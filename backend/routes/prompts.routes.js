const express = require('express');
const router = express.Router();
const { query } = require('../db');

// Get all prompts with details
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT p.id, p.name, p.type, p.trade_id,
              t.name as trade_name, t.code as trade_code,
              LENGTH(p.content) as content_length,
              p.updated_at
       FROM prompts p
       LEFT JOIN trades t ON t.id = p.trade_id
       ORDER BY p.type, t.name`
    );
    
    res.json({ 
      prompts: result.rows,
      stats: {
        total: result.rows.length,
        master: result.rows.filter(p => p.type === 'master').length,
        questions: result.rows.filter(p => p.type === 'questions').length,
        lv: result.rows.filter(p => p.type === 'lv').length
      }
    });
    
  } catch (err) {
    console.error('Failed to fetch prompts:', err);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// Get single prompt with content
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT p.*, t.name as trade_name, t.code as trade_code
       FROM prompts p
       LEFT JOIN trades t ON t.id = p.trade_id
       WHERE p.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    res.json(result.rows[0]);
    
  } catch (err) {
    console.error('Failed to fetch prompt:', err);
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
});

module.exports = router;
