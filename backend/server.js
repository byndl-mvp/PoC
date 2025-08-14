/*
 * BYNDL Proof of Concept – Backend
 *
 * This file sets up an Express server with several REST endpoints to support the
 * BYNDL PoC. The service allows users to create projects, detect trades
 * (Gewerke), collect answers to a dynamically generated question catalogue,
 * generate VOB‑compliant bills of quantities (Leistungsverzeichnisse) and
 * retrieve aggregated results. All prompts are read from the `../prompts`
 * directory. The code has been written to be modular and easy to extend.
 *
 * IMPORTANT: At runtime you will need to install the dependencies listed in
 * package.json (express, cors, pg, dotenv, jsonwebtoken, bcryptjs, etc.) and
 * provide the appropriate environment variables in a `.env` file. See
 * README.md for guidance. In this environment the packages are not installed
 * by default, so the server will not run until you perform `npm install`.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ---------------------------------------------------------------------------
// Database setup
//
// All data related to projects, trades, questions, answers and LVs are stored
// in a PostgreSQL database. The connection details are expected to be
// provided via the DATABASE_URL environment variable. Using a pool ensures
// connections are reused efficiently. See `db/schema.sql` for the schema.

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Helper functions
//
// The following helpers abstract away some common functionality such as
// reading prompts from disk, detecting trades based on user input, generating
// questions and LVs via AI, and authenticating admin users.

/**
 * Load a prompt file from the prompts directory.
 *
 * @param {string} filename Name of the prompt file to load
 * @returns {string} Contents of the prompt file
 */
function loadPrompt(filename) {
  const promptPath = path.join(__dirname, '..', 'prompts', filename);
  try {
    return fs.readFileSync(promptPath, 'utf8');
  } catch (err) {
    console.error(`Error reading prompt file ${filename}:`, err);
    throw new Error(`Prompt file not found: ${filename}`);
  }
}

/**
 * Detect the list of trades (Gewerke) required for a project based on the
 * project's description and category. This function uses a master prompt to
 * instruct the AI to return a comma‑separated list of trade identifiers. In
 * production the call to the AI service would be asynchronous; here we
 * simulate the behaviour with a placeholder implementation to keep the PoC
 * runnable without API keys.
 *
 * @param {Object} project The project object containing category, subCategory
 *                         and description fields.
 * @returns {Promise<Array<{ name: string }>>} Array of trade objects
 */
async function detectTrades(project) {
  // Read master prompt from the prompts directory. The master prompt should
  // contain instructions for the model to analyse the project description and
  // return the relevant trades. It is up to the user to populate this file.
  const masterPrompt = loadPrompt('master_prompt.txt');
  const input = `${masterPrompt}\n\nCategory: ${project.category} - ${project.subCategory}\nDescription: ${project.description}`;

  // Placeholder: In the real implementation we would call OpenAI or Claude here.
  // For this PoC we simply return a fixed set of trades based on keywords.
  const lower = project.description.toLowerCase();
  const trades = [];
  if (lower.includes('bad') || lower.includes('sanitär')) trades.push({ name: 'sanitaer' });
  if (lower.includes('elektro')) trades.push({ name: 'elektro' });
  if (lower.includes('maler')) trades.push({ name: 'maler' });
  if (lower.includes('heizung')) trades.push({ name: 'heizung' });
  // Always include at least one trade to avoid empty results
  if (trades.length === 0) trades.push({ name: 'allgemein' });
  return trades;
}

/**
 * Generate a question catalogue for a specific trade. The prompt for the
 * questions is loaded from the prompts folder (e.g. `questions-sanitaer.txt`).
 * The model should return a structured list of questions. In this PoC we
 * simulate by splitting the prompt file into lines beginning with numbers.
 *
 * @param {string} tradeName Name of the trade (e.g. "sanitaer")
 * @returns {Promise<Array<{ id: string, text: string }>>}
 */
async function generateQuestions(tradeName) {
  const filename = `questions-${tradeName}.txt`;
  const promptContent = loadPrompt(filename);
  const lines = promptContent.split(/\r?\n/);
  const questions = [];
  lines.forEach((line, index) => {
    const match = line.match(/^\s*(\d+)[\.:\)]\s*(.+)$/);
    if (match) {
      questions.push({ id: `${tradeName}-${match[1]}`, text: match[2].trim() });
    }
  });
  // If no numbered lines are found, treat every non‑empty line as a question
  if (questions.length === 0) {
    lines.filter(l => l.trim()).forEach((l, idx) => {
      questions.push({ id: `${tradeName}-${idx + 1}`, text: l.trim() });
    });
  }
  return questions;
}

