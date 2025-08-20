/*
 * BYNDL Proof of Concept – Backend (VOLLSTÄNDIG ÜBERARBEITET)
 * 
 * Hauptverbesserungen:
 * - Dynamische Fragenanzahl basierend auf Projektkomplexität
 * - Erhöhte Token-Limits für detaillierte LVs
 * - Adaptive Fragengenerierung ohne Fallbacks
 * - Vollständige Intake-Kontext Integration
 */

const { query } = require('./db.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const PDFDocument = require('pdfkit');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const OpenAI = require("openai");
const Anthropic = require("@anthropic-ai/sdk");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Modellnamen aus Umgebungsvariablen
const MODEL_OPENAI = process.env.MODEL_OPENAI || 'gpt-4o-mini';
const MODEL_ANTHROPIC = process.env.MODEL_ANTHROPIC || 'claude-3-5-sonnet-latest';

// ===========================================================================
// HELPER FUNCTIONS
// ===========================================================================

/**
 * Erweiterte LLM-Policy mit maximalen Token-Limits
 */
async function llmWithPolicy(task, messages, options = {}) {
  // Maximale Token-Limits für detaillierte Outputs
  const defaultMaxTokens = {
    'detect': 2500,      // Präzise Gewerke-Erkennung
    'questions': 6000,   // 20-40+ detaillierte Fragen
    'lv': 8000,          // Sehr detaillierte LVs
    'intake': 6000,      // Umfassende Intake-Befragung
    'summary': 4000      // Detaillierte Zusammenfassungen
  };
  
  const maxTokens = options.maxTokens || defaultMaxTokens[task] || 4000;
  const temperature = options.temperature !== undefined ? options.temperature : 0.6;
  
  // Bestimme primären Provider
  const primaryProvider = ['detect', 'questions', 'intake'].includes(task) ? 'anthropic' : 'openai';
  
  const callOpenAI = async () => {
    const useJsonMode = options.jsonMode && maxTokens <= 4096;
    
    const response = await openai.chat.completions.create({
      model: MODEL_OPENAI,
      messages,
      temperature,
      max_completion_tokens: Math.min(maxTokens, 16384),
      response_format: useJsonMode ? { type: "json_object" } : undefined
    });
    return response.choices[0].message.content;
  };
  
  const callClaude = async () => {
    const systemMessage = messages.find(m => m.role === "system")?.content || "";
    const otherMessages = messages.filter(m => m.role !== "system");

    const response = await anthropic.messages.create({
      model: MODEL_ANTHROPIC,
      max_tokens: Math.min(maxTokens, 8192),
      temperature,
      system: systemMessage,
      messages: otherMessages,
    });

    return response.content[0].text;
  };
  
  try {
    console.log(`[LLM] Task: ${task} | Provider: ${primaryProvider} | Tokens: ${maxTokens}`);
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
 * Projekt-Trade Verknüpfung sicherstellen
 */
async function ensureProjectTrade(projectId, tradeId) {
  await query(
    `INSERT INTO project_trades (project_id, trade_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [projectId, tradeId]
  );
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
 * Prompt für spezifisches Gewerk laden
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
 * Alle verfügbaren Gewerke laden
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
 * Projektkomplexität bestimmen
 */
function determineProjectComplexity(projectContext, intakeAnswers = []) {
  let complexityScore = 0;
  
  // Budget-basierte Komplexität
  if (projectContext.budget) {
    const budgetStr = projectContext.budget.toLowerCase();
    if (budgetStr.includes('100000') || budgetStr.includes('100k')) complexityScore += 3;
    else if (budgetStr.includes('50000') || budgetStr.includes('50k')) complexityScore += 2;
    else if (budgetStr.includes('20000') || budgetStr.includes('20k')) complexityScore += 1;
  }
  
  // Beschreibungslänge
  if (projectContext.description) {
    const wordCount = projectContext.description.split(' ').length;
    if (wordCount > 100) complexityScore += 2;
    else if (wordCount > 50) complexityScore += 1;
  }
  
  // Kategorie-basierte Komplexität
  if (projectContext.category) {
    const category = projectContext.category.toLowerCase();
    if (category.includes('neubau') || category.includes('kernsanierung')) complexityScore += 3;
    else if (category.includes('umbau') || category.includes('anbau')) complexityScore += 2;
    else if (category.includes('renovierung') || category.includes('modernisierung')) complexityScore += 1;
  }
  
  // Zeitrahmen
  if (projectContext.timeframe) {
    const timeframe = projectContext.timeframe.toLowerCase();
    if (timeframe.includes('sofort') || timeframe.includes('dringend')) complexityScore += 1;
    if (timeframe.includes('jahr') || timeframe.includes('monate')) complexityScore += 1;
  }
  
  // Intake-Antworten Komplexität
  if (intakeAnswers.length > 15) complexityScore += 2;
  else if (intakeAnswers.length > 10) complexityScore += 1;
  
  // Klassifizierung
  if (complexityScore >= 7) return 'SEHR_HOCH';
  if (complexityScore >= 5) return 'HOCH';
  if (complexityScore >= 3) return 'MITTEL';
  if (complexityScore >= 1) return 'NIEDRIG';
  return 'EINFACH';
}

/**
 * Fragenanzahl-Richtlinie
 */
function getQuestionCountGuideline(complexity, isIntake) {
  const guidelines = {
    'SEHR_HOCH': isIntake ? '25-35' : '20-30',
    'HOCH': isIntake ? '20-30' : '15-25',
    'MITTEL': isIntake ? '15-25' : '10-20',
    'NIEDRIG': isIntake ? '12-20' : '8-15',
    'EINFACH': isIntake ? '10-15' : '5-10'
  };
  
  return guidelines[complexity] || (isIntake ? '15-25' : '10-20');
}

/**
 * Gewerke-Erkennung mit LLM
 */
async function detectTrades(project) {
  console.log('[DETECT] Starting trade detection for project:', project);
  
  const masterPrompt = await getPromptByName('master');
  const availableTrades = await getAvailableTrades();
  
  if (availableTrades.length === 0) {
    throw new Error('No trades available in database');
  }
  
  const tradeList = availableTrades
    .map(t => `- ${t.code}: ${t.name}`)
    .join('\n');
  
  const systemPrompt = `${masterPrompt}

Du bist ein erfahrener Baukoordinator für die BYNDL-Plattform.
Analysiere die Projektbeschreibung und erkenne die benötigten Gewerke.

VERFÜGBARE GEWERKE (NUR DIESE VERWENDEN!):
${tradeList}

OUTPUT FORMAT (NUR valides JSON):
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

  const userPrompt = `PROJEKTDATEN:
Kategorie: ${project.category || 'Nicht angegeben'}
Unterkategorie: ${project.subCategory || 'Nicht angegeben'}
Beschreibung: ${project.description || 'Keine Beschreibung'}
Zeitrahmen: ${project.timeframe || 'Nicht angegeben'}
Budget: ${project.budget || 'Nicht angegeben'}

Analysiere diese Daten und gib die benötigten Gewerke als JSON zurück.`;

  try {
    const llmResponse = await llmWithPolicy('detect', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { 
      maxTokens: 2500,
      temperature: 0.3,
      jsonMode: true 
    });
    
    const cleanedResponse = llmResponse
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const parsedResponse = JSON.parse(cleanedResponse);
    
    if (!parsedResponse.trades || !Array.isArray(parsedResponse.trades)) {
      throw new Error('Invalid response structure');
    }
    
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
    
    if (detectedTrades.length === 0) {
      throw new Error('No valid trades detected');
    }
    
    console.log('[DETECT] Successfully detected trades:', detectedTrades);
    return detectedTrades;
    
  } catch (err) {
    console.error('[DETECT] Trade detection failed:', err);
    throw new Error('Gewerke-Erkennung fehlgeschlagen');
  }
}

/**
 * Adaptive Fragengenerierung ohne Fallback
 */
async function generateQuestions(tradeId, projectContext = {}) {
  const tradeResult = await query(
    'SELECT name, code FROM trades WHERE id = $1',
    [tradeId]
  );
  
  if (tradeResult.rows.length === 0) {
    throw new Error(`Trade ${tradeId} not found`);
  }
  
  const { name: tradeName, code: tradeCode } = tradeResult.rows[0];
  const isIntake = tradeCode === 'INT';
  
  const questionPrompt = await getPromptForTrade(tradeId, 'questions');
  
  if (!questionPrompt) {
    throw new Error(`No question prompt available for ${tradeName}`);
  }
  
  // Lade Intake-Kontext für Gewerke-Fragen
  let intakeContext = '';
  let answeredQuestions = [];
  
  if (projectContext.projectId && !isIntake) {
    const intTrade = await query(`SELECT id FROM trades WHERE code='INT' LIMIT 1`);
    if (intTrade.rows.length > 0) {
      const intakeAnswers = await query(
        `SELECT q.text as question, a.answer_text as answer
         FROM answers a
         JOIN questions q ON q.project_id = a.project_id 
           AND q.trade_id = a.trade_id 
           AND q.question_id = a.question_id
         WHERE a.project_id = $1 AND a.trade_id = $2`,
        [projectContext.projectId, intTrade.rows[0].id]
      );
      
      if (intakeAnswers.rows.length > 0) {
        answeredQuestions = intakeAnswers.rows;
        intakeContext = `
BEREITS BEANTWORTETE INTAKE-FRAGEN:
${intakeAnswers.rows.map(a => `- ${a.question}: ${a.answer}`).join('\n')}

WICHTIG: 
- Stelle NUR noch unbeantwortete, gewerkespezifische Fragen
- Vermeide jegliche Dopplungen
- Passe die Fragenanzahl an die Projektkomplexität an`;
      }
    }
  }
  
  const projectComplexity = determineProjectComplexity(projectContext, answeredQuestions);
  const questionGuideline = getQuestionCountGuideline(projectComplexity, isIntake);
  
  const systemPrompt = `Du bist ein Experte für ${tradeName}.
${isIntake ? 'Erstelle einen umfassenden INTAKE-Fragenkatalog für die vollständige Projekterfassung.' : 
`Erstelle einen ADAPTIVEN Fragenkatalog für das Gewerk ${tradeName}.`}

${intakeContext}

FRAGENANZAHL-VORGABE:
- Projektkomplexität: ${projectComplexity}
- Erstelle ${questionGuideline} relevante Fragen
- Qualität vor Quantität, aber sei VOLLSTÄNDIG
- Decke ALLE wichtigen Aspekte ab

KATEGORIEN DIE ABGEDECKT WERDEN MÜSSEN:
${isIntake ? 
`- Projektziele und genaue Anforderungen
- Detaillierte Bestandssituation
- Budget und Finanzierung
- Zeitplanung und Meilensteine
- Qualitätsanforderungen und Standards
- Besondere Wünsche und Präferenzen
- Rechtliche/Bauliche Rahmenbedingungen
- Zugänglichkeit und Logistik
- Eigenleistungen
- Nachbarschaft und Umfeld` :
`- Detaillierter Arbeitsumfang
- Materialspezifikationen und Qualität
- Ausführungsdetails und Technik
- Qualitätsstandards und Normen
- Besondere projektspezifische Anforderungen
- Schnittstellen zu anderen Gewerken
- Baustellenbedingungen
- Zeitliche Anforderungen`}

OUTPUT (NUR valides JSON, keine Markdown):
[
  {
    "id": "eindeutige_id",
    "category": "Kategorie",
    "question": "Präzise, verständliche Frage",
    "type": "text|number|select|multiselect",
    "required": true|false,
    "options": ["Option1", "Option2"],
    "hint": "Hilfetext für den Nutzer"
  }
]`;

  const userPrompt = `AUFGABE:
Generiere basierend auf dem Template einen vollständigen, adaptiven Fragenkatalog.

TEMPLATE:
${questionPrompt}

PROJEKTKONTEXT:
- Kategorie: ${projectContext.category || 'Nicht angegeben'}
- Unterkategorie: ${projectContext.subCategory || 'Nicht angegeben'}
- Beschreibung: ${projectContext.description || 'Keine'}
- Zeitrahmen: ${projectContext.timeframe || 'Nicht angegeben'}
- Budget: ${projectContext.budget || 'Nicht angegeben'}
- Komplexität: ${projectComplexity}

${isIntake ? 
'Erstelle einen VOLLSTÄNDIGEN Intake-Fragenkatalog der ALLE wichtigen Projektaspekte erfasst.' :
`Erstelle einen UMFASSENDEN Fragenkatalog für ${tradeName} der ALLE relevanten technischen Details abfragt.`}

Die Fragen müssen:
1. Vollständig und projektrelevant sein
2. Verständlich für Laien formuliert sein
3. Alle notwendigen Details für ein präzises LV erfassen
4. An die Projektkomplexität angepasst sein (${questionGuideline} Fragen)`;

  try {
    const response = await llmWithPolicy(isIntake ? 'intake' : 'questions', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { 
      maxTokens: 6000,
      temperature: 0.6,
      jsonMode: true 
    });
    
    const cleanedResponse = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const questions = JSON.parse(cleanedResponse);
    
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Invalid question format received');
    }
    
    const processedQuestions = questions.map((q, idx) => ({
      ...q,
      id: q.id || `${tradeCode}-${idx + 1}`,
      question: q.question || q.text || q.q,
      type: q.type || 'text',
      required: q.required !== undefined ? q.required : true,
      tradeId,
      tradeName
    }));
    
    console.log(`[QUESTIONS] Generated ${processedQuestions.length} adaptive questions for ${tradeName}`);
    return processedQuestions;
    
  } catch (err) {
    console.error('[QUESTIONS] Generation failed:', err);
    throw new Error(`Fragengenerierung für ${tradeName} fehlgeschlagen`);
  }
}

/**
 * PDF Generation für LV
 */
function formatCurrency(amount) {
  if (!amount && amount !== 0) return '________';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

function generateLVPDF(lv, tradeName, tradeCode, projectDescription, withPrices = true) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Header
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .text('LEISTUNGSVERZEICHNIS', { align: 'center' });
      
      doc.moveDown(0.5);
      
      doc.fontSize(14)
         .font('Helvetica')
         .fillColor('#666666')
         .text(withPrices ? 'Kalkulation' : 'Angebotsanfrage', { align: 'center' });
      
      doc.moveDown(1.5);
      
      // Projektinfo
      doc.fontSize(12)
         .fillColor('black')
         .font('Helvetica-Bold')
         .text('Projektbeschreibung:', { continued: false });
      
      doc.font('Helvetica')
         .text(projectDescription || 'Keine Beschreibung vorhanden');
      
      doc.moveDown(0.5);
      
      doc.font('Helvetica-Bold')
         .text('Gewerk: ', { continued: true })
         .font('Helvetica')
         .text(`${tradeCode} - ${tradeName}`);
      
      doc.moveDown(0.5);
      
      doc.font('Helvetica-Bold')
         .text('Erstellt am: ', { continued: true })
         .font('Helvetica')
         .text(new Date().toLocaleDateString('de-DE', {
           year: 'numeric',
           month: 'long',
           day: 'numeric'
         }));
      
      doc.moveDown(1);
      
      // Trennlinie
      doc.moveTo(50, doc.y)
         .lineTo(545, doc.y)
         .stroke();
      
      doc.moveDown(1);
      
      if (!withPrices) {
        doc.fontSize(10)
           .fillColor('#FF6600')
           .font('Helvetica-Oblique')
           .text('Hinweis: Bitte tragen Sie Ihre Preise in die vorgesehenen Felder ein.', { align: 'center' });
        doc.moveDown(1);
        doc.fillColor('black');
      }
      
      // Positionen
      doc.font('Helvetica-Bold')
         .fontSize(14)
         .text('POSITIONEN', { underline: true });
      
      doc.moveDown(0.5);
      
      const tableTop = doc.y;
      const col1 = 50;  
      const col2 = 90;  
      const col3 = 250; 
      const col4 = 310; 
      const col5 = 370; 
      const col6 = 450; 
      
      doc.fontSize(10)
         .font('Helvetica-Bold');
      
      doc.text('Pos.', col1, tableTop);
      doc.text('Bezeichnung', col2, tableTop);
      doc.text('Menge', col3, tableTop);
      doc.text('Einheit', col4, tableTop);
      doc.text('EP (€)', col5, tableTop);
      doc.text('GP (€)', col6, tableTop);
      
      doc.moveTo(col1, tableTop + 15)
         .lineTo(545, tableTop + 15)
         .stroke();
      
      let yPosition = tableTop + 25;
      let totalSum = 0;
      
      doc.font('Helvetica')
         .fontSize(9);
      
      if (lv && lv.positions && Array.isArray(lv.positions)) {
        lv.positions.forEach((pos, index) => {
          if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
            
            doc.fontSize(10)
               .font('Helvetica-Bold');
            doc.text('Pos.', col1, yPosition);
            doc.text('Bezeichnung', col2, yPosition);
            doc.text('Menge', col3, yPosition);
            doc.text('Einheit', col4, yPosition);
            doc.text('EP (€)', col5, yPosition);
            doc.text('GP (€)', col6, yPosition);
            
            doc.moveTo(col1, yPosition + 15)
               .lineTo(545, yPosition + 15)
               .stroke();
            
            yPosition += 25;
            doc.font('Helvetica')
               .fontSize(9);
          }
          
          doc.text(pos.pos || `${index + 1}`, col1, yPosition, { width: 30 });
          
          const titleHeight = doc.heightOfString(pos.title || '', { width: 150 });
          doc.text(pos.title || 'Keine Bezeichnung', col2, yPosition, { width: 150 });
          
          doc.text(pos.quantity?.toString() || '-', col3, yPosition, { width: 50, align: 'right' });
          doc.text(pos.unit || '-', col4, yPosition, { width: 50 });
          
          if (withPrices && pos.unitPrice) {
            doc.text(formatCurrency(pos.unitPrice), col5, yPosition, { width: 70, align: 'right' });
          } else {
            doc.text('________', col5, yPosition, { width: 70, align: 'right' });
          }
          
          if (withPrices && pos.totalPrice) {
            doc.text(formatCurrency(pos.totalPrice), col6, yPosition, { width: 70, align: 'right' });
            totalSum += pos.totalPrice;
          } else if (withPrices && pos.quantity && pos.unitPrice) {
            const total = pos.quantity * pos.unitPrice;
            doc.text(formatCurrency(total), col6, yPosition, { width: 70, align: 'right' });
            totalSum += total;
          } else {
            doc.text('________', col6, yPosition, { width: 70, align: 'right' });
          }
          
          if (pos.description) {
            yPosition += Math.max(titleHeight, 15);
            doc.fontSize(8)
               .fillColor('#666666')
               .text(pos.description, col2, yPosition, { width: 400 });
            yPosition += doc.heightOfString(pos.description, { width: 400 });
            doc.fontSize(9)
               .fillColor('black');
          } else {
            yPosition += Math.max(titleHeight, 15);
          }
          
          yPosition += 5;
        });
      }
      
      // Summen
      yPosition += 10;
      
      if (yPosition > 650) {
        doc.addPage();
        yPosition = 50;
      }
      
      doc.moveTo(col5 - 10, yPosition)
         .lineTo(545, yPosition)
         .stroke();
      
      yPosition += 10;
      
      if (withPrices) {
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('Nettosumme:', col5 - 80, yPosition)
           .text(formatCurrency(totalSum), col6, yPosition, { width: 70, align: 'right' });
        
        yPosition += 20;
        
        const vat = totalSum * 0.19;
        doc.font('Helvetica')
           .text('MwSt. (19%):', col5 - 80, yPosition)
           .text(formatCurrency(vat), col6, yPosition, { width: 70, align: 'right' });
        
        yPosition += 20;
        
        doc.moveTo(col5 - 10, yPosition - 5)
           .lineTo(545, yPosition - 5)
           .stroke();
        doc.moveTo(col5 - 10, yPosition - 3)
           .lineTo(545, yPosition - 3)
           .stroke();
        
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('Gesamtsumme:', col5 - 80, yPosition + 5)
           .text(formatCurrency(totalSum + vat), col6, yPosition + 5, { width: 70, align: 'right' });
      } else {
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('Gesamtsumme:', col5 - 80, yPosition)
           .text('________', col6, yPosition, { width: 70, align: 'right' });
      }
      
      // Footer
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor('#666666')
         .text('Alle Preise verstehen sich inklusive aller Nebenleistungen gemäß VOB/C.', 50, 750)
         .text('Erstellt mit BYNDL - KI-gestützte Bauprojektplanung', 50, 765);
      
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
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
    message: 'BYNDL Backend v3.0',
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
    
    const projectResult = await query(
      `INSERT INTO projects (category, sub_category, description, timeframe, budget)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [category || null, subCategory || null, description, timeframe || null, budget || null]
    );
    
    const project = projectResult.rows[0];
    
    const detectedTrades = await detectTrades({
      category,
      subCategory,
      description,
      timeframe,
      budget
    });
    
    for (const trade of detectedTrades) {
      await query(
        `INSERT INTO project_trades (project_id, trade_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [project.id, trade.id]
      );
    }
    
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
    
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = projectResult.rows[0];
    
    const tradesResult = await query(
      `SELECT t.* FROM trades t
       JOIN project_trades pt ON pt.trade_id = t.id
       WHERE pt.project_id = $1
       ORDER BY t.name`,
      [projectId]
    );
    
    project.trades = tradesResult.rows;
    
    res.json(project);
    
  } catch (err) {
    console.error('Failed to fetch project:', err);
    res.status(500).json({ error: err.message });
  }
});

