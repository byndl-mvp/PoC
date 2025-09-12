const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { generateQuestions } = require('../services/question.service');
const { llmWithPolicy } = require('../services/llm.service');

// Helper functions aus den Services importieren
const { ensureProjectTrade, getIntelligentQuestionCount, getAvailableTrades, getPromptByName, getTradeQuestionCount, determineProjectComplexity } = require('../utils/helpers');

// Generate Intake Questions
router.post('/:projectId/intake/questions', async (req, res) => {
  try {
    const { projectId } = req.params;

    const projectResult = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = projectResult.rows[0];

    const intTrade = await query(`SELECT id FROM trades WHERE code = 'INT' LIMIT 1`);
    if (intTrade.rows.length === 0) {
      return res.status(500).json({ error: 'INT trade missing in DB' });
    }
    const tradeId = intTrade.rows[0].id;
    
    await ensureProjectTrade(projectId, tradeId, 'intake');
    
    // NEU: Lade erkannte Gewerke für intelligente Intake-Fragen
    const detectedTrades = await query(
      `SELECT t.code, t.name 
       FROM trades t 
       JOIN project_trades pt ON t.id = pt.trade_id 
       WHERE pt.project_id = $1 AND t.code != 'INT'`,
      [projectId]
    );

    let questions;
    try {
      questions = await generateQuestions(tradeId, {
        category: project.category,
        subCategory: project.sub_category,
        description: project.description,
        timeframe: project.timeframe,
        budget: project.budget,
        detectedTrades: detectedTrades.rows // NEU: Übergebe erkannte Gewerke für intelligente Fragenauswahl
      });
    } catch (err) {
      
      console.error('[INTAKE] generateQuestions error:', err);
      // Nicht leeres Array zurückgeben, sondern Fehler werfen!
      return res.status(500).json({ 
        error: 'Fehler beim Generieren der Intake-Fragen',
        details: err.message 
      });
    }
    
    // Parse questions wenn es ein String ist
    if (typeof questions === 'string') {
      try {
        questions = JSON.parse(questions);
      } catch (e) {
        console.error('[INTAKE] Failed to parse questions:', e);
        return res.status(500).json({ error: 'Fehler beim Generieren der Fragen' });
      }
    }

    // Stelle sicher dass es ein Array ist
    if (!Array.isArray(questions)) {
      console.error('[INTAKE] Questions is not an array:', typeof questions);
      return res.status(500).json({ error: 'Fehler beim Generieren der Fragen' });
    }
    
    // Speichere Fragen mit erweiterten Feldern
    let saved = 0;
    for (const q of questions) {
      // ZUERST in intake_questions speichern für spätere Verwendung
      const intakeQuestionResult = await query(
        `INSERT INTO intake_questions (question_text, question_type, sort_order, is_required, options)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          q.question || q.text,
          q.type || 'text',
          saved + 1,  // sort_order basierend auf Position
          q.required !== undefined ? q.required : true,
          q.options ? JSON.stringify(q.options) : null
        ]
      );
      
      const intakeQuestionId = intakeQuestionResult.rows[0].id;
      
      // DANN in questions speichern mit Referenz zur intake_question_id
      await query(
        `INSERT INTO questions (project_id, trade_id, question_id, text, type, required, options)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (project_id, trade_id, question_id)
         DO UPDATE SET text=$4, type=$5, required=$6, options=$7`,
        [
          projectId,
          tradeId,
          `INT-${intakeQuestionId}`,  // Verwende intake_questions.id als Referenz
          q.question || q.text,
          q.type || 'text',
          q.required !== undefined ? q.required : true,
          q.options ? JSON.stringify(q.options) : null
        ]
      );
      saved++;
    }
    
    // Berechne die intelligente Fragenanzahl für die Response
    const intelligentCount = getIntelligentQuestionCount('INT', {
      category: project.category,
      description: project.description,
      budget: project.budget
    }, []);

    // Hole die echten IDs aus der Datenbank
    const savedQuestions = await query(
      `SELECT question_id FROM questions 
       WHERE project_id = $1 AND trade_id = $2 
       ORDER BY question_id`,
      [projectId, tradeId]
    );

    // Mappe die echten IDs zu den Fragen
    const questionsWithIds = questions.map((q, idx) => ({
      ...q,
      id: savedQuestions.rows[idx]?.question_id || `INT-${idx + 1}`
    }));

    res.json({
      ok: true,
      tradeCode: 'INT',
      questions: questionsWithIds,  // <-- HIER: questionsWithIds statt questions
      saved,
      targetCount: intelligentCount.count,
      completeness: intelligentCount.completeness
    });
    
  } catch (err) {
    console.error('intake/questions failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Intake Summary
router.get('/:projectId/intake/summary', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = (await query('SELECT * FROM projects WHERE id=$1', [projectId])).rows[0];
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const intTrade = (await query(`SELECT id FROM trades WHERE code='INT'`)).rows[0];
    if (!intTrade) return res.status(500).json({ error: 'INT trade missing' });

    const answers = (await query(
      `SELECT q.text as question, a.answer_text as answer
       FROM answers a
       JOIN questions q ON q.project_id = a.project_id 
         AND q.trade_id = a.trade_id 
         AND q.question_id = a.question_id
       WHERE a.project_id=$1 AND a.trade_id=$2
       ORDER BY q.question_id`,
      [projectId, intTrade.id]
    )).rows;

    const availableTrades = await getAvailableTrades();
    const validCodes = availableTrades.map(t => t.code).filter(c => c !== 'INT');

    const master = await getPromptByName('master');

    const system = `${master}

Analysiere die Intake-Antworten und empfehle die benötigten Gewerke.

VERFÜGBARE GEWERKE (NUR DIESE für "trades"):
${availableTrades.filter(t => t.code !== 'INT').map(t => `- ${t.code}: ${t.name}`).join('\n')}

OUTPUT (NUR valides JSON):
{
  "recommendations": ["Empfehlungen für zusätzliche Experten"],
  "risks": ["Identifizierte Projektrisiken"],
  "missingInfo": ["Fehlende wichtige Informationen"],
  "trades": [
    {
      "code": "SAN",
      "reason": "Begründung warum dieses Gewerk benötigt wird",
      "priority": "hoch|mittel|niedrig",
      "estimatedQuestions": 25
    }
  ],
  "projectCharacteristics": {
    "complexity": "SEHR_HOCH|HOCH|MITTEL|NIEDRIG|EINFACH",
    "estimatedDuration": "4-6 Wochen",
    "criticalPath": ["SAN", "ELEKT"]
  }
}`;

    const user = `Projekt:
${JSON.stringify(project, null, 2)}

Intake-Antworten (${answers.length}):
${answers.map(a => `- ${a.question}: ${a.answer}`).join('\n')}

Analysiere und empfehle benötigte Gewerke.`;

    const raw = await llmWithPolicy('summary', [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ], { maxTokens: 4000, temperature: 0.3, jsonMode: true });

    const cleanedResponse = raw
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const summary = JSON.parse(cleanedResponse);

    // Filtere und validiere Trades
    if (summary.trades && Array.isArray(summary.trades)) {
      summary.trades = summary.trades.filter(t => validCodes.includes(t.code));
      
      // Füge geschätzte Fragenanzahl hinzu
      summary.trades = summary.trades.map(t => ({
        ...t,
        estimatedQuestions: t.estimatedQuestions || 
          getTradeQuestionCount(t.code, summary.projectCharacteristics?.complexity || 'MITTEL')
      }));
    }

    res.json({ ok: true, summary });
  } catch (err) {
    console.error('intake/summary failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Save intake answers specifically
router.post('/:projectId/intake/answers', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { answers } = req.body;
    
    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers must be an array' });
    }
    
    const intTrade = await query(`SELECT id FROM trades WHERE code = 'INT' LIMIT 1`);
    if (intTrade.rows.length === 0) {
      return res.status(500).json({ error: 'INT trade missing' });
    }
    const tradeId = intTrade.rows[0].id;
    
    const savedAnswers = [];
    
    for (const answer of answers) {
      // Hole den Fragetext aus questions
      const questionResult = await query(
        'SELECT text FROM questions WHERE project_id = $1 AND trade_id = $2 AND question_id = $3',
        [projectId, tradeId, answer.questionId]
      );
      
      const questionText = questionResult.rows[0]?.text || '';
      
      // Speichere in intake_responses
      await query(
        `INSERT INTO intake_responses (project_id, question_id, question_text, answer_text)
         VALUES ($1, $2, $3, $4)`,
        [
          projectId,
          parseInt(answer.questionId.replace('INT-', '')),  // Extrahiere die intake_questions.id
          questionText,
          answer.answer
        ]
      );
      
      // Speichere auch in answers für Kompatibilität
      await query(
        `INSERT INTO answers (project_id, trade_id, question_id, answer_text)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (project_id, trade_id, question_id)
         DO UPDATE SET answer_text = $4, updated_at = NOW()`,
        [
          projectId,
          tradeId,
          answer.questionId,
          answer.answer
        ]
      );
      
      savedAnswers.push({
        questionId: answer.questionId,
        answer: answer.answer
      });
    }
    
    res.json({ 
      success: true, 
      saved: savedAnswers.length,
      answers: savedAnswers
    });
    
  } catch (err) {
    console.error('Failed to save intake answers:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