/**
 * Generate a Leistungsverzeichnis (LV) for a given trade using the answers
 * provided by the user. The LV prompt is loaded from the prompts directory.
 * In production this would call the OpenAI API or another LLM; here we
 * simulate by returning a placeholder text.
 *
 * @param {string} tradeName Name of the trade
 * @param {Array<{ question: string, answer: string, assumption?: string }>} answers
 * @returns {Promise<string>} A string representation of the LV for this trade
 */
async function generateLV(tradeName, answers) {
  const filename = `lv-${tradeName}.txt`;
  const promptTemplate = loadPrompt(filename);
  const answerSummary = answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n');
  const input = `${promptTemplate}\n\n${answerSummary}`;
  // Placeholder: simulate AI LV generation
  const lines = answers.map((a, idx) => {
    return `${idx + 1}. ${a.question} – Menge: 1 Stk., Einheit: Stk., Preis: 100.00 EUR`;
  });
  return lines.join('\n');
}

/**
 * Authenticate admin user. Reads user from database and compares password
 * using bcrypt. Returns a signed JWT if successful.
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ token: string }|null>}
 */
async function authenticateAdmin(username, password) {
  const res = await query('SELECT * FROM users WHERE username = $1', [username]);
  if (res.rows.length === 0) return null;
  const user = res.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;
  const payload = { userId: user.id, username: user.username };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
  return { token };
}

/**
 * Middleware to protect admin routes.
 */
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'Authorization header missing' });
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
}

// ---------------------------------------------------------------------------
// Express app setup

const app = express();
const allowedOrigins = ['https://byndl-poc.netlify.app', 'https://byndl.de'];
app.use(require('cors')({ origin: allowedOrigins }));
app.use(express.json());

