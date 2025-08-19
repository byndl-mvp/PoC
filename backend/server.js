/*
 * BYNDL Proof of Concept – Backend (VOLLSTÄNDIG)
 * 
 * Änderungen:
 * 1. LV-Route berücksichtigt jetzt Intake-Antworten
 * 2. Neue Aggregations-Route /api/projects/:projectId/lv
 * 3. Strict JSON in allen LLM-Aufrufen
 */

const { query } = require('./db.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const OpenAI = require("openai");
const Anthropic = require("@anthropic-ai/sdk");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// --- Modellnamen aus Umgebungsvariablen (mit sinnvollen Fallbacks) ---
const MODEL_OPENAI = process.env.MODEL_OPENAI || 'gpt-4o-mini';
const MODEL_ANTHROPIC = process.env.MODEL_ANTHROPIC || 'claude-3-5-sonnet-latest';

// ===========================================================================
// HELPER FUNCTIONS
// ===========================================================================

/**
 * LLM Router mit Policy und Fallback
 * - "detect" -> Claude bevorzugt
 * - "questions" -> Claude bevorzugt  
 * - "lv" -> OpenAI bevorzugt
 * - default -> OpenAI bevorzugt
 */
async function llmWithPolicy(task, messages, options = {}) {
  const maxTokens = options.maxTokens || 2000;
  const temperature = options.temperature || 0.7;
  
  // Bestimme primären Provider basierend auf Task
  const primaryProvider = ['detect', 'questions'].includes(task) ? 'anthropic' : 'openai';
  
  const callOpenAI = async () => {
    const response = await openai.chat.completions.create({
      model: MODEL_OPENAI,
      messages,
      temperature,
      max_completion_tokens: maxTokens,
      response_format: options.jsonMode ? { type: "json_object" } : undefined
    });
    return response.choices[0].message.content;
  };
  
  const callClaude = async () => {
    // system-Nachricht extrahieren
    const systemMessage = messages.find(m => m.role === "system")?.content || "";

    // alle anderen Messages (user/assistant) nehmen
    const otherMessages = messages.filter(m => m.role !== "system");

    const response = await anthropic.messages.create({
      model: MODEL_ANTHROPIC,
      max_tokens: maxTokens,
      temperature,
      system: systemMessage,
      messages: otherMessages,
    });

    return response.content[0].text;
  };
  
  // Versuche primären Provider, dann Fallback
  try {
    console.log(`[LLM] Using primary provider: ${primaryProvider} for task: ${task}`);
    return primaryProvider === 'anthropic' ? await callClaude() : await callOpenAI();
  } catch (error) {
    console.warn(`[LLM] Primary provider failed: ${error.message}, trying fallback...`);
    try {
      return primaryProvider === 'anthropic' ? await callOpenAI() : await callClaude();
    } catch (fallbackError) {
      console.error(`[LLM] Both providers failed:`, error.message, fallbackError.message);
      throw new Error('LLM service unavailable');
    }
  }
}

/**
 * Prompt aus DB laden
 */
async function getPromptByName(name) {
  try {
    const result = await query(
      'SELECT content FROM prompts WHERE name = $1 LIMIT 1',
      [name]
    );
    if (result.rows.length === 0) {
      console.warn(`[DB] Prompt "${name}" not found`);
      return '';
    }
    return result.rows[0].content || '';
  } catch (err) {
    console.error(`[DB] Error loading prompt "${name}":`, err);
    return '';
  }
}

/**
 * Prompt für ein spezifisches Gewerk und Typ laden
 */
async function getPromptForTrade(tradeId, type) {
  try {
    const result = await query(
      `SELECT content FROM prompts 
       WHERE trade_id = $1 AND type = $2 
       ORDER BY updated_at DESC LIMIT 1`,
      [tradeId, type]
    );
    if (result.rows.length === 0) {
      console.warn(`[DB] No ${type} prompt found for trade ${tradeId}`);
      return '';
    }
    return result.rows[0].content || '';
  } catch (err) {
    console.error(`[DB] Error loading ${type} prompt for trade ${tradeId}:`, err);
    return '';
  }
}

/**
 * Alle verfügbaren Gewerke aus DB laden
 */
async function getAvailableTrades() {
  try {
    const result = await query(
      'SELECT id, code, name FROM trades ORDER BY id'
    );
    return result.rows;
  } catch (err) {
    console.error('[DB] Failed to load trades:', err);
    return [];
  }
}

/**
 * Gewerke-Erkennung mit LLM
 */
async function detectTrades(project) {
  console.log('[DETECT] Starting trade detection for project:', project);
  
  // 1. Masterprompt aus DB laden
  const masterPrompt = await getPromptByName('master');
  
  // 2. Verfügbare Gewerke aus DB laden
  const availableTrades = await getAvailableTrades();
  
  if (availableTrades.length === 0) {
    throw new Error('No trades available in database');
  }
  
  // 3. Trade-Liste für Prompt erstellen
  const tradeList = availableTrades
    .map(t => `- ${t.code}: ${t.name}`)
    .join('\n');
  
  // 4. System-Prompt mit strikten JSON-Anweisungen
  const systemPrompt = `${masterPrompt}

Du bist ein erfahrener Baukoordinator und KI-Assistent für die BYNDL-Plattform.
Deine Aufgabe: Analysiere die Projektbeschreibung und erkenne die benötigten Gewerke.

VERFÜGBARE GEWERKE (NUR DIESE VERWENDEN!):
${tradeList}

WICHTIG - OUTPUT FORMAT:
Gib NUR valides JSON zurück, keine Markdown-Codeblöcke, kein Text davor oder danach.
Das JSON muss EXAKT diesem Schema entsprechen:

{
  "trades": [
    {"code": "SAN", "name": "Sanitärinstallation"},
    {"code": "ELEKT", "name": "Elektroinstallation"}
  ],
  "confidence": 0.95,
  "reasoning": "Kurze Begründung der Auswahl",
  "projectInfo": {
    "type": "Wohnung/EFH/MFH/Gewerbe",
    "scope": "Neubau/Sanierung/Modernisierung",
    "notes": "Wichtige erkannte Details"
  }
}`;

  // 5. User-Prompt mit Projektdaten
  const userPrompt = `PROJEKTDATEN:
Kategorie: ${project.category || 'Nicht angegeben'}
Unterkategorie: ${project.subCategory || 'Nicht angegeben'}
Beschreibung: ${project.description || 'Keine Beschreibung'}
Zeitrahmen: ${project.timeframe || 'Nicht angegeben'}
Budget: ${project.budget || 'Nicht angegeben'}

Analysiere diese Daten und gib die benötigten Gewerke als JSON zurück.`;

  // 6. LLM-Aufruf
  let llmResponse;
  try {
    llmResponse = await llmWithPolicy('detect', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { 
      maxTokens: 1500,
      temperature: 0.3,
      jsonMode: true 
    });
  } catch (err) {
    console.error('[DETECT] LLM call failed:', err);
    return detectTradesFallback(project, availableTrades);
  }
  
  // 7. JSON parsen und validieren
  let parsedResponse;
  try {
    // Entferne mögliche Markdown-Code-Blöcke
    const cleanedResponse = llmResponse
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    parsedResponse = JSON.parse(cleanedResponse);
  } catch (err) {
    console.error('[DETECT] JSON parse failed:', err);
    console.log('[DETECT] Raw LLM response:', llmResponse);
    return detectTradesFallback(project, availableTrades);
  }
  
  // 8. Validierung und Mapping
  if (!parsedResponse.trades || !Array.isArray(parsedResponse.trades)) {
    console.warn('[DETECT] Invalid response structure, using fallback');
    return detectTradesFallback(project, availableTrades);
  }
  
  // Map erkannte Codes zu DB-Einträgen
  const detectedTrades = [];
  const usedIds = new Set();
  
  for (const trade of parsedResponse.trades) {
    const dbTrade = availableTrades.find(t => 
      t.code === trade.code || 
      t.name.toLowerCase() === trade.name?.toLowerCase()
    );
    
    if (dbTrade && !usedIds.has(dbTrade.id)) {
      usedIds.add(dbTrade.id);
      detectedTrades.push({
        id: dbTrade.id,
        code: dbTrade.code,
        name: dbTrade.name
      });
    }
  }
  
  // Falls keine Gewerke erkannt wurden, Fallback
  if (detectedTrades.length === 0) {
    console.warn('[DETECT] No valid trades detected, using fallback');
    return detectTradesFallback(project, availableTrades);
  }
  
  console.log('[DETECT] Successfully detected trades:', detectedTrades);
  
  return detectedTrades;
}

/**
 * Fallback: Keyword-basierte Gewerke-Erkennung
 */
function detectTradesFallback(project, availableTrades) {
  console.log('[FALLBACK] Using keyword-based detection');
  
  const text = `${project.category} ${project.subCategory} ${project.description}`.toLowerCase();
  
  // Keyword-Mappings
  const keywords = {
    'AUSS': ['außenanlagen', 'aussenanlagen', 'galabau', 'garten', 'terrasse', 'pflaster', 'einfahrt', 'carport', 'wege', 'zaun', 'begrünung'],
    'BOD': ['boden', 'bodenbelag', 'parkett', 'vinyl', 'laminat', 'teppich', 'dielen', 'bodenplatten'],
    'DACH': ['dach', 'dachfenster', 'gaube', 'eindeckung', 'dachdecker', 'dachsanierung', 'dachdämmung'],
    'ELEKT': ['elektro', 'strom', 'steckdose', 'elektroinstallation', 'verteiler', 'kabel', 'beleuchtung', 'lichtschalter'],
    'ESTR': ['estrich', 'estricharbeiten', 'estrichboden'],
    'FASS': ['fassade', 'wdvs', 'außenputz', 'aussenputz', 'wärmedämmung', 'fassadensanierung'],
    'FEN': ['fenster', 'tür', 'türen', 'haustür', 'dachfenster', 'schiebetür', 'fenstertausch'],
    'FLI': ['fliese', 'fliesen', 'platten', 'fliesenleger', 'fliesenspiegel'],
    'GER': ['gerüst', 'geruest', 'gerüstbau'],
    'HEI': ['heizung', 'heizkörper', 'wärmepumpe', 'gastherme', 'heizungsinstallation', 'fußbodenheizung'],
    'MAL': ['maler', 'lack', 'anstrich', 'streichen', 'spachteln', 'tapete', 'innenputz'],
    'ROH': ['rohbau', 'mauer', 'beton', 'wanddurchbruch', 'statik', 'fundament', 'mauerwerk'],
    'SAN': ['sanitär', 'sanitaer', 'bad', 'wc', 'dusche', 'leitung', 'waschbecken', 'toilette'],
    'SCHL': ['schlosser', 'metallbau', 'geländer', 'handlauf', 'stahl', 'treppengeländer'],
    'TIS': ['tischler', 'innenausbau', 'innentür', 'möbel', 'einbau', 'schreiner', 'einbauschrank'],
    'TRO': ['trockenbau', 'gk', 'rigips', 'vorsatzschale', 'abhangdecke', 'trennwand'],
    'ABBR': ['abbruch', 'entkernung', 'rückbau', 'abriss', 'abrissarbeiten']
  };
  
  const detectedCodes = new Set();
  
  // Suche nach Keywords
  for (const [code, words] of Object.entries(keywords)) {
    if (words.some(word => text.includes(word))) {
      detectedCodes.add(code);
    }
  }
  
  // Falls nichts gefunden, nimm Maler als Default
  if (detectedCodes.size === 0) {
    detectedCodes.add('MAL');
  }
  
  // Map zu DB-Einträgen
  const detectedTrades = [];
  for (const code of detectedCodes) {
    const trade = availableTrades.find(t => t.code === code);
    if (trade) {
      detectedTrades.push({
        id: trade.id,
        code: trade.code,
        name: trade.name
      });
    }
  }
  
  console.log('[FALLBACK] Detected trades:', detectedTrades);
  return detectedTrades;
}

/**
 * Fragen für ein Gewerk generieren
 */
async function generateQuestions(tradeId, projectContext = {}) {
  // Lade Trade-Info
  const tradeResult = await query(
    'SELECT name, code FROM trades WHERE id = $1',
    [tradeId]
  );
  
  if (tradeResult.rows.length === 0) {
    throw new Error(`Trade ${tradeId} not found`);
  }
  
  const { name: tradeName, code: tradeCode } = tradeResult.rows[0];
  
  // Lade Questions-Prompt aus DB
  const questionPrompt = await getPromptForTrade(tradeId, 'questions');
  
  if (!questionPrompt) {
    console.warn(`No questions prompt for trade ${tradeId}, using fallback`);
    return [
      {
        id: `${tradeCode}-1`,
        category: 'Allgemein',
        question: `Welche spezifischen Arbeiten sind für ${tradeName} geplant?`,
        type: 'text',
        required: true,
        tradeId,
        tradeName
      }
    ];
  }
  
  // System-Prompt für Fragengenerierung mit Strict JSON
  const systemPrompt = `Du bist ein Experte für ${tradeName}.
Erstelle einen präzisen Fragenkatalog für dieses Gewerk basierend auf dem folgenden Template.

WICHTIG: Gib NUR valides JSON zurück, keine Markdown-Codeblöcke, kein Text davor oder danach:
[
  {
    "id": "q1",
    "category": "Kategorie",
    "question": "Konkrete Frage",
    "type": "text|number|select|multiselect",
    "required": true|false,
    "options": ["Option1", "Option2"]
  }
]`;

  const userPrompt = `TEMPLATE:
${questionPrompt}

PROJEKTKONTEXT:
- Kategorie: ${projectContext.category || 'Nicht angegeben'}
- Beschreibung: ${projectContext.description || 'Keine'}

Erstelle basierend auf dem Template einen angepassten Fragenkatalog als JSON.`;

  try {
    const response = await llmWithPolicy('questions', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { maxTokens: 2000, temperature: 0.5, jsonMode: true });
    
    // Parse JSON
    const cleanedResponse = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const questions = JSON.parse(cleanedResponse);
    
    // Füge Trade-Info hinzu
    return questions.map((q, idx) => ({
      ...q,
      id: q.id || `${tradeCode}-${idx + 1}`,
      tradeId,
      tradeName
    }));
    
  } catch (err) {
    console.error('[QUESTIONS] Generation failed:', err);
    // Fallback
    return [
      {
        id: `${tradeCode}-1`,
        category: 'Allgemein',
        question: `Welche spezifischen Arbeiten sind für ${tradeName} geplant?`,
        type: 'text',
        required: true,
        tradeId,
        tradeName
      }
    ];
  }
}

// ===========================================================================
// EXPRESS APP
// ===========================================================================

const app = express();

// CORS Configuration
const allowedOrigins = [
  'https://byndl-poc.netlify.app',
  'https://byndl.de',
  'http://localhost:3000',
  'http://localhost:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(bodyParser.json());

// ===========================================================================
// ROUTES
// ===========================================================================

// Health Check
app.get('/', (req, res) => {
  res.json({ 
    message: 'BYNDL Backend v2.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// DB Ping
app.get('/api/dbping', async (req, res) => {
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

// Get all trades
app.get('/api/trades', async (req, res) => {
  try {
    const trades = await getAvailableTrades();
    res.json(trades);
  } catch (err) {
    console.error('Failed to fetch trades:', err);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// Create project with trade detection
app.post('/api/projects', async (req, res) => {
  try {
    const { category, subCategory, description, timeframe, budget } = req.body;
    
    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }
    
    // 1. Create project in DB
    const projectResult = await query(
      `INSERT INTO projects (category, sub_category, description, timeframe, budget)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [category || null, subCategory || null, description, timeframe || null, budget || null]
    );
    
    const project = projectResult.rows[0];
    
    // 2. Detect trades using LLM
    const detectedTrades = await detectTrades({
      category,
      subCategory,
      description,
      timeframe,
      budget
    });
    
    // 3. Link trades to project
    for (const trade of detectedTrades) {
      await query(
        `INSERT INTO project_trades (project_id, trade_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [project.id, trade.id]
      );
    }
    
    // 4. Return project with trades
    res.json({
      project: {
        ...project,
        trades: detectedTrades
      }
    });
    
  } catch (err) {
    console.error('Failed to create project:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get project details
app.get('/api/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Get project
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = projectResult.rows[0];
    
    // Get associated trades
    const tradesResult = await query(
      `SELECT t.* FROM trades t
       JOIN project_trades pt ON pt.trade_id = t.id
       WHERE pt.project_id = $1`,
      [projectId]
    );
    
    project.trades = tradesResult.rows;
    
    res.json(project);
    
  } catch (err) {
    console.error('Failed to fetch project:', err);
    res.status(500).json({ error: err.message });
  }
});

// Intake: Generate master questions
app.post('/api/projects/:projectId/intake/questions', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Projektkontext laden
    const projectResult = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = projectResult.rows[0];

    // INT-Trade ermitteln
    const intTrade = await query(`SELECT id FROM trades WHERE code = 'INT' LIMIT 1`);
    if (intTrade.rows.length === 0) {
      return res.status(500).json({ error: 'INT trade missing in DB' });
    }
    const tradeId = intTrade.rows[0].id;

    // Fragen via vorhandener Logik generieren
    const questions = await generateQuestions(tradeId, {
      category: project.category,
      description: project.description
    });

    // Fragen speichern mit korrektem Mapping
    let saved = 0;
    for (const q of questions) {
      await query(
        `INSERT INTO questions (project_id, trade_id, question_id, text, type, required, options)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (project_id, trade_id, question_id)
         DO UPDATE SET text=$4, type=$5, required=$6, options=$7`,
        [
          projectId,
          tradeId,
          q.id,
          q.question || q.text,
          q.type || 'text',
          q.required ?? false,
          q.options ? JSON.stringify(q.options) : null
        ]
      );
      saved++;
    }

    res.json({ ok: true, tradeCode: 'INT', questions, saved });
  } catch (err) {
    console.error('intake/questions failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Intake: Summary with recommendations
app.get('/api/projects/:projectId/intake/summary', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Projekt holen
    const project = (await query('SELECT * FROM projects WHERE id=$1', [projectId])).rows[0];
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // INT-Trade-ID
    const intTrade = (await query(`SELECT id FROM trades WHERE code='INT'`)).rows[0];
    if (!intTrade) return res.status(500).json({ error: 'INT trade missing' });

    // Intake-Antworten laden
    const answers = (await query(
      `SELECT question_id, answer_text
       FROM answers
       WHERE project_id=$1 AND trade_id=$2
       ORDER BY question_id`,
      [projectId, intTrade.id]
    )).rows;

    // Masterprompt holen
    const master = await getPromptByName('master');

    // System-Prompt mit Strict JSON
    const system = `${master}

Gib NUR valides JSON zurück, keine Markdown-Codeblöcke, kein Text davor oder danach:
{
  "recommendations": [ "..." ],
  "risks": [ "..." ],
  "missingInfo": [ "..." ],
  "trades": [ { "code":"SAN","reason":"..." } ]
}`;

    const user = `Projekt:
Kategorie: ${project.category}
Beschreibung: ${project.description}

Antworten Intake:
${answers.map(a => `- ${a.question_id}: ${a.answer_text}`).join('\n')}`;

    // LLM call
    const raw = await llmWithPolicy('detect', [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ], { maxTokens: 1500, temperature: 0.3, jsonMode: true });

    // Parse JSON
    const cleanedResponse = raw
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    res.json({ ok: true, summary: JSON.parse(cleanedResponse) });
  } catch (err) {
    console.error('intake/summary failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Generate questions for a specific trade
app.post('/api/projects/:projectId/trades/:tradeId/questions', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    
    // Get project context
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = projectResult.rows[0];
    
    // Generate questions
    const questions = await generateQuestions(tradeId, {
      category: project.category,
      description: project.description
    });
    
    // Store questions in DB with proper mapping
    for (const question of questions) {
      await query(
        `INSERT INTO questions (project_id, trade_id, question_id, text, type, required, options)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (project_id, trade_id, question_id) 
         DO UPDATE SET text = $4, type = $5, required = $6, options = $7`,
        [
          projectId,
          tradeId,
          question.id,
          question.question || question.text,
          question.type || 'text',
          question.required !== undefined ? question.required : false,
          question.options ? JSON.stringify(question.options) : null
        ]
      );
    }
    
    res.json({ questions });
    
  } catch (err) {
    console.error('Failed to generate questions:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get questions for a trade in a project
app.get('/api/projects/:projectId/trades/:tradeId/questions', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    
    const result = await query(
      `SELECT q.*, t.name as trade_name, t.code as trade_code
       FROM questions q
       JOIN trades t ON t.id = q.trade_id
       WHERE q.project_id = $1 AND q.trade_id = $2
       ORDER BY q.question_id`,
      [projectId, tradeId]
    );
    
    // Parse options if stored as JSON string
    const questions = result.rows.map(q => ({
      ...q,
      options: q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : null
    }));
    
    res.json({ questions });
    
  } catch (err) {
    console.error('Failed to fetch questions:', err);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Save answers (works for both intake and trade-specific)
app.post('/api/projects/:projectId/trades/:tradeId/answers', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    const { answers } = req.body;
    
    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers must be an array' });
    }
    
    // Save each answer
    for (const answer of answers) {
      await query(
        `INSERT INTO answers (project_id, trade_id, question_id, answer_text, assumption)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (project_id, trade_id, question_id)
         DO UPDATE SET answer_text = $4, assumption = $5, updated_at = NOW()`,
        [
          projectId,
          tradeId,
          answer.questionId,
          answer.answer,
          answer.assumption || null
        ]
      );
    }
    
    res.json({ success: true, saved: answers.length });
    
  } catch (err) {
    console.error('Failed to save answers:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===========================================================================
// NEUE/ÜBERARBEITETE LV ROUTES
// ===========================================================================

// Generate LV for a trade (ÜBERARBEITET - berücksichtigt jetzt Intake-Antworten)
app.post('/api/projects/:projectId/trades/:tradeId/lv', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;

    // 1) Projekt + Trade laden
    const project = (await query('SELECT * FROM projects WHERE id=$1', [projectId])).rows[0];
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const trade = (await query('SELECT id, name, code FROM trades WHERE id=$1', [tradeId])).rows[0];
    if (!trade) return res.status(404).json({ error: 'Trade not found' });

    // 2) Antworten laden: Intake (INT) + Trade
    const intTrade = (await query(`SELECT id FROM trades WHERE code='INT' LIMIT 1`)).rows[0];
    const answersInt = intTrade
      ? (await query(
          `SELECT q.text as question, a.answer_text as answer
           FROM answers a
           JOIN questions q ON q.project_id = a.project_id 
             AND q.trade_id = a.trade_id 
             AND q.question_id = a.question_id
           WHERE a.project_id=$1 AND a.trade_id=$2
           ORDER BY a.question_id`,
          [projectId, intTrade.id]
        )).rows
      : [];

    const answersTrade = (await query(
      `SELECT q.text as question, a.answer_text as answer
       FROM answers a
       JOIN questions q ON q.project_id = a.project_id 
         AND q.trade_id = a.trade_id 
         AND q.question_id = a.question_id
       WHERE a.project_id=$1 AND a.trade_id=$2
       ORDER BY a.question_id`,
      [projectId, tradeId]
    )).rows;

    // 3) LV-Prompt laden
    const lvPromptRow = (await query(
      `SELECT content FROM prompts WHERE trade_id=$1 AND type='lv' ORDER BY updated_at DESC LIMIT 1`,
      [tradeId]
    )).rows[0];
    if (!lvPromptRow) return res.status(400).json({ error: 'LV prompt missing for trade' });

    // 4) System/User Prompts bauen mit Strict JSON
    const system = `Du bist ein Experte für VOB-konforme Leistungsverzeichnisse.
Gib NUR valides JSON zurück, keine Markdown-Codeblöcke, kein Text davor oder danach.
Schema:
{
  "trade": "${trade.name}",
  "positions": [
    { 
      "pos":"01.01", 
      "title":"...", 
      "description":"...", 
      "quantity": 0, 
      "unit":"m|m²|Stk|kg|pauschal", 
      "unitPrice": null, 
      "totalPrice": null 
    }
  ],
  "notes": "..."
}`;

    const user = `TEMPLATE:
${lvPromptRow.content}

PROJEKT:
- Kategorie: ${project.category || '-'}
- Beschreibung: ${project.description || '-'}
- Zeitplan: ${project.timeframe || '-' }
- Budget: ${project.budget ?? '-'}

ANTWORTEN (INTAKE):
${answersInt.map(a => `Frage: ${a.question}\nAntwort: ${a.answer}`).join('\n\n') || 'Keine Intake-Antworten'}

ANTWORTEN (${trade.name}):
${answersTrade.map(a => `Frage: ${a.question}\nAntwort: ${a.answer}`).join('\n\n') || 'Keine gewerkespezifischen Antworten'}

Erzeuge ein vollständiges, VOB-konformes Leistungsverzeichnis für ${trade.name}.`;

    // 5) LLM-Call
    const raw = await llmWithPolicy('lv', [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ], { maxTokens: 2800, temperature: 0.2, jsonMode: true });

    // Parse JSON
    const cleanedResponse = raw
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const lv = JSON.parse(cleanedResponse);

    // 6) Speichern
    await query(
      `INSERT INTO lvs (project_id, trade_id, content)
       VALUES ($1,$2,$3)
       ON CONFLICT (project_id, trade_id)
       DO UPDATE SET content=$3, updated_at=NOW()`,
      [projectId, tradeId, lv]
    );

    res.json({ ok: true, trade: { id: trade.id, code: trade.code, name: trade.name }, lv });
  } catch (err) {
    console.error('generate LV failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// NEU: Aggregate LV for a project
app.get('/api/projects/:projectId/lv', async (req, res) => {
  try {
    const { projectId } = req.params;
    const rows = (await query(
      `SELECT l.trade_id, t.code, t.name, l.content
       FROM lvs l JOIN trades t ON t.id=l.trade_id
       WHERE l.project_id=$1
       ORDER BY t.name`,
      [projectId]
    )).rows;

    // Parse content if stored as string
    const lvs = rows.map(row => ({
      ...row,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content
    }));

    res.json({ ok: true, lvs });
  } catch (err) {
    console.error('aggregate LV failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Legacy: Get all LVs for a project (für Kompatibilität)
app.get('/api/projects/:projectId/lvs', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const result = await query(
      `SELECT l.*, t.name as trade_name, t.code as trade_code
       FROM lvs l
       JOIN trades t ON t.id = l.trade_id
       WHERE l.project_id = $1`,
      [projectId]
    );
    
    const lvs = result.rows.map(row => ({
      ...row,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content
    }));
    
    res.json({ lvs });
    
  } catch (err) {
    console.error('Failed to fetch LVs:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===========================================================================
// ADMIN ROUTES
// ===========================================================================

// Admin authentication
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    const result = await query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    res.json({ token, user: { id: user.id, username: user.username } });
    
  } catch (err) {
    console.error('Login failed:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Admin middleware
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  
  const token = auth.slice(7);
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Admin: Get all projects
app.get('/api/admin/projects', requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, 
        COUNT(DISTINCT pt.trade_id) as trade_count,
        COUNT(DISTINCT l.id) as lv_count
       FROM projects p
       LEFT JOIN project_trades pt ON pt.project_id = p.id
       LEFT JOIN lvs l ON l.project_id = p.id
       GROUP BY p.id
       ORDER BY p.created_at DESC`
    );
    
    res.json({ projects: result.rows });
    
  } catch (err) {
    console.error('Failed to fetch projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Admin: Update prompts
app.put('/api/admin/prompts/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const result = await query(
      `UPDATE prompts 
       SET content = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [content, id]
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

// Admin: Get all prompts
app.get('/api/admin/prompts', requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, t.name as trade_name, t.code as trade_code
       FROM prompts p
       LEFT JOIN trades t ON t.id = p.trade_id
       ORDER BY p.type, t.name`
    );
    
    res.json({ prompts: result.rows });
    
  } catch (err) {
    console.error('Failed to fetch prompts:', err);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// Get all prompts with details (public)
app.get('/api/prompts', async (req, res) => {
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
app.get('/api/prompts/:id', async (req, res) => {
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

// ===========================================================================
// TEST ENDPOINTS
// ===========================================================================

// Test OpenAI
app.get('/api/test/openai', async (req, res) => {
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
app.get('/api/test/anthropic', async (req, res) => {
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

// Debug: List all routes
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach(middleware => {
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
app.get('/healthz', (req, res) => {
  res.json({ message: "BYNDL Backend v2.0", status: "running" });
});

// Environment info
app.get('/__info', (req, res) => {
  res.json({
    node: process.version,
    env: {
      OPENAI_MODEL: MODEL_OPENAI,
      ANTHROPIC_MODEL: MODEL_ANTHROPIC,
      DATABASE_URL: process.env.DATABASE_URL ? "✔️ gesetzt" : "❌ fehlt"
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║                                        ║
║     BYNDL Backend v2.0 Started        ║
║                                        ║
║     Port: ${PORT}                        ║
║     Environment: ${process.env.NODE_ENV || 'development'}          ║
║                                        ║
╚════════════════════════════════════════╝
  `);
});
