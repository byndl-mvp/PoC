const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { getAvailableTrades } = require('../utils/helpers');
const { TRADE_COMPLEXITY, DEFAULT_COMPLEXITY } = require('../config/constants');

// Get all trades
router.get('/', async (req, res) => {
  try {
    const trades = await getAvailableTrades();
    
    // Füge Komplexitätsinformationen hinzu
    const tradesWithComplexity = trades.map(trade => ({
      ...trade,
      complexity: TRADE_COMPLEXITY[trade.code] || DEFAULT_COMPLEXITY
    }));
    
    res.json(tradesWithComplexity);
  } catch (err) {
    console.error('Failed to fetch trades:', err);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// Confirm trades for project
router.post('/:projectId/trades/confirm', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { confirmedTrades, manuallyAddedTrades = [], aiRecommendedTrades = [], isAdditional } = req.body;
    
    if (!Array.isArray(confirmedTrades) || confirmedTrades.length === 0) {
      return res.status(400).json({ error: 'Keine Gewerke ausgewählt' });
    }
    
    // Start transaction for data consistency
    await query('BEGIN');
    
    try {
      const intTradeResult = await query(`SELECT id FROM trades WHERE code = 'INT'`);
      const intTradeId = intTradeResult.rows[0]?.id;
      
      // Bei zusätzlichen Gewerken: Nicht löschen
      if (!isAdditional) {
        // CLEANUP: Stelle sicher, dass ALLE abhängigen Daten gelöscht werden
        const allTradeIds = await query(
          'SELECT DISTINCT trade_id FROM project_trades WHERE project_id = $1',
          [projectId]
        );
        
        const existingTradeIds = allTradeIds.rows.map(r => r.trade_id);
        const toDelete = existingTradeIds.filter(id => 
          id !== intTradeId && !confirmedTrades.includes(id)
        );
        
        // Lösche für ALLE nicht-bestätigten Trades
        if (toDelete.length > 0) {
          await query('DELETE FROM questions WHERE project_id = $1 AND trade_id = ANY($2::int[])', 
            [projectId, toDelete]);
          await query('DELETE FROM answers WHERE project_id = $1 AND trade_id = ANY($2::int[])', 
            [projectId, toDelete]);
          await query('DELETE FROM lvs WHERE project_id = $1 AND trade_id = ANY($2::int[])', 
            [projectId, toDelete]);
        }
        
        // DANN die normalen DELETE Statements
        // 1. Lösche questions (abhängig von project_trades)
        await query(
          `DELETE FROM questions 
           WHERE project_id = $1 
           AND trade_id != $2
           AND trade_id NOT IN (SELECT unnest($3::int[]))`,
          [projectId, intTradeId || -1, confirmedTrades]
        );
        
        // 2. Lösche answers
        await query(
          `DELETE FROM answers 
           WHERE project_id = $1 
           AND trade_id != $2 
           AND trade_id NOT IN (SELECT unnest($3::int[]))`,
          [projectId, intTradeId || -1, confirmedTrades]
        );
        
        // 3. Lösche lvs falls vorhanden
        await query(
          `DELETE FROM lvs 
           WHERE project_id = $1 
           AND trade_id NOT IN (SELECT unnest($2::int[]))`,
          [projectId, confirmedTrades]
        );
        
        // 4. ZULETZT: Lösche project_trades
        await query(
          `DELETE FROM project_trades 
           WHERE project_id = $1 
           AND trade_id != $2`,
          [projectId, intTradeId || -1]
        );
      }
      
      // Füge bestätigte Trades hinzu
      if (isAdditional) {
        // Bei zusätzlichen Gewerken nur neue hinzufügen
        const existing = await query('SELECT trade_id FROM project_trades WHERE project_id = $1', [projectId]);
        const existingIds = existing.rows.map(r => r.trade_id);
        const newTrades = confirmedTrades.filter(id => !existingIds.includes(id));
        
        for (const tradeId of newTrades) {
          const isManual = manuallyAddedTrades.includes(tradeId);
          const isAiRecommended = aiRecommendedTrades.includes(tradeId);
          const needsContextQuestion = isManual || isAiRecommended;
          
          await query(
            `INSERT INTO project_trades (project_id, trade_id, is_manual, is_ai_recommended)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (project_id, trade_id) 
             DO UPDATE SET 
               is_manual = EXCLUDED.is_manual, 
               is_ai_recommended = EXCLUDED.is_ai_recommended`,
            [projectId, tradeId, needsContextQuestion, isAiRecommended]
          );
        }
      } else {
        // Normale Bestätigung: Alle hinzufügen
        for (const tradeId of confirmedTrades) {
          const isManual = manuallyAddedTrades.includes(tradeId);
          const isAiRecommended = aiRecommendedTrades.includes(tradeId);
          const needsContextQuestion = isManual || isAiRecommended;
          
          await query(
            `INSERT INTO project_trades (project_id, trade_id, is_manual, is_ai_recommended)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (project_id, trade_id) 
             DO UPDATE SET is_manual = $3, is_ai_recommended = $4`,
            [projectId, tradeId, needsContextQuestion, isAiRecommended]
          );
          
          console.log(`[TRADES] Added trade ${tradeId}: manual=${needsContextQuestion}, AI=${isAiRecommended}`);
        }
      }
      
      await query('COMMIT');
      
      console.log(`[TRADES] User confirmed ${confirmedTrades.length} trades for project ${projectId}`);
      
      res.json({ 
        success: true, 
        confirmedCount: confirmedTrades.length,
        message: 'Gewerke erfolgreich bestätigt'
      });
      
    } catch (innerErr) {
      await query('ROLLBACK');
      throw innerErr;
    }
    
  } catch (err) {
    console.error('Failed to confirm trades:', err);
    res.status(500).json({ 
      error: 'Fehler beim Bestätigen der Gewerke',
      details: err.message 
    });
  }
});

// Add single trade to project (for additional trades)
router.post('/:projectId/trades/add-single', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { tradeId, isAdditional } = req.body;
    
    // Prüfe ob Trade bereits existiert
    const existing = await query(
      'SELECT * FROM project_trades WHERE project_id = $1 AND trade_id = $2',
      [projectId, tradeId]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Gewerk bereits vorhanden' });
    }
    
    // Füge Trade hinzu mit additional flag
    await query(
      `INSERT INTO project_trades (project_id, trade_id, is_manual, is_additional)
       VALUES ($1, $2, $3, $4)`,
      [projectId, tradeId, true, isAdditional || false]
    );
    
    res.json({ success: true });
    
  } catch (err) {
    console.error('Error adding single trade:', err);
    res.status(500).json({ error: 'Fehler beim Hinzufügen des Gewerks' });
  }
});

module.exports = router;
