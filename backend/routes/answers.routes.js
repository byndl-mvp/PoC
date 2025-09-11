const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { isTradeAssignedToProject } = require('../utils/helpers');

// Save answers with validation
router.post('/:projectId/trades/:tradeId/answers', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    const { answers } = req.body;
    
    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers must be an array' });
    }
    
    const isAssigned = await isTradeAssignedToProject(projectId, tradeId);
    
    const tradeInfo = await query('SELECT code FROM trades WHERE id = $1', [tradeId]);
    const tradeCode = tradeInfo.rows[0]?.code;
    
    if (!isAssigned && tradeCode !== 'INT') {
      console.warn(`[ANSWERS] Trade ${tradeId} not assigned to project ${projectId}`);
      return res.status(403).json({ error: 'Trade not assigned to project' });
    }
    
    // Speichere Antworten mit Annahmen
    const savedAnswers = [];
    for (const answer of answers) {
      // Prüfe ob "unsicher" angegeben wurde
      const isUncertain = answer.answer === 'unsicher' || 
                         answer.answer?.toLowerCase?.() === 'unsicher' ||
                         answer.answer?.toLowerCase?.()?.includes('weiß nicht');
      
      let assumption = answer.assumption || null;
      let finalAnswer = answer.answer;
      
      // Bei Unsicherheit: Schätzung generieren
      if (isUncertain) {
        assumption = 'Nutzer war unsicher - Standardwert angenommen';
        // Hier könnte eine intelligente Schätzung erfolgen
        finalAnswer = 'Standardannahme getroffen';
      }
      
      await query(
        `INSERT INTO answers (project_id, trade_id, question_id, answer_text, assumption)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (project_id, trade_id, question_id)
         DO UPDATE SET answer_text = $4, assumption = $5, updated_at = NOW()`,
        [
          projectId,
          tradeId,
          answer.questionId,
          finalAnswer,
          assumption
        ]
      );
      
      savedAnswers.push({
        questionId: answer.questionId,
        answer: finalAnswer,
        assumption
      });
    }
    
    res.json({ 
      success: true, 
      saved: savedAnswers.length,
      answers: savedAnswers
    });
    
  } catch (err) {
    console.error('Failed to save answers:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