// ===== neue Trades-Route =====
app.get('/api/trades', async (req, res) => {
  try {
    const result = await query(`
      SELECT id, code, name
      FROM trades
      ORDER BY id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch trades:', err);
    res.status(500).json({ message: 'Failed to fetch trades' });
  }
});
// ===== Ende neue Trades-Route =====

app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true });
});

app.use(bodyParser.json());

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'BYNDL backend is up and running' });
});

// DB-Verbindungs-Test
app.get('/api/dbping', async (req, res) => {
  try {
    const r = await query('SELECT 1 AS ok');
    res.json({ ok: true, value: r.rows[0].ok });
  } catch (e) {
    console.error('DB ping fehlgeschlagen:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});
// -------------------------------------------------------------
// BYNDL API: Trades liefern (für Frontend & Tests)
// -------------------------------------------------------------
app.get('/api/trades', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, code, name FROM trades ORDER BY id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch trades:', err);
    res.status(500).json({ message: 'Failed to fetch trades' });
  }
});

app.get('/trades', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, code, name FROM trades ORDER BY id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch trades (alias):', err);
    res.status(500).json({ message: 'Failed to fetch trades' });
  }
});
// ----- END trades routes -----  

// Create a new project
app.post('/api/project', async (req, res) => {
  const { category, subCategory, description, timeframe, budget } = req.body;
  if (!category || !description) {
    return res.status(400).json({ message: 'category and description are required' });
  }
  try {
    // Insert project into DB
    const projectRes = await query(
      'INSERT INTO projects (category, sub_category, description, timeframe, budget) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [category, subCategory, description, timeframe, budget]
    );
    const project = projectRes.rows[0];

    // Detect trades
    const trades = await detectTrades({ category, subCategory, description });
    // Insert trades into DB
    for (const trade of trades) {
      const tradeRes = await query(
        'INSERT INTO trades (project_id, name) VALUES ($1, $2) RETURNING *',
        [project.id, trade.name]
      );
      trade.id = tradeRes.rows[0].id;
    }
    res.json({ projectId: project.id, trades });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create project' });
  }
});

// Get trades for a project
app.get('/api/trades/:projectId', async (req, res) => {
  const { projectId } = req.params;
  try {
    const tradesRes = await query('SELECT * FROM trades WHERE project_id = $1', [projectId]);
    res.json({ trades: tradesRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch trades' });
  }
});

// Get questions for a trade
app.get('/api/questions/:tradeId', async (req, res) => {
  const { tradeId } = req.params;
  try {
    const tradeRes = await query('SELECT * FROM trades WHERE id = $1', [tradeId]);
    if (tradeRes.rows.length === 0) return res.status(404).json({ message: 'Trade not found' });
    const tradeName = tradeRes.rows[0].name;
    const questions = await generateQuestions(tradeName);
    // Insert questions into DB if not already present
    for (const q of questions) {
      await query(
        'INSERT INTO questions (trade_id, question_id, text) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [tradeId, q.id, q.text]
      );
    }
    res.json({ questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch questions' });
  }
});

// Save an answer to a question
app.post('/api/questions/:tradeId', async (req, res) => {
  const { tradeId } = req.params;
  const { questionId, answer, assumption } = req.body;
  if (!questionId || !answer) {
    return res.status(400).json({ message: 'questionId and answer are required' });
  }
  try {
    const qRes = await query('SELECT id FROM questions WHERE trade_id = $1 AND question_id = $2', [tradeId, questionId]);
    if (qRes.rows.length === 0) return res.status(404).json({ message: 'Question not found' });
    const dbQId = qRes.rows[0].id;
    const ansRes = await query(
      'INSERT INTO answers (question_db_id, answer_text, assumption) VALUES ($1, $2, $3) RETURNING *',
      [dbQId, answer, assumption]
    );
    res.json({ answer: ansRes.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to save answer' });
  }
});

// Generate LV for a trade
app.post('/api/lv/:tradeId', async (req, res) => {
  const { tradeId } = req.params;
  try {
    const tradeRes = await query('SELECT * FROM trades WHERE id = $1', [tradeId]);
    if (tradeRes.rows.length === 0) return res.status(404).json({ message: 'Trade not found' });
    const tradeName = tradeRes.rows[0].name;
    // Retrieve questions and answers for this trade
    const qaRes = await query(
      `SELECT q.text as question, a.answer_text as answer, a.assumption as assumption
       FROM questions q
       LEFT JOIN answers a ON a.question_db_id = q.id
       WHERE q.trade_id = $1`,
      [tradeId]
    );
    const answers = qaRes.rows;
    const lvContent = await generateLV(tradeName, answers);
    // Insert LV into DB
    const lvRes = await query(
      'INSERT INTO lvs (trade_id, content) VALUES ($1, $2) RETURNING *',
      [tradeId, lvContent]
    );
    res.json({ lv: lvRes.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to generate LV' });
  }
});

// Get aggregate LV for a project
app.get('/api/project/:projectId/lv', async (req, res) => {
  const { projectId } = req.params;
  try {
    const lvsRes = await query(
      `SELECT t.name as trade_name, l.content
       FROM lvs l
       JOIN trades t ON t.id = l.trade_id
       WHERE t.project_id = $1`,
      [projectId]
    );
    res.json({ lvs: lvsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch LVs' });
  }
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }
  try {
    const result = await authenticateAdmin(username, password);
    if (!result) return res.status(401).json({ message: 'Invalid credentials' });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Protected: get all projects
app.get('/api/admin/projects', requireAdmin, async (req, res) => {
  try {
    const projectsRes = await query('SELECT * FROM projects ORDER BY created_at DESC');
    res.json({ projects: projectsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch projects' });
  }
});

// Protected: get details of a project
app.get('/api/admin/project/:projectId', requireAdmin, async (req, res) => {
  const { projectId } = req.params;
  try {
    const projectRes = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (projectRes.rows.length === 0) return res.status(404).json({ message: 'Project not found' });
    // Get trades, questions, answers and lvs
    const tradesRes = await query('SELECT * FROM trades WHERE project_id = $1', [projectId]);
    const trades = tradesRes.rows;
    for (const trade of trades) {
      const qRes = await query('SELECT * FROM questions WHERE trade_id = $1', [trade.id]);
      trade.questions = qRes.rows;
      for (const q of trade.questions) {
        const aRes = await query('SELECT * FROM answers WHERE question_db_id = $1', [q.id]);
        q.answers = aRes.rows;
      }
      const lRes = await query('SELECT * FROM lvs WHERE trade_id = $1', [trade.id]);
      trade.lvs = lRes.rows;
    }
    const project = projectRes.rows[0];
    project.trades = trades;
    res.json({ project });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch project' });
  }
});

// Protected: update prompts – allows admin to upload new prompt files. The
// request body should include `filename` and `content`. Overwrites existing
// files in the prompts directory.
app.post('/api/admin/prompts', requireAdmin, async (req, res) => {
  const { filename, content } = req.body;
  if (!filename || !content) {
    return res.status(400).json({ message: 'filename and content required' });
  }
  try {
    const filePath = path.join(__dirname, '..', 'prompts', filename);
    fs.writeFileSync(filePath, content);
    res.json({ message: 'Prompt updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update prompt' });
  }
});

// PDF export (not implemented)
app.get('/api/export/:projectId', (req, res) => {
  res.status(501).json({ message: 'PDF export is not implemented in this PoC.' });
});

// Start the server
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`BYNDL backend listening on port ${port}`);
});
