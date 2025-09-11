const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { openai, anthropic } = require('../config/llm.config');
const { MODEL_OPENAI, MODEL_ANTHROPIC } = require('../config/llm.config');
const { TRADE_COMPLEXITY } = require('../config/constants');
const { determineProjectComplexity, getIntelligentQuestionCount } = require('../utils/helpers');

// Health Check
router.get('/', (req, res) => {
  res.json({ 
    message: 'BYNDL Backend v4.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    features: [
      'Intelligente Fragenanzahl nach Gewerke-Komplexität',
      'Detaillierte Mengenerfassung',
      'Realistische LV-Generierung',
      'Laienverständliche Fragen',
      'Intelligente Schätzlogik'
    ]
  });
});

// DB Ping
router.get('/dbping', async (req, res) => {
  try {
    const result = await query('SELECT NOW() as time, version() as version');
    res.json({ 
      ok: true, 
      time: result.rows[0].time,
      version: result.rows[0].version 
    });
  } catch (err) {
    console.error('DB ping failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Test OpenAI
router.get('/test/openai', async (req, res) => {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL_OPENAI,
      messages: [{ role: 'user', content: 'Say "OpenAI is working"' }],
      max_completion_tokens: 20
    });
    res.json({ 
      status: 'ok',
      response: response.choices[0].message.content 
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'error',
      error: err.message 
    });
  }
});

// Test Anthropic
router.get('/test/anthropic', async (req, res) => {
  try {
    const response = await anthropic.messages.create({
      model: MODEL_ANTHROPIC,
      max_tokens: 20,
      messages: [{ role: 'user', content: 'Say "Claude is working"' }]
    });
    res.json({ 
      status: 'ok',
      response: response.content[0].text 
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'error',
      error: err.message 
    });
  }
});

// Debug: Project trade details
router.get('/debug/project/:projectId/trades', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const trades = await query(
      `SELECT pt.*, t.code, t.name, pt.created_at,
              COUNT(q.question_id) as question_count,
              COUNT(a.question_id) as answer_count
       FROM project_trades pt
       JOIN trades t ON t.id = pt.trade_id
       LEFT JOIN questions q ON q.project_id = pt.project_id AND q.trade_id = pt.trade_id
       LEFT JOIN answers a ON a.project_id = pt.project_id AND a.trade_id = pt.trade_id
       WHERE pt.project_id = $1
       GROUP BY pt.project_id, pt.trade_id, t.id, t.code, t.name, pt.created_at
       ORDER BY pt.created_at`,
      [projectId]
    );
    
    const project = await query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    res.json({
      project: project.rows[0],
      complexity: determineProjectComplexity(project.rows[0]),
      tradeCount: trades.rows.length,
      trades: trades.rows.map(t => {
        const intelligentCount = getIntelligentQuestionCount(
          t.code, 
          project.rows[0],
          [] // Keine Intake-Antworten im Debug-Modus
        );
        return {
          ...t,
          targetQuestions: intelligentCount.count,
          informationCompleteness: intelligentCount.completeness,
          missingInfo: intelligentCount.missingInfo,
          completeness: t.question_count > 0 
            ? Math.round((t.answer_count / t.question_count) * 100)
            : 0
        };
      })
    });
    
  } catch (err) {
    console.error('Debug failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Debug: List all routes
router.get('/debug/routes', (req, res) => {
  const routes = [];
  req.app._router.stack.forEach(middleware => {
    if (middleware.route) {
      const methods = Object.keys(middleware.route.methods);
      routes.push({
        path: middleware.route.path,
        methods: methods.map(m => m.toUpperCase())
      });
    }
  });
  res.json({ routes });
});

// Health check
router.get('/healthz', (req, res) => {
  res.json({ 
    message: "BYNDL Backend v4.0", 
    status: "running",
    features: {
      intelligentQuestions: true,
      adaptiveQuestionCount: true,
      detailedMeasurements: true,
      realisticPricing: true,
      uncertaintyHandling: true,
      dataValidation: true
    },
    tradeComplexity: Object.keys(TRADE_COMPLEXITY).length + ' trades configured'
  });
});

// Environment info
router.get('/__info', (req, res) => {
  res.json({
    node: process.version,
    version: "4.0",
    env: {
      OPENAI_MODEL: MODEL_OPENAI,
      ANTHROPIC_MODEL: MODEL_ANTHROPIC,
      DATABASE_URL: process.env.DATABASE_URL ? "✔️ gesetzt" : "❌ fehlt",
      JWT_SECRET: process.env.JWT_SECRET ? "✔️ gesetzt" : "❌ fehlt"
    },
    limits: {
      detect: "3000 tokens",
      questions: "8000 tokens",
      lv: "10000 tokens",
      intake: "6000 tokens",
      validation: "3000 tokens"
    },
    features: {
      tradeBasedQuestions: "8-40 Fragen je nach Gewerk",
      measurementFocus: "Explizite Mengenerfassung",
      uncertaintyHandling: "Intelligente Schätzungen",
      dataQuality: "Tracking von Datenquellen",
      realisticPricing: "Marktpreise 2024/2025"
    }
  });
});

module.exports = router;