// Intake: Generate adaptive questions
app.post('/api/projects/:projectId/intake/questions', async (req, res) => {
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
    await ensureProjectTrade(projectId, tradeId);
    
    const questions = await generateQuestions(tradeId, {
      category: project.category,
      subCategory: project.sub_category,
      description: project.description,
      timeframe: project.timeframe,
      budget: project.budget
    });

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

    const project = (await query('SELECT * FROM projects WHERE id=$1', [projectId])).rows[0];
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const intTrade = (await query(`SELECT id FROM trades WHERE code='INT'`)).rows[0];
    if (!intTrade) return res.status(500).json({ error: 'INT trade missing' });

    const answers = (await query(
      `SELECT question_id, answer_text
       FROM answers
       WHERE project_id=$1 AND trade_id=$2
       ORDER BY question_id`,
      [projectId, intTrade.id]
    )).rows;

    const availableTrades = await getAvailableTrades();
    const validCodes = availableTrades.map(t => t.code);

    const master = await getPromptByName('master');

    const system = `${master}

WICHTIG: Unterscheide klar zwischen GEWERKEN und EMPFEHLUNGEN!

VERFÜGBARE GEWERKE-CODES (NUR DIESE für "trades" verwenden):
${availableTrades.map(t => `- ${t.code}: ${t.name}`).join('\n')}

Gib NUR valides JSON zurück:
{
  "recommendations": ["Empfehlung für Gutachter/Statiker/Planer etc."],
  "risks": ["Identifizierte Risiken"],
  "missingInfo": ["Fehlende Informationen"],
  "trades": [
    {"code": "SAN", "reason": "Begründung warum dieses GEWERK benötigt wird"}
  ]
}

REGELN:
- "trades" darf NUR Codes aus der obigen Liste enthalten!
- Gutachter, Statiker, Planer etc. gehören in "recommendations", NICHT in "trades"`;

    const user = `Projekt:
Kategorie: ${project.category}
Beschreibung: ${project.description}

Antworten Intake:
${answers.map(a => `- ${a.question_id}: ${a.answer_text}`).join('\n')}

Analysiere das Projekt und gib Empfehlungen.`;

    const raw = await llmWithPolicy('summary', [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ], { maxTokens: 4000, temperature: 0.3, jsonMode: true });

    const cleanedResponse = raw
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const summary = JSON.parse(cleanedResponse);

    if (summary.trades && Array.isArray(summary.trades)) {
      summary.trades = summary.trades.filter(t => {
        const isValid = validCodes.includes(t.code);
        if (!isValid && (t.code === 'GUT' || t.reason?.toLowerCase().includes('gutachter'))) {
          summary.recommendations = summary.recommendations || [];
          summary.recommendations.push(`Gutachter für ${t.reason || 'Schadensanalyse'}`);
        }
        return isValid;
      });
    }

    res.json({ ok: true, summary });
  } catch (err) {
    console.error('intake/summary failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Generate adaptive questions for a specific trade
app.post('/api/projects/:projectId/trades/:tradeId/questions', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = projectResult.rows[0];
    await ensureProjectTrade(projectId, tradeId);
    
    const questions = await generateQuestions(tradeId, {
      category: project.category,
      subCategory: project.sub_category,
      description: project.description,
      timeframe: project.timeframe,
      budget: project.budget,
      projectId: projectId
    });
    
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

// Get questions for a trade
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

// Save answers
app.post('/api/projects/:projectId/trades/:tradeId/answers', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    const { answers } = req.body;
    
    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers must be an array' });
    }
    
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

// Generate detailed LV for a trade
app.post('/api/projects/:projectId/trades/:tradeId/lv', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;

    const project = (await query('SELECT * FROM projects WHERE id=$1', [projectId])).rows[0];
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const trade = (await query('SELECT id, name, code FROM trades WHERE id=$1', [tradeId])).rows[0];
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    
    await ensureProjectTrade(projectId, tradeId);
    
    const intTrade = (await query(`SELECT id FROM trades WHERE code='INT' LIMIT 1`)).rows[0];
    const answersInt = intTrade
      ? (await query(
          `SELECT q.text as question, a.answer_text as answer, a.assumption
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
      `SELECT q.text as question, a.answer_text as answer, a.assumption
       FROM answers a
       JOIN questions q ON q.project_id = a.project_id 
         AND q.trade_id = a.trade_id 
         AND q.question_id = a.question_id
       WHERE a.project_id=$1 AND a.trade_id=$2
       ORDER BY a.question_id`,
      [projectId, tradeId]
    )).rows;

    const lvPromptRow = (await query(
      `SELECT content FROM prompts WHERE trade_id=$1 AND type='lv' ORDER BY updated_at DESC LIMIT 1`,
      [tradeId]
    )).rows[0];
    if (!lvPromptRow) return res.status(400).json({ error: 'LV prompt missing for trade' });

    const system = `Du bist ein Experte für VOB-konforme Leistungsverzeichnisse mit 20+ Jahren Erfahrung.
Erstelle ein VOLLSTÄNDIGES und DETAILLIERTES Leistungsverzeichnis für ${trade.name}.

ANFORDERUNGEN:
1. VOLLSTÄNDIGKEIT: Alle notwendigen Positionen (10-30 je nach Projektumfang)
2. VOB-KONFORMITÄT: Jede Position VOB/C-konform beschrieben
3. DETAILTIEFE: Ausführliche Leistungsbeschreibungen (2-3 Sätze minimum)
4. PREISGENAUIGKEIT: Realistische marktübliche Preise (Stand 2024/2025)
5. MENGENERMITTLUNG: Plausible Mengen basierend auf Projektangaben

OUTPUT FORMAT (NUR valides JSON):
{
  "trade": "${trade.name}",
  "tradeCode": "${trade.code}",
  "projectType": "Neubau/Sanierung/Modernisierung",
  "positions": [
    { 
      "pos": "01.01.001", 
      "title": "Präziser Positionstitel", 
      "description": "Detaillierte VOB-konforme Leistungsbeschreibung mit allen relevanten Angaben zu Material, Ausführung, Qualität, Normen. Inklusive aller Nebenleistungen gemäß VOB/C.", 
      "quantity": 150.00, 
      "unit": "m²/m/Stk/psch", 
      "unitPrice": 45.50,
      "totalPrice": 6825.00,
      "notes": "Optionale Hinweise"
    }
  ],
  "totalSum": 0,
  "additionalNotes": "Wichtige Hinweise zur Ausführung",
  "includedServices": ["Eingeschlossene Nebenleistungen"],
  "excludedServices": ["Nicht enthaltene Leistungen"],
  "standards": ["Relevante DIN-Normen"],
  "priceBase": "Preisbasis und Gültigkeit",
  "priceDate": "${new Date().toISOString().split('T')[0]}",
  "executionTime": "Geschätzte Ausführungsdauer"
}`;

    const user = `GEWERK-TEMPLATE:
${lvPromptRow.content}

PROJEKTDATEN:
- Kategorie: ${project.category || 'Nicht spezifiziert'}
- Beschreibung: ${project.description || 'Keine'}
- Zeitplan: ${project.timeframe || 'Flexibel'}
- Budget: ${project.budget || 'Nicht spezifiziert'}

INTAKE-ANTWORTEN:
${answersInt.length > 0 ? answersInt.map(a => 
  `Frage: ${a.question}
Antwort: ${a.answer}
${a.assumption ? `Annahme: ${a.assumption}` : ''}`
).join('\n\n') : 'Keine Intake-Informationen'}

GEWERKESPEZIFISCHE ANTWORTEN (${trade.name}):
${answersTrade.length > 0 ? answersTrade.map(a => 
  `Frage: ${a.question}
Antwort: ${a.answer}
${a.assumption ? `Annahme: ${a.assumption}` : ''}`
).join('\n\n') : 'Keine gewerkespezifischen Antworten'}

Erstelle ein VOLLSTÄNDIGES LV mit ALLEN notwendigen Positionen.
Das LV soll direkt als Ausschreibungsunterlage verwendbar sein!`;

    const raw = await llmWithPolicy('lv', [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ], { 
      maxTokens: 8000,
      temperature: 0.3,
      jsonMode: true 
    });

    let lv;
    try {
      const cleanedResponse = raw
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      lv = JSON.parse(cleanedResponse);
      
      if (lv.positions && Array.isArray(lv.positions)) {
        let calculatedSum = 0;
        lv.positions = lv.positions.map(pos => {
          if (!pos.totalPrice && pos.quantity && pos.unitPrice) {
            pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
          }
          calculatedSum += pos.totalPrice || 0;
          return pos;
        });
        lv.totalSum = Math.round(calculatedSum * 100) / 100;
        
        lv.statistics = {
          positionCount: lv.positions.length,
          averagePositionValue: Math.round((lv.totalSum / lv.positions.length) * 100) / 100,
          minPosition: Math.min(...lv.positions.map(p => p.totalPrice || 0)),
          maxPosition: Math.max(...lv.positions.map(p => p.totalPrice || 0))
        };
      }
      
    } catch (parseError) {
      console.error('[LV] JSON parse error:', parseError);
      lv = {
        trade: trade.name,
        tradeCode: trade.code,
        positions: [{
          pos: "01.01",
          title: "LV-Generierung fehlgeschlagen",
          description: "Bitte kontaktieren Sie den Support",
          quantity: 1,
          unit: "psch",
          unitPrice: 0,
          totalPrice: 0
        }],
        totalSum: 0,
        error: "Parse error"
      };
    }

    const lvWithMeta = {
      ...lv,
      metadata: {
        generatedAt: new Date().toISOString(),
        projectId: projectId,
        tradeId: tradeId,
        intakeAnswersCount: answersInt.length,
        tradeAnswersCount: answersTrade.length,
        positionsCount: lv.positions?.length || 0,
        totalValue: lv.totalSum || 0
      }
    };

    await query(
      `INSERT INTO lvs (project_id, trade_id, content)
       VALUES ($1,$2,$3)
       ON CONFLICT (project_id, trade_id)
       DO UPDATE SET content=$3, updated_at=NOW()`,
      [projectId, tradeId, lvWithMeta]
    );

    console.log(`[LV] Generated for ${trade.name}: ${lv.positions?.length || 0} positions, Total: €${lv.totalSum || 0}`);

    res.json({ 
      ok: true, 
      trade: { id: trade.id, code: trade.code, name: trade.name }, 
      lv: lvWithMeta
    });
    
  } catch (err) {
    console.error('Generate LV failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get aggregated LVs for a project
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

// Get all LVs for a project (legacy)
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

// Export LV with or without prices
app.get('/api/projects/:projectId/trades/:tradeId/lv/export', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    const { withPrices } = req.query;
    
    const result = await query(
      `SELECT l.content, t.name as trade_name, t.code as trade_code, p.description as project_description
       FROM lvs l 
       JOIN trades t ON t.id = l.trade_id
       JOIN projects p ON p.id = l.project_id
       WHERE l.project_id = $1 AND l.trade_id = $2`,
      [projectId, tradeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'LV not found' });
    }
    
    const { content, trade_name, trade_code, project_description } = result.rows[0];
    const lv = typeof content === 'string' ? JSON.parse(content) : content;
    
    if (withPrices === 'false') {
      lv.positions = lv.positions.map(pos => ({
        pos: pos.pos,
        title: pos.title,
        description: pos.description,
        quantity: pos.quantity,
        unit: pos.unit,
        unitPrice: '________',
        totalPrice: '________'
      }));
      lv.exportType = 'Angebotsanfrage';
      lv.note = 'Bitte tragen Sie Ihre Preise in die markierten Felder ein.';
    } else {
      lv.exportType = 'Kalkulation';
    }
    
    res.json({
      ok: true,
      tradeName: trade_name,
      tradeCode: trade_code,
      projectDescription: project_description,
      withPrices: withPrices !== 'false',
      lv
    });
    
  } catch (err) {
    console.error('Export LV failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate PDF for LV
app.get('/api/projects/:projectId/trades/:tradeId/lv.pdf', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    const { withPrices } = req.query;
    
    const result = await query(
      `SELECT l.content, t.name as trade_name, t.code as trade_code, p.description as project_description
       FROM lvs l 
       JOIN trades t ON t.id = l.trade_id
       JOIN projects p ON p.id = l.project_id
       WHERE l.project_id = $1 AND l.trade_id = $2`,
      [projectId, tradeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'LV not found' });
    }
    
    const { content, trade_name, trade_code, project_description } = result.rows[0];
    const lv = typeof content === 'string' ? JSON.parse(content) : content;
    
    const pdfBuffer = await generateLVPDF(
      lv,
      trade_name,
      trade_code,
      project_description,
      withPrices !== 'false'
    );
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="LV_${trade_code}_${withPrices !== 'false' ? 'mit' : 'ohne'}_Preise.pdf"`);
    res.send(pdfBuffer);
    
  } catch (err) {
    console.error('PDF generation failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get project cost summary
app.get('/api/projects/:projectId/cost-summary', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const lvsResult = await query(
      `SELECT l.content, t.name as trade_name, t.code as trade_code
       FROM lvs l 
       JOIN trades t ON t.id = l.trade_id
       WHERE l.project_id = $1`,
      [projectId]
    );
    
    const summary = {
      trades: [],
      totalCost: 0,
      pricesComplete: true
    };
    
    for (const row of lvsResult.rows) {
      const lv = typeof row.content === 'string' 
        ? JSON.parse(row.content) 
        : row.content;
      
      const tradeCost = lv.totalSum || 
        (lv.positions || []).reduce((sum, pos) => 
          sum + (pos.totalPrice || 0), 0
        );
      
      summary.trades.push({
        name: row.trade_name,
        code: row.trade_code,
        cost: tradeCost,
        hasPrice: tradeCost > 0
      });
      
      summary.totalCost += tradeCost;
      
      if (tradeCost === 0) {
        summary.pricesComplete = false;
      }
    }
    
    summary.additionalCosts = {
      planningCosts: summary.totalCost * 0.10,
      contingency: summary.totalCost * 0.05,
      vat: summary.totalCost * 0.19
    };
    
    summary.grandTotal = summary.totalCost + 
      summary.additionalCosts.planningCosts +
      summary.additionalCosts.contingency +
      summary.additionalCosts.vat;
    
    res.json({ ok: true, summary });
    
  } catch (err) {
    console.error('Cost summary failed:', err);
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

// Admin: Update prompt
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

// ===========================================================================
// PUBLIC PROMPT ROUTES
// ===========================================================================

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
  res.json({ 
    message: "BYNDL Backend v3.0", 
    status: "running",
    features: {
      adaptiveQuestions: true,
      dynamicQuestionCount: true,
      enhancedTokenLimits: true,
      detailedLVs: true
    }
  });
});

// Environment info
app.get('/__info', (req, res) => {
  res.json({
    node: process.version,
    env: {
      OPENAI_MODEL: MODEL_OPENAI,
      ANTHROPIC_MODEL: MODEL_ANTHROPIC,
      DATABASE_URL: process.env.DATABASE_URL ? "✔️ gesetzt" : "❌ fehlt",
      JWT_SECRET: process.env.JWT_SECRET ? "✔️ gesetzt" : "❌ fehlt"
    },
    limits: {
      detect: "2500 tokens",
      questions: "6000 tokens",
      lv: "8000 tokens",
      intake: "6000 tokens"
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

// ===========================================================================
// SERVER START
// ===========================================================================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║                                        ║
║     BYNDL Backend v3.0 Started        ║
║                                        ║
║     Port: ${PORT}                        ║
║     Environment: ${process.env.NODE_ENV || 'development'}          ║
║                                        ║
║     Features:                          ║
║     ✓ Adaptive Question Generation    ║
║     ✓ Dynamic Question Count          ║
║     ✓ Enhanced Token Limits           ║
║     ✓ Detailed LV Generation          ║
║                                        ║
╚════════════════════════════════════════╝
  `);
});
