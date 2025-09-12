const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { generateQuestions } = require('../services/question.service');
const { llmWithPolicy } = require('../services/llm.service');
const { isTradeAssignedToProject, ensureProjectTrade, getIntelligentQuestionCount, determineProjectComplexity } = require('../utils/helpers');

// Generate adaptive questions for a specific trade
router.post('/:projectId/trades/:tradeId/questions', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    // Hole die Daten aus dem Request Body
    const {
      includeIntakeContext,
      isManuallyAdded: manualFromBody,
      projectDescription: descriptionFromBody,
      projectCategory: categoryFromBody,
      projectBudget: budgetFromBody
    } = req.body;
    // Prüfe Trade-Status (manuell, KI-empfohlen oder automatisch)
    const tradeStatusResult = await query(
      `SELECT is_manual, is_ai_recommended 
       FROM project_trades 
       WHERE project_id = $1 AND trade_id = $2`,
      [projectId, tradeId]
    );
    // NEUER LOG HIER:
    console.log(`[QUESTIONS-ROUTE] Database query for project ${projectId}, trade ${tradeId}:`, tradeStatusResult.rows[0]);   
    
    const tradeStatus = tradeStatusResult.rows[0] || {};
    
    const needsContextQuestion = tradeStatus.is_manual || 
                                 tradeStatus.is_ai_recommended || 
                                 req.body.isManuallyAdded ||
                                 req.body.isAiRecommended; // NEU: Auch KI-empfohlene berücksichtigen
    
    console.log('[QUESTIONS] Trade status:', {
      manual: tradeStatus.is_manual,
      aiRecommended: tradeStatus.is_ai_recommended,
      needsContext: needsContextQuestion
    });
    
    console.log('[DEBUG] Trade needs context question:', needsContextQuestion);
    
    const isAssigned = await isTradeAssignedToProject(projectId, tradeId);
    const tradeInfo = await query('SELECT code, name FROM trades WHERE id = $1', [tradeId]);
    const tradeCode = tradeInfo.rows[0]?.code;
    const tradeName = tradeInfo.rows[0]?.name;
    
    if (!isAssigned && tradeCode !== 'INT') {
      console.log(`[QUESTIONS] Trade ${tradeId} not assigned to project ${projectId}, adding it now`);
      await ensureProjectTrade(projectId, tradeId, 'questions_request');
    }
    
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = projectResult.rows[0];
    
    // Erstelle erweiterten Projektkontext mit BEIDEN Quellen
    const projectContext = {
      category: req.body.projectCategory || project.category,
      subCategory: project.sub_category,
      description: req.body.projectDescription || project.description,
      timeframe: project.timeframe,
      budget: req.body.projectBudget || project.budget,
      projectId: projectId,
      isManuallyAdded: tradeStatus.is_manual || req.body.isManuallyAdded,
      isAiRecommended: tradeStatus.is_ai_recommended || req.body.isAiRecommended
    };
    
    console.log('[DEBUG] projectContext.isManuallyAdded:', projectContext.isManuallyAdded);
    // Lade alle Projekt-Trades für Cross-Check
    const projectTrades = await query(
      `SELECT t.code, t.name FROM trades t 
       JOIN project_trades pt ON t.id = pt.trade_id 
       WHERE pt.project_id = $1`,
      [projectId]
    );

    projectContext.trades = projectTrades.rows; // <-- FÜGE TRADES HINZU!

    const questions = await generateQuestions(tradeId, projectContext);
    
    // NEU - erweitere options um multiSelect und Dependencies:
    for (const question of questions) {
      await query(
        `INSERT INTO questions (project_id, trade_id, question_id, text, type, required, options, depends_on, show_if)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (project_id, trade_id, question_id) 
         DO UPDATE SET text = $4, type = $5, required = $6, options = $7, depends_on = $8, show_if = $9`,
        [
          projectId,
          tradeId,
          question.id,
          question.question || question.text,
          question.multiSelect ? 'multiselect' : (question.type || 'text'),
          question.required !== undefined ? question.required : false,
          question.options ? JSON.stringify({
            values: question.options,
            multiSelect: question.multiSelect || false,
            dependsOn: question.dependsOn || null,
            showIf: question.showIf || null
          }) : null,
          question.dependsOn || null,  // NEU: Abhängigkeit von vorheriger Frage
          question.showIf || null       // NEU: Bedingung für Anzeige
        ]
      );
    }
    
    const intelligentCount = getIntelligentQuestionCount(tradeCode, project, []);
    
    res.json({ 
      questions,
      targetCount: intelligentCount.count,
      actualCount: questions.length,
      completeness: intelligentCount.completeness,
      missingInfo: intelligentCount.missingInfo,
      tradeName: tradeName,
      needsContextQuestion // NEU: Sende Info an Frontend
    });
    
  } catch (err) {
    console.error('Failed to generate questions:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get questions for a trade
router.get('/:projectId/trades/:tradeId/questions', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    
    const isAssigned = await isTradeAssignedToProject(projectId, tradeId);
    
    const tradeInfo = await query('SELECT code FROM trades WHERE id = $1', [tradeId]);
    const tradeCode = tradeInfo.rows[0]?.code;
    
    if (!isAssigned && tradeCode !== 'INT') {
      console.warn(`[QUESTIONS] Trade ${tradeId} not assigned to project ${projectId}`);
      return res.status(403).json({ error: 'Trade not assigned to project' });
    }
    
    const result = await query(
      `SELECT q.*, t.name as trade_name, t.code as trade_code
       FROM questions q
       JOIN trades t ON t.id = q.trade_id
       WHERE q.project_id = $1 AND q.trade_id = $2
       ORDER BY q.question_id`,
      [projectId, tradeId]
    );
    
    const questions = result.rows.map(q => {
      const parsedOptions = q.options ? 
        (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : null;
      
      return {
        ...q,
        options: parsedOptions,
        dependsOn: q.depends_on || null,
        showIf: q.show_if || null
      };
    });
    
    res.json({ 
      questions,
      tradeName: result.rows[0]?.trade_name, 
      tradeCode: result.rows[0]?.trade_code 
    });
    
  } catch (err) {
    console.error('Failed to fetch questions:', err);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Generate adaptive follow-up questions based on context answer
router.post('/:projectId/trades/:tradeId/context-questions', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    const { contextAnswer } = req.body;
    
    const trade = await query('SELECT name, code FROM trades WHERE id = $1', [tradeId]);
    const project = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
    
    if (!contextAnswer) {
      return res.status(400).json({ error: 'Kontextantwort fehlt' });
    }

    // Lade Intake-Daten für besseren Kontext
    const intakeData = await query(
      `SELECT question_text, answer_text 
       FROM intake_responses 
       WHERE project_id = $1`,
      [projectId]
    );
    
    const systemPrompt = `Du bist ein Experte für ${trade.rows[0].name}.
Der Nutzer hat für das Gewerk angegeben: "${contextAnswer}"

PROJEKTKONTEXT:
- Beschreibung: ${project.rows[0].description}
- Kategorie: ${project.rows[0].category}
- Budget: ${project.rows[0].budget}

BEREITS ERFASSTE INFORMATIONEN (nicht erneut fragen!):
${intakeData.rows.map(d => `- ${d.question_text}: ${d.answer_text}`).join('\n')}

Erstelle 10-20 SPEZIFISCHE Folgefragen basierend auf der Kontextantwort.
Die Fragen MÜSSEN sich auf die genannten Arbeiten beziehen.
Vermeide Wiederholungen von bereits erfassten Informationen.

OUTPUT als JSON-Array:
[
  {
    "id": "${trade.rows[0].code}-01",
    "category": "string",
    "question": "Spezifische Frage mit Einheit",
    "explanation": "Erklärung bei Fachbegriffen",
    "type": "text|number|select",
    "required": true/false,
    "unit": "m²/m/Stk",
    "options": null oder ["Option1", "Option2"]
  }
]`;
    
    const userPrompt = `Projekt: ${project.rows[0].description}
Gewählte Arbeiten für ${trade.rows[0].name}: ${contextAnswer}

Erstelle detaillierte Folgefragen für diese spezifischen Arbeiten.
Berücksichtige bereits erfasste Projektinformationen.`;
    
    const response = await llmWithPolicy('questions', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { maxTokens: 4000, temperature: 0.5 });
    
    const cleanedResponse = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const questions = JSON.parse(cleanedResponse);
    
    // Speichere die neuen Fragen
    for (const q of questions) {
      await query(
        `INSERT INTO questions (project_id, trade_id, question_id, text, type, required, options)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (project_id, trade_id, question_id)
         DO UPDATE SET text=$4, type=$5, required=$6, options=$7`,
        [projectId, tradeId, q.id, q.question, q.type || 'text', q.required ?? true, 
         q.options ? JSON.stringify(q.options) : null]
      );
    }
    
    res.json({ questions, count: questions.length });
    
  } catch (err) {
    console.error('Context questions generation failed:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
