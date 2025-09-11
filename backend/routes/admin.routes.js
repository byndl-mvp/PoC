const express = require('express');
const router = express.Router();
const { query } = require('../db');
const crypto = require('crypto');

// Simple token storage (in production, use Redis or database)
const activeSessions = new Map();

// Generate random token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Simple middleware for admin routes
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  
  const token = auth.slice(7);
  
  // Check if token exists and is valid
  const session = activeSessions.get(token);
  
  if (!session) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
  
  // Check if token is not too old (24 hours)
  const dayInMs = 24 * 60 * 60 * 1000;
  if (Date.now() - session.createdAt > dayInMs) {
    activeSessions.delete(token);
    return res.status(403).json({ error: 'Token expired' });
  }
  
  if (session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  req.admin = session;
  next();
}

// Simple admin authentication without bcrypt
router.post('/auth', async (req, res) => {
  try {
    const { password } = req.body;
    
    // Use environment variable for admin password
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeThisPassword2024!';

    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    // Simple password check
    if (password !== ADMIN_PASSWORD) {
      console.warn(`Failed admin login attempt from IP: ${req.ip}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate simple token
    const token = generateToken();
    
    // Store token with metadata
    activeSessions.set(token, {
      role: 'admin',
      createdAt: Date.now(),
      ip: req.ip
    });

    // Clean up old tokens (older than 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    for (const [key, value] of activeSessions.entries()) {
      if (value.createdAt < oneDayAgo) {
        activeSessions.delete(key);
      }
    }

    console.log(`Successful admin login from IP: ${req.ip}`);

    res.json({ 
      token,
      message: 'Login successful'
    });
  } catch (err) {
    console.error('Admin auth failed:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Logout endpoint
router.post('/logout', requireAdmin, async (req, res) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    activeSessions.delete(token);
  }
  res.json({ message: 'Logout successful' });
});

// Get all prompts with full content for editing
router.get('/prompts/full', requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, t.name as trade_name, t.code as trade_code 
       FROM prompts p 
       LEFT JOIN trades t ON t.id = p.trade_id 
       ORDER BY p.type, t.sort_order, p.name`
    );
    
    res.json({ prompts: result.rows });
  } catch (err) {
    console.error('Failed to fetch prompts:', err);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// Update prompt content
router.put('/prompts/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, name } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = await query(
      `UPDATE prompts 
       SET content = $1, name = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [content, name || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    res.json({ prompt: result.rows[0] });
  } catch (err) {
    console.error('Failed to update prompt:', err);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

// Create new prompt
router.post('/prompts', requireAdmin, async (req, res) => {
  try {
    const { name, type, trade_id, content } = req.body;
    
    if (!name || !type || !content) {
      return res.status(400).json({ error: 'Name, type and content are required' });
    }

    const result = await query(
      `INSERT INTO prompts (name, type, trade_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, type, trade_id || null, content]
    );

    res.json({ prompt: result.rows[0] });
  } catch (err) {
    console.error('Failed to create prompt:', err);
    res.status(500).json({ error: 'Failed to create prompt' });
  }
});

// Delete prompt
router.delete('/prompts/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM prompts WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    res.json({ message: 'Prompt deleted successfully' });
  } catch (err) {
    console.error('Failed to delete prompt:', err);
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
});

// Get all LVs with quality metrics - FIXED CAST
router.get('/lvs', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await query(
      `SELECT 
        l.*,
        t.name as trade_name,
        t.code as trade_code,
        p.description as project_description,
        p.budget,
        p.category,
        CASE 
          WHEN l.content->>'totalSum' IS NOT NULL 
          THEN (l.content->>'totalSum')::numeric 
          ELSE NULL 
        END as total_sum,
        CASE 
          WHEN l.content->'positions' IS NOT NULL 
          THEN jsonb_array_length(l.content->'positions') 
          ELSE 0 
        END as position_count
       FROM lvs l
       JOIN trades t ON t.id = l.trade_id
       JOIN projects p ON p.id = l.project_id
       ORDER BY l.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    // Calculate quality metrics with error handling
    const lvs = result.rows.map(lv => {
      try {
        const content = typeof lv.content === 'string' ? JSON.parse(lv.content) : lv.content;
        let qualityScore = 100;
        const issues = [];
        
        // Check for common issues
        if (!content || !content.positions || content.positions.length === 0) {
          qualityScore -= 50;
          issues.push('Keine Positionen');
        }
        
        if (content && content.positions && Array.isArray(content.positions)) {
          const invalidPrices = content.positions.filter(p => !p.unitPrice || p.unitPrice <= 0);
          if (invalidPrices.length > 0) {
            qualityScore -= 20;
            issues.push(`${invalidPrices.length} Positionen ohne Preis`);
          }
          
          const missingDescriptions = content.positions.filter(p => !p.description);
          if (missingDescriptions.length > 0) {
            qualityScore -= 10;
            issues.push(`${missingDescriptions.length} Positionen ohne Beschreibung`);
          }
        }
        
        return {
          ...lv,
          content,
          qualityScore: Math.max(0, qualityScore),
          issues
        };
      } catch (parseError) {
        console.error(`Error parsing LV content for ID ${lv.project_id}-${lv.trade_id}:`, parseError);
        return {
          ...lv,
          content: lv.content,
          qualityScore: 0,
          issues: ['Fehler beim Parsen des Inhalts']
        };
      }
    });

    res.json({ lvs });
  } catch (err) {
    console.error('Failed to fetch LVs:', err);
    res.status(500).json({ error: 'Failed to fetch LVs' });
  }
});

// Update LV content (for price corrections)
router.put('/lvs/:projectId/:tradeId', requireAdmin, async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    const { content } = req.body;
    
    if (!content || typeof content !== 'object') {
      return res.status(400).json({ error: 'Valid content object is required' });
    }
    
    const result = await query(
      `UPDATE lvs 
       SET content = $1::jsonb, updated_at = NOW()
       WHERE project_id = $2 AND trade_id = $3
       RETURNING *`,
      [JSON.stringify(content), projectId, tradeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'LV not found' });
    }

    res.json({ lv: result.rows[0] });
  } catch (err) {
    console.error('Failed to update LV:', err);
    res.status(500).json({ error: 'Failed to update LV' });
  }
});

// Get detailed project analytics - FIXED CASTS
router.get('/analytics', requireAdmin, async (req, res) => {
  try {
    // Project statistics
    const projectStats = await query(
      `SELECT 
        COUNT(*) as total_projects,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as last_week,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as last_month,
        AVG(CASE WHEN budget IS NOT NULL THEN budget END) as avg_budget
       FROM projects`
    );
    
    // Trade usage statistics - FIXED CAST
    const tradeStats = await query(`
      SELECT 
        t.code,
        t.name,
        COUNT(DISTINCT pt.project_id) as usage_count,
        COUNT(DISTINCT l.id) as lv_count,
        AVG(
          CASE 
            WHEN l.content->>'totalSum' IS NOT NULL 
            THEN (l.content->>'totalSum')::numeric 
            ELSE NULL 
          END
        ) as avg_lv_value
      FROM trades t
      LEFT JOIN project_trades pt ON pt.trade_id = t.id
      LEFT JOIN lvs l ON l.trade_id = t.id
      GROUP BY t.id, t.code, t.name
      ORDER BY usage_count DESC
    `);

    // Prompt effectiveness - FIXED CASTS
    const promptStats = await query(`
      SELECT 
        p.id,
        p.name,
        p.type,
        t.name as trade_name,
        COUNT(l.id) as usage_count,
        AVG(
          CASE 
            WHEN l.content->>'totalSum' IS NOT NULL 
            THEN (l.content->>'totalSum')::numeric 
            ELSE NULL 
          END
        ) as avg_lv_value,
        AVG(
          CASE 
            WHEN l.content->'positions' IS NOT NULL 
            THEN jsonb_array_length(l.content->'positions') 
            ELSE 0 
          END
        ) as avg_position_count
      FROM prompts p
      LEFT JOIN trades t ON t.id = p.trade_id
      LEFT JOIN lvs l ON l.trade_id = p.trade_id
      WHERE p.type IN ('questions', 'lv')
      GROUP BY p.id, p.name, p.type, t.name
      ORDER BY usage_count DESC
    `);

    // Question/Answer completion rates
    const completionStats = await query(`
      SELECT 
        t.name as trade_name,
        COUNT(DISTINCT q.question_id) as total_questions,
        COUNT(DISTINCT a.question_id) as answered_questions,
        CASE 
          WHEN COUNT(DISTINCT q.question_id) > 0 
          THEN ROUND((COUNT(DISTINCT a.question_id)::float / COUNT(DISTINCT q.question_id) * 100)::numeric, 2)
          ELSE 0 
        END as completion_rate
      FROM trades t
      LEFT JOIN questions q ON q.trade_id = t.id
      LEFT JOIN answers a ON a.trade_id = t.id AND a.question_id = q.question_id
      GROUP BY t.id, t.name
      ORDER BY completion_rate DESC
    `);

    res.json({
      projects: projectStats.rows[0],
      trades: tradeStats.rows,
      prompts: promptStats.rows,
      completion: completionStats.rows
    });
  } catch (err) {
    console.error('Failed to fetch analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get all projects with full details
router.get('/projects/detailed', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await query(
      `SELECT 
        p.*,
        COUNT(DISTINCT pt.trade_id) as trade_count,
        COUNT(DISTINCT q.question_id) as question_count,
        COUNT(DISTINCT a.question_id) as answer_count,
        COUNT(DISTINCT l.id) as lv_count,
        STRING_AGG(DISTINCT t.name, ', ' ORDER BY t.name) as trade_names
       FROM projects p
       LEFT JOIN project_trades pt ON pt.project_id = p.id
       LEFT JOIN trades t ON t.id = pt.trade_id
       LEFT JOIN questions q ON q.project_id = p.id
       LEFT JOIN answers a ON a.project_id = p.id
       LEFT JOIN lvs l ON l.project_id = p.id
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({ projects: result.rows });
  } catch (err) {
    console.error('Failed to fetch projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get specific project with all Q&A
router.get('/projects/:id/full', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get project
    const projectResult = await query('SELECT * FROM projects WHERE id = $1', [id]);
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectResult.rows[0];

    // Get trades with Q&A
    const tradesResult = await query(
      `SELECT 
        t.*,
        pt.created_at as assigned_at
       FROM trades t
       JOIN project_trades pt ON pt.trade_id = t.id
       WHERE pt.project_id = $1
       ORDER BY t.sort_order`,
      [id]
    );

    // Get all questions and answers (bestehender Code)
    const qaResult = await query(
      `SELECT 
        q.*,
        a.answer_text,
        a.assumption,
        t.name as trade_name,
        t.code as trade_code
       FROM questions q
       LEFT JOIN answers a ON a.project_id = q.project_id 
         AND a.trade_id = q.trade_id 
         AND a.question_id = q.question_id
       JOIN trades t ON t.id = q.trade_id
       WHERE q.project_id = $1
       ORDER BY t.sort_order, q.question_id`,
      [id]
    );

    // NEU: Get Intake-Fragen aus intake_responses
    const intakeResult = await query(
      `SELECT 
        question_text,
        answer_text,
        created_at
       FROM intake_responses
       WHERE project_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    // NEU: Get Gewerke-Antworten mit Fragen aus der questions Tabelle
    const answersResult = await query(
      `SELECT 
        t.name as trade_name,
        t.code as trade_code,
        q.text as question_text,
        a.answer_text,
        a.assumption,
        a.created_at
       FROM answers a
       JOIN trades t ON t.id = a.trade_id
       LEFT JOIN questions q ON q.project_id = a.project_id 
         AND q.trade_id = a.trade_id 
         AND q.question_id = a.question_id
       WHERE a.project_id = $1
       ORDER BY t.sort_order, a.created_at`,
      [id]
    );

    // Get LVs
    const lvsResult = await query(
      `SELECT 
        l.*,
        t.name as trade_name,
        t.code as trade_code
       FROM lvs l
       JOIN trades t ON t.id = l.trade_id
       WHERE l.project_id = $1`,
      [id]
    );

    res.json({
      project,
      trades: tradesResult.rows,
      questionsAnswers: qaResult.rows,  // Alt (wahrscheinlich leer)
      intakeQuestions: intakeResult.rows,  // NEU
      tradeAnswers: answersResult.rows,    // NEU
      totalQuestions: intakeResult.rows.length + answersResult.rows.length,  // NEU
      lvs: lvsResult.rows.map(lv => {
        try {
          return {
            ...lv,
            content: typeof lv.content === 'string' ? JSON.parse(lv.content) : lv.content
          };
        } catch (e) {
          console.error(`Error parsing LV content for project ${lv.project_id}, trade ${lv.trade_id}:`, e);
          return lv;
        }
      })
    });
    
  } catch (err) {
    console.error('Failed to fetch project details:', err);
    res.status(500).json({ error: 'Failed to fetch project details' });
  }
});

// Health check endpoint
router.get('/health', requireAdmin, async (req, res) => {
  try {
    // Check database connection
    await query('SELECT 1');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      sessions: activeSessions.size
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database connection failed'
    });
  }
});

// Clean up expired tokens periodically (every hour)
setInterval(() => {
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  let cleaned = 0;
  
  for (const [token, session] of activeSessions.entries()) {
    if (session.createdAt < oneDayAgo) {
      activeSessions.delete(token);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired admin sessions`);
  }
}, 60 * 60 * 1000); // Run every hour

module.exports = router;
