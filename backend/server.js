/*
 * BYNDL Proof of Concept – Backend v4.0
 * 
 * HAUPTVERBESSERUNGEN:
 * - Intelligente Fragenanzahl basierend auf Gewerke-Komplexität
 * - Detaillierte Mengenerfassung mit Validierung
 * - Keine erfundenen LV-Positionen - nur explizit erfragte
 * - Laienverständliche Fragen mit Erläuterungen
 * - Intelligente Schätzlogik bei unsicheren Angaben
 * - Realistische Preiskalkulationen
 */

const { query } = require('./db.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');  // oder require('bcrypt')
const crypto = require('crypto');  // Für Reset-Token
const PDFDocument = require('pdfkit');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const multer = require('multer');
const nodemailer = require('nodemailer');
const emailService = require('./emailService');
const OpenAI = require("openai");
const Anthropic = require("@anthropic-ai/sdk");

// ===========================================================================
// FILE UPLOAD CONFIGURATION
// ===========================================================================
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Ungültiger Dateityp'));
    }
  }
});

// Irgendwo vor den Routes:
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function formatCurrency(amount) {
  if (!amount && amount !== 0) return '0 €';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

// Modellnamen aus Umgebungsvariablen
const MODEL_OPENAI = process.env.MODEL_OPENAI || process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const MODEL_ANTHROPIC_QUESTIONS = process.env.MODEL_ANTHROPIC_QUESTIONS || process.env.ANTHROPIC_MODEL_QUESTIONS || 'claude-sonnet-4-20250514';
const MODEL_ANTHROPIC_LV = process.env.MODEL_ANTHROPIC_LV || process.env.ANTHROPIC_MODEL_LV || 'claude-opus-4-1-20250805';

// ===========================================================================
// GEWERKE-KOMPLEXITÄT DEFINITIONEN (KORREKTE CODES)
// ===========================================================================

const TRADE_COMPLEXITY = {
  // Sehr komplexe Gewerke (25-40 Fragen)
  DACH:  { complexity: 'SEHR_HOCH', minQuestions: 18, maxQuestions: 26, targetPositionsRatio: 0.9 },
  ELEKT: { complexity: 'SEHR_HOCH', minQuestions: 16, maxQuestions: 23, targetPositionsRatio: 0.9 },
  SAN:   { complexity: 'SEHR_HOCH', minQuestions: 16, maxQuestions: 23, targetPositionsRatio: 0.85 },
  HEI:   { complexity: 'SEHR_HOCH', minQuestions: 16, maxQuestions: 23, targetPositionsRatio: 0.8 },
  KLIMA: { complexity: 'SEHR_HOCH', minQuestions: 16, maxQuestions: 22, targetPositionsRatio: 0.8 },
  ROH:   { complexity: 'SEHR_HOCH', minQuestions: 18, maxQuestions: 25, targetPositionsRatio: 0.9 },
  
  // Komplexe Gewerke (20-30 Fragen)
  TIS:   { complexity: 'HOCH', minQuestions: 15, maxQuestions: 20, targetPositionsRatio: 1.0 }, // Türen: oft 1:1
  FEN:   { complexity: 'HOCH', minQuestions: 18, maxQuestions: 22, targetPositionsRatio: 1.0 }, // Fenster: oft 1:1
  FASS:  { complexity: 'HOCH', minQuestions: 18, maxQuestions: 22, targetPositionsRatio: 0.9 },
  SCHL:  { complexity: 'HOCH', minQuestions: 15, maxQuestions: 20, targetPositionsRatio: 0.8 },
  PV:    { complexity: 'HOCH', minQuestions: 15, maxQuestions: 22, targetPositionsRatio: 0.8 },
  ZIMM:  { complexity: 'HOCH', minQuestions: 15, maxQuestions: 22, targetPositionsRatio: 0.8 },

  // Mittlere Komplexität (15-20 Fragen)
  FLI:   { complexity: 'MITTEL', minQuestions: 16, maxQuestions: 20, targetPositionsRatio: 0.8 },
  ESTR:  { complexity: 'MITTEL', minQuestions: 12, maxQuestions: 17, targetPositionsRatio: 0.7 },
  TRO:   { complexity: 'MITTEL', minQuestions: 15, maxQuestions: 20, targetPositionsRatio: 0.75 },
  BOD:   { complexity: 'MITTEL', minQuestions: 15, maxQuestions: 20, targetPositionsRatio: 0.8 },
  AUSS:  { complexity: 'MITTEL', minQuestions: 15, maxQuestions: 20, targetPositionsRatio: 0.75 },

  // Einfache Gewerke (8-15 Fragen)
  MAL:   { complexity: 'EINFACH', minQuestions: 10,  maxQuestions: 15, targetPositionsRatio: 0.8 },
  GER:   { complexity: 'EINFACH', minQuestions: 8,  maxQuestions: 12, targetPositionsRatio: 0.8 },
  ABBR:  { complexity: 'EINFACH', minQuestions: 10, maxQuestions: 15, targetPositionsRatio: 0.8 },

  // Intake ist speziell (16-24 Fragen)
  INT:   { complexity: 'INTAKE', minQuestions: 16, maxQuestions: 26, targetPositionsRatio: 0.0 }
};

// Fallback für nicht definierte Gewerke
const DEFAULT_COMPLEXITY = { 
  complexity: 'MITTEL', 
  minQuestions: 14, 
  maxQuestions: 22,
  targetPositionsRatio: 0.75  // NEU: Ratio hinzufügen
};

// ===========================================================================
// HELPER FUNCTIONS
// ===========================================================================

/**
 * Erweiterte LLM-Policy mit robuster Fehlerbehandlung
 */
async function llmWithPolicy(task, messages, options = {}) {
  const defaultMaxTokens = {
    'detect': 3000,      
    'questions': 10000,   
    'lv': 16000,         
    'intake': 10000,      
    'summary': 3000,
    'validation': 3000,
    'clarification': 1000, // NEU: Für Rückfragen
    'context': 8000       // NEU: Für Kontext-basierte Fragen
  };
  
  const maxTokens = options.maxTokens || defaultMaxTokens[task] || 4000;
  
  const defaultTimeouts = {
    'questions': 90000,  
    'lv': 120000,        
    'intake': 90000,     
    'optimization': 60000,
    'clarification': 30000, // NEU: Rückfragen sind schneller
    'context': 60000,       // NEU: Kontext-Fragen
    'default': 45000     
  };
  
  if (!options.timeout) {
    options.timeout = defaultTimeouts[task] || defaultTimeouts.default;
    console.log(`[LLM] Setting timeout for ${task}: ${options.timeout}ms`);
  }
  
  // Optimization-Task mit Claude als Haupt-LLM, OpenAI als Fallback
if (task === 'optimization') {
  console.log('[LLM] Optimization task - using Claude with OpenAI fallback');
  
  try {
    // Primär: Claude verwenden
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: options.maxTokens || 6000,
      temperature: options.temperature || 0.3,
      messages: messages.map(msg => ({
        role: msg.role === 'system' ? 'user' : msg.role,
        content: msg.content
      }))
    });
    
    return response.content[0].text;
    
  } catch (claudeError) {
    console.error('[LLM] Claude failed for optimization, trying OpenAI fallback:', claudeError.message);
    
    // Fallback: OpenAI
    try {
      const response = await openai.chat.completions.create({
        model: MODEL_OPENAI,
        messages,
        temperature: options.temperature || 0.3,
        max_tokens: options.maxTokens || 4000,
        response_format: { type: "json_object" }
      });
      return response.choices[0].message.content;
    } catch (openaiError) {
      console.error('[LLM] Both Claude and OpenAI failed for optimization');
      throw openaiError;
    }
  }
}
  
  // DEBUG: Log prompt sizes for questions task
  if (task === 'questions' || task === 'intake') {
    const systemMsg = messages.find(m => m.role === 'system');
    const userMsg = messages.find(m => m.role === 'user');
    
    console.log(`[LLM-DEBUG] Task: ${task}`);
    console.log(`[LLM-DEBUG] System prompt length: ${systemMsg?.content?.length || 0} chars`);
    console.log(`[LLM-DEBUG] User prompt length: ${userMsg?.content?.length || 0} chars`);
    
    if (systemMsg?.content?.length > 8000) {
      console.log(`[LLM-DEBUG] ⚠️ System prompt exceeds Anthropic limit!`);
    }
  }
  
  const temperature = options.temperature !== undefined ? options.temperature : 0.4;
  
  // NEU: Modell-Selektion basierend auf Task
  const getAnthropicModel = (task) => {
    if (task === 'lv') {
      // Claude Opus für LV-Generierung
      return MODEL_ANTHROPIC_LV || MODEL_ANTHROPIC || 'claude-sonnet-4-20250514';
    }
    // Claude Sonnet für alle anderen Tasks
    return MODEL_ANTHROPIC_QUESTIONS || MODEL_ANTHROPIC || 'claude-sonnet-4-20250514';
  };
  
  // GEÄNDERT: Anthropic als primärer Provider für ALLE Tasks
  const primaryProvider = 'anthropic';
  
  // OpenAI als Fallback bleibt unverändert
  const callOpenAI = async () => {
    try {
      const useJsonMode = options.jsonMode;
      
      const response = await openai.chat.completions.create({
        model: MODEL_OPENAI,
        messages,
        temperature,
        max_tokens: Math.min(maxTokens, 16384),
        response_format: useJsonMode ? { type: "json_object" } : undefined
      });
      return response.choices[0].message.content;
    } catch (error) {
      console.error('[LLM] OpenAI error:', error.status || error.message);
      throw error;
    }
  };

  // Unicode-Bereinigung für Anthropic
  function cleanUnicodeForAnthropic(text) {
    if (!text) return '';
    
    return text
      .normalize('NFC')
      .replace(/[\uD800-\uDFFF]/g, '')
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
      .replace(/[\uFFFD]/g, '')
      .trim();
  }
  
  // GEÄNDERT: Claude mit task-spezifischem Modell
  const callClaude = async () => {
    try {
      // Wähle das richtige Modell basierend auf Task
      const modelToUse = getAnthropicModel(task);
      
      console.log(`[LLM-CLAUDE] Using model ${modelToUse} for task: ${task}`);
      
      let systemMessage = messages.find(m => m.role === "system")?.content || "";
      const originalUserMessages = messages.filter(m => m.role === "user");
      
      // BEREINIGE Unicode
      systemMessage = cleanUnicodeForAnthropic(systemMessage);
      const cleanedUserMessages = originalUserMessages.map(msg => ({
        ...msg,
        content: cleanUnicodeForAnthropic(msg.content)
      }));
      
      // Baue Messages für Anthropic auf
      let claudeMessages = [];
      
      // Kombiniere System-Content mit erster User-Message wenn System zu lang
      if (systemMessage.length > 8000) {
        console.log(`[LLM-CLAUDE] System prompt ${systemMessage.length} chars - moving to user message`);
        
        const combinedContent = `SYSTEM-INSTRUKTIONEN:
=====================================
${systemMessage}

ANFRAGE:
========
${cleanedUserMessages[0]?.content || 'Bitte die obigen Instruktionen befolgen.'}`;
        
        claudeMessages.push({
          role: "user",
          content: cleanUnicodeForAnthropic(combinedContent)
        });
        
        for (let i = 1; i < cleanedUserMessages.length; i++) {
          claudeMessages.push({
            role: "user",
            content: cleanedUserMessages[i].content
          });
        }
        
        // GEÄNDERT: Verwende task-spezifisches Modell
        const response = await anthropic.messages.create({
          model: modelToUse,
          max_tokens: Math.min(maxTokens, 16000),
          temperature,
          messages: claudeMessages
        });
        
        console.log(`[LLM-CLAUDE] Success with ${modelToUse} (no system prompt)`);
        return response.content[0].text;
        
      } else {
        // System ist klein genug - normale Verarbeitung
        for (const msg of messages.filter(m => m.role !== "system")) {
          claudeMessages.push({
            role: msg.role,
            content: cleanUnicodeForAnthropic(
              typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
            )
          });
        }
        
        // NEU: Spezielle JSON-Mode Behandlung je nach Modell
let finalSystem = systemMessage;
if (options.jsonMode) {
  // Universelle JSON-Instruktion für ALLE Tasks und ALLE Claude-Modelle
  finalSystem = `KRITISCH: Du MUSST ausschließlich valides JSON zurückgeben!
- Beginne deine Antwort DIREKT mit {
- Ende deine Antwort mit }
- KEINE Markdown-Formatierung (keine \`\`\`json)
- KEINE Erklärungen vor oder nach dem JSON
- NUR das reine JSON-Objekt

${systemMessage}`;
}
        
        console.log(`[LLM-CLAUDE] Normal call - Model: ${modelToUse} | System: ${finalSystem.length} chars`);
        
        // GEÄNDERT: Verwende task-spezifisches Modell
        const response = await anthropic.messages.create({
          model: modelToUse,
          max_tokens: Math.min(maxTokens, 16000),
          temperature,
          system: finalSystem,
          messages: claudeMessages
        });
        
        console.log(`[LLM-CLAUDE] Success with ${modelToUse}`);
        return response.content[0].text;
      }
      
    } catch (error) {
      console.error('[LLM-CLAUDE] Full error:', error);
      console.error(`[LLM-CLAUDE] Failed model: ${getAnthropicModel(task)}`);
      
      if (error.status === 400) {
        console.error('[LLM-CLAUDE] 400 Error - Message:', error.message);
        if (error.error) {
          console.error('[LLM-CLAUDE] Error details:', error.error);
        }
      }
      
      throw error;
    }
  };
  
  // Rest der Funktion - jetzt mit Anthropic als primär
  let result = null;
  let lastError = null;
  
  // Try primary provider (jetzt immer Anthropic)
  try {
    const model = getAnthropicModel(task);
    console.log(`[LLM] Task: ${task} | Primary: Anthropic (${model}) | Tokens: ${maxTokens}`);
    
    result = await callClaude();
    
    console.log(`[LLM] Success with Anthropic (${model})`);
    return result;
    
  } catch (primaryError) {
    lastError = primaryError;
    console.warn(`[LLM] Anthropic failed with status ${primaryError.status || 'unknown'}`);
    
    // Try fallback provider (OpenAI)
    try {
      console.log(`[LLM] Trying fallback: OpenAI (${MODEL_OPENAI})`);
      
      result = await callOpenAI();
      
      console.log(`[LLM] Success with fallback OpenAI`);
      return result;
      
    } catch (fallbackError) {
      console.error(`[LLM] Fallback OpenAI also failed with status ${fallbackError.status || 'unknown'}`);
      lastError = fallbackError;
    }
  }
  
  // Both failed - last resort for questions
  if (task === 'questions' || task === 'intake') {
    console.log('[LLM] Both providers failed, using emergency fallback questions');
    return '[]';
  }
  
  throw new Error(`All LLM providers unavailable. Last error: ${lastError?.message || 'Unknown error'}`);
}

// Konstante für alle maßrelevanten Bauteile (ca. Zeile 415, vor extractProjectKeyData)
const DIMENSION_REQUIRED_ITEMS = {
  'FEN': {
    keywords: ['fenster', 'haustür', 'außentür', 'terrassenentür'],
    format: /\d+\s*x\s*\d+\s*(cm|mm)/,
    example: 'Fenster Kunststoff weiß, 120 x 140 cm, Dreh-Kipp',
    itemName: 'Fenster',
    requireExactDimensions: true
  },
  'TIS': {
    keywords: ['tür', 'türen', 'innentür'],
    format: /\d+\s*x\s*\d+\s*(cm|mm)/,
    example: 'Innentür Weißlack, 86 x 198,5 cm, inkl. Zarge',
    itemName: 'Innentüren',
    requireExactDimensions: true
  },
  'HEI': {
    keywords: ['heizkörper', 'radiator'],
    format: /\d+\s*x\s*\d+\s*(cm|mm)|typ\s*\d+|(\d+\s*watt)/i,
    example: 'Heizkörper Typ 22, Leistung nach Heizlastberechnung',
    itemName: 'Heizkörper',
    requireExactDimensions: false,
    alternativeSpec: 'Leistung/Typ'
  },
  'SAN': {
    keywords: ['waschbecken', 'wc', 'dusche', 'badewanne', 'waschtisch'],
    format: /\d+\s*(x\s*\d+)?\s*(cm|mm)|standard/i,
    example: 'Waschtisch 60 cm oder Standardmaß',
    itemName: 'Sanitärobjekte',
    requireExactDimensions: true
  },
  'SCHL': {
    keywords: ['geländer', 'handlauf', 'brüstung'],
    format: /\d+\s*(m|meter|lfm)/,
    example: 'Balkongeländer Stahl feuerverzinkt, 12 m, Höhe 110 cm, Lieferung und Montage',
    itemName: 'Geländer',
    requireExactDimensions: true
  },
  'FLI': {
    keywords: ['fliesen', 'platten'],
    format: /\d+\s*x\s*\d+\s*(cm|mm)/,
    example: 'Fliesen Feinsteinzeug, 60 x 60 cm, grau',
    itemName: 'Fliesen',
    requireExactDimensions: true
  }
};

/**
 * Extrahiert Schlüsseldaten aus der Projektbeschreibung
 */
function extractProjectKeyData(description, category = null) {
  const extractedData = {
    quantities: {},
    measures: [],
    rooms: [],
    specificDetails: {}
  };
  
  if (!description) return extractedData;
  
  const desc = description.toLowerCase();
  
  // Extrahiere Mengenangaben
  const quantityPatterns = [
    { pattern: /(\d+)\s*(fenster|fenstern)/gi, key: 'fenster' },
    { pattern: /(\d+)\s*(tür|türen)/gi, key: 'tueren' },
    { pattern: /(\d+)\s*(m²|qm|quadratmeter)/gi, key: 'flaeche' },
    { pattern: /(\d+)\s*(zimmer|räume)/gi, key: 'raeume' },
    { pattern: /(\d+)\s*(stockwerk|etage|geschoss)/gi, key: 'stockwerke' },
    { pattern: /(\d+)\s*(heizkörper)/gi, key: 'heizkoerper' },
    { pattern: /(\d+)\s*(steckdose|schalter)/gi, key: 'elektropunkte' }
  ];
  
  quantityPatterns.forEach(({ pattern, key }) => {
    const matches = description.match(pattern);
    if (matches && matches[0]) {
      const number = matches[0].match(/\d+/);
      if (number) {
        extractedData.quantities[key] = parseInt(number[0]);
      }
    }
  });
  
  // Extrahiere spezifische Maßnahmen
  const measureKeywords = [
    { keyword: 'wdvs', measure: 'WDVS Fassadendämmung' },
    { keyword: 'fassadendämmung', measure: 'Fassadendämmung' },
    { keyword: 'dachdämmung', measure: 'Dachdämmung' },
    { keyword: 'fenster austausch', measure: 'Fensteraustausch' },
    { keyword: 'fenster erneuern', measure: 'Fensteraustausch' },
    { keyword: 'bad sanierung', measure: 'Badsanierung' },
    { keyword: 'badsanierung', measure: 'Badsanierung' },
    { keyword: 'küche', measure: 'Küchenerneuerung' },
    { keyword: 'heizung', measure: 'Heizungserneuerung' },
    { keyword: 'elektro', measure: 'Elektroerneuerung' },
    { keyword: 'dach neu', measure: 'Dacherneuerung' },
    { keyword: 'parkett', measure: 'Parkettverlegung' },
    { keyword: 'fliesen', measure: 'Fliesenarbeiten' }
  ];
  
  measureKeywords.forEach(({ keyword, measure }) => {
    if (desc.includes(keyword)) {
      extractedData.measures.push(measure);
    }
  });
  
  // Extrahiere Rauminformationen
  const roomKeywords = ['bad', 'küche', 'wohnzimmer', 'schlafzimmer', 'kinderzimmer', 
                        'büro', 'keller', 'dachgeschoss', 'flur', 'gäste-wc'];
  
  roomKeywords.forEach(room => {
    if (desc.includes(room)) {
      extractedData.rooms.push(room);
    }
  });
  // Spezielle Gewerke-Kombinationen für häufige Sanierungsmaßnahmen
extractedData.impliedTrades = [];

// 1. BADSANIERUNG - sehr häufig
if (desc.includes('bad') || desc.includes('bäder') || 
    desc.includes('sanitär') || desc.includes('dusch') || 
    desc.includes('wc')) {
  
  extractedData.impliedTrades.push({
    code: 'TRO',
    reason: 'Vorwandinstallation für Sanitärleitungen',
    confidence: 85
  });
  
  extractedData.impliedTrades.push({
    code: 'FLI',
    reason: 'Fliesenarbeiten Wand und Boden',
    confidence: 90
  });
  
  extractedData.impliedTrades.push({
    code: 'SAN',
    reason: 'Sanitärinstallation',
    confidence: 95
  });
  
  extractedData.impliedTrades.push({
    code: 'ELEKT',
    reason: 'Elektroinstallation Feuchtraum',
    confidence: 80
  });
  
  extractedData.impliedTrades.push({
    code: 'MAL',
    reason: 'Malerarbeiten Decke',
    confidence: 70
  });
}

// 2. KÜCHENSANIERUNG
if (desc.includes('küche')) {
  extractedData.impliedTrades.push({
    code: 'ELEKT',
    reason: 'Elektroanschlüsse Herd, Spülmaschine, Beleuchtung',
    confidence: 95
  });
  
  extractedData.impliedTrades.push({
    code: 'SAN',
    reason: 'Wasseranschlüsse Spüle, Spülmaschine',
    confidence: 90
  });
  
  if (desc.includes('fliesen') || desc.includes('komplett')) {
    extractedData.impliedTrades.push({
      code: 'FLI',
      reason: 'Fliesenspiegel',
      confidence: 75
    });
  }
  
  extractedData.impliedTrades.push({
    code: 'MAL',
    reason: 'Wandanstrich',
    confidence: 70
  });
}

// 3. DACHAUSBAU / DACHGESCHOSS
if (desc.includes('dachausbau') || desc.includes('dachgeschoss') || 
    (desc.includes('dach') && desc.includes('ausbau'))) {
  
  extractedData.impliedTrades.push({
    code: 'TRO',
    reason: 'Dachschrägen verkleiden, Trennwände',
    confidence: 95
  });
  
  extractedData.impliedTrades.push({
    code: 'ZIMM',
    reason: 'Holzkonstruktion, Gauben',
    confidence: 80
  });
  
  extractedData.impliedTrades.push({
    code: 'FEN',
    reason: 'Dachfenster',
    confidence: 85
  });
  
  extractedData.impliedTrades.push({
    code: 'ELEKT',
    reason: 'Elektroinstallation neue Räume',
    confidence: 90
  });
  
  extractedData.impliedTrades.push({
    code: 'HEI',
    reason: 'Heizung erweitern',
    confidence: 75
  });
}

// 4. FASSADENSANIERUNG
if (desc.includes('fassade') || desc.includes('wdvs') || 
    desc.includes('außendämmung')) {
  
  extractedData.impliedTrades.push({
    code: 'FASS',
    reason: 'Fassadenarbeiten',
    confidence: 100
  });
  
  extractedData.impliedTrades.push({
    code: 'GER',
    reason: 'Gerüst für Fassadenarbeiten',
    confidence: 95
  });
  
  if (desc.includes('fenster') || desc.includes('komplett')) {
    extractedData.impliedTrades.push({
      code: 'FEN',
      reason: 'Fensteraustausch bei Fassadensanierung',
      confidence: 70
    });
  }
}

// 5. KOMPLETTSANIERUNG / KERNSANIERUNG
if (desc.includes('kernsanierung') || desc.includes('komplettsanierung') || 
    desc.includes('vollsanierung')) {
  
  extractedData.impliedTrades.push({
    code: 'ABBR',
    reason: 'Entkernung',
    confidence: 90
  });
  
  extractedData.impliedTrades.push({
    code: 'ROH',
    reason: 'Rohbauarbeiten',
    confidence: 85
  });
  
  extractedData.impliedTrades.push({
    code: 'ELEKT',
    reason: 'Komplette Elektroerneuerung',
    confidence: 95
  });
  
  extractedData.impliedTrades.push({
    code: 'SAN',
    reason: 'Komplette Sanitärerneuerung',
    confidence: 95
  });
  
  extractedData.impliedTrades.push({
    code: 'HEI',
    reason: 'Heizungserneuerung',
    confidence: 90
  });
}

// 6. KELLERSANIERUNG
if (desc.includes('keller')) {
  extractedData.impliedTrades.push({
    code: 'MAL',
    reason: 'Kellerwände streichen',
    confidence: 70
  });
  
  if (desc.includes('feucht') || desc.includes('nass')) {
    extractedData.impliedTrades.push({
      code: 'ROH',
      reason: 'Sanierputz, Abdichtung',
      confidence: 85
    });
  }
  
  if (desc.includes('ausbau')) {
    extractedData.impliedTrades.push({
      code: 'TRO',
      reason: 'Kellerausbau Trockenbauwände',
      confidence: 80
    });
    
    extractedData.impliedTrades.push({
      code: 'ELEKT',
      reason: 'Elektroinstallation Kellerräume',
      confidence: 75
    });
  }
}

// 7. WOHNUNGSSANIERUNG
if (desc.includes('wohnung') && 
    (desc.includes('sanier') || desc.includes('renovier'))) {
  
  extractedData.impliedTrades.push({
    code: 'MAL',
    reason: 'Malerarbeiten alle Räume',
    confidence: 90
  });
  
  extractedData.impliedTrades.push({
    code: 'BOD',
    reason: 'Bodenbelagsarbeiten',
    confidence: 85
  });
  
  extractedData.impliedTrades.push({
    code: 'ELEKT',
    reason: 'Elektromodernisierung',
    confidence: 70
  });
  
  if (!desc.includes('ohne bad')) {
    extractedData.impliedTrades.push({
      code: 'SAN',
      reason: 'Sanitärmodernisierung',
      confidence: 60
    });
  }
}

// 8. ENERGETISCHE SANIERUNG
if (desc.includes('energetisch') || desc.includes('energiespar') || 
    desc.includes('kfw') || desc.includes('bafa')) {
  
  extractedData.impliedTrades.push({
    code: 'FASS',
    reason: 'Fassadendämmung WDVS',
    confidence: 90
  });
  
  extractedData.impliedTrades.push({
    code: 'DACH',
    reason: 'Dachdämmung',
    confidence: 85
  });
  
  extractedData.impliedTrades.push({
    code: 'FEN',
    reason: 'Fensteraustausch energetisch',
    confidence: 90
  });
  
  extractedData.impliedTrades.push({
    code: 'HEI',
    reason: 'Heizungsmodernisierung',
    confidence: 80
  });
}

// 9. DACHSANIERUNG
if (desc.includes('dach') && 
    (desc.includes('neu') || desc.includes('sanier'))) {
  
  extractedData.impliedTrades.push({
    code: 'DACH',
    reason: 'Dachdeckerarbeiten',
    confidence: 100
  });
  
  extractedData.impliedTrades.push({
    code: 'ZIMM',
    reason: 'Dachstuhl prüfen/reparieren',
    confidence: 60
  });
  
  extractedData.impliedTrades.push({
    code: 'GER',
    reason: 'Gerüst für Dacharbeiten',
    confidence: 95
  });
}

// 10. BALKON/TERRASSEN-SANIERUNG
if (desc.includes('balkon') || desc.includes('terrasse') || 
    desc.includes('loggia')) {
  
  extractedData.impliedTrades.push({
    code: 'FLI',
    reason: 'Balkonbelag Fliesen/Platten',
    confidence: 85
  });
  
  extractedData.impliedTrades.push({
    code: 'SCHL',
    reason: 'Balkongeländer',
    confidence: 75
  });
  
  if (desc.includes('überdach')) {
    extractedData.impliedTrades.push({
      code: 'ZIMM',
      reason: 'Überdachung Holzkonstruktion',
      confidence: 70
    });
  }
}

// NEU: Initialisiere suggestedTrades für spätere Verwendung
extractedData.suggestedTrades = [];
extractedData.intakeKeywords = []; // Für spätere Analyse

// Keyword-Liste für spätere Verwendung speichern
extractedData.tradeKeywords = {
  'ELEKT': ['steckdose', 'schalter', 'lampe', 'elektro', 'kabel', 'sicherung', 'strom', 'leitung', 'verteiler', 'fi-schalter'],
  'HEI': ['heizung', 'heizkörper', 'thermostat', 'warmwasser', 'kessel', 'brenner', 'fußbodenheizung', 'radiator'],
  'KLIMA': ['lüftung', 'klima', 'luftwechsel', 'abluft', 'zuluft', 'klimaanlage', 'wärmerückgewinnung'],
  'TRO': ['rigips', 'trockenbau', 'ständerwerk', 'vorwand', 'gipskarton', 'abgehängte decke', 'schallschutz'],
  'FLI': ['fliesen', 'verfugen', 'mosaik', 'bad', 'naturstein', 'feinsteinzeug', 'bodenfliesen', 'wandfliesen'],
  'MAL': ['streichen', 'innenputz', 'tapezieren', 'verputzen', 'spachteln', 'anstrich', 'farbe', 'lackieren', 'grundierung', 'malerarbeiten'],
  'BOD': ['parkett', 'laminat', 'vinyl', 'teppich', 'linoleum', 'kork', 'designboden', 'bodenbelag'],
  'ROH': ['mauerwerk', 'durchbruch', 'beton', 'wand', 'decke', 'maurerarbeiten'],
  'SAN': ['bad', 'wc', 'waschbecken', 'dusche', 'badewanne', 'sanitär', 'abfluss', 'wasserhahn', 'armatur'],
  'FEN': ['fenster', 'verglasung', 'rolladen', 'jalousie', 'fensterbank', 'glasbruch', 'isolierglas'],
  'TIS': ['tür', 'innentür', 'zarge', 'möbel', 'einbauschrank', 'holzarbeiten', 'küche', 'arbeitsplatte'],
  'DACH': ['dach', 'ziegel', 'dachrinne', 'schneefang', 'dachfenster', 'gauben', 'dachstuhl', 'eindeckung'],
  'FASS': ['fassade', 'wdvs', 'außenputz', 'dämmung', 'verblendung', 'klinker', 'fassadenfarbe'],
  'GER': ['gerüst', 'baugerüst', 'arbeitsgerüst', 'fassadengerüst', 'rollgerüst'],
  'ZIMM': ['holzbau', 'gaube', 'dachstuhl', 'balken', 'carport', 'pergola', 'holzkonstruktion', 'fachwerk'],
  'ESTR': ['estrich', 'fließestrich', 'zementestrich', 'anhydritestrich', 'trockenestrich', 'ausgleichsmasse'],
  'SCHL': ['geländer', 'zaun', 'tor', 'metallbau', 'stahltreppe', 'gitter', 'schlosserarbeiten'],
  'AUSS': ['pflaster', 'terrasse', 'einfahrt', 'garten', 'außenanlage', 'randstein', 'rasen'],
  'PV': ['solar', 'photovoltaik', 'solaranlage', 'wechselrichter', 'speicher', 'batterie', 'einspeisung'],
  'ABBR': ['abriss', 'abbruch', 'entkernung', 'rückbau', 'demontage', 'entsorgung', 'schutt']
};

// Entferne Duplikate (falls ein Gewerk mehrfach impliziert wurde)
const uniqueTrades = {};
extractedData.impliedTrades.forEach(trade => {
  if (!uniqueTrades[trade.code] || uniqueTrades[trade.code].confidence < trade.confidence) {
    uniqueTrades[trade.code] = trade;
  }
});
extractedData.impliedTrades = Object.values(uniqueTrades);
  
  // Spezifische Details extrahieren
  if (desc.includes('altbau')) extractedData.specificDetails.buildingType = 'Altbau';
  if (desc.includes('neubau')) extractedData.specificDetails.buildingType = 'Neubau';
  if (desc.includes('einfamilienhaus') || desc.includes('efh')) {
    extractedData.specificDetails.buildingType = 'Einfamilienhaus';
  }
  if (desc.includes('mehrfamilienhaus') || desc.includes('mfh')) {
    extractedData.specificDetails.buildingType = 'Mehrfamilienhaus';
  }
  
  // Prüfe ob Gerüst benötigt wird (für spätere Verwendung)
  extractedData.specificDetails.needsScaffolding = 
    desc.includes('dach') || desc.includes('fassade') || 
    desc.includes('fenster') && (desc.includes('obergeschoss') || desc.includes('2. stock'));
  
  // Extrahiere "KEINE" Angaben (wichtig für Ausschlüsse)
  if (desc.includes('keine haustür') || desc.includes('ohne haustür')) {
    extractedData.specificDetails.excludeHaustuer = true;
  }
  if (desc.includes('ohne gerüst') || desc.includes('kein gerüst')) {
    extractedData.specificDetails.excludeGeruest = true;
  }
  
  console.log('[EXTRACT] Extracted data from description:', extractedData);
  
  return extractedData;
}

/**
 * Intelligente Antwort-Validierung und Schätzung
 */
async function validateAndEstimateAnswers(answers, tradeCode, projectContext) {
  const systemPrompt = `Du bist ein erfahrener Bausachverständiger mit 20+ Jahren Erfahrung.
Deine Aufgabe: Validiere Nutzerantworten und erstelle realistische Schätzungen für unsichere Angaben.

WICHTIGE REGELN:
1. Prüfe die Plausibilität aller Mengenangaben
2. Bei "unsicher" oder fehlenden kritischen Angaben: Erstelle realistische Schätzungen basierend auf:
   - Typischen Werten für ähnliche Projekte
   - Ableitungen aus anderen Angaben (z.B. Raumgröße → Kabellänge)
   - Branchenüblichen Standards
3. Berechne abgeleitete Werte intelligent:
   - Kabellängen: ca. 15-20m pro Raum + Steigungen
   - Rohrleitungen: Direkte Wege + 20% Zuschlag
   - Materialmengen: Flächen × Erfahrungswerte
4. Dokumentiere ALLE Annahmen transparent

OUTPUT (NUR valides JSON):
{
  "validated": [
    {
      "questionId": "string",
      "originalAnswer": "string oder null",
      "validatedValue": "number",
      "unit": "m²/m/Stk/kg/l",
      "assumption": "Detaillierte Erklärung der Schätzgrundlage",
      "confidence": 0.5-1.0
    }
  ],
  "derivedValues": {
    "totalArea": "number",
    "perimeter": "number",
    "volume": "number",
    "additionalMetrics": {}
  },
  "warnings": ["Liste von Hinweisen auf unrealistische oder fehlende Angaben"]
}`;

  const userPrompt = `Gewerk: ${tradeCode}
Projektkontext: ${JSON.stringify(projectContext)}
Nutzerantworten: ${JSON.stringify(answers)}

Validiere diese Antworten und erstelle realistische Schätzungen wo nötig.`;

  try {
    const response = await llmWithPolicy('validation', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { maxTokens: 3000, temperature: 0.3, jsonMode: true });
    
    const cleanedResponse = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    return JSON.parse(cleanedResponse);
  } catch (err) {
    console.error('[VALIDATION] Failed:', err);
    return null;
  }
}

/**
 * Intelligente, dynamische Fragenanzahl-Ermittlung
 * VERBESSERT: Realistischere Bewertung der vorhandenen Informationen
 */
function getIntelligentQuestionCount(tradeCode, projectContext, intakeAnswers = []) {
  const tradeConfig = TRADE_COMPLEXITY[tradeCode] || DEFAULT_COMPLEXITY;

  // NEU: Nutze gespeicherte Komplexität falls vorhanden
  const projectComplexity = projectContext.complexity || 
    projectContext.metadata?.complexity?.level ||
    determineProjectComplexity(projectContext, intakeAnswers);
  
  // NEU: Komplexitäts-basierte Anpassung der Fragenanzahl
  const complexityMultiplier = {
    'SEHR_HOCH': 1.25,
    'HOCH': 1.15,
    'MITTEL': 1.0,
    'NIEDRIG': 0.85,
    'EINFACH': 0.7
  }[projectComplexity] || 1.0;
  
  // Basis-Range mit Komplexitäts-Multiplikator
  const baseRange = {
    min: Math.round(tradeConfig.minQuestions * complexityMultiplier),
    max: Math.round(tradeConfig.maxQuestions * complexityMultiplier),
    complexity: tradeConfig.complexity
  };
  
  // Analysiere wie viel Information bereits vorhanden ist
  let informationCompleteness = 0;
  let missingCriticalInfo = [];
  
  // Prüfe Projektbeschreibung
  if (projectContext.description) {
    const desc = projectContext.description.toLowerCase();
    const wordCount = desc.split(' ').length;
    
    // REALISTISCHERE Bewertung der Beschreibung
    if (wordCount > 100) informationCompleteness += 20;
    else if (wordCount > 50) informationCompleteness += 15;
    else if (wordCount > 20) informationCompleteness += 10;
    else informationCompleteness += 5;
    
    // Gewerke-spezifische Prüfungen mit höherer Gewichtung
    switch(tradeCode) {
      case 'MAL': // Malerarbeiten
        if (desc.match(/\d+\s*(m²|qm|quadratmeter)/)) {
          informationCompleteness += 25; // Fläche ist kritisch!
        } else {
          missingCriticalInfo.push('Flächenangabe');
        }
        if (desc.includes('zimmer') || desc.includes('raum') || desc.includes('wohnung')) {
          informationCompleteness += 15;
        }
        if (desc.includes('weiß') || desc.includes('farbe') || desc.includes('farbton')) {
          informationCompleteness += 10;
        }
        // Bei "Zimmer streichen" ist oft schon genug Info da
        if (desc.includes('zimmer') && desc.includes('streichen')) {
          informationCompleteness += 20;
        }
        break;
        
      case 'DACH':
        if (!desc.match(/\d+\s*(m²|qm)/)) missingCriticalInfo.push('Dachfläche');
        else informationCompleteness += 20;
        if (!desc.includes('dachform') && !desc.includes('sattel') && !desc.includes('flach')) {
          missingCriticalInfo.push('Dachform');
        } else {
          informationCompleteness += 15;
        }
        break;
        
      case 'ELEKT':
        if (!desc.match(/\d+\s*(steckdose|schalter|dose)/)) missingCriticalInfo.push('Anzahl Elektropunkte');
        else informationCompleteness += 15;
        if (!desc.includes('verteiler') && !desc.includes('sicherung')) missingCriticalInfo.push('Verteilerinfo');
        else informationCompleteness += 10;
        break;
        
      case 'FLI': // Fliesenarbeiten
        if (desc.match(/\d+\s*(m²|qm)/)) informationCompleteness += 25;
        else missingCriticalInfo.push('Fliesenfläche');
        if (desc.includes('bad') || desc.includes('küche')) informationCompleteness += 10;
        break;
        
      case 'SAN': // Sanitär
        if (desc.includes('bad') || desc.includes('wc') || desc.includes('dusche')) {
          informationCompleteness += 15;
        }
        if (!desc.includes('austausch') && !desc.includes('erneuer') && !desc.includes('neu')) {
          missingCriticalInfo.push('Umfang der Arbeiten');
        }
        break;
        
      case 'GER': // Gerüstbau
        if (desc.match(/\d+\s*(m|meter)/)) informationCompleteness += 20;
        else missingCriticalInfo.push('Gebäudehöhe');
        if (desc.includes('einfamilienhaus') || desc.includes('efh')) informationCompleteness += 10;
        break;

      case 'FASS':
  if (!desc.match(/\d+\s*(m²|qm)/)) missingCriticalInfo.push('Fassadenfläche');
  else informationCompleteness += 20;
  if (!desc.includes('fassade') && !desc.includes('putz') && !desc.includes('dämmung')) {
    missingCriticalInfo.push('Art der Fassadenarbeiten');
  } else {
    informationCompleteness += 20;
  }
  break;

case 'ABBR':
  if (!desc.match(/\d+\s*(m²|m³|tonnen)/)) missingCriticalInfo.push('Abbruchmenge');
  else informationCompleteness += 20;
  if (!desc.includes('entkernung') && !desc.includes('teilabbruch') && !desc.includes('komplettabbruch')) {
    missingCriticalInfo.push('Art des Abbruchs');
  } else {
    informationCompleteness += 10;
  }
  break;

case 'BOD':
  if (!desc.match(/\d+\s*(m²|qm)/)) missingCriticalInfo.push('Bodenfläche');
  else informationCompleteness += 20;
  if (!desc.includes('parkett') && !desc.includes('laminat') && !desc.includes('vinyl')) {
    missingCriticalInfo.push('Bodenbelagsart');
  } else {
    informationCompleteness += 20;
  }
  break;

case 'HEI':
  if (!desc.match(/\d+\s*(kw|heizkörper|räume)/)) missingCriticalInfo.push('Heizleistung/Umfang');
  else informationCompleteness += 10;
  if (!desc.includes('gastherme') && !desc.includes('wärmepumpe') && !desc.includes('ölheizung')) {
    missingCriticalInfo.push('Heizungstyp');
  } else {
    informationCompleteness += 15;
  }
  break;

case 'KLIMA': // Lüftung- und Klimatechnik
    if (!desc.match(/\d+\s*(m²|qm)/)) missingCriticalInfo.push('Raumflächen');
    else informationCompleteness += 20;
    if (!desc.includes('raumhöhe') && !desc.includes('geschoss')) missingCriticalInfo.push('Raumhöhen');
    else informationCompleteness += 10;
    if (desc.includes('lüftung') || desc.includes('klima') || desc.includes('luftwechsel')) {
        informationCompleteness += 10;
    }
    if (desc.includes('kühlung') || desc.includes('heizung')) informationCompleteness += 20;
    break;

case 'PV': // Photovoltaik
  if (!desc.match(/\d+\s*(kwp|kw)/i)) missingCriticalInfo.push('Anlagengröße');
  else informationCompleteness += 20;
  if (!desc.match(/\d+\s*(m²|qm)/)) missingCriticalInfo.push('Dachfläche');
  else informationCompleteness += 15;
  if (desc.includes('speicher') || desc.includes('batterie')) informationCompleteness += 20;
  break;
        
case 'FEN':
  if (!desc.match(/\d+\s*(fenster|türen|stück)/)) missingCriticalInfo.push('Anzahl Fenster/Türen');
  else informationCompleteness += 20;
  if (!desc.includes('kunststoff') && !desc.includes('holz') && !desc.includes('aluminium')) {
    missingCriticalInfo.push('Material Fenster/Türen');
  } else {
    informationCompleteness += 15;
  }
  break;

case 'TIS':
  if (!desc.match(/\d+\s*(m|schrank|element)/)) missingCriticalInfo.push('Umfang Tischlerarbeiten');
  else informationCompleteness += 15;
  if (!desc.includes('einbauschrank') && !desc.includes('küche') && !desc.includes('möbel')) {
    missingCriticalInfo.push('Art der Tischlerarbeiten');
  } else {
    informationCompleteness += 10;
  }
  break;

case 'ROH':
  // Spezialfall: Bei EINFACHEN oder NIEDRIGEN Projekten mit Wanddurchbruch
  if ((projectComplexity === 'EINFACH' || projectComplexity === 'NIEDRIG') && 
      (desc.includes('wanddurchbruch') || 
       desc.includes('türdurchbruch') || 
       (desc.includes('durchbruch') && !desc.includes('mehrere')))) {
    
    // Erhöhe Vollständigkeit stark für einfache Durchbrüche
    informationCompleteness += 30;
    console.log('[QUESTIONS] Simple wall opening in SIMPLE/LOW project - increasing completeness');
    
    if (desc.match(/\d+\s*(cm|m|mm)/)) {
      informationCompleteness += 20;
    }
    
  } else if ((projectComplexity === 'HOCH' || projectComplexity === 'SEHR_HOCH') && 
             desc.includes('durchbruch')) {
    // Komplexes Projekt mit Durchbruch - normale Behandlung
    informationCompleteness += 10; // Nur leichte Erhöhung
    console.log('[QUESTIONS] Wall opening in COMPLEX project - standard handling');
    
    // Normale Prüfungen fortsetzen
    if (!desc.match(/\d+\s*(m²|m³|qm)/)) {
      missingCriticalInfo.push('Rohbaufläche/Volumen');
    } else {
      informationCompleteness += 10;
    }
    
  } else {
    // Normale Rohbau-Prüfung (MITTEL-Komplexität oder ohne Durchbruch)
    if (!desc.match(/\d+\s*(m²|m³|qm)/)) {
      missingCriticalInfo.push('Rohbaufläche/Volumen');
    } else {
      informationCompleteness += 10;
    }
    
    if (!desc.includes('bodenplatte') && !desc.includes('wand') && !desc.includes('decke')) {
      missingCriticalInfo.push('Art der Rohbauarbeiten');
    } else {
      informationCompleteness += 10;
    }
  }
  break;

case 'ZIMM': // Zimmererarbeiten
  if (!desc.match(/\d+\s*(m²|qm)/)) missingCriticalInfo.push('Holzkonstruktionsfläche');
  else informationCompleteness += 10;
  if (!desc.includes('dachstuhl') && !desc.includes('holzbau') && !desc.includes('carport')) {
    missingCriticalInfo.push('Art der Zimmererarbeiten');
  } else {
    informationCompleteness += 10;
  }
  break;
        
case 'ESTR':
  if (!desc.match(/\d+\s*(m²|qm)/)) missingCriticalInfo.push('Estrichfläche');
  else informationCompleteness += 30;
  if (!desc.includes('fließestrich') && !desc.includes('zementestrich') && !desc.includes('trockenestrich')) {
    missingCriticalInfo.push('Estrichart');
  } else {
    informationCompleteness += 20;
  }
  break;

case 'TRO':
  if (!desc.match(/\d+\s*(m²|qm|wände)/)) missingCriticalInfo.push('Trockenbaufläche');
  else informationCompleteness += 20;
  if (!desc.includes('rigips') && !desc.includes('gipskarton') && !desc.includes('ständerwerk')) {
    missingCriticalInfo.push('Art der Trockenbauarbeiten');
  } else {
    informationCompleteness += 10;
  }
  break;

case 'SCHL':
  if (!desc.match(/\d+\s*(m|meter|stück)/)) missingCriticalInfo.push('Umfang Schlosserarbeiten');
  else informationCompleteness += 20;
  if (!desc.includes('geländer') && !desc.includes('zaun') && !desc.includes('tor')) {
    missingCriticalInfo.push('Art der Schlosserarbeiten');
  } else {
    informationCompleteness += 10;
  }
  break;

case 'AUSS':
  if (!desc.match(/\d+\s*(m²|qm)/)) missingCriticalInfo.push('Außenbereichsfläche');
  else informationCompleteness += 20;
  if (!desc.includes('pflaster') && !desc.includes('rasen') && !desc.includes('bepflanzung')) {
    missingCriticalInfo.push('Art der Außenarbeiten');
  } else {
    informationCompleteness += 10;
  }
  break;

case 'INT':
  // Spezialfall INT - weniger strenge Anforderungen
  if (!desc.match(/\d+/)) missingCriticalInfo.push('Projektumfang');
  else informationCompleteness += 10;
  informationCompleteness += 10; // Bonus für INT
  break;
    
    }
    
    // Allgemeine hilfreiche Informationen
    if (desc.match(/\d+\s*(zimmer|räume)/)) informationCompleteness += 10;
    if (desc.includes('altbau') || desc.includes('neubau')) informationCompleteness += 5;
    if (desc.includes('komplett') || desc.includes('gesamt')) informationCompleteness += 5;
  }
  
  // Prüfe Intake-Antworten (haben mehr Gewicht)
  if (intakeAnswers.length > 0) {
    // Jede beantwortete Intake-Frage erhöht die Vollständigkeit
    informationCompleteness += Math.min(40, intakeAnswers.length * 3);
    
    // Prüfe auf konkrete Mengenangaben in Antworten
    const hasNumbers = intakeAnswers.filter(a => 
      a.answer && a.answer.match(/\d+/)
    ).length;
    informationCompleteness += Math.min(20, hasNumbers * 5);
  }
  
  // Budget gibt Aufschluss über Projektumfang
  if (projectContext.budget && !projectContext.budget.includes('unsicher')) {
    informationCompleteness += 10;
  }
  
  // Kategorie kann auch helfen
  if (projectContext.category) {
    const cat = projectContext.category.toLowerCase();
    if (cat.includes('renovierung') || cat.includes('sanierung')) {
      informationCompleteness += 5;
    }
  }
  
  // Berechne finale Fragenanzahl
  informationCompleteness = Math.min(100, informationCompleteness);
  
  // VERBESSERTE Reduktionslogik
  let targetCount;
  
  if (baseRange.complexity === 'EINFACH') {
    // Einfache Gewerke brauchen weniger Fragen
    if (informationCompleteness >= 75) {
      targetCount = baseRange.min; // Minimum
    } else if (informationCompleteness >= 60) {
      targetCount = Math.round(baseRange.min + 2);
    } else if (informationCompleteness >= 40) {
      targetCount = Math.round((baseRange.min + baseRange.max) / 2);
    } else {
      targetCount = baseRange.max - 2;
    }
  } else if (baseRange.complexity === 'SEHR_HOCH' || baseRange.complexity === 'HOCH') {
    // Komplexe Gewerke brauchen mehr Details
    if (informationCompleteness >= 85) {
      targetCount = Math.round(baseRange.min + 5);
    } else if (informationCompleteness >= 70) {
      targetCount = Math.round((baseRange.min + baseRange.max) / 2);
    } else if (informationCompleteness >= 50) {
      targetCount = Math.round(baseRange.max - 5);
    } else {
      targetCount = baseRange.max;
    }
  } else {
    // Mittlere Komplexität
    if (informationCompleteness >= 80) {
      targetCount = baseRange.min + 2;
    } else if (informationCompleteness >= 60) {
      targetCount = Math.round((baseRange.min + baseRange.max) / 2);
    } else {
      targetCount = baseRange.max - 3;
    }
  }
  
  // Kritische fehlende Infos erhöhen Fragenbedarf
  targetCount += missingCriticalInfo.length * 2;
  
  // Sicherstellen dass wir in sinnvollen Grenzen bleiben
  targetCount = Math.max(baseRange.min, targetCount);
  targetCount = Math.min(baseRange.max, targetCount);
  
 // SPEZIALFALL: Sehr einfache Projekte
if (projectContext.description && 
    (projectComplexity === 'EINFACH' || projectComplexity === 'NIEDRIG')) {
  const desc = projectContext.description.toLowerCase();
  
  // Wanddurchbruch-Spezialbehandlung bei einfachen/niedrigen Projekten
  if (tradeCode === 'ROH' && 
      (desc.includes('wanddurchbruch') || 
       desc.includes('türdurchbruch') || 
       (desc.includes('durchbruch') && !desc.includes('anbau')))) {
    
    targetCount = Math.min(targetCount, 12);
    console.log(`[QUESTIONS] SIMPLE/LOW ROH wall opening: capped at 12 questions`);
  }
}
  console.log(`[QUESTIONS] Intelligent count for ${tradeCode}:`);
  console.log(`  -> Information completeness: ${informationCompleteness}%`);
  console.log(`  -> Missing critical info: ${missingCriticalInfo.join(', ') || 'none'}`);
  console.log(`  -> Base range: ${baseRange.min}-${baseRange.max}`);
  console.log(`  -> Target questions: ${targetCount}`);
  
  return {
    count: targetCount,
    completeness: informationCompleteness,
    missingInfo: missingCriticalInfo
  };
}

/**
 * Berechnet Orientierungswerte für LV-Positionen (NICHT als strikte Vorgabe!)
 */
function getPositionOrientation(tradeCode, questionCount, projectContext = null) {
  const tradeConfig = TRADE_COMPLEXITY[tradeCode] || DEFAULT_COMPLEXITY;
  
  const projectComplexity = projectContext?.complexity || 
    projectContext?.metadata?.complexity?.level || 'MITTEL';
  
  // MODERATE Anpassung für NIEDRIG/EINFACH Projekte
  if (projectComplexity === 'EINFACH' || projectComplexity === 'NIEDRIG') {
    console.log(`[LV-ORIENTATION] ${projectComplexity} project - angepasste Positionen für ${tradeCode}`);
    
    // Moderatere Faktoren: 0.8 - 1.2 der Fragenanzahl
    const reductionFactor = projectComplexity === 'NIEDRIG' ? 0.8 : 0.9;
    const maxFactor = projectComplexity === 'NIEDRIG' ? 1.2 : 1.3;
    
    const baseMin = Math.max(5, Math.floor(questionCount * reductionFactor));
    const baseMax = Math.floor(questionCount * maxFactor);
    
    // Sanfte Obergrenze - verhindert Extreme wie 19 bei 10 Fragen
    const absoluteMax = projectComplexity === 'NIEDRIG' ? 
      Math.max(12, questionCount + 2) :  // Max: Fragen + 2 oder 12
      Math.max(15, questionCount + 3);    // Max: Fragen + 3 oder 15
    
    return {
      min: baseMin,
      max: Math.min(baseMax, absoluteMax),
      base: Math.floor((baseMin + Math.min(baseMax, absoluteMax)) / 2),
      ratio: (reductionFactor + maxFactor) / 2,
      projectComplexity: projectComplexity,
      tradeCode: tradeCode,
      reason: `${projectComplexity} Projekt - angepasste Positionsanzahl`
    };
  }
  
  let ratio = tradeConfig.targetPositionsRatio;
  
  const complexityBonus = {
    'SEHR_HOCH': 0.20,
    'HOCH': 0.15,
    'MITTEL': 0.10,
    'EINFACH': 0,
  }[projectComplexity] || 0;
  
  ratio = ratio + complexityBonus;
  
  const complexProjects = ['aufstockung', 'anbau', 'umbau', 'kernsanierung'];
  const description = projectContext?.description?.toLowerCase() || '';
  const matchedTerm = complexProjects.find(term => description.includes(term));
  if (matchedTerm) {
    ratio += 0.15;
    console.log(`[LV-ORIENTATION] "${matchedTerm}" erkannt - erhöhe Positions-Ratio`);
  }
  
  const baseOrientation = Math.round(questionCount * ratio);
  
  const COMPLEXITY_MINIMUMS = {
    'SEHR_HOCH': {
      'SEHR_HOCH': 22,
      'HOCH': 18,
      'MITTEL': 16,
      'EINFACH': 10
    },
    'HOCH': {
      'SEHR_HOCH': 20,
      'HOCH': 18,
      'MITTEL': 16,
      'EINFACH': 10
    },
    'MITTEL': {
      'SEHR_HOCH': 20,
      'HOCH': 18,
      'MITTEL': 16,
      'EINFACH': 8
    },
    'EINFACH': {
      'SEHR_HOCH': 16,
      'HOCH': 14,
      'MITTEL': 10,
      'EINFACH': 8      
    },
    'NIEDRIG': {
      'SEHR_HOCH': 15,
      'HOCH': 13,
      'MITTEL': 10,
      'EINFACH': 6      
    }
  };
  
  const minPositions = COMPLEXITY_MINIMUMS[projectComplexity]?.[tradeConfig.complexity] || 8;
  
  const orientationMin = Math.max(minPositions, baseOrientation);
  
  // FEHLTE: Berechnung von orientationMax!
  let orientationMax = Math.round(orientationMin * 1.3);
  
  // Keine künstliche Begrenzung für komplexe Projekte
  if (projectComplexity === 'EINFACH') {
    orientationMax = Math.min(25, orientationMax);
  } else if (projectComplexity === 'MITTEL') {
    orientationMax = Math.min(35, orientationMax);
  }
  // Bei HOCH und SEHR_HOCH keine Begrenzung nach oben!
  
  // Sicherheitsprüfung
  if (orientationMax <= orientationMin) {
    orientationMax = orientationMin + 10;
  }
  
  console.log(`[LV-ORIENTATION] ${tradeCode}: ${orientationMin}-${orientationMax} positions`);
  console.log(`  Project complexity: ${projectComplexity}, Trade complexity: ${tradeConfig.complexity}`);
  console.log(`  Final ratio: ${ratio.toFixed(2)}, Min positions: ${minPositions}`);
  
  return {
    min: orientationMin,
    max: orientationMax,
    base: baseOrientation,
    ratio: ratio,
    projectComplexity: projectComplexity
  };
}

/**
 * Projektkomplexität bestimmen - VERBESSERTE VERSION
 */
function determineProjectComplexity(projectContext, intakeAnswers = []) {
  let complexityScore = 0;
  
  const combinedText = [
    projectContext.category || '',
    projectContext.sub_category || '',
    projectContext.description || ''
  ].join(' ').toLowerCase();
  
  // TRADE COMPLEXITY DEFINITIONEN (aus deinem Code)
    const TRADE_COMPLEXITY = {
    // Sehr komplexe Gewerke
    DACH:  { complexity: 'SEHR_HOCH', weight: 5, minScore: 13 },
    ELEKT: { complexity: 'SEHR_HOCH', weight: 5, minScore: 12 },
    SAN:   { complexity: 'SEHR_HOCH', weight: 5, minScore: 12 },
    HEI:   { complexity: 'SEHR_HOCH', weight: 5, minScore: 12 },
    KLIMA: { complexity: 'SEHR_HOCH', weight: 5, minScore: 12 },
    ROH:   { complexity: 'SEHR_HOCH', weight: 5, minScore: 10 }, // Kontextabhängig
    
    // Komplexe Gewerke
    TIS:   { complexity: 'HOCH', weight: 3, minScore: 8 },
    FEN:   { complexity: 'HOCH', weight: 3, minScore: 8 },
    FASS:  { complexity: 'HOCH', weight: 4, minScore: 12 },
    SCHL:  { complexity: 'HOCH', weight: 3, minScore: 8 },
    PV:    { complexity: 'HOCH', weight: 4, minScore: 14 },
    ZIMM:  { complexity: 'HOCH', weight: 3, minScore: 7 },
    
    // Mittlere Komplexität
    FLI:   { complexity: 'MITTEL', weight: 2, minScore: 7 },
    ESTR:  { complexity: 'MITTEL', weight: 2 },
    TRO:   { complexity: 'MITTEL', weight: 2, minScore: 7 },
    BOD:   { complexity: 'MITTEL', weight: 2 },
    AUSS:  { complexity: 'MITTEL', weight: 2, minScore: 6 },
    
    // Einfache Gewerke
    MAL:   { complexity: 'EINFACH', weight: 1 },
    GER:   { complexity: 'EINFACH', weight: 0.5 },
    ABBR:  { complexity: 'EINFACH', weight: 1 }
  };
  
  // KATEGORIE-BASIERTE GRUNDBEWERTUNG
  const categoryComplexityMap = {
    'Energetische Sanierung': {
      baseScore: 8,
      minComplexity: 'mittel',
      subCategoryScores: {
        'Komplettsanierung (Dach, Fassade, Fenster, Heizung)': 15,
        'Fassadendämmung': 10,
        'Dachdämmung / Dachsanierung': 12,
        'Fenstertausch': 6,
        'Heizungserneuerung (Wärmepumpe, Gas, Pellet)': 8,
        'Photovoltaik / Solarthermie': 9
      }
    },
    'Sanierung': {
      baseScore: 6,
      minComplexity: 'niedrig',
      subCategoryScores: {
        'Teilsanierung': 6,
        'Kernsanierung': 16,
        'Kellersanierung': 8,
        'Schadstoffsanierung (Asbest/Schimmel)': 14
      }
    },
    'Innenausbau / Renovierung': {
      baseScore: 3,
      minComplexity: 'einfach',
      subCategoryScores: {
        'Badsanierung': 7,
        'Küchensanierung': 7,
        'Wand- und Bodenrenovierung': 3,
        'Türen, Zargen, Deckenverkleidungen': 3,
        'Trockenbau (Raumaufteilung, Schallschutz)': 5
      }
    },
    'Anbau / Umbau / Aufstockung': {
      baseScore: 12,
      minComplexity: 'hoch',
      subCategoryScores: {
        'Anbau (Raumerweiterung, Wintergarten)': 14,
        'Umbau (Grundrissänderungen)': 13,
        'Aufstockung (zusätzlicher Wohnraum)': 18,
        'Dachausbau (Gauben, Dachflächenfenster)': 11
      }
    },
    'Rohbauarbeiten / Statisch relevante Eingriffe': {
      baseScore: 8,
      minComplexity: 'niedrig', // Kann von einfach bis sehr_hoch sein
      subCategoryScores: {
        'Mauer- und Betonarbeiten (Wände / Decken / Stützen)': 12,
        'Fundamentarbeiten': 14,
        'Statische Veränderungen (Wanddurchbrüche)': 6 // Basis niedrig
      }
    },
    'Rückbau / Abbrucharbeiten': {
      baseScore: 8,
      minComplexity: 'mittel',
      subCategoryScores: {
        'Abbrucharbeiten (Teil- oder Komplettabriss)': 14,
        'Entkernung': 16
      }
    },
    'Technische Gebäudeausrüstung (TGA)': {
      baseScore: 7,
      minComplexity: 'mittel',
      subCategoryScores: {
        'Heizung (Neuinstallation/Austausch)': 8,
        'Sanitärinstallation': 8,
        'Elektroinstallation (inkl. Smart Home)': 8,
        'Lüftungs- oder Klimaanlage': 10
      }
    },
    'Außenanlagen / Garten- und Landschaftsbau': {
      baseScore: 3,
      minComplexity: 'einfach',
      subCategoryScores: {
        'Terrasse': 4,
        'Zaunbau / Sichtschutz': 2,
        'Gartenneugestaltung': 3,
        'Wege / Pflasterarbeiten / Einfahrten': 3,
        'Carport / Garage / Gartenhaus': 6
      }
    }
  };
  
  // SCHRITT 1: Kategorie-Basis-Score
  let categoryConfig = categoryComplexityMap[projectContext.category] || { baseScore: 5 };
  complexityScore = categoryConfig.baseScore;
  
  // Unterkategorie berücksichtigen
  if (projectContext.sub_category && categoryConfig.subCategoryScores) {
    const subCategories = projectContext.sub_category.split(',').map(s => s.trim());
    let maxSubScore = 0;
    
    for (const subCat of subCategories) {
      if (categoryConfig.subCategoryScores[subCat]) {
        maxSubScore = Math.max(maxSubScore, categoryConfig.subCategoryScores[subCat]);
      }
    }
    
    if (maxSubScore > complexityScore) {
      complexityScore = maxSubScore;
    }
    
    // Mehrere Unterkategorien = höhere Komplexität
    if (subCategories.length > 2) {
      complexityScore += Math.min(subCategories.length - 1, 3);
    }
  }
  
  // SCHRITT 2: GEWERKE-KOMPLEXITÄT UND -ANZAHL
  const detectedTrades = projectContext.detectedTrades || [];
  const tradeCount = detectedTrades.length;
  
  // Berechne gewichtete Gewerke-Komplexität
  let tradeComplexityScore = 0;
  let maxTradeComplexity = 'EINFACH';
  let hasVeryComplexTrade = false;
  
  detectedTrades.forEach(trade => {
    const tradeConfig = TRADE_COMPLEXITY[trade.code];
    if (tradeConfig) {
      tradeComplexityScore += tradeConfig.weight;
      
      // Track höchste Einzelkomplexität
      if (tradeConfig.complexity === 'SEHR_HOCH') {
        hasVeryComplexTrade = true;
        maxTradeComplexity = 'SEHR_HOCH';
      } else if (tradeConfig.complexity === 'HOCH' && maxTradeComplexity !== 'SEHR_HOCH') {
        maxTradeComplexity = 'HOCH';
      } else if (tradeConfig.complexity === 'MITTEL' && 
                 maxTradeComplexity !== 'SEHR_HOCH' && 
                 maxTradeComplexity !== 'HOCH') {
        maxTradeComplexity = 'MITTEL';
      }
    }
  });
  
  // Kombiniere Gewerke-Anzahl mit Gewerke-Komplexität
  let tradeFactor = 0;
  
  // Basis: Anzahl der Gewerke
  if (tradeCount >= 10) {
    tradeFactor = 8;
  } else if (tradeCount >= 7) {
    tradeFactor = 6;
  } else if (tradeCount >= 5) {
    tradeFactor = 4;
  } else if (tradeCount >= 3) {
    tradeFactor = 3;
  } else if (tradeCount === 2) {
    tradeFactor = 2;
  } else if (tradeCount === 1) {
    tradeFactor = 1;
  }
  
  // Modifiziere basierend auf Gewerke-Komplexität
  if (hasVeryComplexTrade) {
    // Wenn sehr komplexe Gewerke dabei sind, Mindest-Score
    tradeFactor = Math.max(tradeFactor, 5);
    
    // Bei einzelnem sehr komplexen Gewerk (z.B. nur Dach)
    if (tradeCount === 1) {
      tradeFactor = 4; // Nicht zu niedrig bewerten
    }
  }
  
  // Gewichtete Gewerke-Komplexität zur Gesamtwertung
  complexityScore += tradeFactor;
  complexityScore += Math.min(tradeComplexityScore / 2, 8); // Cap bei 8
  
  // SCHRITT 3: KONTEXT-SPEZIFISCHE ANPASSUNGEN
  
  // Wanddurchbruch-Speziallogik
  const isWanddurchbruch = combinedText.includes('wanddurchbruch') || 
                           combinedText.includes('durchbruch') ||
                           projectContext.sub_category?.includes('Wanddurchbrüche');
  
  if (isWanddurchbruch) {
    const isIsolated = tradeCount <= 2 && 
                      !combinedText.includes('umbau') && 
                      !combinedText.includes('sanierung') &&
                      !combinedText.includes('mehrere');
    
    const isPartOfLargerWork = tradeCount >= 5 || 
                               combinedText.includes('komplett') ||
                               combinedText.includes('kernsanierung');
    
    if (isIsolated) {
      // Einzelner Wanddurchbruch ohne Kontext
      complexityScore = Math.min(complexityScore, 6); // Cap bei niedrig
      console.log('[COMPLEXITY] Isolated Wanddurchbruch - capping complexity');
    } else if (isPartOfLargerWork) {
      // Teil größerer Maßnahme
      complexityScore += 2;
      console.log('[COMPLEXITY] Wanddurchbruch in larger context - adding complexity');
    }
  }
  
  // Einzelnes Dach oder Fassade - Mindest-Komplexität
  if (tradeCount <= 2) {
    if (detectedTrades.some(t => t.code === 'DACH')) {
      complexityScore = Math.max(complexityScore, 14); // Mindestens "hoch"
      console.log('[COMPLEXITY] Single DACH trade - ensuring high complexity');
    }
    if (detectedTrades.some(t => t.code === 'FASS')) {
      complexityScore = Math.max(complexityScore, 12); // Mindestens "mittel-hoch"
      console.log('[COMPLEXITY] Single FASS trade - ensuring medium-high complexity');
    }
  }
  
  // SCHRITT 4: INTAKE-ANTWORTEN AUSWERTEN
  let intakeData = { flaechen: {}, stueckzahlen: {} }; // Initialisiere mit leeren Objekten
  if (intakeAnswers && intakeAnswers.length > 0) {
    intakeData = extractCalculationDataFromIntake(intakeAnswers);
    
    // Flächen-basierte Anpassungen
    if (intakeData.flaechen.dachflaeche) {
      const area = parseFloat(intakeData.flaechen.dachflaeche);
      if (area > 300) complexityScore += 2;
      else if (area > 150) complexityScore += 1;
    }
    
    if (intakeData.flaechen.fassadenflaeche) {
      const area = parseFloat(intakeData.flaechen.fassadenflaeche);
      if (area > 400) complexityScore += 2;
      else if (area > 200) complexityScore += 1;
    }
    
    // Geschoss-Anzahl
    if (intakeData.stueckzahlen.geschosse) {
      const floors = parseInt(intakeData.stueckzahlen.geschosse);
      if (floors > 3) complexityScore += 2;
      else if (floors > 2) complexityScore += 1;
    }
    
    // Anzahl der Intake-Fragen als Indikator
    if (intakeAnswers.length > 24) {
      complexityScore += 2;
    } else if (intakeAnswers.length > 20) {
      complexityScore += 1;
    }
  }
  
  // SCHRITT 5: BUDGET
  if (projectContext.budget) {
    const budget = parseFloat(projectContext.budget);
    
    // Spezielle Bewertung für hochkomplexe Einzelgewerke
    if (hasVeryComplexTrade && tradeCount <= 3) {
      if (budget > 80000) complexityScore += 2;
      else if (budget > 40000) complexityScore += 1;
    } else {
      // Standard-Budget-Bewertung
      if (budget > 500000) complexityScore += 4;
      else if (budget > 200000) complexityScore += 3;
      else if (budget > 100000) complexityScore += 2;
      else if (budget > 50000) complexityScore += 1;
    }
  }
  
  // SCHRITT 6: KEYWORD-BONUS (nur additiv)
  const highKeywords = ['kernsanierung', 'komplettsanierung', 'denkmalschutz', 
                        'brandschutz', 'statiker', 'architekt', 'asbest'];
  const mediumKeywords = ['sanierung', 'modernisierung', 'energetisch', 'dämmung'];
  
  const foundHigh = highKeywords.filter(k => combinedText.includes(k));
  const foundMedium = mediumKeywords.filter(k => combinedText.includes(k));
  
  if (foundHigh.length > 0) {
    complexityScore += Math.min(foundHigh.length * 2, 4);
  }
  if (foundMedium.length > 0) {
    complexityScore += Math.min(foundMedium.length, 2);
  }
  
  // FINALE KLASSIFIZIERUNG mit KONTEXT-CAPS
  console.log(`[COMPLEXITY] Raw Score: ${complexityScore}`);
  
  // Spezielle Caps für bestimmte Projekttypen
  const subCat = (projectContext.sub_category || '').toLowerCase();
  
  // === CAPS FÜR BEGRENZTE PROJEKTE ===
  
  // Badsanierung
if (subCat.includes('badsanierung')) {
  // Luxus-Bad oder barrierefrei: KEIN Cap, kann hoch bleiben
  if (combinedText.includes('luxus') || combinedText.includes('barrierefrei')) {
    complexityScore = Math.max(complexityScore, 14); // Mindestens "hoch"
  }
  // Mehrere Bäder: auch komplex
  else if (combinedText.includes('mehrere')) {
    complexityScore = Math.max(complexityScore, 14); // Mindestens "hoch"
  }
  // Standard-Bad mit wenigen Gewerken
  else if (tradeCount <= 4) {
    complexityScore = Math.min(complexityScore, 11); // Mittleres "mittel"
  }
  // Standard-Bad mit mehreren Gewerken
  else if (tradeCount <= 6) {
    complexityScore = Math.min(complexityScore, 13); // Oberes "mittel"
  }
  // Sehr große Badsanierung (>6 Gewerke)
  else {
    complexityScore = Math.min(complexityScore, 16); // Unteres "hoch"
  }
}
  
  // Küchensanierung
  if (subCat.includes('küchensanierung')) {
    if (tradeCount <= 5 && !combinedText.includes('luxus')) {
      complexityScore = Math.min(complexityScore, 14); // Max "hoch"
    }
  }
  
  // Wohnungssanierung
  if ((combinedText.includes('wohnung') && combinedText.includes('sanierung')) ||
      subCat.includes('teilsanierung')) {
    if (tradeCount <= 8 && !combinedText.includes('kernsanierung')) {
      complexityScore = Math.min(complexityScore, 13); // Basis "mittel-hoch"
      
      // Modifikatoren
      if (combinedText.includes('altbau')) complexityScore += 1;
      if (combinedText.includes('komplett')) complexityScore += 1;
      if (intakeData?.flaechen?.wohnflaeche > 120) complexityScore += 1;
    }
  }
  
  // Entkernung Wohnung
  if (subCat.includes('entkernung')) {
    if (combinedText.includes('wohnung') || tradeCount <= 2) {
      complexityScore = Math.min(complexityScore, 10); // Basis "mittel"
      
      if (combinedText.includes('asbest')) complexityScore += 4;
      if (combinedText.includes('tragend')) complexityScore += 2;
    }
  }
  
  // Dachausbau ohne Gauben
  if (subCat.includes('dachausbau')) {
    if (!combinedText.includes('gaube') && !combinedText.includes('aufstockung')) {
      complexityScore = Math.min(complexityScore, 16); // Max "hoch"
    }
  }
  
  // === MINDEST-SCORES FÜR KRITISCHE GEWERKE ===
  
  detectedTrades.forEach(trade => {
    const tradeConfig = TRADE_COMPLEXITY[trade.code];
    if (tradeConfig?.minScore && tradeCount <= 3) {
      // Bei wenigen Gewerken: Mindest-Score durchsetzen
      if (complexityScore < tradeConfig.minScore) {
        complexityScore = tradeConfig.minScore;
        console.log(`[COMPLEXITY] ${trade.code} raised to minimum ${tradeConfig.minScore}`);
      }
    }
  });
  
  // === SPEZIELLE GEWERKE-MODIFIKATOREN ===
  
  // PV-Modifikatoren
  if (detectedTrades.some(t => t.code === 'PV')) {
    if (combinedText.includes('speicher')) complexityScore += 1;
    if (combinedText.includes('wallbox')) complexityScore += 1;
    if (combinedText.includes('notstrom')) complexityScore += 2;
  }
  
  // Klima-Modifikatoren
  if (detectedTrades.some(t => t.code === 'KLIMA')) {
    if (combinedText.includes('zentral')) complexityScore += 2;
    if (combinedText.includes('wärmerückgewinnung')) complexityScore += 1;
  }
  
  // FINALE KLASSIFIZIERUNG
  console.log(`[COMPLEXITY] Final Score: ${complexityScore}`);
  
  let finalComplexity;
  if (complexityScore >= 20) {
    finalComplexity = 'sehr_hoch';
  } else if (complexityScore >= 14) {
    finalComplexity = 'hoch';
  } else if (complexityScore >= 10) {
    finalComplexity = 'mittel';
  } else if (complexityScore >= 6) {
    finalComplexity = 'niedrig';
  } else {
    finalComplexity = 'einfach';
  }
  
  return finalComplexity;
}

/**
 * NEU: Intelligente Intake-Fragenanzahl basierend auf Gewerke-Count
 */
function getIntakeQuestionCount(projectContext) {
  const tradeCount = projectContext.detectedTrades?.length || 0;
  const complexity = determineProjectComplexity(projectContext, []);
  
  // Basis-Ranges für Intake
  const INTAKE_RANGES = {
    SINGLE_TRADE: { min: 14, max: 18 },    // 1 Gewerk
    SMALL_PROJECT: { min: 16, max: 20 },   // 2-3 Gewerke
    MEDIUM_PROJECT: { min: 18, max: 24 },  // 4-5 Gewerke
    LARGE_PROJECT: { min: 22, max: 28 }    // 6+ Gewerke
  };
  
  let range;
  
  // Primär nach Gewerke-Anzahl
  if (tradeCount === 1) {
    range = INTAKE_RANGES.SINGLE_TRADE;
  } else if (tradeCount <= 3) {
    range = INTAKE_RANGES.SMALL_PROJECT;
  } else if (tradeCount <= 5) {
    range = INTAKE_RANGES.MEDIUM_PROJECT;
  } else {
    range = INTAKE_RANGES.LARGE_PROJECT;
  }
  
  // Feintuning basierend auf Komplexität
  let targetCount = range.min;
  
  switch(complexity) {
    case 'SEHR_HOCH':
      targetCount = range.max;
      break;
    case 'HOCH':
      targetCount = Math.round((range.min + range.max) * 0.75 / 2);
      break;
    case 'MITTEL':
      targetCount = Math.round((range.min + range.max) / 2);
      break;
    case 'NIEDRIG':
      targetCount = Math.round((range.min + range.max) * 0.35 / 2);
      break;
    case 'EINFACH':
      targetCount = range.min;
      break;
  }
  
  // Spezialfälle
  if (projectContext.description) {
    const desc = projectContext.description.toLowerCase();
    
    // Weniger Fragen bei sehr spezifischen Einzelmaßnahmen
    if (tradeCount === 1 && (
      desc.includes('nur') || 
      desc.includes('lediglich') || 
      desc.includes('ausschließlich')
    )) {
      targetCount = Math.max(8, targetCount - 2);
    }
    
    // Mehr Fragen bei Koordinationsbedarf
    if (desc.includes('koordination') || 
        desc.includes('gleichzeitig') || 
        desc.includes('bewohnt während')) {
      targetCount = Math.min(range.max, targetCount + 2);
    }
    
    // Mehr Fragen bei besonderen Anforderungen
    if (desc.includes('denkmalschutz') || 
        desc.includes('brandschutz') || 
        desc.includes('schadstoffe')) {
      targetCount = Math.min(range.max + 2, targetCount + 3);
    }
  }
  
  console.log(`[INTAKE] Trade count: ${tradeCount}, Complexity: ${complexity}, Target questions: ${targetCount}`);
  
  return {
    count: targetCount,
    range: range,
    tradeCount: tradeCount,
    complexity: complexity,
    reasoning: `${tradeCount} Gewerk(e) erkannt → ${targetCount} Intake-Fragen`
  };
}

/**
 * Trade-Zuordnung prüfen
 */
async function isTradeAssignedToProject(projectId, tradeId) {
  const result = await query(
    'SELECT 1 FROM project_trades WHERE project_id = $1 AND trade_id = $2',
    [projectId, tradeId]
  );
  return result.rows.length > 0;
}

/**
 * Projekt-Trade Verknüpfung
 */
async function ensureProjectTrade(projectId, tradeId, source = 'unknown') {
  const exists = await isTradeAssignedToProject(projectId, tradeId);
  
  if (!exists) {
    console.log(`[PROJECT_TRADE] Adding trade ${tradeId} to project ${projectId} (source: ${source})`);
    await query(
      `INSERT INTO project_trades (project_id, trade_id)
       VALUES ($1, $2)
       ON CONFLICT (project_id, trade_id) DO NOTHING`,  
      [projectId, tradeId]
    );
  }
}

/**
 * Alle Trades eines Projekts abrufen
 */
async function getProjectTrades(projectId) {
  // Sort project trades so that manually added trades appear last regardless of sort_order.
  // We join project_trades to access the is_manual flag and use a CASE expression in ORDER BY
  // to push manual trades to the end. Within each group we still sort by sort_order and id.
  const result = await query(
    `SELECT t.*
     FROM trades t
     JOIN project_trades pt ON pt.trade_id = t.id
     WHERE pt.project_id = $1
     ORDER BY
       CASE WHEN COALESCE(pt.is_manual, false) THEN 1 ELSE 0 END,
       t.sort_order,
       t.id`,
    [projectId]
  );
  return result.rows;
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
      'SELECT id, code, name, sort_order FROM trades ORDER BY sort_order, id'
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
  
  const masterPrompt = await getPromptByName('master');

// VALIDIERE Masterprompt
if (!masterPrompt) {
  console.error('[DETECT] CRITICAL: Master prompt missing!');
  throw new Error('Master-Prompt fehlt in der Datenbank - Gewerke-Erkennung nicht möglich');
}

if (masterPrompt.length < 500) {
  console.warn(`[DETECT] WARNING: Master prompt suspiciously short: ${masterPrompt.length} chars`);
}

// DEBUG: Prüfe ob wichtige Regeln im Masterprompt sind
const criticalRules = [
  'DACHARBEITEN',
  'ABBRUCH-GEWERK',
  'GERÜST',
  'FENSTER/TÜREN',
  'SANITÄR/HEIZUNG/ELEKTRO',
  'FASSADE vs. PUTZ/MALER',
  'GEWERKEABGRENZUNG'
];

const missingRules = criticalRules.filter(rule => 
  !masterPrompt.includes(rule)
);

if (missingRules.length > 0) {
  console.warn('[DETECT] Master prompt missing critical rules:', missingRules);
  console.warn('[DETECT] This may lead to incorrect trade detection!');
}

console.log(`[DETECT] Master prompt loaded: ${masterPrompt.length} chars, ${criticalRules.length - missingRules.length}/${criticalRules.length} critical rules found`);

// DANN GEHT ES WEITER MIT DEM BESTEHENDEN CODE:
const availableTrades = await getAvailableTrades();
  
if (availableTrades.length === 0) {
  throw new Error('No trades available in database');
}
  
  const tradeList = availableTrades
    .filter(t => t.code !== 'INT') // INT wird separat behandelt
    .map(t => `- ${t.code}: ${t.name}`)
    .join('\n');
  
  const systemPrompt = `${masterPrompt}

Du bist ein erfahrener Baukoordinator für die BYNDL-Plattform.
Analysiere die Projektbeschreibung und erkenne NUR die tatsächlich benötigten Gewerke.

KRITISCHE GEWERKE-ABGRENZUNGEN (IMMER EINHALTEN):

1. DACHARBEITEN:
   - Dachdecker (DACH) übernimmt ALLES am Dach:
     * Rückbau alte Eindeckung und Entsorgung
     * Neue Eindeckung und Abdichtung
     * ALLE Klempnerarbeiten (Rinnen, Fallrohre, Bleche, Kehlen)
     * Dachfenster-Einbau (Abdichtung)
     * Schneefangsysteme
   - NIEMALS Abbruch (ABBR) für Dacharbeiten!
   - NIEMALS Fassade (FASS) für Dachrinnen!
   - NIEMALS Rohbau (ROH) für Rückbauarbeiten am Dach!
   - NIEMALS Schlosser/Metallbau (SCHL) für Dachrinnen und Fallrohre!
   - NIEMALS Fenster/Türen (FEN) für Innentüren! 

2. ABBRUCH-GEWERK (ABBR) - NUR HINZUFÜGEN WENN:
   - Umfangreiche Sanierung mit 3+ anderen Gewerken (Komplettmodernisierung)
   - Schadstoffe wie Asbest erwähnt/vermutet werden (Spezialentsorgung)
   - Komplette Entkernung oder Teilentkernung geplant
   - Mehrere Wände entfernt werden
   - NICHT bei einzelnen Gewerken (Bad, Küche, Dach allein)
   - NICHT wenn nur 1-2 andere Gewerke beteiligt sind

3. SANITÄR/HEIZUNG/ELEKTRO:
   - Sanitär (SAN): Wasser, Abwasser, Sanitärobjekte, eigene Wanddurchbrüche (Kernbohrungen), Rückbau alter Installationen
   - Heizung (HEI): Wärmeerzeugung, Heizkörper, Fußbodenheizung, Rückbau alter Heizungsanlagen
   - Elektro (ELEKT): Strom, Schalter, Smart Home, eigene Schlitze, KOMPLETTER Rückbau alter Elektroinstallationen (Kabel, Dosen, Verteiler)
   - Lüftung/Klima (KLIMA): Lüftungsanlagen, Klimageräte, Luftkanäle, Wärmerückgewinnung, Luftqualität
   - Jedes Gewerk macht EIGENE Rückbauarbeiten, Schlitze und Durchbrüche!
   - KEIN separates Abbruch-Gewerk für TGA-Rückbau!

4. FASSADE vs. PUTZ/MALER:
   - Fassade (FASS): NUR Außen-WDVS, Klinker, vorgehängte Fassaden
   - Maler (MAL): Innenputz, Innenanstriche, einfache Fassadenanstriche
   - Bei reinem Fassadenanstrich: NUR Maler, NICHT Fassade

5. ROHBAU vs. ABBRUCH:
   - Rohbau (ROH): Neue Wände, Decken, Fundamente
   - Abbruch (ABBR): NUR bei Abriss oder (Teil-)Entkernung
   - Wanddurchbrüche: Immer Rohbau (ROH) wegen statischem Eingriff

6. SANITÄR/HEIZUNG/ELEKTRO:
   - Sanitär (SAN): Wasser, Abwasser, Sanitärobjekte, Wanddurchbrüche für Leitungen
   - Heizung (HEI): Wärmeerzeugung, Heizkörper, Fußbodenheizung
   - Elektro (ELEKT): Strom, Schalter, Smart Home, eigene Schlitze
   - Jedes Gewerk macht EIGENE Schlitze und Durchbrüche!

7. TROCKENBAU vs. TISCHLER:
   - Trockenbau (TRO): Rigips- bzw. Gipskartonwände, abgehängte Decken, Vorsatzschalen
   - Tischler (TIS): Türen, Zargen, Holzverkleidungen, Einbaumöbel
   - NIEMALS Türen im Trockenbau!

8. FLIESEN vs. BODENBELAG:
   - Fliesen (FLI): ALLE Fliesenarbeiten, Naturstein in Bad/Küche
   - Bodenbelag (BOD): Parkett, Laminat, Vinyl, Teppich - NIEMALS Fliesen!

9. GERÜSTBAU:
   - Wenn Gerüst (GER) erforderlich immer als eigenes Gewerk → KEINE Gerüstpositionen in anderen Gewerken

10. ESTRICH:
   - Estrich (ESTR): Alle Estricharten, Dämmung unter Estrich
   - NICHT: Oberbeläge (gehören zu FLI oder BOD)

11. FENSTER/TÜREN:
   - Fenster (FEN): Außenfenster, Fenstertüren, Rollläden, Haustüren
   - Tischler (TIS): Innentüren, Zargen
   - Dachdecker (DACH): Dachfenster-Abdichtung

12. AUSSENANLAGEN:
    - Garten (AUSS): Pflaster, Zäune, Terrassen, Gartenbau
    - NICHT Balkonsanierung (gehört zu DACH oder FASS je nach Abdichtung)

13. ZIMMERER vs. TISCHLER vs. FENSTER:
   - Zimmerer (ZIMM): Dachstuhl, tragende Holzkonstruktionen, Holzrahmenbau, Carports, Pergolen
   - Tischler (TIS): Innentüren, Wohnungseingangstüren (nicht Haustüren!), Möbel, nicht-tragende Verkleidungen
   - Fenster (FEN): ALLE Fenster inkl. Holzfenster (außer Dachfenster)
   - Dachdecker (DACH): Dachfenster-Einbau und -Abdichtung
   - NIEMALS Fenster im Zimmerer-Gewerk!
   - NIEMALS Dachstuhl im Tischler-Gewerk!
   - NIEMALS Sockelleisten im Tischler-Gewerk!
   
GENERELLE REGELN:
- Qualität vor Quantität - lieber weniger richtige Gewerke
- Bei Unsicherheit: Hauptgewerk übernimmt Nebenleistungen
- Spezialisierte Gewerke haben Vorrang
- NIEMALS "INT" zurückgeben
- Maximal 7-9 Gewerke pro Projekt (außer Großprojekte)

WICHTIG BEI IMPLIED TRADES:
- Wenn vorgeschlagene Gewerke mit Konfidenz >= 80% übergeben werden, MÜSSEN diese übernommen werden
- Bei Badsanierung IMMER Trockenbau (TRO) für Vorwandinstallation einplanen
- Begründe wenn du ein hochkonfidentes impliedTrade NICHT übernimmst

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
    "estimatedDuration": "4-6 Wochen",
    "criticalTrades": ["SAN", "ELEKT"]
  }
}`;

  const userPrompt = `PROJEKTDATEN:
Kategorie: ${project.category || 'Nicht angegeben'}
Unterkategorie: ${project.subCategory || 'Nicht angegeben'}
Beschreibung: ${project.description || 'Keine Beschreibung'}
Zeitrahmen: ${project.timeframe || 'Nicht angegeben'}
Budget: ${project.budget || 'Nicht angegeben'}

${project.extractedData?.impliedTrades?.length > 0 ? `
VORGESCHLAGENE GEWERKE (aus Analyse):
${project.extractedData.impliedTrades.map(t => 
  `- ${t.code}: ${t.reason} (Konfidenz: ${t.confidence}%)`
).join('\n')}

WICHTIG: Übernimm alle Gewerke mit Konfidenz >= 80%!
` : ''}

${project.extractedData?.measures?.length > 0 ? `
Maßnahmen: ${project.extractedData.measures.join(', ')}
` : ''}

${project.extractedData?.rooms?.length > 0 ? `
Räume: ${project.extractedData.rooms.join(', ')}
` : ''}

Analysiere diese Daten und gib die benötigten Gewerke als JSON zurück.`;

  try {
    const llmResponse = await llmWithPolicy('detect', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { 
      maxTokens: 3000,
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
      if (trade.code === 'INT') continue; // Skip INT
      
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

    // Kernsanierung - ALLE Gewerke außer AUSS, PV, KLIMA
    const isKernsanierung = project.description?.toLowerCase().includes('kernsanierung') || 
                            project.description?.toLowerCase().includes('komplettsanierung');

    if (isKernsanierung) {
      console.log('[DETECT] Kernsanierung erkannt - füge ALLE Gewerke hinzu (außer AUSS, PV, KLIMA)');
      
      const excludeForKernsanierung = ['AUSS', 'PV', 'KLIMA', 'INT'];
      
      for (const trade of availableTrades) {
        if (excludeForKernsanierung.includes(trade.code)) continue;
        if (usedIds.has(trade.id)) continue;
        
        detectedTrades.push({
          id: trade.id,
          code: trade.code,
          name: trade.name
        });
        usedIds.add(trade.id);
        console.log(`[DETECT] Kernsanierung: Added ${trade.code}`);
      }
    }
    
    if (detectedTrades.length === 0) {
      throw new Error('No valid trades detected');
    }
    
    // NEU: Automatisch Gerüst hinzufügen wenn nötig
    const needsScaffolding = detectedTrades.some(t => 
      ['DACH', 'FASS', 'FEN'].includes(t.code)
    );
    
    // Oder aus extractedData wenn vorhanden
    const extractedNeedsScaffolding = project.extractedData?.specificDetails?.needsScaffolding;
    
    if ((needsScaffolding || extractedNeedsScaffolding) && 
        !detectedTrades.some(t => t.code === 'GER')) {
      
      // Gerüstbau-Trade aus DB holen
      const scaffoldTrade = availableTrades.find(t => t.code === 'GER');
      if (scaffoldTrade && !usedIds.has(scaffoldTrade.id)) {
        console.log('[DETECT] Auto-adding Gerüstbau for Dach/Fassade/Fenster work');
        detectedTrades.push({
          id: scaffoldTrade.id,
          code: scaffoldTrade.code,
          name: scaffoldTrade.name
        });
      }
    }
    // NEU: Automatisch PV erkennen
const needsPV = project.description?.toLowerCase().includes('pv') || 
                 project.description?.toLowerCase().includes('photovoltaik') ||
                 project.description?.toLowerCase().includes('solar') ||
                 project.description?.toLowerCase().includes('solaranlage');

if (needsPV && !detectedTrades.some(t => t.code === 'PV')) {
  const pvTrade = availableTrades.find(t => t.code === 'PV');
  if (pvTrade && !usedIds.has(pvTrade.id)) {
    console.log('[DETECT] Auto-adding PV for solar/photovoltaik keywords');
    detectedTrades.push({
      id: pvTrade.id,
      code: pvTrade.code,
      name: pvTrade.name
    });
  }
}
    
    console.log('[DETECT] Successfully detected trades:', detectedTrades);
    return detectedTrades;
    
  } catch (err) {
    console.error('[DETECT] Trade detection failed:', err);
    throw new Error('Gewerke-Erkennung fehlgeschlagen');
  }
}

/**
 * PRÄZISE EXTRAKTION VON KALKULATIONSDATEN AUS INTAKE-ANTWORTEN
 * Unterscheidet klar zwischen verschiedenen Dimensionen und Kontexten
 */

function extractCalculationDataFromIntake(intakeAnswers) {
  const knownData = {
    flaechen: {},
    laengen: {},
    breiten: {},
    hoehen: {},
    stueckzahlen: {},
    volumen: {},
    gewichte: {},
    materialien: {},
    rawData: []
  };
  
  intakeAnswers.forEach(item => {
    const question = (item.question_text || '').toLowerCase();
    const answer = (item.answer_text || '').trim();
    
    // Speichere für Debug
    knownData.rawData.push(`${item.question_text}: ${answer}`);
    
    // ========== FLÄCHEN (m²) ==========
    if (question.includes('fläche')) {
      // Unterscheide WELCHE Fläche
      if (question.includes('wohnfläche') || question.includes('gesamtfläche')) {
        knownData.flaechen.wohnflaeche_gesamt = answer;
      }
      else if (question.includes('bad')) {
        knownData.flaechen.badflaeche_gesamt = answer;
      }
      else if (question.includes('dach')) {
        knownData.flaechen.dachflaeche = answer;
      }
      else if (question.includes('fassade')) {
        knownData.flaechen.fassadenflaeche = answer;
      }
      else if (question.includes('garten') || question.includes('grundstück')) {
        knownData.flaechen.grundstueck = answer;
      }
    }
    
    // ========== HÖHEN (m/cm) ==========
    if (question.includes('höhe')) {
      // Unterscheide WELCHE Höhe
      if (question.includes('raum') || question.includes('decke')) {
        knownData.hoehen.raumhoehe = answer;
      }
      else if (question.includes('gebäude') || question.includes('first')) {
        knownData.hoehen.gebaeudehoehe = answer;
      }
      else if (question.includes('keller')) {
        knownData.hoehen.kellerhoehe = answer;
      }
      else if (question.includes('geschoss')) {
        knownData.hoehen.geschosshoehe = answer;
      }
    }
    
    // ========== LÄNGEN (m/cm) ==========
    if (question.includes('länge') || question.includes('lang')) {
      if (question.includes('wand')) {
        knownData.laengen.wandlaenge = answer;
      }
      else if (question.includes('raum')) {
        knownData.laengen.raumlaenge = answer;
      }
      else if (question.includes('flur') || question.includes('gang')) {
        knownData.laengen.flurlaenge = answer;
      }
    }
    
    // ========== BREITEN (m/cm) ==========
    if (question.includes('breite') || question.includes('breit')) {
      if (question.includes('wand')) {
        knownData.breiten.wandbreite = answer;
      }
      else if (question.includes('raum')) {
        knownData.breiten.raumbreite = answer;
      }
      else if (question.includes('fenster')) {
        knownData.breiten.fensterbreite = answer;
      }
      else if (question.includes('tür')) {
        knownData.breiten.tuerbreite = answer;
      }
    }
    
    // ========== SPEZIELLE MASSE ==========
    // Wandstärke (meist in cm)
    if (question.includes('wandstärke') || question.includes('wanddicke') || 
        (question.includes('wand') && question.includes('dick'))) {
      knownData.hoehen.wandstaerke = answer; // Technisch eine "Dicke"
    }
    
    // ========== KOMBINIERTE MASSE (LxBxH) ==========
    if (question.includes('maße') || question.includes('abmessung')) {
      // Versuche zu parsen: "5x3x2,5m" oder "500x300x250cm"
      const match = answer.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(?:[x×]\s*(\d+(?:[.,]\d+)?))?/i);
      if (match) {
        if (question.includes('bad')) {
          knownData.laengen.bad = match[1];
          knownData.breiten.bad = match[2];
          if (match[3]) knownData.hoehen.bad = match[3];
        }
        else if (question.includes('raum') || question.includes('zimmer')) {
          knownData.laengen.raum = match[1];
          knownData.breiten.raum = match[2];
          if (match[3]) knownData.hoehen.raum = match[3];
        }
      }
    }
    
    // ERWEITERTE STÜCKZAHLEN-ERFASSUNG
    if (question.includes('wie viele') || question.includes('anzahl')) {
      const numberMatch = answer.match(/\d+/);
      if (numberMatch) {
        const count = numberMatch[0];
        
        // Basis-Stückzahlen (wie bisher)
        if (question.includes('fenster') && !question.includes('dachfenster')) {
          knownData.stueckzahlen.fenster = count;
        }
        else if (question.includes('dachfenster')) {
          knownData.stueckzahlen.dachfenster = count;
        }
        else if (question.includes('tür')) {
          knownData.stueckzahlen.tueren = count;
        }
        else if (question.includes('raum') || question.includes('zimmer')) {
          knownData.stueckzahlen.raeume = count;
        }
        else if (question.includes('bad') || question.includes('bäder')) {
          knownData.stueckzahlen.baeder = count;
        }
        else if (question.includes('etage') || question.includes('geschoss') || question.includes('stockwerk')) {
          knownData.stueckzahlen.geschosse = count;
        }
        // NEU: Zusätzliche Stückzahlen
        else if (question.includes('wand') || question.includes('wände')) {
          knownData.stueckzahlen.waende = count;
        }
        else if (question.includes('heizkörper')) {
          knownData.stueckzahlen.heizkoerper = count;
        }
        else if (question.includes('steckdose')) {
          knownData.stueckzahlen.steckdosen = count;
        }
        else if (question.includes('schalter')) {
          knownData.stueckzahlen.schalter = count;
        }
        else if (question.includes('leuchte') || question.includes('lampe')) {
          knownData.stueckzahlen.leuchten = count;
        }
        else if (question.includes('rolladen') || question.includes('rollladen')) {
          knownData.stueckzahlen.rolladen = count;
        }
        // NEU: Gauben
        else if (question.includes('gaube') || question.includes('gauben')) {
          knownData.stueckzahlen.gauben = count;
        }
      }
    }  // <-- DIESE KLAMMER FEHLT! 
    // ========== MATERIALIEN ==========
    if (question.includes('material') || question.includes('ausführung')) {
      if (question.includes('wand')) {
        knownData.materialien.wand = answer;
      }
      else if (question.includes('boden')) {
        knownData.materialien.boden = answer;
      }
      else if (question.includes('dach')) {
        knownData.materialien.dach = answer;
      }
    }
  });
  
  return knownData;
}

/**
 * Generiert klaren Kontext für das LLM
 */
function createCalculationContext(knownData, tradeCode) {
  let context = `
╔════════════════════════════════════════════════════════════════╗
║ BEREITS BEKANNTE KALKULATIONSDATEN (NICHT ERNEUT ERFRAGEN!)   ║
╚════════════════════════════════════════════════════════════════╝
`;
  
  // FLÄCHEN
  if (Object.keys(knownData.flaechen).length > 0) {
    context += `\n▶ FLÄCHEN:\n`;
    Object.entries(knownData.flaechen).forEach(([key, value]) => {
      context += `  • ${key.replace(/_/g, ' ')}: ${value}\n`;
    });
  }
  
  // HÖHEN
  if (Object.keys(knownData.hoehen).length > 0) {
    context += `\n▶ HÖHEN:\n`;
    Object.entries(knownData.hoehen).forEach(([key, value]) => {
      context += `  • ${key.replace(/_/g, ' ')}: ${value}\n`;
    });
  }
  
  // LÄNGEN
  if (Object.keys(knownData.laengen).length > 0) {
    context += `\n▶ LÄNGEN:\n`;
    Object.entries(knownData.laengen).forEach(([key, value]) => {
      context += `  • ${key.replace(/_/g, ' ')}: ${value}\n`;
    });
  }
  
  // BREITEN
  if (Object.keys(knownData.breiten).length > 0) {
    context += `\n▶ BREITEN:\n`;
    Object.entries(knownData.breiten).forEach(([key, value]) => {
      context += `  • ${key.replace(/_/g, ' ')}: ${value}\n`;
    });
  }
  
  // STÜCKZAHLEN
  if (Object.keys(knownData.stueckzahlen).length > 0) {
    context += `\n▶ ANZAHL/STÜCK:\n`;
    Object.entries(knownData.stueckzahlen).forEach(([key, value]) => {
      context += `  • ${key.replace(/_/g, ' ')}: ${value}\n`;
    });
  }
  
  // MATERIALIEN
  if (Object.keys(knownData.materialien).length > 0) {
    context += `\n▶ MATERIALIEN:\n`;
    Object.entries(knownData.materialien).forEach(([key, value]) => {
      context += `  • ${key.replace(/_/g, ' ')}: ${value}\n`;
    });
  }
  
  // GEWERKE-SPEZIFISCHE HINWEISE
  context += `\n═══════════════════════════════════════════════════════════════\n`;
  context += `WICHTIG für ${tradeCode}:\n`;
  
  // Beispiele was NICHT mehr gefragt werden darf
  if (knownData.flaechen.badflaeche_gesamt) {
    context += `❌ NICHT fragen: "Wie groß ist das Bad?" → Bereits bekannt: ${knownData.flaechen.badflaeche_gesamt}\n`;
    context += `✅ ERLAUBT: "Davon Wandfläche zu fliesen?" oder "Davon Bodenfläche?"\n`;
  }
  
  if (knownData.hoehen.raumhoehe) {
    context += `❌ NICHT fragen: "Wie hoch sind die Räume?" → Bereits bekannt: ${knownData.hoehen.raumhoehe}\n`;
    context += `✅ ERLAUBT: Nutze diese Höhe für deine Berechnungen\n`;
  }
  
  if (knownData.stueckzahlen.fenster) {
    context += `❌ NICHT fragen: "Wie viele Fenster?" → Bereits bekannt: ${knownData.stueckzahlen.fenster}\n`;
    context += `✅ ERLAUBT: "Welche Maße haben die einzelnen Fenster?"\n`;
  }
  
  context += `\nREGEL: Frage NUR nach DETAILS die für DEIN Gewerk spezifisch sind!`;
  
  return context;
}

/**
 * Vollständige Gewerke-Validierung aus Intake-Antworten
 * NUR mit existierenden Gewerke-Codes aus dem System
 */

// KOMPLETTE GEWERKE-ZUORDNUNGSREGELN für alle 20 vorhandenen Gewerke
const TRADE_DETECTION_RULES = {
  // EXKLUSIVE Keywords - NUR dieses Gewerk darf diese Begriffe beanspruchen
  exclusive: {
    'DACH': [
      'dach', 'dacheindeckung', 'eindecken', 'Eindeckung', 'dachziegel', 'dachpfanne', 'dachstein',
      'dachrinne', 'fallrohr', 'dachfenster', 'schneefang', 'kehle', 'first', 'abdichten',
      'gauben', 'gaube abdichten', 'eindeckung', 'dampfbremse', 'unterspannbahn',
      'dachsparren ersetzen', 'sparren aufdoppeln', 'sparren reparieren',
      'dachstuhl sanieren', 'dachabdichtung', 'klempnerarbeiten dach',
      'dachentlüftung', 'dachhaube', 'attika', 'flachdach', 'bitumenbahn'
    ],
    
    'FASS': [
      'fassade', 'wdvs', 'wärmedämmverbundsystem', 'fassadendämmung', 
      'außenputz', 'verblendung', 'klinker', 'fassadenfarbe', 'außendämmung',
      'vorgehängte fassade', 'reibeputz außen', 'fassadenanstrich',
      'fassadensanierung', 'fassadenverkleidung', 'hinterlüftete fassade',
      'putzfassade', 'wärmedämmung außen', 'sockelputz', 'außenwand dämmen'
    ],
    
    'ZIMM': [
      'holzbau', 'dachstuhl', 'gaube', 'gauben', 'gaube bauen', 'neue gaube', 'gaube konstruktion',
      'carport', 'holzkonstruktion', 'fachwerk', 'holzrahmenbau', 'blockhaus',
      'dachstuhl errichten', 'aufstockung holz', 'holzbalken', 'sparren neu',
      'pfetten', 'kehlbalken', 'schwelle', 'holzständerbau', 'pergola',
      'holzterrasse überdacht', 'zimmererarbeiten', 'holzbauweise'
    ],
    
    'ROH': [
      'mauerwerk', 'ziegelmauerwerk', 'durchbruch', 'wanddurchbruch',
      'beton', 'maurerarbeiten', 'sturz', 'kalksandstein', 'neue wand mauern',
      'wand mauern', 'betonieren', 'tragende wand', 'decke durchbrechen', 'fundament',
      'sturz einbauen', 'ziegelwand', 'porenbeton', 'ytong', 'betondecke',
      'stahlbeton', 'bewehrung', 'schalung', 'kernbohrung groß', 'statik',
      'unterfangen', 'ringanker', 'betontreppe', 'mauern', 'betonieren'
    ],
    
    'TRO': [
      'rigips', 'trockenbau', 'ständerwerk', 'vorwand', 'gipskarton',
      'ständerwand', 'vorwandinstallation', 'abgehängte decke', 'vorsatzschale',
      'metallständer', 'trockenbauwand', 'cw-profil', 'uw-profil',
      'gipskartonwand', 'installationswand', 'schallschutzwand',
      'brandschutzwand f90', 'revisionsöffnung', 'trockenbauwände'
    ],
    
    'TIS': [
      'innentür', 'zarge', 'möbel', 'einbauschrank', 'küche einbauen',
      'wohnungseingangstür', 'arbeitsplatte', 'zimmertür', 'wohnungstür',
      'küchenmöbel', 'holzverkleidung innen', 'schiebetür innen', 'falttür',
      'raumteiler holz', 'einbauküche', 'schranksystem', 'holztreppe innen',
      'treppengeländer holz', 'handlauf holz', 'tischlerarbeiten', 'wohnungstür'
    ],
    
    'FEN': [
      'fenster', 'verglasung', 'haustür', 'rolladen', 'jalousie', 'außentür',
      'terrassentür', 'isolierglas', 'neue fenster', 'fenster austauschen',
      'kunststofffenster', 'holzfenster', 'alufenster', 'eingangstür',
      'balkontür', 'fensterbank außen', 'fensterbank innen',
      'dreifachverglasung', 'schallschutzfenster', 'einbruchschutz fenster'
    ],
    
    'SAN': [
      'bad', 'wc', 'waschbecken', 'dusche', 'badewanne', 'abfluss', 'wasserhahn',
      'armatur', 'sanitär', 'bad komplett', 'toilette', 'waschtisch', 
      'wasserleitung', 'abwasser', 'fallleitung', 'hebeanlage', 'rückstauklappe',
      'wasseranschluss bad', 'wasseranschluss küche', 'sanitärobjekte', 'urinal', 'bidet', 
      'sanitärinstallation', 'bad sanieren', 'badezimmer'
    ],
    
    'ELEKT': [
      'schalter', 'steckdose', 'leuchte', 'lampe', 'sicherung', 'verteiler',
      'fi-schalter', 'elektro', 'kabel', 'leitung elektro', 'stromleitung',
      'unterverteiler', 'zählerschrank', 'hausanschluss strom', 'sat-anlage',
      'netzwerk', 'lan-kabel', 'smart home', 'bus-system', 'knx', 'dimmer',
      'bewegungsmelder', 'elektroinstallation', 'elektriker', 'wallbox'
    ],
    
    'HEI': [
      'thermostat', 'warmwasser', 'kessel', 'brenner', 'radiator', 'heizung',
      'heizkörper', 'fußbodenheizung', 'heizungsrohr', 'wärmepumpe',
      'gasheizung', 'ölheizung', 'pelletheizung', 'brennwertkessel',
      'pufferspeicher', 'solaranlage heizung', 'heizkreisverteiler',
      'heizungspumpe', 'heizungsinstallation'
    ],
    
    'KLIMA': [
      'klima', 'luftwechsel', 'abluft', 'zuluft', 'klimaanlage',
      'wärmerückgewinnung', 'lüftung', 'lüftungsanlage',
      'kontrollierte wohnraumlüftung', 'kwl', 'luftkanal', 'luftauslass',
      'luftfilter', 'enthalpietauscher', 'dezentrale lüftung', 'badlüfter',
      'dunstabzug', 'klimatechnik'
    ],
    
    'FLI': [
      'bad', 'badezimmer', 'küche', 'verfugen', 'mosaik', 'naturstein bad', 'feinsteinzeug', 'bodenfliesen',
      'wandfliesen', 'fliesen', 'badfliesen', 'kacheln', 'fliesenspiegel', 'bordüre',
      'großformat fliesen', 'terracotta', 'zementfliesen', 'metro fliesen',
      'hexagon fliesen', 'fugenlos bad', 'fliesenarbeiten', 'fliesenleger'
    ],
    
    'BOD': [
      'parkett', 'laminat', 'vinyl', 'teppich', 'linoleum', 'kork',
      'designboden', 'bodenbelag', 'klick-vinyl', 'massivholzdielen',
      'landhausdielen', 'industrieparkett', 'bambusparkett', 'pvc-boden',
      'kautschuk', 'nadelvlies', 'bodenbelagsarbeiten'
    ],
    
    'MAL': [
      'streichen', 'anstreichen', 'innenputz', 'tapezieren', 'verputzen', 'spachteln',
      'lackieren', 'grundierung', 'malerarbeiten', 'wandfarbe', 'deckenfarbe',
      'lasieren', 'raufaser', 'vliestapete', 'strukturputz innen',
      'streichputz', 'silikatfarbe', 'dispersionsfarbe', 'kalkputz innen',
      'malerarbeiten innen'
    ],
    
    'ESTR': [
      'fließestrich', 'zementestrich', 'anhydritestrich', 'trockenestrich',
      'ausgleichsmasse', 'estrich', 'heizestrich', 'calciumsulfatestrich',
      'schnellestrich', 'verbundestrich', 'schwimmender estrich',
      'dämmung unter estrich', 'trittschalldämmung', 'randdämmstreifen',
      'estricharbeiten'
    ],
    
    'GER': [
      'gerüst', 'baugerüst', 'arbeitsgerüst', 'fassadengerüst', 'rollgerüst',
      'dachgerüst', 'schutzgerüst', 'fanggerüst', 'hängegerüst', 'modulgerüst',
      'gerüstbau', 'einrüstung', 'gerüststellung', 'gerüstmiete'
    ],
    
    'SCHL': [
      'geländer', 'zaun', 'tor', 'metallbau', 'stahltreppe',
      'schlosserarbeiten', 'balkongeländer', 'treppengeländer metall',
      'französischer balkon', 'einbruchschutz gitter', 'kellerschacht',
      'metalltür', 'brandschutztür', 'fluchttreppe', 'gitter'
    ],
    
    'AUSS': [
      'pflaster', 'garten', 'einfahrt', 'außenanlage', 'randstein', 'rasen',
      'terrasse pflaster', 'hofeinfahrt', 'garagenzufahrt', 'gehweg',
      'stellplatz', 'gartenmauer', 'stützmauer', 'gabionen', 'sickermulde',
      'regenwasserversickerung', 'gartengestaltung'
    ],
    
    'PV': [
      'solar', 'photovoltaik', 'solaranlage', 'wechselrichter', 'batterie',
      'einspeisung', 'pv-anlage', 'solarmodule', 'solarpanel',
      'balkonkraftwerk', 'energiespeicher', 'wallbox', 'notstrom',
      'inselanlage', 'pv-installation'
    ],
    
    'ABBR': [
      'abriss', 'abbruch', 'entkernung', 'rückbau', 'teilabbruch',
      'komplettabriss', 'entkernen', 'schadstoffsanierung', 'asbestsanierung',
      'entsorgung bauschutt', 'containerstellung', 'bauschuttcontainer',
      'entrümpelung', 'rückbau komplett', 'abbrucharbeiten'
    ]
  },
  
  // VERBOTENE Zuordnungen - diese Begriffe dürfen NICHT zu diesem Gewerk führen
  forbidden: {
    'TRO': ['wdvs', 'fassade', 'außendämmung', 'außenputz', 'fassadenanstrich', 'gaube'],
    'ROH': ['dach', 'sparren', 'dachstuhl', 'gaube', 'dachrinne', 'eindeckung'],
    'TIS': ['gaube', 'dachfenster', 'außenfenster', 'haustür', 'dachstuhl', 'balkontür'],
    'FEN': ['dachfenster', 'gaube', 'dachsparren'],
    'ZIMM': ['dämmung', 'eindeckung', 'dachziegel', 'dachrinne', 'wdvs'],
    'MAL': ['fassade', 'außenputz', 'wdvs', 'außendämmung'],
    'BOD': ['fliesen', 'naturstein', 'wandfliesen', 'fliesenspiegel'],
    'ELEKT': ['heizung', 'sanitär', 'wasser', 'abwasser', 'klima'],
    'SAN': ['elektro', 'strom', 'heizung', 'heizkörper', 'thermostat'],
    'HEI': ['elektro', 'sanitär', 'klima', 'lüftung', 'bad'],
    'KLIMA': ['heizung', 'sanitär', 'elektro'],
    'FASS': ['innenputz', 'tapete', 'malerarbeiten innen', 'gaube'],
    'DACH': ['wdvs', 'fassadendämmung', 'außenputz'],
    'FLI': ['parkett', 'laminat', 'vinyl', 'teppich'],
    'ESTR': ['fliesen', 'parkett', 'bewehrung', 'bodenbelag'],
    'GER': ['bauarbeiten', 'sanierung', 'renovierung'],
    'ABBR': ['neubau', 'anbau', 'aufstockung'],
    'SCHL': ['holzgeländer', 'holztreppe', 'carport'],
    'AUSS': ['innenausbau', 'bad', 'küche'],
    'PV': ['heizung', 'warmwasser', 'sanitär']
  }
};

/**
 * Hauptfunktion zur Gewerke-Erkennung mit strenger Validierung
 */
function detectAndValidateTradesFromIntake(intakeAnswers, existingTrades = [], projectDescription = '') {
  const detectedTrades = new Map();
  
  // FIX 1: Handle beide Formate (String-Array und Object-Array)
  const existingCodes = new Set(
    existingTrades.map(t => typeof t === 'string' ? t : t.code)
  );
  
  const rejectedTrades = [];
  
  // FIX 2: Sichere toLowerCase() Anwendung
  const fullText = intakeAnswers
    .map(item => {
      const q = item.question || item.question_text || '';
      const a = item.answer || item.answer_text || '';
      return `${q} ${a}`.toLowerCase();
    })
    .concat([projectDescription ? projectDescription.toLowerCase() : ''])
    .join(' ');
  
  console.log('[TRADE-DETECT] Analysiere Text mit', fullText.length, 'Zeichen');
  
  // 1. PHASE: Keyword-Erkennung MIT QUELLEN-TRACKING
for (const [tradeCode, keywords] of Object.entries(TRADE_DETECTION_RULES.exclusive)) {
  if (existingCodes.has(tradeCode)) continue;
  
  const matchedKeywords = [];
  const matchedFromDescription = [];
  const matchedFromIntake = [];
  
  // Separiere Projektbeschreibung von Intake-Antworten
  const descriptionText = (projectDescription || '').toLowerCase();
  const intakeText = intakeAnswers
    .map(item => `${item.question || ''} ${item.answer || ''}`.toLowerCase())
    .join(' ');
  
 for (const keyword of keywords) {
  if (fullText.includes(keyword)) {
    matchedKeywords.push(keyword);
    
    // Track woher das Keyword kommt
    if (descriptionText.includes(keyword)) {
      matchedFromDescription.push(keyword);
    } else if (intakeText.includes(keyword)) {
      matchedFromIntake.push(keyword);
    }
  }
}
    
    if (matchedKeywords.length > 0) {
      // 2. PHASE: Validierung gegen verbotene Begriffe
      const forbidden = TRADE_DETECTION_RULES.forbidden[tradeCode] || [];
      const forbiddenMatches = [];
      
      for (const term of forbidden) {
        if (matchedKeywords.some(kw => kw.includes(term))) {
          forbiddenMatches.push(term);
        }
      }
      
      if (forbiddenMatches.length > 0) {
        rejectedTrades.push({
          code: tradeCode,
          keywords: matchedKeywords,
          reason: `Enthält verbotene Begriffe: ${forbiddenMatches.join(', ')}`
        });
        console.log(`[TRADE-DETECT] ❌ ${tradeCode} abgelehnt: ${forbiddenMatches.join(', ')}`);
        continue;
      }
      
      // 3. PHASE: Konfidenz-Berechnung mit Quellen-Tracking
const confidence = calculateTradeConfidence(tradeCode, matchedKeywords);

// Bestimme Quelle und Kategorie
const source = matchedFromDescription.length > 0 ? 'description' : 'intake';
const category = matchedFromDescription.length > 0 ? 'required' : 'recommended';

detectedTrades.set(tradeCode, {
  confidence,
  keywords: matchedKeywords,
  reason: generateTradeReason(tradeCode, matchedKeywords, intakeAnswers),
  source: source,
  category: category
});

console.log(`[TRADE-DETECT] ✓ ${tradeCode}: ${matchedKeywords.length} Keywords, ${confidence}% Konfidenz, Source: ${source}`);
  }  
}  
  
  // 4. PHASE: Kreuz-Validierung und Korrektur falscher Zuordnungen
  const corrections = new Map();
  
  for (const [code, data] of detectedTrades) {
    let shouldCorrect = false;
    let correctToCode = null;
    
    // Spezifische Korrekturen basierend auf bekannten Fehlern
    for (const keyword of data.keywords) {
      // WDVS/Fassade: TRO → FASS
      if (code === 'TRO' && (keyword.includes('wdvs') || keyword.includes('fassad'))) {
        shouldCorrect = true;
        correctToCode = 'FASS';
        break;
      }
      
      // Dacharbeiten: ROH → DACH
      if (code === 'ROH' && (keyword.includes('dach') || keyword.includes('sparr'))) {
        shouldCorrect = true;
        correctToCode = 'DACH';
        break;
      }
      
      // Gaube: TIS → ZIMM
      if (code === 'TIS' && keyword.includes('gaube')) {
        shouldCorrect = true;
        correctToCode = 'ZIMM';
        break;
      }
      
      // Dachfenster: FEN → DACH
      if (code === 'FEN' && keyword.includes('dachfenster')) {
        shouldCorrect = true;
        correctToCode = 'DACH';
        break;
      }
      
      // Außenputz: MAL → FASS
      if (code === 'MAL' && (keyword.includes('außenputz') || keyword.includes('fassad'))) {
        shouldCorrect = true;
        correctToCode = 'FASS';
        break;
      }
      
      // Fliesen: BOD → FLI
      if (code === 'BOD' && keyword.includes('fliese')) {
        shouldCorrect = true;
        correctToCode = 'FLI';
        break;
      }
    }
    
    if (shouldCorrect && correctToCode) {
      corrections.set(code, correctToCode);
      console.log(`[TRADE-DETECT] ↻ Korrektur: ${code} → ${correctToCode}`);
      
      // Füge korrigiertes Gewerk hinzu wenn noch nicht vorhanden
      if (!detectedTrades.has(correctToCode) && !existingCodes.has(correctToCode)) {
        detectedTrades.set(correctToCode, {
          confidence: data.confidence,
          keywords: data.keywords,
          reason: `${data.reason} (korrigiert von ${code})`
        });
      }
      
      // Entferne falsches Gewerk
      detectedTrades.delete(code);
    }
  }
  
  // 5. PHASE: Abhängigkeiten hinzufügen
  const dependencies = addTradeDependencies(detectedTrades, existingCodes, fullText);
  for (const [code, data] of dependencies) {
    if (!detectedTrades.has(code)) {
      detectedTrades.set(code, data);
      console.log(`[TRADE-DETECT] + Abhängigkeit: ${code} (${data.reason})`);
    }
  }
  
  // 6. PHASE: Finale Liste erstellen MIT SOURCE/CATEGORY
const finalTrades = [];
for (const [code, data] of detectedTrades) {
  finalTrades.push({
    code,
    confidence: data.confidence,
    matchedKeywords: data.keywords,
    reason: data.reason,
    source: data.source || 'description',  // Fallback für Kompatibilität
    category: data.category || 'required'   // Fallback für Kompatibilität
  });
}
  
  console.log(`[TRADE-DETECT] Final: ${finalTrades.length} Gewerke erkannt`);
  
  return {
    trades: finalTrades,
    rejected: rejectedTrades
  };
}

/**
 * Berechnet Konfidenz basierend auf Keyword-Matches
 */
function calculateTradeConfidence(tradeCode, matchedKeywords) {
  // Hochwertige Keywords für ALLE Gewerke - gibt extra Konfidenz
  const highValueKeywords = {
    'DACH': ['dach', 'komplett neu eindecken', 'dachsanierung', 'dacherneuerung', 'dach komplett', 'neue eindeckung'],
    'FASS': ['wdvs', 'wärmedämmverbundsystem', 'fassadendämmung', 'komplettsanierung fassade', 'neue fassade', 'außendämmung komplett'],
    'ZIMM': ['gaube', 'neue gaube', 'dachstuhl', 'sparren', 'holzkonstruktion', 'aufstockung', 'dachstuhl erneuern', 'holzrahmenbau'],
    'ROH': ['tragende wand', 'wanddurchbruch', 'neue wände mauern', 'statisch', 'fundament', 'betonieren', 'stahlbeton'],
    'TRO': ['komplette trockenbauwände', 'vorwandinstallation bad', 'abgehängte decke', 'schallschutzwand', 'brandschutzwand'],
    'TIS': ['innentüren', 'komplette küche', 'wohnungstür', 'wohnungseingangstür', 'einbauküche', 'einbauschränke', 'möbel nach maß', 'innentüren erneuern'],
    'FEN': ['alle fenster neu', 'fenster komplett', 'haustür neu', 'kompletter fenstertausch', 'neue fenster und türen'],
    'SAN': ['bad', 'bad komplett', 'badsanierung', 'sanitär', 'neues bad', 'sanitärinstallation', 'bad kernsanierung'],
    'ELEKT': ['elektroinstallation', 'elektrik', 'neue elektroinstallation', 'smart home', 'knx-installation', 'wallbox', 'elektro komplett neu'],
    'HEI': ['heizung', 'neue heizungsanlage', 'wärmepumpe', 'gasheizung', 'fußbodenheizung', 'heizung komplett erneuern', 'brennwertkessel'],
    'KLIMA': ['lüftungsanlage', 'kontrollierte wohnraumlüftung', 'kwl-anlage', 'klimaanlage', 'wärmerückgewinnung', 'zentrale lüftung'],
    'FLI': ['bad', 'küche', 'fliesen', 'neue fliesen', 'komplett neu fliesen', 'naturstein', 'großformatfliesen', 'fugenfarbe'],
    'BOD': ['neuer parkettboden', 'kompletter bodenbelag', 'alle böden neu', 'designboden', 'massivholzdielen', 'parkett komplett'],
    'MAL': ['streichen', 'alle räume streichen', 'komplette malerarbeiten', 'innenputz neu', 'tapezieren komplett'],
    'ESTR': ['neuer estrich', 'estrich komplett', 'fließestrich', 'heizestrich', 'estrich mit dämmung', 'kompletter estrichaufbau'],
    'GER': ['fassadengerüst', 'kompletteinrüstung', 'dachgerüst', 'gerüst rundherum', 'baugerüst komplett'],
    'SCHL': ['neues geländer', 'balkongeländer', 'stahltreppe', 'metallkonstruktion', 'einbruchschutz', 'neue metallarbeiten'],
    'AUSS': ['neue einfahrt', 'komplette außenanlage', 'terrasse neu', 'pflasterarbeiten', 'gartengestaltung', 'hofpflasterung'],
    'PV': ['photovoltaikanlage', 'solaranlage komplett', 'pv mit speicher', 'balkonkraftwerk', 'wallbox', 'komplette pv-anlage'],
    'ABBR': ['entkernung', 'abriss', 'abbruch', 'teilabbruch', 'asbestsanierung', 'schadstoffsanierung', 'rückbau komplett']
  };
  
  let confidence = 70; // Basis-Konfidenz
  
  // Erhöhe für Anzahl der Keywords
  confidence += Math.min(20, matchedKeywords.length * 5);
  
  // Bonus für hochwertige Keywords
  const tradeHighValue = highValueKeywords[tradeCode] || [];
  const hasHighValue = matchedKeywords.some(kw => 
    tradeHighValue.some(hv => kw.includes(hv))
  );
  
  if (hasHighValue) {
    confidence = Math.min(95, confidence + 10);
  }
  
  return confidence;
}

/**
 * Generiert spezifische Begründung für erkanntes Gewerk
 */
function generateTradeReason(tradeCode, keywords, intakeAnswers) {
  // Fallback-Begründung ohne Kürzung
  const relevantKeywords = keywords.slice(0, 3).join(', ');
  return `Möglicher Bedarf für dieses Gewerk durch folgende Begriffe erkannt: ${relevantKeywords}`;
}

/**
 * Fügt logische Abhängigkeiten hinzu
 */
function addTradeDependencies(detectedTrades, existingCodes, fullText) {
  const dependencies = new Map();
  
  // Bei Badsanierung → TRO für Vorwandinstallation
  if ((detectedTrades.has('SAN') || existingCodes.has('SAN')) && 
      !detectedTrades.has('TRO') && !existingCodes.has('TRO')) {
    if (fullText.includes('bad') || fullText.includes('sanitär')) {
      dependencies.set('TRO', {
        confidence: 85,
        keywords: ['vorwandinstallation'],
        reason: 'Vorwandinstallation für Badsanierung'
      });
    }
  }
  
  // Bei Dach/Fassade → GER für Gerüst
  if ((detectedTrades.has('DACH') || detectedTrades.has('FASS') || 
       existingCodes.has('DACH') || existingCodes.has('FASS')) &&
      !detectedTrades.has('GER') && !existingCodes.has('GER')) {
    dependencies.set('GER', {
      confidence: 90,
      keywords: ['arbeitsgerüst'],
      reason: 'Gerüst für Dach-/Fassadenarbeiten erforderlich'
    });
  }
  
  return dependencies;
}

/**
 * Intelligente Fragengenerierung mit Mengenerfassung
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

  // SPEZIAL-ERKENNUNG: Dachaufstockung
const istDachaufstockung = (projectContext.description || '').toLowerCase().match(
  /dachaufstockung|aufstockung|geschossaufstockung|dach.*aufstocken|stockwerk.*aufbauen|etage.*draufsetzen/
);

if (istDachaufstockung) {
  console.log('[QUESTIONS] Dachaufstockung erkannt - Spezialbehandlung aktiviert');
  projectContext.istDachaufstockung = true;
}
  
  // NEU: Lade extrahierte Projektdaten
  let extractedData = null;
  let knownCalculationData = null; // NEU HINZUFÜGEN
  if (projectContext.projectId) {
    const projectResult = await query(
      'SELECT metadata FROM projects WHERE id = $1',
      [projectContext.projectId]
    );
    if (projectResult.rows[0]?.metadata) {
      const metadata = typeof projectResult.rows[0].metadata === 'string' 
        ? JSON.parse(projectResult.rows[0].metadata)
        : projectResult.rows[0].metadata;
      extractedData = metadata?.extracted || null;
      projectContext.extractedData = extractedData;
    }
  }

  // NEU: Sammle ALLE bereits beantworteten Informationen
const allAnsweredInfo = {
  fromDescription: extractedData || {},
  fromIntake: [],
  fromOtherTrades: []
};

// Lade Intake-Antworten
if (!isIntake && projectContext.projectId) {
  // Lade aus intake_responses (neue Tabelle)
  const intakeResponses = await query(
    `SELECT q.text as question_text, a.answer_text 
     FROM answers a
     JOIN questions q ON q.project_id = a.project_id 
       AND q.trade_id = a.trade_id 
       AND q.question_id = a.question_id
     JOIN trades t ON t.id = a.trade_id
     WHERE a.project_id = $1 
       AND t.code = 'INT'`,
    [projectContext.projectId]
  );
  
  if (intakeResponses.rows.length > 0) {
    allAnsweredInfo.fromIntake = intakeResponses.rows;
    projectContext.intakeData = intakeResponses.rows;
    // NEU: Kalkulationsdaten extrahieren
  knownCalculationData = extractCalculationDataFromIntake(intakeResponses.rows);
  projectContext.knownCalculationData = knownCalculationData;
  
  console.log('[CALC-DATA] Extracted from intake:', {
    flaechen: Object.keys(knownCalculationData.flaechen).length,
    hoehen: Object.keys(knownCalculationData.hoehen).length,
    laengen: Object.keys(knownCalculationData.laengen).length,
    stueck: Object.keys(knownCalculationData.stueckzahlen).length
  });

    // EXTRAHIERE Bauweise bei Dachaufstockung
  if (projectContext.istDachaufstockung) {
    const bauweiseFrage = intakeResponses.rows.find(r => 
      r.question_text?.toLowerCase().includes('bauweise') && 
      r.question_text?.toLowerCase().includes('aufstockung')
    );
    
    if (bauweiseFrage) {
      projectContext.aufstockungsBauweise = bauweiseFrage.answer_text?.toLowerCase().includes('holz') 
        ? 'holzbau' 
        : bauweiseFrage.answer_text?.toLowerCase().includes('massiv') 
        ? 'massivbau'
        : 'offen';
      
      console.log(`[QUESTIONS] Aufstockungsbauweise: ${projectContext.aufstockungsBauweise}`);
    }
  }
    
    // NEU: Extrahiere konkrete Werte für bessere Duplikatserkennung
    projectContext.answeredValues = {};
    intakeResponses.rows.forEach(item => {
      const q = (item.question_text || '').toLowerCase();
      const a = item.answer_text || '';
      
      // Speichere konkrete Maße
      if ((q.includes('abmessung') || q.includes('maße') || q.includes('größe')) && a) {
        const matches = a.match(/(\d+)\s*x\s*(\d+)/);
        if (matches) {
          projectContext.answeredValues.dimensions = matches[0];
        }
      }
      
      // Speichere Wandstärke
      if ((q.includes('stärke') || q.includes('dicke')) && a) {
        const matches = a.match(/(\d+)\s*(cm|mm)/);
        if (matches) {
          projectContext.answeredValues.wallThickness = matches[0];
        }
      }
      
      // Speichere Material
      if (q.includes('material') && a) {
        projectContext.answeredValues.material = a;
      }
      
      // Speichere Flächen
      if (q.includes('fläche') && a) {
        const matches = a.match(/(\d+)\s*(m²|qm)/);
        if (matches) {
          projectContext.answeredValues.area = matches[0];
        }
      }
      
      // Speichere Anzahlen
      if (q.includes('wie viele') || q.includes('anzahl')) {
        const matches = a.match(/\d+/);
        if (matches) {
          // Identifiziere worum es geht
          if (q.includes('fenster')) projectContext.answeredValues.windowCount = matches[0];
          if (q.includes('tür')) projectContext.answeredValues.doorCount = matches[0];
          if (q.includes('raum') || q.includes('zimmer')) projectContext.answeredValues.roomCount = matches[0];
        }
      }
    });
    
  } else {
    // Fallback auf answers Tabelle
    const intTrade = await query(`SELECT id FROM trades WHERE code='INT' LIMIT 1`);
    if (intTrade.rows[0]) {
      const intakeAnswers = await query(
        `SELECT q.text as question_text, a.answer_text 
         FROM answers a
         JOIN questions q ON q.project_id = a.project_id 
           AND q.trade_id = a.trade_id 
           AND q.question_id = a.question_id
         WHERE a.project_id = $1 AND a.trade_id = $2`,
        [projectContext.projectId, intTrade.rows[0].id]
      );
      allAnsweredInfo.fromIntake = intakeAnswers.rows;
      projectContext.intakeData = intakeAnswers.rows;
      }
    }
  }
    
  // NEU: Füge Intake-Kontext zum System-Prompt hinzu
  if (projectContext.intakeContext && !isIntake) {
    console.log('[QUESTIONS] Adding intake context to prompt');
    // Der intakeContext wird später im System-Prompt verwendet
  }
  
  // Falls es ein empfohlenes Gewerk ist
  if (projectContext.isAiRecommended && !isIntake) {
    console.log('[QUESTIONS] Trade is AI-recommended, will add specific instructions');
  }
  
  console.log(`[QUESTIONS] Generating for ${tradeName} with context:`, {
    hasExtractedData: !!extractedData,
    extractedQuantities: extractedData?.quantities || {},
    intakeAnswerCount: allAnsweredInfo.fromIntake.length,
    isManuallyAdded: projectContext.isManuallyAdded,
  });
  
  // NEU: Unterscheide zwischen AI-empfohlen und manuell
if (projectContext.isManuallyAdded === true && !projectContext.isAiRecommended) {
  // NUR bei MANUELL hinzugefügten Gewerken: Kontextfrage zuerst
  console.log(`[QUESTIONS] Manually added trade ${tradeCode} - returning context question only`);
  
  const contextQuestion = `Sie haben ${tradeName} als zusätzliches Gewerk ausgewählt. 
    Basierend auf Ihrem Projekt "${projectContext.description?.substring(0, 100)}..." - was genau soll in diesem Bereich gemacht werden?`;
  
  return [{
    id: 'context_reason',
    question: contextQuestion,
    text: contextQuestion,
    type: 'text',
    required: true,
    category: 'Projektkontext',
    explanation: 'Basierend auf Ihrer Antwort erstellen wir passende Detailfragen für dieses Gewerk.'
  }];
}

// AI-empfohlene Gewerke: KEINE Kontextfrage, direkt vollständiger Fragenkatalog
if (projectContext.isAiRecommended === true) {
  console.log(`[QUESTIONS] AI-recommended trade ${tradeCode} - generating FULL question catalog with project context`);
  // Weiter mit normalem Fragenkatalog-Prozess (kein early return!)
}
  
  const questionPrompt = await getPromptForTrade(tradeId, 'questions');

// VALIDIERE dass Prompt geladen wurde
if (!questionPrompt && !isIntake) {
  console.error(`[QUESTIONS] ERROR: No question prompt found for ${tradeName} (${tradeCode})`);
  // Ohne Prompt können keine sinnvollen Fragen generiert werden
  throw new Error(`Fragen-Prompt für ${tradeName} fehlt in der Datenbank`);
}

// DEBUG: Prompt-Inhalt prüfen
if (questionPrompt) {
  console.log(`[QUESTIONS] Prompt loaded for ${tradeName}: ${questionPrompt.length} chars`);
  
  // Prüfe ob wichtige Keywords im Prompt sind
  if (tradeCode === 'GER' && !questionPrompt.includes('Gerüstfläche')) {
    console.warn(`[QUESTIONS] WARNING: Gerüst prompt missing 'Gerüstfläche' keyword`);
  }
}
  
  // Intake-Kontext für Gewerke-Fragen laden
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
- Fokussiere auf KONKRETE MENGEN und MASSE
- Vermeide jegliche Dopplungen`;
      }
    }
  }
  
  const projectComplexity = determineProjectComplexity(projectContext, answeredQuestions);
  const intelligentCount = getIntelligentQuestionCount(tradeCode, projectContext, answeredQuestions);
  // Bei manuell hinzugefügten: Erste Frage MUSS Kontextfrage sein
let targetQuestionCount = intelligentCount.count;
let forceContextQuestion = false;

if (projectContext.isManuallyAdded) {
  forceContextQuestion = true;
  targetQuestionCount = Math.max(10, targetQuestionCount); // Mindestens 10 Fragen bei manuellen Gewerken
  console.log(`[QUESTIONS] Context question required for ${tradeName} - manually added`);
}

// Spezielle Behandlung für Intake-Fragen basierend auf Gewerke-Anzahl
if (isIntake && projectContext.targetQuestionCount) {
  targetQuestionCount = projectContext.targetQuestionCount;
  console.log(`[QUESTIONS] INT: Using provided targetQuestionCount: ${targetQuestionCount}`);
} else if (isIntake && projectContext.detectedTrades) {
  const tradeCount = projectContext.detectedTrades.length;
  if (tradeCount === 1) {
    targetQuestionCount = 16;
  } else if (tradeCount <= 3) {
    targetQuestionCount = 18;
  } else if (tradeCount <= 5) {
    targetQuestionCount = 21;
  } else {
    targetQuestionCount = 25;
  }
  console.log(`[QUESTIONS] INT: Adjusted to ${targetQuestionCount} questions for ${tradeCount} trades`);
}
  
// Innenprojekt-Erkennung für intelligente Intake-Fragen
let innenprojektText = '';
if (isIntake) {
  const hasInnengewerke = projectContext.detectedTrades?.some(t => 
    ['MAL', 'BOD', 'FLI', 'TIS', 'TRO', 'ELEKT', 'SAN', 'HEI'].includes(t.code)
  );
  const hasAussengewerke = projectContext.detectedTrades?.some(t => 
    ['DACH', 'FASS', 'AUSS', 'GER'].includes(t.code)
  );
  const beschreibung = (projectContext.description || '').toLowerCase();
  const istWohnung = beschreibung.includes('wohnung') || 
                     beschreibung.includes('stock') || 
                     beschreibung.includes('etage');
  
  if ((hasInnengewerke && !hasAussengewerke) || istWohnung) {
    innenprojektText = `
INNENPROJEKT ERKANNT - Stelle zusätzlich diese Fragen:
- In welchem Stockwerk/Geschoss befindet sich die Wohnung?
- Gibt es einen Aufzug? (Falls ja: Maße angeben)
- Kann der Aufzug für Materialtransport genutzt werden?
- Wie breit ist das Treppenhaus?
- Gibt es Engstellen beim Transport?`;
  }
}
// Schadensabfrage basierend auf Gewerken
let schadensfrageText = '';
if (isIntake && projectContext.detectedTrades) {
  const schadensRelevant = [];
  
  // Prüfe welche Gewerke vorhanden sind und sammle relevante Schadensfragen
  projectContext.detectedTrades.forEach(trade => {
    switch(trade.code) {
      case 'FASS':
        schadensRelevant.push('Gibt es sichtbare Schäden an der Fassade (Risse, Abplatzungen, Feuchtigkeit)?');
        break;
      case 'DACH':
        schadensRelevant.push('Gibt es Schäden am Dach (undichte Stellen, fehlende Ziegel, Sturmschäden)?');
        break;
      case 'KEL':
      case 'ABBR':
        schadensRelevant.push('Gibt es Feuchtigkeitsschäden im Keller (nasse Wände, Schimmel, Salzausblühungen)?');
        break;
      case 'SAN':
      case 'HEI':
        schadensRelevant.push('Gibt es Wasserschäden oder Rohrbrüche (Verfärbungen, Feuchtigkeit)?');
        break;
      case 'FEN':
        schadensRelevant.push('Gibt es Schäden an Fensterlaibungen (Risse, Feuchtigkeit, Schimmel)?');
        break;
      case 'MAL':
        schadensRelevant.push('Gibt es Vorschäden an Wänden/Decken (Risse, Feuchtigkeit, Schimmel)?');
        break;
      case 'ELEKT':
        schadensRelevant.push('Gibt es bekannte Elektroschäden (Kurzschlüsse, defekte Leitungen)?');
        break;
    }
  });
  
  // Keller-Check auch über Beschreibung
  const beschreibung = (projectContext.description || '').toLowerCase();
  if (beschreibung.includes('keller') && !schadensRelevant.some(s => s.includes('Keller'))) {
    schadensRelevant.push('Gibt es Feuchtigkeitsprobleme im Keller?');
  }
  
  if (schadensRelevant.length > 0) {
    schadensfrageText = `
SCHADENSABFRAGE - Wichtig für Kalkulation:
${schadensRelevant.map(s => `- ${s}`).join('\n')}
- Falls ja: Bitte Umfang beschreiben (klein/mittel/groß)`;
  }
}

// NEU: Explizite Konzept-Extraktion für bessere Duplikat-Vermeidung
const answeredConcepts = new Set();
const answeredValues = {};

if (allAnsweredInfo.fromIntake && allAnsweredInfo.fromIntake.length > 0) {
  allAnsweredInfo.fromIntake.forEach(item => {
    const q = item.question_text?.toLowerCase() || '';
    const a = item.answer_text?.toLowerCase() || '';
    
    // Extrahiere beantwortete Konzepte und Werte
    if (q.includes('bad') && a.match(/\d+\s*(m²|qm)/)) {
      answeredConcepts.add('badfläche');
      answeredConcepts.add('badgröße');
      answeredConcepts.add('sanitärbereich_fläche');
      answeredValues['badfläche'] = a.match(/\d+\s*(m²|qm)/)[0];
    }
    
    if (q.includes('stock') || q.includes('geschoss') || q.includes('etage')) {
      answeredConcepts.add('stockwerk');
      answeredConcepts.add('etage');
      answeredConcepts.add('geschoss');
      answeredValues['stockwerk'] = a;
    }
    
    if (q.includes('fläche') && !q.includes('bad')) {
      answeredConcepts.add('grundfläche');
      if (a.match(/\d+/)) answeredValues['grundfläche'] = a;
    }
  });
}
  
  const systemPrompt = `Du bist ein erfahrener Experte für ${tradeName} mit 20+ Jahren Berufserfahrung.
${isIntake ? 
`╔══════════════════════════════════════════════════════════════════╗
║                     INTAKE-FRAGEN MODUS                           ║
╚══════════════════════════════════════════════════════════════════╝

WICHTIG: Dies sind ALLGEMEINE INTAKE-FRAGEN zur Erfassung der BAUSTELLENBEDINGUNGEN.

ERKANNTE GEWERKE IM PROJEKT:
${projectContext.detectedTrades ? projectContext.detectedTrades.map(t => `- ${t.code}: ${t.name}`).join('\n') : 'Keine Gewerke übergeben'}

INTELLIGENTE FRAGENAUSWAHL BASIEREND AUF GEWERKEN:

1. IMMER FRAGEN (für alle Projekte):
   - Zufahrt/Zugang (LKW-tauglich bei großen Projekten)
   - Lagerungsmöglichkeiten
   - Arbeitszeiten/Einschränkungen
   - Gewünschter Zeitraum
   - Bewohnt während Bauzeit?

2. BAUSTROM (immer fragen):
   - Alle Gewerke benötigen Strom
   - Bei ELEKT: Auch Leistung/Absicherung erfragen

3. BAUWASSER (NUR fragen bei):
   - ROH, MAL, ESTR, FLI, FASS, DACH, SAN, HEI
   - NICHT bei: ELEKT, TIS, FEN, BOD, TRO

4. DENKMALSCHUTZ (NUR fragen bei):
   - FASS, DACH, FEN, AUSS
   - NICHT bei: Bad-/Innensanierung ohne Außenarbeiten

5. GEBÄUDEHÖHE/STOCKWERKE (NUR fragen bei):
   - GER, DACH, FASS, FEN (wenn Obergeschoss)
   - NICHT bei: reinen Innenarbeiten

6. LÄRMSCHUTZ (NUR fragen bei):
   - ABBR, ROH, ESTR, TRO
   - ODER wenn "bewohnt während Bauzeit" = ja

7. SANITÄRANLAGEN FÜR HANDWERKER (NUR bei):
   - Großprojekten (>3 Gewerke)
   - Oder Projektdauer >4 Wochen

8. MATERIALTRANSPORT BEI INNENPROJEKTEN (NUR fragen bei):
   - Erkannte Innengewerke: MAL, BOD, FLI, TIS, TRO, ELEKT, SAN, HEI
   - Wenn Projektbeschreibung "Wohnung", "Büro", "Innen" enthält
   
   FRAGEN:
   - In welchem Geschoss/Stockwerk befindet sich die Wohnung/das Objekt?
   - Gibt es einen Aufzug? Wenn ja: Maße (B x T x H)?
   - Kann der Aufzug für Materialtransport genutzt werden?
   - Breite der Treppe/Treppenhaus?
   - Gibt es Engstellen (schmale Türen, verwinkelte Flure)?
   - Maximale Transportlänge (z.B. für lange Bretter, Rohre)?

9. SCHUTZ BEI BEWOHNTEN OBJEKTEN (bei "bewohnt während Bauzeit" = ja):
   - Müssen bestimmte Bereiche staubfrei bleiben?
   - Gibt es empfindliche Böden/Treppen die geschützt werden müssen?

BEISPIEL-ANPASSUNG:
- "Wohnungssanierung 3. OG": 
  → Frage nach Aufzug PFLICHT
  → Frage nach Treppenbreite
  → Frage nach Balkonen/Fenstern für Materialtransport
  
- "Kellersanierung":
  → Frage nach Kellerzugang
  → Frage nach Lichtschacht
  → Keine Aufzugfrage

- "Dachgeschoss-Ausbau":
  → Frage nach Dachbodenzugang
  → Maximale Transportlänge für Balken
  → Treppenbreite kritisch
  
ANPASSUNG AN PROJEKTGRÖSSE:
- Kleines Projekt (1-2 Gewerke): 14-19 Fragen
- Mittleres Projekt (3-5 Gewerke): 17-22 Fragen  
- Großes Projekt (>5 Gewerke): 22-28 Fragen

BEISPIELE INTELLIGENTER ANPASSUNG:
- Nur ELEKT: Keine Bauwasser-Frage
- Nur Badsanierung: Kein Denkmalschutz
- Nur MAL innen: Keine Gebäudehöhe
- DACH+FASS: Alle Außen-relevanten Fragen

KEINE FRAGEN ZU:
- Technischen Details (Dämmstärke, Wandstärke, Verglasungsart, U-Werte)
- Spezifischen Materialien oder Produkten
- Detaillierten Maßen (außer grobe Gebäudegröße)
- Gewerkespezifischen Themen
- Anzahl Fenster/Türen (wenn bereits in Beschreibung)
- Generalunternehmer vs. Einzelvergabe (BYNDL ist für Einzelvergabe konzipiert!)
- Bevorzugter Vergabeart
- Ob alles aus einer Hand gewünscht wird

10. SPEZIAL: DACHAUFSTOCKUNG (NUR bei erkannter Aufstockung):
   - Bauweise der Aufstockung (Holzbau vs. Massivbau)
   - Statisches Gutachten vorhanden?
   - Maximale zusätzliche Last bekannt?

${istDachaufstockung ? `
PFLICHTFRAGE BEI DACHAUFSTOCKUNG:
"Welche Bauweise ist für die Aufstockung geplant?"
- Optionen: ["Holzbauweise/Holzrahmenbau (leichter)", "Massivbau (Mauerwerk/Beton)", "Noch offen - Beratung gewünscht"]
- WICHTIG: Diese Antwort bestimmt die weiteren Gewerke-Fragen!
` : ''}

BEISPIELE VERBOTENER INTAKE-FRAGEN:
- "Welche Dämmstärke ist gewünscht?" → GEHÖRT ZU FASS/DACH
- "Welche Putzstruktur?" → GEHÖRT ZU FASS/MAL
- "Welche Fliesenart?" → GEHÖRT ZU FLI
- "Welches Heizsystem?" → GEHÖRT ZU HEI
- "Anzahl Steckdosen?" → GEHÖRT ZU ELEKT

Die Intake-Fragen dienen NUR zur Vorbereitung der Baustelle!
KRITISCH: Stelle NUR relevante Intake-Fragen für die erkannten Gewerke!

Diese Informationen werden für die Vorbemerkungen aller LVs verwendet. 
  
══════════════════════════════════════════════════════════════════════` 
: 
`╔══════════════════════════════════════════════════════════════════╗
║                   GEWERKE-FRAGEN MODUS                            ║
║                     Gewerk: ${tradeName}                          ║
╚══════════════════════════════════════════════════════════════════╝

WICHTIG: Erstelle einen GEZIELTEN Fragenkatalog für ${tradeName}.

${knownCalculationData ? createCalculationContext(knownCalculationData, tradeCode) : ''}

WICHTIG: Berücksichtige alle nachfolgenden Regeln und bereits vorhandene Informationen!`}

${extractedData ? `
BEREITS AUS PROJEKTBESCHREIBUNG EXTRAHIERT (NIEMALS ERNEUT FRAGEN!):
${extractedData.quantities ? Object.entries(extractedData.quantities).map(([key, value]) => 
  `- ${key}: ${value}`).join('\n') : ''}
${extractedData.measures?.length ? `- Maßnahmen: ${extractedData.measures.join(', ')}` : ''}
${extractedData.rooms?.length ? `- Räume: ${extractedData.rooms.join(', ')}` : ''}
${extractedData.specificDetails ? Object.entries(extractedData.specificDetails).map(([key, value]) => 
  `- ${key}: ${value}`).join('\n') : ''}

WICHTIG: Diese Informationen sind DEFINITIV BEKANNT. Stelle KEINE Fragen dazu!
` : ''}

${allAnsweredInfo?.fromIntake?.length > 0 ? `
BEREITS IN INTAKE BEANTWORTET (NIEMALS WIEDERHOLEN!):
${allAnsweredInfo.fromIntake.map(item => 
  `- ${item.question_text}: ${item.answer_text}`
).join('\n')}
` : ''}

UNIVERSELLE REGEL - NUR FRAGEN WAS ERWÄHNT WURDE:
- Wenn Nutzer "5 Fenster" sagt → NICHT nach Haustüren fragen
- Wenn Nutzer "Fassadendämmung" sagt → NICHT nach Dachdämmung fragen
- Wenn Nutzer "Bad renovieren" sagt → NICHT nach Küche fragen
- Wenn Nutzer "Parkett verlegen" sagt → NICHT nach Fliesen fragen
- Generell: NUR zu dem fragen, was explizit im Projektumfang erwähnt wurde
- Bei Unklarheiten: Lieber eine offene Frage stellen als Annahmen treffen

${['DACH', 'FASS', 'FEN'].includes(tradeCode) ? `
GERÜST-REGEL FÜR ${tradeName}:
- KEINE Fragen zum Gerüst stellen!
- Gerüst wird als separates Gewerk behandelt
- In LV kommt Vorbemerkung: "Gerüst wird bauseits gestellt"
- Keine Fragen zu Gerüsthöhe, Standzeit, Gerüstart
` : ''}

PROJEKT-KONTEXT:
- Beschreibung: ${projectContext.description || 'Nicht angegeben'}
- Kategorie: ${projectContext.category || 'Nicht angegeben'}
- Budget: ${projectContext.budget || 'Nicht angegeben'}

${innenprojektText}
${schadensfrageText}

KRITISCHE REGELN FÜR LAIENVERSTÄNDLICHE FRAGEN:

0. AUSFÜHRLICHE ERKLÄRUNGEN SIND PFLICHT - JEDE FRAGE BRAUCHT 100-200 WÖRTER ERKLÄRUNG:
   
   Jede Frage MUSS eine vollständige "explanation" haben die ALLE folgenden Punkte abdeckt:

a) KONTEXT & ZWECK (20-30 Wörter):
   - Warum wird diese Information benötigt?
   - Wie beeinflusst sie Kosten und Aufwand?
   - Welche Folgearbeiten hängen davon ab?

b) LAIENVERSTÄNDLICHE ERKLÄRUNG (40-60 Wörter):
   - Fachbegriffe in Alltagssprache übersetzen
   - Vergleiche mit bekannten Dingen ("wie ein...")
   - Visuelle Beschreibung ("sieht aus wie...")
   - Wo man es im Gebäude findet

c) PRAKTISCHE ANLEITUNG (30-50 Wörter):
   - WO genau messen/schauen/prüfen?
   - WIE messen? (Zollstock anlegen von...bis...)
   - WOMIT messen? (Werkzeuge)
   - Häufige Fehler vermeiden

d) KONKRETE BEISPIELE (30-40 Wörter):
   Bei Qualitätsfragen IMMER Produkte/Marken zur Orientierung:
   
   SANITÄR:
   - Standard: "Baumarkt-Eigenmarken, Grohe Start, Ideal Standard Connect"
   - Gehoben: "Duravit D-Code, Hansgrohe Focus, Keramag Renova"
   - Premium: "Villeroy & Boch Subway, Dornbracht, Kaldewei, Bette"
   
   FLIESEN:
   - Standard: "Baumarkt-Fliesen (15-25 €/m²)"
   - Gehoben: "Deutsche Markenhersteller wie Agrob Buchtal (30-50 €/m²)"
   - Premium: "Italienische Feinsteinzeug, Großformate 120x120cm (60-120 €/m²)"
   
   FENSTER:
   - Standard: "Kunststoff weiß, Veka/Rehau Profile (400-500 €/m²)"
   - Gehoben: "Kunststoff mit Dekor oder Holz (500-700 €/m²)"
   - Premium: "Holz-Alu Kombination, Internorm/Unilux (700-1000 €/m²)"
   
   BODENBELÄGE:
   - Standard: "Laminat Klasse 31 (20-35 €/m²)"
   - Gehoben: "3-Schicht Parkett Eiche (60-90 €/m²)"
   - Premium: "Massivparkett, Fischgrät verlegt (100-150 €/m²)"
   
   TÜREN:
   - Standard: "Dekor-Türen CPL/Laminat (150-250 €/Stück)"
   - Gehoben: "Echtholz furniert oder lackiert (300-500 €/Stück)"
   - Premium: "Massivholz, Sonderanfertigungen (600-1200 €/Stück)"
   
   PREISANGABEN:
   - IMMER relative Unterschiede: "Gehoben ist 40-60% teurer als Standard"
   - IMMER mit Einheit: €/m², €/Stück, €/lfdm
   - NIE absolute Preise ohne Größenangabe
   
e) EMPFEHLUNG BEI UNSICHERHEIT (20-30 Wörter):
   - "Bei Unsicherheit empfehlen wir: [konkreter Wert]"
   - "80% unserer Kunden wählen: [Option]"
   - "Für Ihr Projekt passend wäre: [Empfehlung]"

BEISPIEL EINER VOLLSTÄNDIGEN ERKLÄRUNG:

Frage: "Welche Qualitätsstufe wünschen Sie für die Sanitärausstattung?"

explanation: "Die Qualitätsstufe bestimmt Preis und Lebensdauer Ihrer Badausstattung erheblich. Je nach Wahl variieren die Kosten zwischen 800€ (Standard) und 5000€ (Premium) pro Bad. 
Standard-Qualität wie Grohe Start (WC ~150€) oder Ideal Standard (Waschtisch ~120€) bietet solide Funktionalität für Mietobjekte. Gehobene Qualität wie Hansgrohe (Armaturen ~180€) oder Duravit (WC ~300€) verbindet Design mit Komfort - ideal für Eigennutzung. Premium-Marken wie Dornbracht (Armaturen ~500€) oder Villeroy & Boch (WC ~600€) bieten Luxus und 15+ Jahre Haltbarkeit.
Die Qualität beeinflusst auch Wartungskosten: Standard braucht alle 3-5 Jahre Service, Premium erst nach 8-10 Jahren. Bei Unsicherheit empfehlen wir für Eigennutzung die gehobene Qualität - bestes Preis-Leistungs-Verhältnis."

Frage: "Ist ein Ringbalken/Ringanker vorhanden?"

explanation: "Ein Ringbalken ist ein umlaufender Betonbalken oben auf den Mauern - wie ein stabilisierender Gürtel ums Haus. Er verteilt Dachlasten gleichmäßig und verhindert, dass Wände auseinanderdriften.
Sie erkennen ihn als durchgehenden grauen Betonstreifen (20-30cm hoch) auf der Mauerkrone. Gehen Sie dazu auf den Dachboden und schauen Sie, wo die Dachbalken aufliegen. Dort sollte ein durchgehender Betonbalken sichtbar sein.
Bei Altbauten vor 1960 meist nicht vorhanden, ab 1970 Standard. Ohne Ringbalken sind bei Dacharbeiten Verstärkungen nötig (Mehrkosten 3000-5000€). Falls unsicher: Machen Sie Fotos vom Dachboden, besonders vom Übergang Wand/Dach. Wir gehen im Zweifel von 'nicht vorhanden' aus."

Frage: "Welche Qualitätsstufe wünschen Sie für die Sanitärausstattung?"

explanation: "Die Qualitätsstufe bestimmt Preis, Haltbarkeit und Design erheblich. Standard-Qualität (Baumarkt-Eigenmarken, Grohe Start, Ideal Standard Connect) bietet solide Funktionalität - ein WC kostet 150-250€, Waschtisch 100-200€. Gehobene Qualität (Duravit D-Code, Hansgrohe Focus, Keramag Icon) verbindet Design mit Komfort - WC 300-450€, Waschtisch 250-400€. Premium (Villeroy & Boch Subway, Dornbracht, Kaldewei) bietet exklusives Design und beste Materialien - WC 500-800€, Waschtisch 400-700€. Die Preisdifferenz zwischen Standard und Gehoben beträgt etwa 50-70%, zu Premium 150-200%. Wartungsintervalle: Standard alle 5 Jahre, Premium erst nach 10-15 Jahren. Für Mietobjekte empfehlen wir Standard, für Eigennutzung Gehoben als beste Preis-Leistung."

Frage: "Welche Öffnungsart wünschen Sie für die Fenster?"

explanation: "Die Öffnungsart bestimmt Komfort, Sicherheit und Preis. Dreh-Kipp-Fenster (Standard) bieten optimale Lüftung und Reinigungsmöglichkeit. Nur-Kipp ist etwa 20% günstiger, aber eingeschränkt nutzbar. Festverglasung spart 40-50% gegenüber Dreh-Kipp, erlaubt aber keine Lüftung. Schiebefenster kosten 30-40% mehr als Dreh-Kipp, sparen aber Platz. Die Preise variieren stark nach Größe und Material: Kunststoff-Dreh-Kipp kostet 400-600€/m², Holz 25-30% mehr, Holz-Alu 50-70% mehr. Ein 1,2x1,4m Fenster hat ca. 1,7m². Für Wohnräume empfehlen wir Dreh-Kipp, für Bäder Kipp (Sichtschutz). Bei Unsicherheit: Dreh-Kipp als flexibelste Lösung."

FALSCH: "Dreh-Kipp-Fenster kosten 600€" (Welche Größe? Material?)
RICHTIG: "Kunststoff-Dreh-Kipp: 400-600€/m², bei 1,5m² Fenster also 600-900€"

FALSCH: "Parkett kostet 80€"
RICHTIG: "Parkett: 50-120€/m² Material plus 25-40€/m² Verlegung"

WICHTIG: Diese ausführlichen Erklärungen sind PFLICHT für jede Frage!

1. MASSEINHEITEN IMMER IM FRAGENTEXT ANGEBEN:
   - Bei Zahlenfragen IMMER die Einheit direkt im Text: "Wie groß ist die Fläche in m²?"
   - Niemals nur "Wie groß ist die Fläche?" ohne Einheit
   - Gängige Einheiten: m² (Quadratmeter), m (Meter), cm, mm, m³ (Kubikmeter), Stück, kg
   - Die Einheit MUSS im Fragentext stehen, nicht nur im unit-Feld

2. MEHRFACHAUSWAHL ERMÖGLICHEN:
   - Bei Fragen wo mehrere Antworten sinnvoll sind: "multiSelect": true setzen
   - AUTOMATISCH Mehrfachauswahl bei:
     * Sanitärgegenstände (WC, Waschbecken, Dusche, Badewanne)
     * Gewerke-Auswahl
     * Materialien/Oberflächen
     * Ausstattungsmerkmale
   - Bei Mehrfachauswahl: type = "multiselect" ODER "text" für Freitext
   - Beispiele für Mehrfachauswahl-Fragen:
     * "Welche Sanitärgegenstände sollen installiert werden?"
     * "Welche Räume sollen gestrichen werden?"
     * "Welche Elektroinstallationen sind gewünscht?"  
   
3. FACHBEGRIFFE ERKLÄREN:
   - Bei Fachbegriffen IMMER eine Erklärung in der "explanation" 
   - Beispiel: "Ortgang" → Erklärung: "Der seitliche Dachabschluss am Giebel"
   - Beispiel: "Unterkonstruktion" → Erklärung: "Das Traggerüst unter der sichtbaren Oberfläche"

4. MESSANLEITUNGEN BEI KOMPLEXEN MASSEN:
   - Erkläre WIE gemessen wird
   - Beispiel: "Kranreichweite" → "Abstand vom Kranstandort zum entferntesten Arbeitspunkt"
   - Bei unklaren Mengen: IMMER "unsicher/weiß nicht" als Option

5. KEINE FRAGEN DIE LAIEN NICHT BEANTWORTEN KÖNNEN:
   - NICHT fragen nach: Arbeitsdauer, Kranreichweite, Kubikmeter Schutt, Lastberechnungen
   - NICHT fragen nach: Anzahl Lagen Abdichtung (außer bei Reparatur bekannt)
   - Stattdessen: Sinnvolle Annahmen treffen und in LV einarbeiten

6. INTELLIGENTE ANNAHMEN STATT DOPPELFRAGEN:
   - Wenn nach Dachfläche gefragt → Abdichtungsfläche = Dachfläche + 5%
   - Wenn nach Wandfläche gefragt → Deckenfläche aus Raumgröße ableiten
   - Annahmen klar kommunizieren: "Wir gehen von X aus, basierend auf Y"

7. INTELLIGENTE FRAGENLOGIK:
   - Bereits erfasste Daten NIEMALS erneut abfragen
   - Aus vorhandenen Daten ableiten:
     * Raumhöhe vorhanden → Wandfläche = Umfang × Höhe
     * Grundfläche vorhanden → Deckenfläche = Grundfläche
     * Außenwandfläche → Fassadenfläche = Außenwand - Fenster/Türen
   - Redundanzen vermeiden: Frage NUR was wirklich fehlt

8. PROJEKTKONTEXT BEACHTEN:
   - Bei "Fassadensanierung" + Gewerk "MAL" → Fragen zu AUSSENanstrich
   - Bei "Badsanierung" + Gewerk "MAL" → Fragen zu feuchtraumgeeigneter Farbe
   - ERSTE FRAGE bei manuell hinzugefügtem Gewerk: "Welche Arbeiten sollen in diesem Gewerk ausgeführt werden?"

9. UNSICHER-OPTIONEN & ANNAHMEN:
   - Bei schwer schätzbaren Werten IMMER "unsicher" anbieten
   - Annahmen transparent machen:
     * "Falls unsicher: Wir kalkulieren mit Standardwerten"
     * "Übliche Werte: Raumhöhe 2,50m, Wandstärke 24cm"
   - Validierung anbieten:
     * "Möchten Sie die Standardannahme verwenden?"

10. VERMEIDUNG VON LAIEN-ÜBERFORDERUNG:
   - NICHT fragen nach:
     * Technischen Details (U-Wert, Lastberechnung, Bewehrung)
     * Zeitschätzungen (Arbeitsstunden, Trocknungszeiten)
     * Fachspezifischen Mengen (m³ Beton, kg Bewehrung)
   - STATTDESSEN:
     * Sichtbare/messbare Größen erfragen
     * Aus diesen technische Werte ableiten

11. INTELLIGENTE FRAGE-ABHÄNGIGKEITEN:
   - KRITISCH: Folgefragen MÜSSEN vorherige Antworten berücksichtigen
   - Verwende bedingte Logik in Fragen mit "dependsOn" und "showIf" Feldern
   - Beispiele:
     * Wenn "Trockenbauwände erstellen?" = "Nein" → KEINE Fragen zu Wanddämmung, Wandhöhe, etc.
     * Wenn "Fliesen gewünscht?" = "Nein" → KEINE Fragen zu Fliesenformat, Fugenfarbe, etc.
     * Wenn "Dachsanierung?" = "Teilsanierung" → NUR Fragen zum betroffenen Bereich
   - Struktur für bedingte Fragen:
     {
       "id": "TRO-02",
       "question": "Sollen die Trockenbauwände gedämmt werden?",
       "dependsOn": "TRO-01",
       "showIf": "ja",
       "type": "select",
       "options": ["ja", "nein"]
     }
   - Bei Verneinung: Überspringe alle abhängigen Detailfragen
   - Bei Unsicherheit: Stelle Basisfragen, aber keine Detailfragen

12. GEWERKEABGRENZUNG & SCHNITTSTELLENKLARHEIT:
   - KEINE Doppelungen zwischen Gewerken
   - Hierarchie: Spezialgewerk > Hauptgewerk > Nebengewerk
   
   KRITISCHE ZUORDNUNGEN (IMMER EINHALTEN):
   * Fliesenarbeiten: AUSSCHLIESSLICH Gewerk FLI (Fliesenarbeiten), NIEMALS BOD (Bodenbelagsarbeiten)
   * Innentüren/Zargen: AUSSCHLIESSLICH Gewerk TIS (Tischlerarbeiten), NIEMALS TRO (Trockenbau) oder FEN (Fenster/Türen)
   * Rigips/Gipskartonwände: AUSSCHLIESSLICH Gewerk TRO (Trockenbau), NIEMALS ROH (Rohbau)
   * Putzqualitäten Q1-Q3: NUR bei Innenputz im Gewerk MAL (Malerarbeiten), NIEMALS bei FASS (Fassade)
   * Fassadenputz: Nur Struktur (Glattputz, Kratzputz, Scheibenputz) und Körnung bei FASS
   * Durchbrüche: NUR Abbruch ODER Rohbau, nie beide
   * Gerüst: NUR Gerüstbau ODER einmalig in anderem Gewerk
   * Entsorgung: Beim verursachenden Gewerk
   * Elektroschlitze: NUR bei ELEKT, nicht bei ROH oder ABBR
   * Sanitärschlitze: NUR bei SAN, nicht bei ROH oder ABBR
   * Fenster: Nur im Gewerk FEN, Dachfenster nur im Gewerk DACH
   * Elektrische Fußbodenheizung: NUR bei ELEKT oder FLI, NIEMALS bei SAN
   * Elektrischer Handtuchheizkörper: Gerät bei SAN, Stromanschluss bei ELEKT
   * Warmwasser-Fußbodenheizung: NUR bei HEI (Heizung), nicht bei SAN
   * Vorwandinstallation: NUR bei TRO (Trockenbau), nicht bei SAN
   * Abdichtungen Bad: NUR bei FLI (unter Fliesen), nicht bei SAN
   * Dämmung Dach: NUR bei DACH oder ZIMM (je nach Konstruktion), nicht bei FASS
   * Sockeldämmung: NUR bei FASS (Teil des WDVS), nicht separat
   
   GEWERK-SPEZIFISCHE REGELN:
   - FLI (Fliesenarbeiten): 
     * Fliesen, Mosaikarbeiten, Natursteinbeläge in Bad/Küche
     * Abdichtungen unter Fliesen (Verbundabdichtung)
     * Elektrische Fußbodenheizung (optional, alternativ ELEKT)
     * Gefälleestrich in Duschen
   
   - BOD (Bodenbelagsarbeiten): 
     * Parkett, Laminat, Vinyl, Teppich, PVC, Linoleum
     * KEINE Fliesen oder Naturstein!
     * Sockelleisten passend zum Bodenbelag
   
   - TIS (Tischlerarbeiten): 
     * Innentüren und Zargen (IMMER)
     * Einbaumöbel, Holzarbeiten
     * Holztreppen (nicht Beton)
     * KEINE Fenster oder Außentüren
   
   - TRO (Trockenbau): 
     * Rigipswände, Gipskarton, Metallständerwerk
     * Abgehängte Decken
     * Vorwandinstallationen für Sanitär
     * Schachtverkleidungen
     * KEINE tragenden Wände!
   
   - ROH (Rohbau): 
     * Mauerwerk, Beton, Stahlbeton
     * Tragende Konstruktionen
     * Ringanker, Stürze, Decken
     * KEINE Leichtbauwände oder Holzkonstruktionen!
   
   - MAL (Malerarbeiten): 
     * Innenputz mit Q1-Q3 Qualitäten
     * Anstriche, Tapeten, Spachteltechniken
     * Grundierungen
     * KEINE Fassadenarbeiten!
   
   - FASS (Fassade): 
     * Außenputz mit Struktur/Körnung
     * WDVS komplett inkl. Sockeldämmung
     * Fassadenanstrich
     * KEINE Q-Stufen, nur Strukturangaben!
   
   - ELEKT (Elektroarbeiten):
     * Alle Elektroinstallationen
     * Schlitze für Elektroleitungen (IMMER)
     * Elektrische Fußbodenheizung (Anschluss/komplett)
     * FI-Schutzschalter, Potentialausgleich
     * PV-AC-Seite, Wallbox
     * Smart Home Verkabelung
   
   - SAN (Sanitär):
     * Sanitärobjekte (WC, Waschbecken, Dusche, Wanne)
     * Wasser-/Abwasserleitungen
     * Elektrische Handtuchheizkörper (Gerät)
     * Armaturen
     * KEINE Vorwandinstallation (→ TRO)
     * KEINE elektrische Fußbodenheizung (→ ELEKT/FLI)
   
   - HEI (Heizung):
     * Heizkessel, Wärmepumpe, Brennwertgerät
     * Warmwasser-Fußbodenheizung
     * Heizkörper (wasserbetrieben)
     * Heizungsverrohrung
     * KEINE elektrischen Heizsysteme
   
   - ZIMM (Zimmerer):
     * Dachstuhl, Holzkonstruktionen
     * Holzbalkendecken
     * Gauben (Holzkonstruktion)
     * Carport, Holzständerwerk
     * Bei Holzbau: auch Dämmung
   
   - DACH (Dachdecker):
     * Dacheindeckung, Dachziegel
     * Dachrinnen, Fallrohre
     * Dachfenster (IMMER, nicht FEN)
     * Dachdämmung (bei Massivbau)
     * Flachdachabdichtung
   
   WICHTIGE SCHNITTSTELLEN-MATRIX:
   
   - Bad-Sanierung: 
     SAN/ELEKT/HEI (Rohinstallation) → TRO (Vorwand) → FLI (Abdichtung + Fliesen) → MAL (Anstrich) → SAN/ELEKT/HEI (Endmontage)
     
   - Dachausbau: 
     ZIMM/DACH (Konstruktion) → ELEKT/SAN/HEI (Leitungen) → TRO (Verkleidung) → MAL/BOD/FLI (Finish) → SAN/ELEKT/HEI (Endmontage)
     
   - Fassade mit WDVS: 
     GER (Gerüst) → FASS (WDVS + Dämmung) → FASS (Putz + Anstrich)
   
   - Heizungstausch: 
     HEI (Heizung) → ELEKT (Stromanschluss) → MAL (Anstrich Heizungsraum)
   
   - Kernsanierung Wohnung:
     ABBR (Entkernung) → ELEKT/SAN (Grundleitungen) → ROH (Wanddurchbrüche) → TRO (neue Raumaufteilung) → ESTR (Estrich) → FLI/BOD (Bodenbeläge) → TIS (Türen) → MAL (Komplettanstrich)
   
   - Kellersanierung (feucht):
     ABBR (Putz entfernen) → ROH (Abdichtung) → SAN/ELEKT (neue Leitungen) → TRO/MAL (Wandaufbau) → BOD (Bodenbelag)
   
   - Energetische Komplettsanierung:
     GER (Gerüst) → DACH (Dachdämmung) → FEN (Fenstertausch) → FASS (Fassadendämmung) → HEI (neue Heizung) → PV (Solaranlage)
   
   - Aufstockung:
     ROH (Verstärkung Bestand) → ZIMM (Holzaufbau) → DACH (Eindeckung) → FEN (Fenster) → ELEKT/SAN/HEI (Installation) → TRO (Innenausbau) → MAL/BOD/FLI (Finish) → SAN/ELEKT/HEI (Endmontage)   
   
   - Küchensanierung:
     ELEKT/SAN (Anschlüsse verlegen) → FLI (Fliesenspiegel) → TIS (Küchenmontage) → ELEKT (E-Geräte anschließen)
   
   - Balkon-/Terrassensanierung:
     ABBR (Altbelag entfernen) → ROH (Gefälle/Abdichtung) → FLI (Belag + Randabschluss) → SCHL (Geländer)
   
   - Altbau-Deckensanierung:
     ABBR (Fehlboden öffnen) → ZIMM (Balkenverstärkung) → TRO (Schallschutz + Verkleidung) → MAL (Stuck + Anstrich)
   
   - Wanddurchbruch mit Sturz:
     ROH (Statik + Durchbruch + Sturz) → MAL (Putz + Anstrich)
   
   - Dachterrasse neu:
     DACH (Abdichtung) → FLI (Plattenbelag) → SCHL (Geländer) → ELEKT (Außenbeleuchtung)
   
   - Smart-Home-Nachrüstung:
     ELEKT (KNX/Bus-Leitungen) → TRO (Kabelkanäle verkleiden) → MAL (Spachtel + Anstrich) → ELEKT (Endgeräte)
   
   - Schimmelsanierung:
     ABBR (befallene Teile entfernen) → ROH (Ursache beheben) → MAL (Spezialgrundierung) → TRO/MAL (Neuaufbau)
   
   - Barrierefreier Umbau:
     ROH (Türverbreiterung) → SAN (bodengleiche Dusche) → FLI (rutschfeste Fliesen) → TIS (breite Türen) → ELEKT (Notrufsystem)
   
   - PV-Installation Bestand:
     DACH (Dachhaken) → PV (Module + DC) → ELEKT (AC + Zähler + Speicher) → ELEKT (Wallbox)
   
   - Wintergarten-Anbau:
     ROH (Fundament + Bodenplatte) → FEN (Wintergarten-Konstruktion) → ELEKT/HEI (Anschlüsse) → FLI/BOD (Bodenbelag)
   
   REIHENFOLGE-PRINZIPIEN:
   1. Abbruch/Rückbau immer zuerst
   2. Rohbau/Statik vor Ausbau
   3. Installationen (ELEKT/SAN/HEI) vor Verkleidung
   4. Trockenbau vor Nassarbeiten wo möglich
   5. Bodenbeläge nach Wänden
   6. Malerarbeiten als Finish
   7. Endmontage Sanitär/Elektro ganz zum Schluss
   
13. MANUELL HINZUGEFÜGTE UND DURCH KI-EMPFOHLENE GEWERKE:
   - ERSTE FRAGE MUSS IMMER SEIN: "Welche konkreten ${tradeName}-Arbeiten sollen durchgeführt werden?"
   - Type: "text", required: true
   - Zweite Frage: "In welchem Umfang?" mit Mengenerfassung
   - Weitere Fragen basierend auf Projektkontext
   - ID der ersten Frage: "${tradeCode}-CONTEXT"

14. INTELLIGENTE FELDTYP-AUSWAHL:
   - Bei Fragen nach mehreren Objekten/Gegenständen: 
     * Verwende "type": "text" für freie Eingabe ODER
     * Verwende "type": "multiselect" mit "multiSelect": true
   - Erkennungsmuster für Mehrfachauswahl:
     * Frage enthält "Welche" (Plural)
     * Frage nach Gegenständen/Objekten im Plural
     * Sanitär-, Elektro-, Ausstattungsfragen
   - NIE nur Dropdown bei offensichtlichen Mehrfachauswahl-Szenarien
   
   ${tradeCode === 'FEN' ? `
15. SPEZIELLE FENSTER-REGELN:
   PFLICHTFRAGEN für Fenster-Gewerk:
   - Frage 1: "Wie viele Fenster insgesamt?"
   - Frage 2: "Welche Maße haben die EINZELNEN Fenster?" 
     * MUSS Einzelmaße abfragen!
     * Format: "Fenster 1: Breite x Höhe in cm"
     * NICHT nur Gesamtfläche!
   - Frage 3: "Welche Öffnungsart pro Fenstertyp?"
   - Frage 4: "Welches Material?"
   - Frage 5: "Sollen alte Fenster demontiert werden?"
   
   KRITISCH: Die Maßfrage MUSS nach EINZELMASSEN fragen, nicht nach Gesamtfläche!
` : ''}

${tradeCode === 'HEI' ? `
16. SPEZIELLE HEIZUNGS-REGELN:
   ERSTE FRAGE: "Liegt bereits eine Heizlastberechnung vor?"
   - Optionen: ["Ja, liegt vor", "Nein, wird noch erstellt", "Unsicher"]
   
   WENN JA: 
   - "Welche Heizkörpergrößen/Leistungen wurden berechnet?"
   - "Bitte Typ, Abmessungen oder Leistung in Watt angeben"
   
   WENN NEIN:
   - "Wie viele Räume sollen beheizt werden?"
   - "Welche Raumgrößen haben die zu beheizenden Räume?"
   - Im LV dann: "Heizkörper gemäß Heizlastberechnung"
   
   KEINE FRAGEN nach:
   - Genauen Heizkörpermaßen ohne Berechnung
   - Erfundenen Standardgrößen
` : ''}

${tradeCode === 'TIS' ? `
17. SPEZIELLE TÜREN-REGELN:
   PFLICHTFRAGEN für Innentüren:
   - "Wie viele Innentüren werden benötigt?"
   - "Welche Türmaße werden benötigt?"
     * Standard: 86x198,5cm, 96x198,5cm, 86x211cm, 96x211cm
     * "Bitte für jede abweichende Größe: Anzahl und Maße angeben"
     * WICHTIG: Bei Maßen über 100cm Breite oder 215cm Höhe: "SONDERMASS" vermerken
   - "Gibt es Türen mit Sondermaßen (z.B. breiter als 100cm oder höher als 215cm)?"
     * Falls ja: "Bitte genaue Maße und Anzahl angeben"
     * Hinweis: "Sondermaße sind deutlich teurer (30-100% Aufpreis)"
   - "Mit oder ohne Zargen?"
   - "Welche Ausführung?" (Weißlack, Echtholz, etc.)
` : ''}

${tradeCode === 'SAN' ? `
18. SPEZIELLE SANITÄR-REGELN:
   Bei Sanitärobjekten:
   - "Welche Sanitärobjekte sollen installiert werden?" 
     * type: "multiselect" mit multiSelect: true
     * Optionen: ["WC", "Waschbecken", "Dusche", "Badewanne", "Bidet"]
   - Für jedes Objekt: "Standardmaß oder Sondermaß?"
   - Nur bei Sondermaß: Nach konkreten Maßen fragen
` : ''}

${tradeCode === 'FASS' ? `
SPEZIELLE REGEL FÜR DÄMMSTÄRKEN-FRAGE:
- Frage nach EINER konkreten Dämmstärke, NICHT nach Bereichen!
- FALSCH: "Welche Dämmstärke (12-14 cm, 16-18 cm, 18-20 cm)?"
- RICHTIG: "Welche Dämmstärke in cm? (12, 14, 16, 18, 20, 22, 24)"
- Der Nutzer soll EINE Zahl wählen oder eingeben
- Options-Array: [12, 14, 16, 18, 20, 22, 24, 26] als einzelne Werte
` : ''}

${tradeCode === 'ROH' ? `
19. SPEZIELLE ROHBAU-REGELN:
   
   GRUNDREGEL: Rohbau macht Massivbauarbeiten!
   
   STANDARD-ABGRENZUNG (gilt immer):
   ================================
   ROHBAU MACHT:
   - Mauerwerk (Ziegel, Kalksandstein, Porenbeton)
   - Betonarbeiten (Wände, Decken, Stützen)
   - Stahlbetonarbeiten
   - Durchbrüche und Kernbohrungen
   - Ringanker und Stürze
   
   ROHBAU MACHT NICHT:
   - Trockenbau/Leichtbauwände (→ gehört zu TRO)
   - Holzkonstruktionen (→ gehört zu ZIMM)
   - Verputzarbeiten (→ gehört zu MAL/FASS)
   - Dämmarbeiten (→ gehört zu jeweiligem Gewerk)
   
   ${projectContext.istDachaufstockung ? `
   ╔══════════════════════════════════════════════════════════════════╗
   ║ SONDERFALL: DACHAUFSTOCKUNG - BEDINGTE AKTIVIERUNG               ║
   ╚══════════════════════════════════════════════════════════════════╝
   
   ${projectContext.aufstockungsBauweise === 'massivbau' ? `
   MASSIVBAUWEISE GEWÄHLT → Rohbau ist AKTIV:
   ✓ Komplette Massivwände der Aufstockung
   ✓ Ringanker/Ringbalken für Dachauflage
   ✓ Ggf. Betonstützen oder Stahlbetonwände
   ✓ Neue Geschossdecke falls nötig
   
   PFLICHTFRAGEN bei Massivbau-Aufstockung:
   - "Welches Mauerwerk für die Aufstockung (Ziegel, Kalksandstein, Porenbeton)?"
   - "Welche Wandstärke für die Aufstockungswände?"
   - "Wie viele m² Wandfläche in Massivbauweise?"
   - "Wird eine neue Geschossdecke benötigt?"
   ` : projectContext.aufstockungsBauweise === 'holzbau' ? `
   HOLZBAUWEISE GEWÄHLT → Rohbau NUR für Sonderarbeiten:
   ⚠️ Aufstockungswände macht der Zimmerer!
   
   Rohbau NUR falls zusätzlich benötigt:
   - Verstärkung bestehender Decke
   - Abbrucharbeiten am Bestand
   - Anpassungen am Treppenhaus
   
   Stelle NUR Fragen zu diesen Zusatzarbeiten!
   ` : `
   BAUWEISE NOCH OFFEN → Stelle bedingte Fragen:
   - "Falls Massivbauweise: Welches Mauerwerk?"
   - "Falls Massivbauweise: Welche Wandstärke?"
   - "Unabhängig: Sind Verstärkungen am Bestand nötig?"
   `}
   
   WICHTIG: Bei Holzbau-Aufstockung ist Rohbau meist NICHT beteiligt!
   ` : ''}
   
   GENERELLE ABGRENZUNG:
   - Leichte Bauweise = Zimmerer/Trockenbau
   - Schwere Bauweise = Rohbau
   ${projectContext.istDachaufstockung ? '- Bei Aufstockung: Bauweise entscheidet über Zuständigkeit!' : ''}
` : ''}

${tradeCode === 'ZIMM' ? `
18. SPEZIELLE ZIMMERER-REGELN:
   
   GRUNDREGEL: Zimmerer macht NUR Holzkonstruktionen!
   
   STANDARD-ABGRENZUNG (gilt immer):
   ================================
   ZIMMERER MACHT:
   - Dachstuhl / Holztragwerk
   - Holzkonstruktionen
   - Sparren, Pfetten, First
   - Gauben-Holzkonstruktion
   
   ZIMMERER MACHT NICHT (gehört zum Dachdecker):
   - Dachdämmung
   - Dampfbremse/Dampfsperre
   - Dacheindeckung/Ziegel
   - Unterspannbahn
   - Dachrinnen
   
   ${projectContext.istDachaufstockung ? `
   ╔══════════════════════════════════════════════════════════════════╗
   ║ SONDERFALL: DACHAUFSTOCKUNG - ERWEITERTE REGELN                  ║
   ╚══════════════════════════════════════════════════════════════════╝
   
   ${projectContext.aufstockungsBauweise === 'holzbau' ? `
   HOLZBAUWEISE → Zimmerer macht ZUSÄTZLICH:
   ✓ Komplette Holzrahmenwände der Aufstockung
   ✓ Ständerwerk-Konstruktion der Wände
   ✓ Beplankung (OSB, Gipskarton)
   ✓ Wanddämmung im Holzrahmen
   ✓ PLUS den normalen Dachstuhl obendrauf
   
   ZUSÄTZLICHE PFLICHTFRAGEN bei Holzbau-Aufstockung:
   - "Welche Wandhöhe soll die Aufstockung haben?"
   - "Wie viele m² Wandfläche in Holzrahmenbauweise?"
   - "Welche Beplankung gewünscht (OSB, Gipskarton, etc.)?"
   ` : projectContext.aufstockungsBauweise === 'massivbau' ? `
   MASSIVBAUWEISE → Zimmerer macht NUR Dachstuhl:
   ✗ KEINE Wände (macht Rohbau in Massivbauweise)
   ✓ NUR Standard-Dachstuhl auf der Massiv-Aufstockung
   
   Fokussiere NUR auf Dachstuhl-Fragen!
   ` : `
   BAUWEISE NOCH OFFEN → Stelle bedingte Fragen:
   - "Falls Holzbauweise gewählt: [Wandfragen]"
   - "Falls Massivbauweise: [nur Dachfragen]"
   - "In beiden Fällen: [Dachstuhl-Details]"
   `}` : ''}
   
   MERKE: Bei normalen Dachprojekten arbeiten Zimmerer und Dachdecker nacheinander.
   ${projectContext.istDachaufstockung ? 'Bei Aufstockungen kommt ggf. noch Rohbau (Massivbau) oder erweiterter Zimmerer-Umfang (Holzbau) dazu.' : ''}
` : ''}

${['FEN', 'TIS', 'SAN', 'HEI', 'FLI'].includes(tradeCode) ? `
ALLGEMEINE MAß-REGEL für ${tradeName}:
- IMMER nach konkreten Einzelmaßen fragen
- NIE nur Gesamtflächen oder pauschale Angaben
- Format: "Anzahl x Maß" für jeden unterschiedlichen Typ
- Bei Unsicherheit: "Maße vor Ort aufnehmen" als Option
` : ''}

   FRAGENANZAHL: ${targetQuestionCount} Fragen
- Vollständigkeit: ${intelligentCount.completeness}%
- Fehlende Info: ${intelligentCount.missingInfo.join(', ') || 'keine'}
- Bei hoher Vollständigkeit: WENIGER Fragen stellen als vorgegeben!

OUTPUT als JSON-Array mit genau ${targetQuestionCount} Fragen.
Jede Frage muss einen klaren Mehrwert für die LV-Erstellung bieten!
   
FRAGENANZAHL: ${targetQuestionCount} Fragen
- Vollständigkeit: ${intelligentCount.completeness}%
- Fehlende Info: ${intelligentCount.missingInfo.join(', ') || 'keine'}
- Bei Vollständigkeit >80%: Reduziere auf ${Math.floor(targetQuestionCount * 0.6)} Fragen
- Bei Vollständigkeit 50-80%: Reduziere auf ${Math.floor(targetQuestionCount * 0.8)} Fragen
- Bei Vollständigkeit <50%: Stelle alle ${targetQuestionCount} Fragen

OUTPUT (NUR valides JSON-Array):
[
  {
    "id": "string",
    "category": "string", 
    "question": "Verständliche Frage MIT EINHEIT bei Zahlen",
    "explanation": "PFLICHT! 100-200 Wörter mit: 1) Warum wird das gefragt? 2) Was bedeutet der Begriff für Laien? 3) Wie/wo messen? 4) Produktbeispiele bei Qualität 5) Empfehlung bei Unsicherheit",
    "type": "text|number|select|multiselect",
    "required": boolean,
    "unit": "m²|m|cm|Stück|null",
    "options": ["Option1", "Option2", "unsicher/weiß nicht"],
    "multiSelect": boolean,
    "defaultAssumption": "Falls 'unsicher': Diese Annahme wird getroffen",
    "measurementGuide": "Optional: Detaillierte Schritt-für-Schritt Messanleitung",
    "productExamples": "Optional: Konkrete Produkte mit Preisen für Standard/Gehoben/Premium",
    "visualHint": "Optional: Visuelle Erkennungsmerkmale",
    "commonMistakes": "Optional: Häufige Fehler die vermieden werden sollten",
    "defaultRecommendation": "Optional: Unsere Standard-Empfehlung mit Begründung",
    "dependsOn": "ID der Vorfrage oder null",
    "showIf": "Antwort die gegeben sein muss oder null"
  }
]

KRITISCH - STRUCTURE DER EXPLANATION (IMMER 100-200 WÖRTER):

1. KONTEXT (20-30 Wörter): Warum ist diese Info wichtig für die Kalkulation?
2. LAIEN-ERKLÄRUNG (40-60 Wörter): Was bedeutet das in einfachen Worten?
3. MESS-/PRÜFANLEITUNG (30-50 Wörter): Wo und wie genau messen/prüfen?
4. BEISPIELE (30-40 Wörter): Bei Qualität: Konkrete Produkte mit Preisen
5. EMPFEHLUNG (20-30 Wörter): "Bei Unsicherheit empfehlen wir..."

BEISPIEL EINER PERFEKTEN EXPLANATION:
"Die Qualitätsstufe bestimmt Preis und Lebensdauer erheblich - zwischen 800€ (Standard) und 5000€ (Premium) pro Bad. Standard wie Grohe Start (WC ~150€) oder Ideal Standard (Waschtisch ~120€) ist solide für Mietobjekte. Gehoben wie Hansgrohe (Armaturen ~180€) oder Duravit (WC ~300€) verbindet Design mit Komfort. Premium wie Dornbracht (Armaturen ~500€) oder Villeroy & Boch (WC ~600€) bietet Luxus und 15+ Jahre Haltbarkeit. Die Wahl beeinflusst auch Wartung: Standard braucht alle 3-5 Jahre Service, Premium erst nach 8-10 Jahren. Bei Unsicherheit empfehlen wir gehobene Qualität für Eigennutzung - bestes Preis-Leistungs-Verhältnis."

${projectContext.intakeContext && !isIntake ? `
WICHTIGER KONTEXT aus der Vorbefragung:
${projectContext.intakeContext}
Berücksichtige diese Informationen bei der Fragenerstellung.` : ''}

${projectContext.isAiRecommended && !isIntake ? `
HINWEIS: Dieses Gewerk wurde aufgrund der Vorbefragung empfohlen. 
Stelle spezifische Fragen zu den relevanten Punkten aus der Vorbefragung.` : ''}`; // Ende des GESAMTEN Template-Strings

// HIER NEUE ERGÄNZUNG EINFÜGEN:
// Zusätzliche Anpassung für AI-empfohlene Gewerke
let finalSystemPrompt = systemPrompt;
if (projectContext.isAiRecommended && !isIntake) {
  finalSystemPrompt += `

KRITISCHE ERGÄNZUNG FÜR AI-EMPFOHLENES GEWERK:
- Dies ist ein VOLLSTÄNDIGER Fragenkatalog, KEINE reduzierte Version
- ALLE gewerkespezifischen Regeln MÜSSEN angewendet werden
- Ziel: ${targetQuestionCount} detaillierte Fragen
- Bei Fenstern: JEDES einzelne Fenster mit Maßen
- Bei Türen: JEDE einzelne Tür mit Maßen
- Qualität wie bei erforderlichen Gewerken!`;
}
  
  const userPrompt = `Erstelle ${targetQuestionCount} LAIENVERSTÄNDLICHE Fragen für ${tradeName}.

PROJEKTKONTEXT:
- Beschreibung: ${projectContext.description || 'Keine'}
- Kategorie: ${projectContext.category || 'Nicht angegeben'}
- Vollständigkeit: ${intelligentCount.completeness}%

${projectContext.isManuallyAdded ? 
`WICHTIG: Dieses Gewerk wurde MANUELL HINZUGEFÜGT oder von der KI EMPFOHLEN!
ERSTE FRAGE MUSS SEIN: "Welche ${tradeName}-Arbeiten sollen im Rahmen der ${projectContext.category || 'Arbeiten'} ausgeführt werden?"` : ''}

FEHLENDE INFOS: ${intelligentCount.missingInfo.join(', ') || 'keine'}

${questionPrompt ? `Template-Basis:\n${questionPrompt.substring(0, 3000)}...\n` : ''}

BEACHTE:
- Fachbegriffe MÜSSEN erklärt werden
- Keine Fragen die Laien nicht beantworten können  
- Bei Mengen/Maßen: "unsicher" Option anbieten
- Sinnvolle Annahmen statt Detailfragen
- Wenn Info vorhanden: WENIGER Fragen stellen!`;

  try {
    console.log(`[QUESTIONS] Generating ${targetQuestionCount} questions for ${tradeName}`);
    
    const response = await llmWithPolicy(isIntake ? 'intake' : 'questions', [
      { role: 'system', content: finalSystemPrompt }, 
      { role: 'user', content: userPrompt }
    ], { 
      maxTokens: 10000,
      temperature: 0.5,
      jsonMode: false 
    });
    
// Bereinige die Response von Claude
let cleanedResponse = response
  .replace(/```json\n?/g, '')
  .replace(/```\n?/g, '')
  .trim();

// NEU: Prüfe ob die Response abgeschnitten wurde
if (!cleanedResponse.endsWith(']')) {
  console.warn('[QUESTIONS] Response appears truncated, attempting to fix...');
  
  // Finde das letzte vollständige Objekt
  const lastCompleteObject = cleanedResponse.lastIndexOf('},');
  if (lastCompleteObject > 0) {
    cleanedResponse = cleanedResponse.substring(0, lastCompleteObject + 1) + '\n]';
    console.log('[QUESTIONS] Truncated response fixed by closing at position', lastCompleteObject);
  }
}

// NEU: Escape problematische Zeichen in Strings
cleanedResponse = cleanedResponse
  .replace(/\n(?=[^"]*"(?:[^"]*"[^"]*")*[^"]*$)/g, '\\n')  // Newlines innerhalb von Strings
  .replace(/\t(?=[^"]*"(?:[^"]*"[^"]*")*[^"]*$)/g, '\\t'); // Tabs innerhalb von Strings

// Parse die Fragen
let questions;
try {
  questions = JSON.parse(cleanedResponse);
} catch (parseError) {
  console.error('[QUESTIONS] Failed to parse response:', parseError.message);
  console.error('[QUESTIONS] Parse error stack:', parseError.stack);
  console.log('[QUESTIONS] Raw response length:', cleanedResponse?.length || 0);
  console.log('[QUESTIONS] Raw response first 500 chars:', cleanedResponse?.substring(0, 500) || 'EMPTY');
  
  // Den originalen Fehler mit mehr Details werfen
  const detailedError = new Error(`JSON Parse fehlgeschlagen: ${parseError.message}`);
  detailedError.originalError = parseError;
  detailedError.responseSnippet = cleanedResponse?.substring(0, 200);
  throw detailedError;
}

// SPEZIELLE INTAKE-VALIDIERUNG: Entferne gewerkespezifische Fragen
if (tradeCode === 'INT') {
  const vorherAnzahl = questions.length;
  
  questions = questions.filter(q => {
    const qText = (q.question || '').toLowerCase();
    
    // VERBOTENE technische Details (für alle Gewerke)
    const technischeDetails = [
      // Spezifische Stärken
      /\d+\s*(cm|mm)\s*(dick|stark|stärke)/,
      /dämmstärke|wandstärke|deckenstärke/,
      
      // SPEZIFISCHE FLÄCHEN
      /fassadenfläche|fassade.*m²|m².*fassade/,
      /dachfläche|dach.*m²|m².*dach/,
      /wandfläche|wand.*m²|m².*wand/,
      /bodenfläche|boden.*m²|m².*boden/,
      /deckenfläche|decke.*m²|m².*decke/,
      /fensterfläche|fenster.*m²/,
      /türfläche|tür.*m²/,
      /zu dämmende.*fläche/,
      /zu fliesen.*fläche/,
      /zu streichen.*fläche/,
      
      // ANZAHLEN/STÜCKZAHLEN (NEU)
      /wie viele.*fenster|anzahl.*fenster|fenster.*anzahl/,
      /wie viele.*türen|anzahl.*türen|türen.*anzahl/,
      /wie viele.*heizkörper|anzahl.*heizkörper/,
      /wie viele.*steckdosen|anzahl.*steckdosen/,
      /wie viele.*schalter|anzahl.*schalter/,
      /wie viele.*leuchten|anzahl.*leuchten/,
      /wie viele.*räume.*streichen/,
      /wie viele.*wände/,
      /stückzahl|stück.*fenster|stück.*türen/,
      // ERLAUBT bleiben: Anzahl Geschosse/Etagen, Anzahl Räume (allgemein)
      
      // Materialauswahl
      /material.*auswahl|welches.*material/,
      /dämmmaterial|putzmaterial|fugenmaterial/,
      
      // Farben
      /farbe|farbton|ral/,
      
      // Oberflächendetails
      /struktur|körnung|oberfläche/,
      /putzstruktur|kratzputz|rillenputz/,
      
      // Qualitätsstufen
      /qualität|ausführung.*variant/,
      /q1|q2|q3|q4/,
      
      // Produktspezifika
      /produkt|hersteller|marke/,
      
      // Technische Kennwerte
      /dämmwert|u-wert|kennwert|lambda/,
      
      // Detailmaße
      /format|maße.*einzel/,
      /fenster.*\d+.*\d+|tür.*\d+.*\d+/,
      
      // Ausführungsdetails
      /verlegeart|einbauart|montage.*art/
    ];
    
    const istTechnisch = technischeDetails.some(pattern => qText.match(pattern));
    
    // NEU: Ausnahme für wichtige offene Intake-Fragen
    const istOffeneFrage = qText.includes('weitere') && 
                       (qText.includes('wünsche') || 
                        qText.includes('bedenken') || 
                        qText.includes('anmerkungen') ||
                        qText.includes('informationen'));

if (istTechnisch && !istOffeneFrage) {  // ← Ausnahme hinzugefügt
  console.log(`[INT-FILTER] Entfernt (technisches Detail): "${q.question.substring(0,60)}..."`);
  return false;
}
    
    // ALLES ANDERE IST ERLAUBT!
    // ✓ Wohnfläche, Nutzfläche, Gesamtfläche
    // ✓ Anzahl Geschosse/Etagen (allgemein)
    // ✓ Baujahr, Budget, Gebäudetyp
    // ✓ Bauweise bei Aufstockung
    // ✓ Konkrete Arbeiten/Projektumfang
    // ✓ Baustellenbedingungen
    
    return true;
  });
  
  if (vorherAnzahl !== questions.length) {
    console.log(`[INT-FILTER] ${vorherAnzahl - questions.length} gewerkespezifische Fragen aus Intake entfernt`);
  }
}

// Zähle Fragen vor Validierung
const beforeValidation = questions.length;

// Gewerke-Validierung NUR für Nicht-Intake Fragen
if (tradeCode !== 'INT') {
  questions = validateTradeQuestions(tradeCode, questions, projectContext);
  console.log(`[QUESTIONS] After trade validation: ${questions.length} questions (removed ${beforeValidation - questions.length})`);
} else {
  console.log(`[QUESTIONS] INT: Skipping trade validation for intake questions`);
}

// SPEZIAL-VALIDIERUNG bei Dachaufstockung
if (projectContext.istDachaufstockung) {
  if (tradeCode === 'ROH' && projectContext.aufstockungsBauweise === 'holzbau') {
    // Bei Holzbau sollte Rohbau minimal oder gar keine Fragen stellen
    questions = questions.filter(q => {
      const qText = q.question.toLowerCase();
      if (qText.includes('aufstockung') || qText.includes('wand') || qText.includes('mauerwerk')) {
        console.log(`[AUFSTOCKUNG] ROH-Frage entfernt bei Holzbau: ${q.question}`);
        return false;
      }
      return true;
    });
  }
  
  if (tradeCode === 'ZIMM' && projectContext.aufstockungsBauweise === 'massivbau') {
    // Bei Massivbau macht Zimmerer nur Dachstuhl
    questions = questions.filter(q => {
      const qText = q.question.toLowerCase();
      if (qText.includes('wand') || qText.includes('holzrahmen') || qText.includes('beplankung')) {
        console.log(`[AUFSTOCKUNG] ZIMM-Wandfrage entfernt bei Massivbau: ${q.question}`);
        return false;
      }
      return true;
    });
  }
}
    
// HIER: VERBESSERTER FILTER mit konkreten Werten
if (projectContext.answeredValues) {
  const afterAnswerFilter = questions.filter(q => {
    const qText = (q.question || '').toLowerCase();
    
    // Filtere bereits beantwortete Fragen
    if (projectContext.answeredValues.dimensions && 
        (qText.includes('abmessung') || qText.includes('maße'))) {
      console.log('[FILTER] Removed dimension question - already answered');
      return false;
    }
    
    if (projectContext.answeredValues.area && 
        qText.includes('fläche')) {
      console.log('[FILTER] Removed area question - already answered');
      return false;
    }
    
    // MATERIAL NUR FÜR INTAKE FILTERN
    if (projectContext.answeredValues.material && 
        qText.includes('material') && 
        tradeCode === 'INT') {  // <- NUR für Intake!
      console.log('[FILTER] Removed material question - already answered in intake');
      return false;
    }
    
    return true;
  });
  
  console.log(`[FILTER] Removed ${questions.length - afterAnswerFilter.length} answered questions`);
  questions = afterAnswerFilter;
}

// Zähle Fragen vor Duplikat-Filter
const beforeDuplicates = questions.length;

// Post-Processing Filter anwenden
console.log(`[DEBUG] tradeCode: "${tradeCode}", questions before duplicate filter: ${questions.length}`);
if (tradeCode !== 'INT') {
  questions = filterDuplicateQuestions(questions, allAnsweredInfo.fromIntake);
} else {
  console.log(`[QUESTIONS] INT: Skipping duplicate filter for intake questions`);
}
console.log(`[QUESTIONS] After duplicate filter: ${questions.length} questions (removed ${beforeDuplicates - questions.length})`);
console.log(`[DEBUG] Final question count: ${questions.length}`);

return Array.isArray(questions) ? questions : [];

// Entferne problematische Zeichen die Claude manchmal einfügt
cleanedResponse = cleanedResponse
  .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Kontrolzeichen entfernen
  .replace(/\r\n/g, '\n')  // Windows line endings normalisieren
  .replace(/\\n/g, ' ')    // Escaped newlines durch Leerzeichen ersetzen
  .replace(/\\"/g, '"')    // Escaped quotes fixen
  .replace(/\\\\/g, '\\'); // Double backslashes fixen

// NEU: Zusätzliche Bereinigung - Entferne alles vor dem ersten [ und nach dem letzten ]
const arrayStart = cleanedResponse.indexOf('[');
const arrayEnd = cleanedResponse.lastIndexOf(']');

if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
  cleanedResponse = cleanedResponse.substring(arrayStart, arrayEnd + 1);
} else {
  console.error('[QUESTIONS] No valid array brackets found in response');
  console.error('[QUESTIONS] Response snippet:', cleanedResponse.substring(0, 200));
  throw new Error('Invalid JSON structure - no array found');
}

// Entferne trailing commas (häufiger Claude-Fehler)
cleanedResponse = cleanedResponse
  .replace(/,(\s*[}\]])/g, '$1');  // Trailing commas entfernen

// Debug-Ausgabe
console.log(`[QUESTIONS] Raw response length: ${response.length}`);
console.log(`[QUESTIONS] Cleaned response starts with: ${cleanedResponse.substring(0, 100)}`);
    
try {
  questions = JSON.parse(cleanedResponse);
} catch (parseError) {
  console.error('[QUESTIONS] Parse error, attempting recovery:', parseError.message);
  console.error('[QUESTIONS] Failed response preview:', cleanedResponse.substring(0, 300));
  
  // Versuche das JSON zu reparieren
  try {
    // Entferne trailing commas und andere häufige JSON-Fehler
    let fixedResponse = cleanedResponse
      .replace(/,\s*}/g, '}')     // Entferne trailing commas vor }
      .replace(/,\s*\]/g, ']')     // Entferne trailing commas vor ]
      .replace(/}\s*{/g, '},{')   // Füge fehlende Kommas zwischen Objekten hinzu
      .replace(/"\s*\n\s*"/g, '","'); // Fixe fehlende Kommas zwischen Strings
    
    questions = JSON.parse(fixedResponse);
    console.log('[QUESTIONS] Recovery successful with fixed JSON');
  } catch (recoveryError) {
    console.error('[QUESTIONS] Recovery failed:', recoveryError);
    
    // Letzter Versuch: Extrahiere einzelne JSON-Objekte
    try {
      const objectMatches = cleanedResponse.match(/\{[^{}]*\}/g);
      if (objectMatches && objectMatches.length > 0) {
        questions = objectMatches.map(match => {
          try {
            return JSON.parse(match);
          } catch (e) {
            return null;
          }
        }).filter(q => q !== null);
        
        if (questions.length > 0) {
          console.log('[QUESTIONS] Recovered', questions.length, 'questions via object extraction');
        } else {
          throw new Error('No valid objects could be parsed');
        }
      } else {
        throw new Error('No JSON objects found');
      }
    } catch (finalError) {
      console.error('[QUESTIONS] Final recovery attempt failed:', finalError);
      throw new Error('Fehler bei der Fragengenerierung - bitte versuchen Sie es erneut');
    }
  }
}
    
    if (!Array.isArray(questions)) {
      console.error('[QUESTIONS] Response is not an array, using fallback');
      throw new Error('Fehler bei der Fragengenerierung - bitte versuchen Sie es erneut');
    }
    
    if (questions.length === 0) {
      console.error('[QUESTIONS] Empty questions array, using fallback');
      throw new Error('Fehler bei der Fragengenerierung - bitte versuchen Sie es erneut');
    }
    
    // NEU - füge multiSelect hinzu:
let processedQuestions = questions.slice(0, targetQuestionCount).map((q, idx) => ({
  id: q.id || `${tradeCode}-${String(idx + 1).padStart(2, '0')}`,
  category: q.category || 'Allgemein',
  question: q.question || q.text || q.q || `Frage ${idx + 1}`,
  explanation: q.explanation || q.hint || '',
  type: q.type || 'text',
  multiSelect: q.multiSelect || false,  // NEU: Mehrfachauswahl-Flag
  required: q.required !== undefined ? q.required : true,
  unit: q.unit || null,
  options: Array.isArray(q.options) ? q.options : null,
  defaultValue: q.defaultValue || null,
  validationRule: q.validationRule || null,
  tradeId,
  tradeName
}));
    
    console.log(`[QUESTIONS] Successfully generated ${processedQuestions.length} questions for ${tradeName}`);
    if (tradeCode === 'FEN') {
  console.log('[QUESTIONS] Ensuring ALL critical window questions...');
  
  // PFLICHT-CHECKS für Fenster
  const hasMaßfrage = processedQuestions.some(q => 
    q.question.toLowerCase().includes('maße')
  );
  
  const hasMaterialFrage = processedQuestions.some(q => 
    q.question.toLowerCase().includes('material') || 
    q.question.toLowerCase().includes('rahmen')
  );
  
  const hasÖffnungsFrage = processedQuestions.some(q => 
    q.question.toLowerCase().includes('öffnung') || 
    q.question.toLowerCase().includes('dreh')
  );
  
  // FÜGE FEHLENDE FRAGEN HINZU
  let insertPos = 1;
  
  if (!hasMaterialFrage) {
    processedQuestions.splice(insertPos++, 0, {
      id: 'FEN-MATERIAL',
      category: 'Material',
      question: 'Welches Rahmenmaterial wünschen Sie für die Fenster?',
      explanation: 'Das Material bestimmt bis zu 40% des Preises!',
      type: 'select',
      options: ['Kunststoff', 'Holz', 'Holz-Aluminium', 'Aluminium'],
      required: true,
      multiSelect: false,
      unit: null,
      tradeId: tradeId,
      tradeName: tradeName
    });
  }
  
  if (!hasMaßfrage) {
    processedQuestions.splice(insertPos++, 0, {
      id: 'FEN-MASSE',
      category: 'Abmessungen',
      question: 'Welche Maße haben die einzelnen Fenster? Bitte für jedes Fenster: Breite x Höhe in cm, Anzahl Flügel, Öffnungsart',
      explanation: 'Beispiel: "Fenster 1: 120x140cm, 2-flügelig, Dreh-Kipp" oder "3 Stück 80x100cm, 1-flügelig, Kipp"',
      type: 'text',
      required: true,
      multiSelect: false,
      unit: null,
      tradeId: tradeId,
      tradeName: tradeName
    });
  }
  
  console.log('[QUESTIONS] Window questions verified - Material, Maße, Öffnung checked');
}
// INTELLIGENTE GEWERKE-VALIDIERUNG basierend auf Kontext
processedQuestions = processedQuestions.map((q, idx) => {
  const qLower = q.question.toLowerCase();
  
  // Regel 1: Wenn ein anderes Gewerk explizit im Projekt ist, keine Fragen dazu
  const otherTradesInProject = projectContext.trades || [];
  
  // Prüfe ob Frage zu anderem Gewerk gehört
  const belongsToOtherTrade = otherTradesInProject.some(otherTrade => {
    if (otherTrade.code === tradeCode) return false; // Eigenes Gewerk ok
    
    // Mapping von Keywords zu Gewerken
    const tradeIndicators = {
      'FEN': ['fenster', 'verglasung', 'öffnungsart', 'rahmen', 'fensterbank'],
      'FASS': ['fassade', 'wdvs', 'dämmung außen', 'außenputz'],
      'DACH': ['dach', 'ziegel', 'dachrinne', 'dachfenster', 'first', 'traufe'],
      'SAN': ['sanitär', 'waschbecken', 'wc', 'dusche', 'abwasser'],
      'ELEKT': ['steckdose', 'schalter', 'kabel', 'verteiler', 'strom'],
      'HEI': ['heizung', 'heizkörper', 'thermostat', 'heizkessel']
    };
    
    const indicators = tradeIndicators[otherTrade.code] || [];
    return indicators.some(indicator => qLower.includes(indicator));
  });
  
  if (belongsToOtherTrade) {
    console.log(`[GEWERKE-INTELLIGENCE] Question belongs to other trade: "${q.question}"`);
    return null; // Markiere zum Entfernen
  }
  
  return q;
}).filter(q => q !== null);

if (tradeCode === 'FASS') {
  // Pflichtfrage 1: Fassadenfläche
  if (!extractedData?.quantities?.flaeche) {
    const hasAreaQuestion = processedQuestions.some(q => 
      q.question.toLowerCase().includes('fläche') || 
      q.question.toLowerCase().includes('m²')
    );
    
    if (!hasAreaQuestion) {
      processedQuestions.unshift({
        id: 'FASS-01',
        category: 'Mengenermittlung',
        question: 'Wie groß ist die zu dämmende Fassadenfläche in m²?',
        explanation: 'Bitte messen Sie alle Außenwandflächen, die gedämmt werden sollen (ohne Fenster/Türen)',
        type: 'number',
        required: true,
        unit: 'm²'
      });
    }
  }
  
  // Pflichtfrage 2: Dämmstoffstärke
  const hasDaemmstaerkeQuestion = processedQuestions.some(q => 
    q.question.toLowerCase().includes('dämmstärke') || 
    q.question.toLowerCase().includes('dämmstoffstärke') ||
    q.question.toLowerCase().includes('dicke') && q.question.toLowerCase().includes('dämm')
  );
  
  if (!hasDaemmstaerkeQuestion) {
    processedQuestions.splice(1, 0, {
      id: 'FASS-02',
      category: 'Dämmung',
      question: 'Welche Dämmstoffstärke ist geplant (in cm)?',
      explanation: 'Empfehlung für optimale Energieeffizienz: 14-16 cm. Mindestens 12 cm für EnEV-Anforderungen, 16-20 cm für KfW-Förderung.',
      type: 'select',
      options: ['12 cm', '14 cm', '16 cm (Empfehlung)', '18 cm', '20 cm', 'Unsicher - bitte beraten'],
      required: true,
      defaultValue: '16 cm (Empfehlung)'
    });
  }
}

if (tradeCode === 'PV') {
  // Pflichtfrage 1: Verfügbare Dachfläche
  const hasDachflaecheQuestion = processedQuestions.some(q => 
    q.question.toLowerCase().includes('dachfläche') || 
    (q.question.toLowerCase().includes('fläche') && q.question.toLowerCase().includes('dach'))
  );
  
  if (!hasDachflaecheQuestion) {
    processedQuestions.unshift({
      id: 'PV-01',
      category: 'Flächenermittlung',
      question: 'Wie groß ist die für PV belegbare Dachfläche in m²?',
      explanation: 'Nur unverschattete Süd-, Ost- oder Westflächen. Abzüglich Dachfenster, Schornsteine, Gauben.',
      type: 'number',
      required: true,
      unit: 'm²'
    });
  }
  
  // Pflichtfrage 2: Gewünschte Leistung
  const hasLeistungQuestion = processedQuestions.some(q => 
    q.question.toLowerCase().includes('kwp') || 
    q.question.toLowerCase().includes('kilowatt') ||
    q.question.toLowerCase().includes('leistung')
  );
  
  if (!hasLeistungQuestion) {
    processedQuestions.splice(1, 0, {
      id: 'PV-02',
      category: 'Anlagenleistung',
      question: 'Welche PV-Anlagenleistung wünschen Sie (in kWp)?',
      explanation: 'Faustregel: Pro kWp werden ca. 5-7 m² Dachfläche benötigt. Ein 4-Personen-Haushalt benötigt typisch 6-10 kWp.',
      type: 'select',
      options: ['4-6 kWp', '6-8 kWp', '8-10 kWp (Empfehlung)', '10-12 kWp', '12-15 kWp', 'Maximal möglich', 'Unsicher - bitte beraten'],
      required: true,
      defaultValue: '8-10 kWp (Empfehlung)'
    });
  }
}
    
if (tradeCode === 'GER') {
  // Sicherstellen dass Gerüstfläche erfragt wird
  const hasCorrectAreaQuestion = processedQuestions.some(q => 
    q.question.toLowerCase().includes('gerüstfläche') || 
    q.question.toLowerCase().includes('m²')
  );
  
  if (!hasCorrectAreaQuestion) {
    // Füge Pflichtfrage hinzu
    processedQuestions.unshift({
      id: 'GER-01',
      category: 'Mengenermittlung',
      question: 'Wie groß ist die benötigte Gerüstfläche in m²?',
      explanation: 'Berechnung: (Länge aller einzurüstenden Fassadenseiten) x (Höhe bis Arbeitsebene + 2m Überstand)',
      type: 'number',
      required: true,
      unit: 'm²',
      tradeId: tradeId,
      tradeName: tradeName
    });
  }
}   
    // VERBESSERTER FILTER: Entferne Duplikate basierend auf allen Informationsquellen
let filteredQuestions = processedQuestions;

// Erstelle Liste aller bereits bekannten Informationen
const knownInfo = [];

// Aus extrahierten Daten
if (extractedData) {
  if (extractedData.quantities?.fenster) {
    knownInfo.push('anzahl fenster', 'wie viele fenster', 'fensteranzahl');
  }
  if (extractedData.quantities?.tueren) {
    knownInfo.push('anzahl türen', 'wie viele türen', 'türenanzahl', 'haustür');
  }
  if (extractedData.quantities?.flaeche) {
    knownInfo.push('fläche', 'quadratmeter', 'qm', 'größe');
  }
  if (extractedData.quantities?.raeume) {
    knownInfo.push('anzahl zimmer', 'wie viele zimmer', 'räume');
  }
  if (extractedData.measures?.includes('WDVS Fassadendämmung')) {
    knownInfo.push('fassadendämmung', 'wdvs', 'dämmung fassade');
  }
  if (extractedData.measures?.includes('Fensteraustausch')) {
    knownInfo.push('fenster austauschen', 'fenster erneuern', 'neue fenster');
  }
  if (extractedData.measures?.includes('Badsanierung')) {
    knownInfo.push('bad sanierung', 'bad renovieren');
  }
}

// Aus Intake-Antworten
if (allAnsweredInfo?.fromIntake?.length > 0) {
  allAnsweredInfo.fromIntake.forEach(item => {
    const questionLower = item.question_text.toLowerCase();
    // Füge die komplette Frage als bekannt hinzu
    knownInfo.push(questionLower);
    // Extrahiere auch Schlüsselwörter
    if (questionLower.includes('baustrom')) knownInfo.push('strom', 'baustrom');
    if (questionLower.includes('bauwasser')) knownInfo.push('wasser', 'bauwasser');
    if (questionLower.includes('zufahrt')) knownInfo.push('zufahrt', 'zugang');
    if (questionLower.includes('gerüst')) knownInfo.push('gerüst', 'arbeitsgerüst');
  });
}

// Filtere Fragen
filteredQuestions = processedQuestions.filter(newQ => {
  const questionLower = (newQ.question || '').toLowerCase();
  
  // Prüfe ob Frage bereits beantwortet wurde
  const isDuplicate = knownInfo.some(known => {
    if (questionLower.includes(known)) {
      console.log(`[QUESTIONS] Filtered duplicate: "${newQ.question}" (matches: ${known})`);
      return true;
    }
    return false;
  });
  
  // UNIVERSELLE REGEL: Frage nur nach erwähnten Dingen
  if (!isIntake && extractedData) {
    // Bei Fenster-Gewerk: Wenn keine Türen erwähnt, keine Tür-Fragen
    if (tradeCode === 'FEN' && !extractedData.quantities?.tueren && 
        !projectContext.description?.toLowerCase().includes('tür')) {
      if (questionLower.includes('haustür') || questionLower.includes('eingangstür')) {
        console.log(`[QUESTIONS] Filtered: Tür-Frage obwohl keine Türen erwähnt`);
        return false;
      }
    }
    
    // Bei Boden-Gewerk: Wenn nur Parkett erwähnt, keine Fliesen-Fragen
    if (tradeCode === 'BOD' && projectContext.description) {
      const desc = projectContext.description.toLowerCase();
      if (desc.includes('parkett') && !desc.includes('fliesen')) {
        if (questionLower.includes('fliesen')) {
          console.log(`[QUESTIONS] Filtered: Fliesen-Frage obwohl nur Parkett erwähnt`);
          return false;
        }
      }
    }
  }
  
  // Gerüst-Filter für betroffene Gewerke
  if (['DACH', 'FASS', 'FEN'].includes(tradeCode)) {
    if (questionLower.includes('gerüst') || questionLower.includes('arbeitsgerüst')) {
      console.log(`[QUESTIONS] Filtered: Gerüst-Frage in ${tradeCode}`);
      return false;
    }
  }
  
  return !isDuplicate;
});

console.log(`[QUESTIONS] Filtered ${processedQuestions.length - filteredQuestions.length} duplicate/irrelevant questions`);

// INTELLIGENTER FILTER FÜR FENSTER-GEWERK
if (tradeCode === 'FEN') {
  const descLower = (projectContext.description || '').toLowerCase();
  const haustuerErwaehnt = descLower.includes('haustür') || 
                           descLower.includes('eingangstür') || 
                           descLower.includes('haustüre') ||
                           descLower.includes('hauseingangstür');
  
  if (!haustuerErwaehnt) {
    // NUR wenn NICHT erwähnt, dann filtern
    filteredQuestions = filteredQuestions.filter(q => {
      const qLower = q.question.toLowerCase();
      if (qLower.includes('haustür') || qLower.includes('eingangstür')) {
        console.log(`[FEN] Removed door question - not mentioned in project: "${q.question}"`);
        return false;
      }
      return true;
    });
  } else {
    // Wenn erwähnt, SICHERSTELLEN dass danach gefragt wird
    const hasDoorQuestion = filteredQuestions.some(q => 
      q.question.toLowerCase().includes('tür')
    );
    
    if (!hasDoorQuestion) {
      filteredQuestions.unshift({
        id: 'FEN-DOOR-01',
        category: 'Türen',
        question: 'Welche Art von Haustür wünschen Sie?',
        type: 'select',
        options: ['Kunststoff', 'Aluminium', 'Holz', 'Stahl'],
        required: true
      });
      console.log('[FEN] Added door question - was mentioned in project');
    }
  }
}
 
return filteredQuestions;   
    
 } catch (err) {
    console.error('[QUESTIONS] Generation failed:', err.message);
    console.error('[QUESTIONS] Error details:', err);
    if (err.responseSnippet) {
      console.error('[QUESTIONS] Response snippet:', err.responseSnippet);
    }
    throw err;
  }
}  

/**
 * Filtert duplizierte Fragen basierend auf Intake-Antworten
 */
function filterDuplicateQuestions(questions, intakeAnswers) {
  if (!intakeAnswers || intakeAnswers.length === 0) return questions;
  
  // Extrahiere bekannte Kalkulationsdaten
  const knownData = extractCalculationDataFromIntake(intakeAnswers);
  
  return questions.filter(q => {
    const qText = (q.question || q.text || '').toLowerCase();
    
    // ============ FLÄCHEN ============
    if (knownData.flaechen.badflaeche_gesamt && 
        qText.includes('bad') && 
        (qText.includes('wie groß') || qText.includes('fläche')) &&
        !qText.includes('wandfläche') && 
        !qText.includes('bodenfläche') &&
        !qText.includes('zu fliesen')) {
      console.log('[FILTER] Removed: Bad-Gesamtfläche bereits bekannt');
      return false;
    }
    
    if (knownData.flaechen.wohnflaeche_gesamt && 
        qText.includes('wohnfläche') &&
        !qText.includes('davon')) {
      console.log('[FILTER] Removed: Wohnfläche bereits bekannt');
      return false;
    }
    
    if (knownData.flaechen.dachflaeche && 
        qText.includes('dachfläche') &&
        !qText.includes('davon') &&
        !qText.includes('teilfläche')) {
      console.log('[FILTER] Removed: Dachfläche bereits bekannt');
      return false;
    }
    
    if (knownData.flaechen.fassadenflaeche && 
        qText.includes('fassade') && 
        qText.includes('fläche')) {
      console.log('[FILTER] Removed: Fassadenfläche bereits bekannt');
      return false;
    }
    
    // NEU: Bodenfläche (wichtig für Estrich, Bodenbelag, Fliesen)
    if (knownData.flaechen.bodenflaeche && 
        qText.includes('boden') && 
        (qText.includes('fläche') || qText.includes('wie groß')) &&
        !qText.includes('teilfläche') &&
        !qText.includes('welcher raum')) {
      console.log('[FILTER] Removed: Bodenfläche bereits bekannt');
      return false;
    }
    
    // Estrichfläche spezifisch
    if (knownData.flaechen.estrichflaeche && 
        qText.includes('estrich') && 
        qText.includes('fläche')) {
      console.log('[FILTER] Removed: Estrichfläche bereits bekannt');
      return false;
    }
    
    // ============ HÖHEN ============
    if (knownData.hoehen.raumhoehe && 
        (qText.includes('raumhöhe') || 
         qText.includes('deckenhöhe') || 
         (qText.includes('wie hoch') && qText.includes('raum')))) {
      console.log('[FILTER] Removed: Raumhöhe bereits bekannt');
      return false;
    }
    
    if (knownData.hoehen.wandstaerke && 
        (qText.includes('wandstärke') || 
         qText.includes('wanddicke') || 
         (qText.includes('dick') && qText.includes('wand')))) {
      console.log('[FILTER] Removed: Wandstärke bereits bekannt');
      return false;
    }
    
    if (knownData.hoehen.gebaeudehoehe && 
        (qText.includes('gebäudehöhe') || 
         qText.includes('firsthöhe') || 
         (qText.includes('hoch') && qText.includes('gebäude')))) {
      console.log('[FILTER] Removed: Gebäudehöhe bereits bekannt');
      return false;
    }
    
    // ============ LÄNGEN ============
    if (knownData.laengen.wandlaenge && 
        qText.includes('wand') && 
        (qText.includes('länge') || qText.includes('lang'))) {
      console.log('[FILTER] Removed: Wandlänge bereits bekannt');
      return false;
    }
    
    if (knownData.laengen.raumlaenge && 
        qText.includes('raum') && 
        (qText.includes('länge') || qText.includes('lang'))) {
      console.log('[FILTER] Removed: Raumlänge bereits bekannt');
      return false;
    }
    
    // ============ BREITEN ============
    if (knownData.breiten.raumbreite && 
        qText.includes('raum') && 
        (qText.includes('breite') || qText.includes('breit'))) {
      console.log('[FILTER] Removed: Raumbreite bereits bekannt');
      return false;
    }
    
    if (knownData.breiten.fensterbreite && 
        qText.includes('fenster') && 
        (qText.includes('breite') || qText.includes('breit')) &&
        !qText.includes('einzelne')) {
      console.log('[FILTER] Removed: Fensterbreite bereits bekannt');
      return false;
    }
    
    // ============ STÜCKZAHLEN - ERWEITERT ============
    
    // Fenster
    if (knownData.stueckzahlen.fenster && 
        ((qText.includes('wie viele') && qText.includes('fenster')) ||
         (qText.includes('anzahl') && qText.includes('fenster')))) {
      console.log('[FILTER] Removed: Fensteranzahl bereits bekannt');
      return false;
    }
    
    // Türen
    if (knownData.stueckzahlen.tueren && 
        ((qText.includes('wie viele') && qText.includes('tür')) ||
         (qText.includes('anzahl') && qText.includes('tür')))) {
      console.log('[FILTER] Removed: Türenanzahl bereits bekannt');
      return false;
    }
    
    // Räume
    if (knownData.stueckzahlen.raeume && 
        ((qText.includes('wie viele') && (qText.includes('raum') || qText.includes('räume') || qText.includes('zimmer'))) ||
         (qText.includes('anzahl') && (qText.includes('raum') || qText.includes('räume') || qText.includes('zimmer'))))) {
      console.log('[FILTER] Removed: Raumanzahl bereits bekannt');
      return false;
    }
    
    // Bäder
    if (knownData.stueckzahlen.baeder && 
        ((qText.includes('wie viele') && (qText.includes('bad') || qText.includes('bäder'))) ||
         (qText.includes('anzahl') && (qText.includes('bad') || qText.includes('bäder'))))) {
      console.log('[FILTER] Removed: Bäderanzahl bereits bekannt');
      return false;
    }
    
    // Geschosse/Etagen
    if (knownData.stueckzahlen.geschosse && 
        ((qText.includes('wie viele') && (qText.includes('geschoss') || qText.includes('etage') || qText.includes('stockwerk'))) ||
         (qText.includes('anzahl') && (qText.includes('geschoss') || qText.includes('etage') || qText.includes('stockwerk'))))) {
      console.log('[FILTER] Removed: Geschossanzahl bereits bekannt');
      return false;
    }
    
    // ZUSÄTZLICHE STÜCKZAHLEN die aus den Antworten extrahiert werden könnten:
    
    // Wände (Intake könnte fragen: "Wie viele Wände sollen verputzt werden?")
    if (knownData.stueckzahlen.waende && 
        ((qText.includes('wie viele') && qText.includes('wand')) ||
         (qText.includes('anzahl') && qText.includes('wand')))) {
      console.log('[FILTER] Removed: Wandanzahl bereits bekannt');
      return false;
    }
    
    // Heizkörper
    if (knownData.stueckzahlen.heizkoerper && 
        ((qText.includes('wie viele') && qText.includes('heizkörper')) ||
         (qText.includes('anzahl') && qText.includes('heizkörper')))) {
      console.log('[FILTER] Removed: Heizkörperanzahl bereits bekannt');
      return false;
    }
    
    // Steckdosen
    if (knownData.stueckzahlen.steckdosen && 
        ((qText.includes('wie viele') && qText.includes('steckdose')) ||
         (qText.includes('anzahl') && qText.includes('steckdose')))) {
      console.log('[FILTER] Removed: Steckdosenanzahl bereits bekannt');
      return false;
    }
    
    // Schalter
    if (knownData.stueckzahlen.schalter && 
        ((qText.includes('wie viele') && qText.includes('schalter')) ||
         (qText.includes('anzahl') && qText.includes('schalter')))) {
      console.log('[FILTER] Removed: Schalteranzahl bereits bekannt');
      return false;
    }
    
    // Dachfenster
    if (knownData.stueckzahlen.dachfenster && 
        ((qText.includes('wie viele') && qText.includes('dachfenster')) ||
         (qText.includes('anzahl') && qText.includes('dachfenster')))) {
      console.log('[FILTER] Removed: Dachfensteranzahl bereits bekannt');
      return false;
    }
    
    // NEU: Gauben
    if (knownData.stueckzahlen.gauben && 
        ((qText.includes('wie viele') && (qText.includes('gaube') || qText.includes('gauben'))) ||
         (qText.includes('anzahl') && (qText.includes('gaube') || qText.includes('gauben'))))) {
      console.log('[FILTER] Removed: Gaubenanzahl bereits bekannt');
      return false;
    }
    
    // ============ MATERIALIEN ============
// DEAKTIVIERT: Intake fragt nicht mehr nach Material-Details (wird dort gefiltert)
// Gewerke-Fragen MÜSSEN nach spezifischen Materialien fragen können
/*
if (knownData.materialien.wand && 
    qText.includes('wand') && 
    qText.includes('material') &&
    !qText.includes('oberfläche') &&
    !qText.includes('beschichtung')) {
  console.log('[FILTER] Removed: Wandmaterial bereits bekannt');
  return false;
}

if (knownData.materialien.boden && 
    qText.includes('boden') && 
    qText.includes('material') &&
    !qText.includes('neuer') &&
    !qText.includes('gewünscht')) {
  console.log('[FILTER] Removed: Bodenmaterial bereits bekannt');
  return false;
}

if (knownData.materialien.dach && 
    qText.includes('dach') && 
    qText.includes('material')) {
  console.log('[FILTER] Removed: Dachmaterial bereits bekannt');
  return false;
}
*/
    
    // ============ KOMBINIERTE MASSE (LxBxH) ============
    if ((knownData.laengen.bad && knownData.breiten.bad) &&
        qText.includes('bad') && 
        (qText.includes('maße') || qText.includes('abmessung'))) {
      console.log('[FILTER] Removed: Badmaße bereits bekannt');
      return false;
    }
    
    if ((knownData.laengen.raum && knownData.breiten.raum) &&
        qText.includes('raum') && 
        (qText.includes('maße') || qText.includes('abmessung')) &&
        !qText.includes('welcher raum') &&
        !qText.includes('einzelne')) {
      console.log('[FILTER] Removed: Raummaße bereits bekannt');
      return false;
    }
    
    // ============ VOLUMEN ============
    if (knownData.volumen && Object.keys(knownData.volumen).length > 0) {
      // Prüfe Volumen-bezogene Fragen
      if (qText.includes('kubikmeter') || qText.includes('m³') || qText.includes('volumen')) {
        const volumenKeys = Object.keys(knownData.volumen);
        for (const key of volumenKeys) {
          if (qText.includes(key)) {
            console.log(`[FILTER] Removed: ${key}-Volumen bereits bekannt`);
            return false;
          }
        }
      }
    }
    
    // Frage ist OK - wird beibehalten
    return true;
  });
}

/**
 * Validiert und filtert Fragen basierend auf Gewerke-Zuständigkeit
 * Berücksichtigt gemeinsame und exklusive Begriffe
 */
function validateTradeQuestions(tradeCode, questions, projectContext = {}) {
  // INTAKE-FRAGEN NIEMALS FILTERN!
  if (tradeCode === 'INT') {
    console.log('[VALIDATION] INT: Keine Filterung bei Intake-Fragen');
    return questions; // Alle Fragen durchlassen
  }  
  // GEMEINSAME Begriffe - mehrere Gewerke dürfen danach fragen
  const SHARED_KEYWORDS = {
    'bad': ['SAN', 'FLI', 'MAL', 'ELEKT', 'TRO'],  // Badezimmer betrifft viele
    'küche': ['TIS', 'FLI', 'ELEKT', 'SAN'],        // Küche betrifft viele
    'wand': ['ROH', 'FLI', 'MAL', 'TRO', 'ELEKT'],  // Wände betrifft viele
    'boden': ['FLI', 'BOD', 'ESTR', 'MAL'],         // Böden betrifft viele
    'decke': ['MAL', 'TRO', 'ROH', 'ELEKT'],        // Decken betrifft viele
    'gaube': ['ZIMM', 'DACH'],                      // Zimmerer baut Holzkonstruktion der Gaube, Dachdecker deckt sie ein
    'raum': ['MAL', 'TRO', 'BOD', 'FLI', 'ELEKT'],  // Räume betrifft viele
    'tür': ['TIS', 'MAL', 'TRO', 'FEN'],             // Türbereiche betrifft mehrere
    'fläche': ['FLI', 'MAL', 'BOD', 'FASS', 'ESTR'], // Flächen allgemein
    'material': ['ALLE'],                            // Material kann jedes Gewerk fragen
    'farbe': ['MAL', 'FASS', 'TIS', 'FEN'],         // Farben betrifft mehrere
    'montage': ['ALLE'],                             // Montage betrifft alle
    'demontage': ['ALLE'],                           // Demontage betrifft alle
    'estrich': ['ESTR', 'ABBR'],                     // Beide dürfen generell
    'heizestrich': ['ESTR', 'HEI'],                   // Beide relevant
    'estrich vorbereiten': ['BOD', 'FLI'],           // Beide bereiten vor
    'ausgleichsmasse': ['ESTR', 'BOD', 'FLI'],       // Alle drei
  };

  // NUR EXKLUSIVE Begriffe - nur DIESES Gewerk darf fragen
  const STRICTLY_EXCLUSIVE = {
    'ELEKT': ['schalter', 'leuchte', 'sicherung', 'verteiler', 'fi-schalter'],
    'HEI': ['thermostat', 'warmwasser', 'kessel', 'brenner', 'radiator'],
    'KLIMA': ['klima', 'luftwechsel', 'abluft', 'zuluft', 'klimaanlage', 'wärmerückgewinnung'],
    'TRO': ['rigips', 'trockenbau', 'ständerwerk', 'vorwand', 'gipskarton'],
    'FLI': ['verfugen', 'mosaik', 'naturstein', 'feinsteinzeug', 'bodenfliesen', 'wandfliesen'],
    'MAL': ['streichen', 'innenputz', 'tapezieren', 'verputzen', 'spachteln', 'lackieren', 'grundierung'],
    'BOD': ['parkett', 'laminat', 'vinyl', 'teppich', 'linoleum', 'kork', 'designboden'],
    'ROH': ['mauerwerk', 'ziegelmauerwerk', 'durchbruch', 'beton', 'maurerarbeiten', 'sturz', 'kalksandstein'],
    'SAN': ['wc', 'waschbecken', 'dusche', 'badewanne', 'abfluss', 'wasserhahn', 'armatur'],
    'FEN': ['verglasung', 'haustür', 'rolladen', 'jalousie', 'außentür', 'terrassentür', 'isolierglas'],
    'TIS': ['innentür', 'zarge', 'möbel', 'einbauschrank', 'küche', 'wohnungseingangstür', 'arbeitsplatte'],
    'DACH': ['dachziegel', 'dachrinne', 'schneefang', 'gauben', 'eindeckung', 'dampfbremse', 'unterspannbahn'],
    'FASS': ['fassade', 'wdvs', 'außenputz', 'verblendung', 'klinker', 'fassadenfarbe'],
    'GER': ['gerüst', 'baugerüst', 'arbeitsgerüst', 'fassadengerüst', 'rollgerüst', 'dachgerüst'],
    'ZIMM': ['holzbau', 'dachstuhl', 'gaube', 'carport', 'holzkonstruktion', 'fachwerk'],
    'ESTR': ['fließestrich', 'zementestrich', 'anhydritestrich', 'trockenestrich', 'ausgleichsmasse'],
    'SCHL': ['geländer', 'zaun', 'tor', 'metallbau', 'stahltreppe', 'schlosserarbeiten'],
    'AUSS': ['pflaster', 'einfahrt', 'außenanlage', 'randstein', 'rasen'],
    'PV': ['solar', 'photovoltaik', 'solaranlage', 'wechselrichter', 'batterie', 'einspeisung'],
    'ABBR': ['abriss', 'abbruch', 'entkernung', 'rückbau']
  };

  const filteredQuestions = [];
  const blockedQuestions = [];

  for (const question of questions) {
    const questionText = (question.question || question.text || '').toLowerCase();
    let isValid = true;
    let blockReason = '';

    // Prüfe EXKLUSIVE Keywords anderer Gewerke
    for (const [code, keywords] of Object.entries(STRICTLY_EXCLUSIVE)) {
      if (code !== tradeCode) {
        for (const keyword of keywords) {
          if (questionText.includes(keyword)) {
            // Prüfe ob es nicht ein gemeinsamer Begriff ist
            const isShared = Object.entries(SHARED_KEYWORDS).some(([sharedWord, allowedTrades]) => 
              questionText.includes(sharedWord) && 
              (allowedTrades.includes(tradeCode) || allowedTrades.includes('ALLE'))
            );
            
            if (!isShared) {
              blockReason = `Exklusiv-Begriff "${keyword}" gehört nur zu ${code}`;
              isValid = false;
              break;
            }
          }
        }
      }
      if (!isValid) break;
    }

    // SPEZIALREGELN für bekannte Probleme
    if (isValid) {
      // Fenster darf nicht nach Dachfenstern fragen
      if (tradeCode === 'FEN' && questionText.includes('dachfenster')) {
        blockReason = 'Dachfenster gehören zu DACH, nicht zu FEN';
        isValid = false;
      }
      
      // Zimmerer darf nicht nach Dämmung fragen
      else if (tradeCode === 'ZIMM' && 
               (questionText.includes('dämmung') || 
                questionText.includes('dampfsperre') || 
                questionText.includes('isolierung'))) {
        blockReason = 'Dämmung gehört zu DACH, nicht zu ZIMM';
        isValid = false;
      }
      
      // Bodenleger darf nicht nach Fliesen fragen
      else if (tradeCode === 'BOD' && 
               (questionText.includes('fliese') || 
                questionText.includes('naturstein'))) {
        blockReason = 'Fliesen gehören zu FLI, nicht zu BOD';
        isValid = false;
      }
      
      // Haustür nur wenn im Projekt erwähnt
      else if (tradeCode === 'FEN' && 
               questionText.includes('haustür') && 
               !projectContext?.description?.toLowerCase().includes('haustür')) {
        blockReason = 'Haustür nicht im Projekt erwähnt';
        isValid = false;
      }
    }

    if (isValid) {
      filteredQuestions.push(question);
    } else {
      blockedQuestions.push({ question: questionText, reason: blockReason });
    }
  }

  // Logging nur wenn Fragen blockiert wurden
  if (blockedQuestions.length > 0) {
    console.log(`[VALIDATION] ${tradeCode}: ${blockedQuestions.length} Fragen blockiert`);
    blockedQuestions.forEach(b => {
      console.log(`  ❌ "${b.question.substring(0, 60)}..." → ${b.reason}`);
    });
  } else {
    console.log(`[VALIDATION] ${tradeCode}: Alle ${filteredQuestions.length} Fragen valide`);
  }

  return filteredQuestions;
}

/**
 * Generiert adaptive Folgefragen basierend auf Kontext-Antwort
 */
async function generateContextBasedQuestions(tradeId, projectId, contextAnswer) {
  const trade = await query('SELECT name, code FROM trades WHERE id = $1', [tradeId]);
  const project = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
  
  // Lade Intake-Kontext
  const intakeAnswers = await query(
    `SELECT q.text as question, a.answer_text as answer
     FROM answers a
     JOIN questions q ON q.project_id = a.project_id 
       AND q.trade_id = a.trade_id 
       AND q.question_id = a.question_id
     JOIN trades t ON t.id = a.trade_id
     WHERE a.project_id = $1 AND t.code = 'INT'`,
    [projectId]
  );
  
  // Bestimme Fragenanzahl basierend auf BESTEHENDER Komplexitätslogik
  const projectContext = {
    description: project.rows[0].description,
    category: project.rows[0].category,
    budget: project.rows[0].budget,
    intakeData: intakeAnswers.rows
  };
  
  const complexity = determineProjectComplexity(projectContext, intakeAnswers.rows);
  const intelligentCount = getIntelligentQuestionCount(trade.rows[0].code, projectContext, intakeAnswers.rows);
  
  // Lade das BESTEHENDE Prompt-Template für dieses Gewerk
  const questionPrompt = await getPromptForTrade(tradeId, 'questions');
  
  const systemPrompt = `Du bist ein Experte für ${trade.rows[0].name}.
Der Nutzer hat angegeben: "${contextAnswer}"

WICHTIG: Wende ALLE bestehenden Regeln aus dem System an:
- Erstelle ${intelligentCount.count} Fragen (Komplexität: ${complexity})
- Verwende das Standard-Template für ${trade.rows[0].code}
- ALLE gewerkespezifischen Regeln aus dem Code MÜSSEN beachtet werden

${questionPrompt ? `Template-Basis:\n${questionPrompt}` : ''}

OUTPUT als JSON-Array mit EXAKT ${intelligentCount.count} Fragen.`;
  
  try {
    const response = await llmWithPolicy('questions', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Erstelle detaillierte Folgefragen für: ${contextAnswer}` }
    ], { maxTokens: 10000, temperature: 0.5 });
    
    const cleaned = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    let questions = JSON.parse(cleaned);
    
    // Verwende BESTEHENDE Validierungslogik
    questions = validateTradeQuestions(trade.rows[0].code, questions, projectContext);
    questions = filterDuplicateQuestions(questions, intakeAnswers.rows);
    
    return Array.isArray(questions) ? questions : [];
    
  } catch (err) {
    console.error('[CONTEXT] Failed to generate adaptive questions:', err);
    return [];
  }
}
  
/**
 * Parst Fenster-Maßangaben aus Nutzer-Antwort
 */
function parseFensterMaße(antwortText) {
  const fensterTypen = [];
  
  // Pattern: "120x140" oder "120 x 140" oder "3 Stück 120x140"
  const matches = antwortText.matchAll(/(\d+)?\s*(?:stück|stk|x)?\s*(\d+)\s*x\s*(\d+)/gi);
  
  for (const match of matches) {
    const anzahl = match[1] ? parseInt(match[1]) : 1;
    const breite = parseInt(match[2]);
    const höhe = parseInt(match[3]);
    
    if (breite && höhe) {
      fensterTypen.push({
        anzahl,
        breite,
        höhe,
        beschreibung: `${breite} x ${höhe} cm`
      });
    }
  }
  
  // Fallback wenn keine Maße gefunden
  if (fensterTypen.length === 0) {
    console.log('[LV] Keine Fenstermaße in Antwort gefunden:', antwortText);
  }
  
  return fensterTypen;
}
async function generateDetailedLV(projectId, tradeId) {
  const project = (await query('SELECT * FROM projects WHERE id=$1', [projectId])).rows[0];
  if (!project) throw new Error('Project not found');
  
  const trade = (await query('SELECT id, name, code FROM trades WHERE id=$1', [tradeId])).rows[0];
  if (!trade) throw new Error('Trade not found');
  
  const tradeCode = trade.code;

  // NEU: Lade Projekt-Komplexität aus Metadata
  const projectMetadata = project.metadata ? 
    (typeof project.metadata === 'string' ? JSON.parse(project.metadata) : project.metadata) 
    : {};
  
  const projectComplexity = projectMetadata.complexity?.level || 
    determineProjectComplexity(project, []);
  
  console.log(`[LV] Project complexity for ${trade.code}: ${projectComplexity}`);
  
  // Lade alle relevanten Antworten
  const intTrade = (await query(`SELECT id FROM trades WHERE code='INT' LIMIT 1`)).rows[0];
  const intakeAnswers = intTrade
    ? (await query(
        `SELECT q.text as question, q.question_id, a.answer_text as answer, a.assumption
         FROM answers a
         JOIN questions q ON q.project_id = a.project_id 
           AND q.trade_id = a.trade_id 
           AND q.question_id = a.question_id
         WHERE a.project_id=$1 AND a.trade_id=$2
         ORDER BY q.question_id`,
        [projectId, intTrade.id]
      )).rows
    : [];
    
  const tradeAnswers = (await query(
    `SELECT 
       q.text as question, 
       q.question_id, 
       CASE 
         WHEN q.text ILIKE '%m²%' OR q.text ILIKE '%quadratmeter%' THEN 'm²'
         WHEN q.text ILIKE '%meter%' OR q.text ILIKE '% m %' THEN 'm'
         WHEN q.text ILIKE '%stück%' OR q.text ILIKE '%anzahl%' THEN 'Stk'
         WHEN q.text ILIKE '%stunde%' THEN 'h'
         WHEN q.text ILIKE '%kilogramm%' OR q.text ILIKE '% kg %' THEN 'kg'
         ELSE NULL
       END as unit,
       a.answer_text as answer, 
       a.assumption
     FROM answers a
     JOIN questions q ON q.project_id = a.project_id 
       AND q.trade_id = a.trade_id 
       AND q.question_id = a.question_id
     WHERE a.project_id=$1 AND a.trade_id=$2
     ORDER BY q.question_id`,
    [projectId, tradeId]
  )).rows;

  // Berechne Fragenanzahl
const answeredQuestionCount = tradeAnswers.length;

// NEU: Erweiterte Orientierungswerte mit Projekt-Context (NUR EINMAL!)
const orientation = getPositionOrientation(trade.code, answeredQuestionCount, {
    ...project,
    complexity: projectComplexity,
    description: project.description
});

// Override bei MITTEL, HOCH und SEHR_HOCH
if (projectComplexity === 'SEHR_HOCH' || projectComplexity === 'HOCH' || projectComplexity === 'MITTEL') {
  const MINIMUM_POSITIONS_BY_COMPLEXITY = {
    'SEHR_HOCH': 18,
    'HOCH': 15,
    'MITTEL': 12,
    'EINFACH': 8,
    'INTAKE': 0
  };
  
  const tradeComplexity = TRADE_COMPLEXITY[trade.code]?.complexity || 'MITTEL';
  const absoluteMinimum = MINIMUM_POSITIONS_BY_COMPLEXITY[tradeComplexity];
  
  if (orientation.min < absoluteMinimum) {
    orientation.min = absoluteMinimum;
    orientation.max = Math.max(absoluteMinimum + 10, orientation.max);
    console.log(`[LV] OVERRIDE for ${projectComplexity} project: ${trade.code} minimum positions: ${absoluteMinimum}`);
  }
} else {
  // Nur bei NIEDRIG und EINFACH: Keine Overrides
  console.log(`[LV] ${projectComplexity} project - using orientation values without override`);
}

console.log(`[LV] Final orientation for ${trade.code}: ${orientation.min}-${orientation.max} positions from ${answeredQuestionCount} questions`);

  // Nach Zeile ~1300, vor der LV-Generierung
if (projectMetadata.isManual || projectMetadata.isAiRecommended) {
  console.log(`[LV] Verstärkte Validierung für ${trade.code} - Gewerk ist manuell/AI-empfohlen`);
  
  // Sicherstellen dass ALLE bestehenden Regeln angewendet werden
  // Verwende die GLEICHEN Orientierungswerte wie bei erforderlichen Gewerken
  const enforcedOrientation = getPositionOrientation(trade.code, answeredQuestionCount, {
    ...project,
    complexity: projectComplexity,
    description: project.description
  });
  
  // Override falls zu wenige Positionen vorgesehen
  if (orientation.min < enforcedOrientation.min) {
    orientation.min = enforcedOrientation.min;
    orientation.max = enforcedOrientation.max;
    console.log(`[LV] Enforcing standard position count for ${trade.code}: ${orientation.min}-${orientation.max}`);
  }
  
  // Verwende EXAKT das gleiche Prompt-Template wie bei erforderlichen Gewerken
  const lvPrompt = await getPromptForTrade(tradeId, 'lv');
  if (!lvPrompt || lvPrompt.length < 100) {
    console.error(`[LV] KRITISCH: LV-Template fehlt für ${trade.code} - Abbruch`);
    throw new Error(`LV-Template für ${trade.name} nicht verfügbar`);
  }
  
  console.log(`[LV] Verwende Standard-LV-Template mit ${lvPrompt.length} Zeichen`);
}
  
  // NEU: Prüfe ob Gerüst als separates Gewerk vorhanden ist
  const hasScaffoldingTrade = await query(
    `SELECT 1 FROM project_trades pt 
     JOIN trades t ON t.id = pt.trade_id 
     WHERE pt.project_id = $1 AND t.code = 'GER'`,
    [projectId]
  );
  const hasGeruestGewerk = hasScaffoldingTrade.rows.length > 0;

  // NEU: Füge Gerüst-Vorbemerkung für betroffene Gewerke hinzu
  let additionalVorbemerkungen = [];
  if (hasGeruestGewerk && ['DACH', 'FASS', 'FEN'].includes(trade.code)) {
    additionalVorbemerkungen.push('Gerüst wird bauseits gestellt');
    additionalVorbemerkungen.push('Gerüstkosten sind in separatem Gewerk erfasst');
  }

  // NEU: Lade ALLE Intake-Antworten mit Zahlen/Maßen
  const intakeResponses = await query(
    `SELECT question_text, answer_text 
     FROM intake_responses
     WHERE project_id = $1`,
    [projectId]
  );
  
  // NEU: Extrahiere ALLE Zahlen- und Maßangaben
  const criticalMeasurements = {};
  
  intakeResponses.rows.forEach(response => {
    const question = response.question_text.toLowerCase();
    const answer = response.answer_text;
    
    // Suche nach Zahlen mit Einheiten
    const measurementMatch = answer.match(/(\d+(?:\.\d+)?)\s*(m²|qm|m2|m|stück|stk)/i);
    
    if (measurementMatch) {
    // Speichere nach Kategorie
    if (question.includes('dach')) {
      criticalMeasurements.dachflaeche = {
        value: parseFloat(measurementMatch[1]),
        unit: measurementMatch[2],
        original: answer,
        source: 'intake'
      };
    }
    if (question.includes('fassade')) {
      criticalMeasurements.fassadenflaeche = {
        value: parseFloat(measurementMatch[1]),
        unit: measurementMatch[2],
        original: answer,
        source: 'intake'
      };
    }
  }  // <-- DIESE KLAMMER FEHLT (schließt if measurementMatch)
});  // <-- DIESE KLAMMER FEHLT (schließt forEach)

// FASS-spezifisch: Extrahiere Dämmstärke
if (trade.code === 'FASS') {
  tradeAnswers.forEach(answer => {
    const question = answer.question.toLowerCase();
    const answerText = answer.answer;
    
    if (question.includes('dämmstärke') || question.includes('dämmung') || 
        question.includes('wärmedämmung') || question.includes('stärke')) {
      
      let daemmstaerke = null;
      
      // Suche ALLE Zahlen im Text
      const allNumbers = answerText.match(/\d+/g);
      
      if (allNumbers && allNumbers.length > 0) {
        // Nimm die erste gültige Dämmstärke (10-30cm)
        for (const num of allNumbers) {
          const value = parseInt(num);
          if (value >= 10 && value <= 30) {
            daemmstaerke = value;
            break;
          }
        }
      }
      
      if (daemmstaerke) {
        // Auf gerade Zahl runden
        if (daemmstaerke % 2 !== 0) {
          daemmstaerke = daemmstaerke + 1;
        }
        
        criticalMeasurements.daemmstaerke = {
          value: daemmstaerke,
          unit: 'cm',
          original: answerText,
          source: 'trade_answers'
        };
        
        console.log(`[FASS] Dämmstärke ${daemmstaerke}cm aus: "${answerText}"`);
      }
    }
  });
}

// GER-spezifisch: Berechne Gerüstfläche aus Fassadenfläche
if (trade.code === 'GER') {
  // Suche Fassadenfläche in Intake oder Trade-Antworten
  let fassadenflaeche = criticalMeasurements.fassadenflaeche?.value;
  
  if (!fassadenflaeche) {
    // Suche in Trade-Antworten
    tradeAnswers.forEach(answer => {
      const question = answer.question.toLowerCase();
      const answerText = answer.answer;
      
      if (question.includes('fassade') && question.includes('fläche')) {
        const flaecheMatch = answerText.match(/(\d+(?:\.\d+)?)\s*(m²|qm|m2)/i);
        if (flaecheMatch) {
          fassadenflaeche = parseFloat(flaecheMatch[1]);
        }
      }
    });
  }
  
  if (fassadenflaeche) {
    // Gerüstfläche = Fassadenfläche * 1.1 (10% Zuschlag)
    const geruestflaeche = Math.round(fassadenflaeche * 1.1);
    
    criticalMeasurements.geruestflaeche = {
      value: geruestflaeche,
      unit: 'm²',
      original: `Berechnet aus Fassadenfläche ${fassadenflaeche}m² + 10% Zuschlag`,
      source: 'calculated'
    };
    
    console.log(`[GER] Gerüstfläche berechnet: ${fassadenflaeche}m² * 1.1 = ${geruestflaeche}m²`);
  }
}
  
  // Validiere und schätze fehlende Werte
  const validationResult = await validateAndEstimateAnswers(
    tradeAnswers,
    trade.code,
    {
      category: project.category,
      description: project.description,
      intakeAnswers
    }
  );

  const lvPrompt = await getPromptForTrade(tradeId, 'lv');
  if (!lvPrompt) throw new Error('LV prompt missing for trade');

  // SICHERSTELLEN dass Prompt korrekt geladen wurde
if (!lvPrompt || lvPrompt.length < 100) {
  console.error(`[LV] WARNING: LV prompt for ${trade.code} missing or too short!`);
  console.error(`[LV] Prompt length: ${lvPrompt?.length || 0}`);
}

// DEBUG: Prüfe ob Prompt korrekte Preisinformationen enthält
if (trade.code === 'GER' && lvPrompt) {
  const hasCorrectPrices = lvPrompt.includes('8-12') || lvPrompt.includes('Auf-/Abbau');
  if (!hasCorrectPrices) {
    console.error(`[LV] WARNING: Gerüst prompt missing price information!`);
  }
}

const universalLVRules = `
╔════════════════════════════════════════════════════════════════╗
║ UNIVERSELLE LV-REGELN FÜR ALLE GEWERKE                        ║
╚════════════════════════════════════════════════════════════════╝

PREISE IN BESCHREIBUNGEN - ABSOLUT VERBOTEN:
❌ NIEMALS Preisspannen: "Premium (400-1000€)", "Standard (50-150€)"  
❌ NIEMALS Preisangaben: "hochwertig (ab 500€)", "günstig (unter 100€)"
✅ NUR Qualitätsbeschreibung: "Premium-Qualität", "Standardausführung"

QUALITÄT MUSS ZUM EP PASSEN:
- EP < 100€ → "Standard" oder keine Qualitätsangabe
- EP 100-250€ → "Solide Qualität"
- EP 250-500€ → "Gehobene Qualität"  
- EP > 500€ → "Premium-Qualität"

NIEMALS "Premium" bei niedrigen Preisen!
NIEMALS "Standard" bei hohen Preisen!

Der PREIS definiert die Qualität, NICHT umgekehrt!
`;
  
  const systemPrompt = `Du bist ein Experte für VOB-konforme Leistungsverzeichnisse mit 25+ Jahren Erfahrung.
Erstelle ein PRÄZISES und REALISTISCHES Leistungsverzeichnis für ${trade.name}.

STRIKTE REGEL: Du MUSST zwischen ${orientation.min} und ${orientation.max} Positionen erstellen.
NICHT WENIGER ALS ${orientation.min}, NICHT MEHR ALS ${orientation.max}!

PROJEKT-KOMPLEXITÄT: ${projectComplexity}

📋 POSITIONS-ANFORDERUNG: ${orientation.min}-${orientation.max} Positionen

${Object.keys(criticalMeasurements).length > 0 ? `
KRITISCHE VORGABEN AUS INTAKE (MÜSSEN EXAKT ÜBERNOMMEN WERDEN):
${Object.entries(criticalMeasurements).map(([key, data]) => 
  `- ${key}: ${data.value} ${data.unit} (Nutzerangabe: "${data.original}")`
).join('\n')}

STRIKTE REGEL: 
- Diese Werte MÜSSEN EXAKT in den LV-Positionen verwendet werden
- KEINE Anpassungen, Rundungen oder "Sicherheitszuschläge"
- Bei Dachfläche 120m² MUSS im LV auch 120m² stehen
- Wenn der Nutzer "ca." oder "ungefähr" sagt, verwende trotzdem den genannten Wert
` : ''}

${universalLVRules}

KRITISCHE REGELN:
1. Erstelle ${orientation.min} bis ${orientation.max} ECHTE Positionen mit tatsächlichen Leistungen
2. NIEMALS leere, "nicht vorhanden" oder "nicht definiert" Positionen
3. NIEMALS Positionen mit Menge 0, "-" oder ohne Preis
4. NUR Arbeiten die tatsächlich ausgeführt werden
5. Bei Bedarf: Unterschreitung um max. 30% erlaubt (Minimum: ${Math.floor(orientation.min * 0.7)} Positionen)

${projectComplexity === 'SEHR_HOCH' ? `
🔴 SEHR HOHE KOMPLEXITÄT:
- Ziel: ${orientation.min}-${orientation.max} sinnvolle Positionen
- Mindestens: ${Math.floor(orientation.min * 0.7)} Positionen (30% Toleranz)
- Detaillierte Aufschlüsselung wo sinnvoll
- Zusammenfassung ähnlicher Arbeiten erlaubt
- Fokus auf Vollständigkeit und Qualität
` : projectComplexity === 'HOCH' ? `
🟡 HOHE KOMPLEXITÄT:
- Ziel: ${orientation.min}-${orientation.max} sinnvolle Positionen
- Mindestens: ${Math.floor(orientation.min * 0.7)} Positionen (30% Toleranz)
- Ausgewogene Detaillierung
- Wichtige Leistungen einzeln erfassen
` : projectComplexity === 'MITTEL' ? `
🟢 MITTLERE KOMPLEXITÄT:
- Ziel: ${orientation.min}-${orientation.max} Positionen
- Mindestens: ${Math.floor(orientation.min * 0.7)} Positionen (30% Toleranz)
- Standarddetaillierung mit sinnvollen Zusammenfassungen
` : `
⚪ STANDARD-PROJEKT:
- Ziel: ${orientation.min}-${orientation.max} Positionen
- Mindestens: ${Math.floor(orientation.min * 0.7)} Positionen (30% Toleranz)
- Kompakte, praxisgerechte Darstellung
`}

VERBOTENE POSITIONEN (WERDEN AUTOMATISCH ENTFERNT):
❌ Positionen mit "(nicht vorhanden)", "(nicht enthalten)", "(nicht definiert)"
❌ Positionen mit Menge = 0, "-" oder ohne Menge
❌ Positionen ohne reale Leistung
❌ Künstliche Positionen nur zur Mengenerhöhung
❌ Doppelte/redundante Positionen

ERLAUBT:
✅ Sinnvolle Zusammenfassung ähnlicher Arbeiten
✅ Unterschreitung der Vorgabe um bis zu 20% wenn nötig
✅ Fokus auf realistische, ausführbare Leistungen

Ziel: Ein vollständiges, realistisches LV ohne künstliche Aufblähung

KRITISCHE ANFORDERUNGEN FÜR PRÄZISE LV-ERSTELLUNG:

1. NUR ERFRAGTE POSITIONEN:
   - Erstelle NUR Positionen für explizit erfragte und beantwortete Leistungen
   - KEINE erfundenen Positionen oder Annahmen
   - Wenn eine Leistung nicht erfragt wurde, darf sie NICHT im LV erscheinen

2. MENGENERMITTLUNG:
   - Verwende NUR die validierten Mengen aus den Antworten
   - Bei geschätzten Werten: Kennzeichne dies in den Notes
   - Plausibilitätsprüfung aller Mengen

3. PREISKALKULATION (2024/2025):
   - Realistische Marktpreise
   - Regionale Unterschiede berücksichtigen
   - Inkl. aller Nebenleistungen gem. VOB/C

4. TECHNISCH SINNVOLLE POSITIONIERUNG & ORIENTIERUNG:
   - Erfasste Informationen: ${answeredQuestionCount} beantwortete Fragen
   - Orientierungs-Richtwert: ca. ${orientation.min}-${orientation.max} Positionen
   - Diese Zahl ist KEINE strikte Vorgabe, sondern eine ORIENTIERUNG
   - Maßgeblich ist die TECHNISCH SINNVOLLE Aufteilung

   KRITISCHE REGEL FÜR BAUTEILE MIT ABMESSUNGEN:
   - UNTERSCHIEDLICHE Abmessungen = IMMER separate Positionen
   - GLEICHE Abmessungen = IMMER in einer Position mit erhöhter Stückzahl
   
   Beispiele RICHTIG:
   - "3 Stk. Fenster Kunststoff weiß, 120x140cm, DIN rechts" (gleiche Maße)
   - "1 Stk. Fenster Kunststoff weiß, 180x140cm, DIN rechts" (andere Maße = neue Position)
   - "5 Stk. Innentüren Weißlack 86x198,5cm inkl. Zarge" (gleiche Maße)
   - "2 Stk. Innentüren Weißlack 96x198,5cm inkl. Zarge" (andere Breite = neue Position)
   
   Beispiele FALSCH:
   - "Fenster verschiedene Größen" (zu unspezifisch)
   - Gleiche Fenster in mehreren Positionen aufteilen
   - Verschiedene Türmaße in einer Position zusammenfassen
   
   GILT FÜR ALLE BAUTEILE wo Maße kalkulationsrelevant sind:
   - Fenster, Türen, Zargen
   - Heizkörper
   - Sanitärobjekte (Waschbecken, WCs, Duschwannen)
   - Fliesen (verschiedene Formate)
   - Treppen, Geländer
   - Alle vorgefertigten Bauteile mit definierten Abmessungen
   
   Zusammengehörende Arbeiten ohne Maßrelevanz in EINER Position:
   - Flächenarbeiten (Malerarbeiten, Putz, Estrich)
   - Installationsarbeiten (sofern nicht bauteilbezogen)
   - Demontagearbeiten gleicher Art

5. GEWERKEABGRENZUNG & DUPLIKATSVERMEIDUNG:
   - KRITISCH: Prüfe ALLE anderen Gewerke auf Überschneidungen
   - STRIKTE ZUORDNUNGEN:
   - Fliesenarbeiten → IMMER UND AUSSCHLIESSLICH im Gewerk FLI
   - Türen und Zargen → IMMER UND AUSSCHLIESSLICH im Gewerk TIS
   - Rigips-/Gipskartonwände → IMMER UND AUSSCHLIESSLICH im Gewerk TRO
   - Putzqualitäten Q1-Q3 → NUR bei Innenarbeiten im Gewerk MAL
   - Fassadenputz → NUR Struktur/Körnung im Gewerk FASS (keine Q-Stufen)
   - Bodenbeläge wie Parkett/Laminat/Vinyl → NUR im Gewerk BOD (nie Fliesen!)
   - Wanddurchbruch: NUR im beauftragten Hauptgewerk (Rohbau ODER Abbruch, nie beide)
   - Gerüstbau: Wenn als eigenes Gewerk -> KEINE Gerüstpositionen in anderen Gewerken
   - Elektro-/Sanitärschlitze: NUR im jeweiligen Fachgewerk, nicht im Rohbau oder Abbruch
   - Entsorgung: Pro Material nur in EINEM Gewerk ausschreiben
   - Bei Überschneidungsgefahr: Leistung dem primär verantwortlichen Gewerk zuordnen
   
6. GEWERKE-HIERARCHIE (bei Konflikten):
   1. Spezialisierte Gewerke haben Vorrang (z.B. Gerüstbau vor Fassade)
   2. Abbruch vor Neubau
   3. Rohbau vor Ausbau
   4. Hauptleistung vor Nebenleistung
   
7. VOB-KONFORME VORBEMERKUNGEN:
   - Erstelle aus den Intake-Daten technische Vorbemerkungen
   - Diese müssen VOR den Positionen stehen
   - Inhalt: Baustellenlogistik, Gebäudedaten, Arbeitszeiten, besondere Bedingungen
   - Format: Array von Strings im "vorbemerkungen" Feld

8. SPEZIELLE FENSTER-REGELN (NUR für Gewerk FEN):
   ${tradeCode === 'FEN' ? `
   KRITISCH: ÜBERNIMM EXAKT DIE NUTZER-ANGABEN!
   - Lieferung und Montage IMMER in EINER Position pro Fenstertyp
   - DEMONTAGE: NUR EINE Sammelposition für ALLE Altfenster
   - Reihenfolge: Erst Demontage, dann neue Fenster   
   - Wenn Nutzer "Holzfenster" wählt → NUR Holzfenster im LV
   - Wenn Nutzer "Kunststofffenster" wählt → NUR Kunststofffenster im LV
   - KEINE Standard-Annahmen die den Nutzer-Angaben widersprechen!
   
   - JEDES Fenster MUSS als EIGENE Position mit EXAKTEN Abmessungen
   - Format: "Fenster [GEWÄHLTES MATERIAL], [Breite] x [Höhe] cm, [Öffnungsart]"
   - NIEMALS Sammelpositionen wie "6 Fenster" ohne Einzelaufstellung
   - NIEMALS m² oder Pauschalangaben
   - Gleiche Fenstertypen: Als eine Position mit Stückzahl
   
   BEISPIEL KORREKT:
   - Pos 1: Demontage und Entsorgung sämtlicher Altfenster, 5 Stück
   - Pos 2: Fenster [NUTZER-MATERIAL], 120 x 140 cm, Dreh-Kipp, 2 Stück
   - Pos 3: Fenster [NUTZER-MATERIAL], 60 x 80 cm, Kipp, 3 Stück
   
   BEISPIEL FALSCH:
   - "Demontage Fenster 1" ❌
   - "Demontage Fenster 2" ❌
   - "Entsorgung Fenster" ❌   
   - "Einbau von 6 Fenstern" ❌
   - "Fenster gesamt 25 m²" ❌
   - Falsches Material verwenden ❌
   ` : ''}

  9. LIEFERUNG UND MONTAGE IMMER ZUSAMMEN:
   - NIEMALS getrennte Positionen für Lieferung und Montage
   - IMMER: "Lieferung und [Verb]" in EINER Position
   - NIEMALS: Lieferung und Demontage im Gewerk ABBR (Abbruch/Entkernung)
   - NIEMALS: Lieferung und Montage bei Rückbau- und Demontagearbeiten in allen Gewerken
   
   KORREKTE FORMULIERUNGEN:
   - "Lieferung und Verlegung von Dachziegeln..."
   - "Lieferung und Montage Fenster Kunststoff, 120x140cm, Dreh-Kipp..."
   - "Lieferung und Montage von Heizkörpern..."
   - "Lieferung und Installation von Sanitärobjekten..."
   - "Lieferung und Verlegen von Fliesen..."
   
   FALSCH:
   - "Verlegung von Dachziegeln..." (fehlt Lieferung!)
   - "Einbau von Fenstern..." (fehlt Lieferung!)
   - Pos 1: "Lieferung Dachziegel", Pos 2: "Verlegung Dachziegel"
   
   AUSNAHMEN (OHNE "Lieferung"):
   - Reine Arbeitsleistungen: "Abbruch...", "Demontage...", "Reinigung..."
   - Vorhandenes Material: "Wiederverwendung vorhandener..."
   - Nebenleistungen: "Abdichtung...", "Anschluss...", "Verfugung..."
   
   KRITISCH: Bei JEDEM einzubauenden Material in JEDEM Gewerk MUSS "Lieferung und" vorangestellt werden!

10. REALISTISCHE PREISE ZWINGEND:
    - Putzarbeiten: 25-60€/m² oder 30-80€/m
    - Fenster komplett: 400-4000€/Stück (inkl. Montage)
    - Türen komplett: 600-6000€/Stück (inkl. Montage)
    - NIEMALS über 200€/m für einfache Arbeiten
    - NIEMALS über 100€/m² für Standard-Arbeiten

11. STRIKTE GEWERKE-TRENNUNG:
    - Fenster (normale) → NUR im Gewerk FEN
    - Dachfenster → NUR im Gewerk DACH
    - NIEMALS Annahmen treffen die nicht explizit genannt wurden
    - Bei "5 Fenster" im Projekt + Dach-Gewerk → KEINE Dachfenster annehmen!

KRITISCHE VERBOTE - NIE VERWENDEN:
1. "Lieferung und Demontage" - IMMER TRENNEN in:
   - "Demontage und Entsorgung" (eigene Position)
   - "Lieferung und Montage" (eigene Position)

2. Vorwandinstallation:
   - NUR bei Gewerk TROCKENBAU (TRO) erlaubt
   - Bei SANITÄR (SAN): Verwende "Unterputz-Installation"
   - Bei anderen Gewerken: GAR NICHT erwähnen

3. Korrekte Formulierungen:
   ✓ "Lieferung und Montage"
   ✓ "Demontage und Entsorgung"
   ✗ "Lieferung und Demontage" (FALSCH!)
   
4. Gewerke-Abgrenzung:
   - Vorwand = IMMER Trockenbau
   - Sanitärinstallation in Vorwand = Zwei Gewerke:
     * TRO: Vorwandinstallation erstellen
     * SAN: Sanitärobjekte montieren

// Trade-spezifische Ergänzung
const tradeSpecificRules = {
  'FEN': 'KEINE Dachfenster - nur normale Wandfenster!',
  'DACH': 'Dachfenster JA, normale Fenster NEIN!',
  'SAN': 'KEINE Vorwandinstallation - nur Sanitärobjekte!',
  'TRO': 'Vorwandinstallation JA, aber KEINE Sanitärobjekte!'
};

  ${hasGeruestGewerk && ['DACH', 'FASS', 'FEN'].includes(trade.code) ? `
KRITISCH - GERÜST-REGEL:
- Gerüst ist als SEPARATES Gewerk vorhanden
- KEINE Gerüstpositionen in diesem LV
- Vorbemerkung hinzufügen: "Gerüst wird bauseits gestellt"
- Alle Gerüstkosten sind im Gewerk GER erfasst
` : ''}

${trade.code === 'GER' ? `
KRITISCH FÜR GERÜSTBAU - STRIKTE REGELN:

${criticalMeasurements.geruestflaeche ? `
GERÜSTFLÄCHE - VERBINDLICH:
- EXAKTE GERÜSTFLÄCHE: ${criticalMeasurements.geruestflaeche.value} m²
- Berechnung: Fassadenfläche + 10% Sicherheitszuschlag
- Diese Fläche MUSS in allen Positionen verwendet werden
` : ''}

PFLICHT-POSITIONEN (GENAU DIESE STRUKTUR):
1. "Lieferung, Auf- und Abbau Arbeitsgerüst" - ${criticalMeasurements.geruestflaeche?.value || '[Fläche]'} m² - 8-12 €/m²
2. "Gerüst-Standzeit erste 4 Wochen" - ${criticalMeasurements.geruestflaeche?.value || '[Fläche]'} m² - 4-6 €/m²
3. "Gerüst-Standzeit jede weitere Woche (Eventualposition)" - ${criticalMeasurements.geruestflaeche?.value || '[Fläche]'} m² - max. 1,20 €/m² - MUSS als NEP markiert sein!
4. "Schutznetz/Plane" - ${criticalMeasurements.geruestflaeche?.value || '[Fläche]'} m² - 2-3 €/m² (optional)

VERBOTEN:
- KEINE separate Position "An- und Abtransport" (ist in Pos. 1 enthalten!)
- KEINE höhere Fläche als berechnet
- KEINE Transportkosten als eigene Position

EVENTUALPOSITION (NEP):
Die Position "Gerüst-Standzeit jede weitere Woche" MUSS:
- Als Eventualposition (NEP) markiert werden: "isNEP": true
- Einheitspreis maximal 1,20 €/m²
- NICHT in die Hauptsumme einfließen
- Mit Hinweis "Abrechnung nach tatsächlichem Bedarf"

REALISTISCHE PREISE:
- Auf-/Abbau inkl. Transport: 8-12 €/m²
- Standzeit erste 4 Wochen: 4-6 €/m²
- Jede weitere Woche (NEP): max. 1,20 €/m²
- Schutznetz: 2-3 €/m²
` : ''}

${trade.code === 'ROH' ? `
KRITISCH FÜR ROHBAUARBEITEN:
1. KLARE ABGRENZUNG - ROHBAU macht NUR:
   - Fundamente, Bodenplatte, Kellerwände
   - Tragende Wände (Mauerwerk, Beton, Stahlbeton)
   - Rohdecken (Betondecken, Filigrandecken)
   - Stürze, Ringanker, Betonstützen
   - Treppen (Rohbau, nicht Ausbau)
   - Verstärkung/Ertüchtigung von BESTANDSMAUERWERK
   - Statisch relevante Wanddurchbrüche
   - Anschlüsse AN Bestandsmauerwerk
   
2. NIEMALS IM ROHBAU:
   - KEIN Estrich (gehört zu Gewerk ESTR)
   - KEINE Dämmung unter Estrich
   - KEIN Holzbau (→ ZIMM)
   - KEINE Holzständerwände (→ ZIMM)
   - KEINE Holzbalkendecke (→ ZIMM)
   - KEINE Dachkonstruktion (→ ZIMM)   
   - KEINE Trittschalldämmung 
   - KEINE Bodenbeläge
   - KEINE Putze (gehört zu MAL oder FASS)
   - KEINE Abdichtungen (außer Bodenplatte, Kellerwände)

3. HÄUFIGE FEHLER VERMEIDEN:
   - "Estrich" → FALSCH! Rohbau macht nur Rohdecke
   - "Fließestrich" → FALSCH! Gehört zu ESTR
   - "Dämmung unter Estrich" → FALSCH! Gehört zu ESTR
   - "Innenputz" → FALSCH! Gehört zu MAL

4. KORREKTE POSITIONEN:
   - "Stahlbetondecke d=20cm"
   - "Filigrandecke verlegen"
   - "Mauerwerk erstellen, 24cm Poroton"
   - "Ringanker betonieren"
   - "Betonstützen 30x30cm"

5. BEI DEMONTAGE/ABBRUCH:
   - Wanddurchbrüche gehören zu ROH
   - Deckendurchbrüche gehören zu ROH
   - Abbruch tragender Teile gehört zu ROH
   - Nicht-tragende Wände → Gewerk TRO oder ABBR

6. BEI AUFSTOCKUNG IN HOLZBAUWEISE:
   - Rohbau macht NUR: Verstärkung Bestandsmauerwerk, Ringanker aus Beton
   - Zimmerer macht: KOMPLETTE Holzkonstruktion der Aufstockung
   - KEINE Vermischung der Gewerke!

WENN HOLZBAU ERWÄHNT WIRD:
→ Schreibe: "Holzbauarbeiten siehe Gewerk ZIMMERER"
→ KEINE Holz-Positionen im Rohbau-LV!
` : ''}

${trade.code === 'HEI' ? `
KRITISCH FÜR HEIZUNGSARBEITEN:

1. HEIZLASTBERECHNUNG IMMER ZUERST FRAGEN:
   - "Liegt eine Heizlastberechnung vor?"
   - Wenn JA: Nach berechneten Leistungen fragen
   - Wenn NEIN: Nach Raumgrößen fragen, "gemäß Heizlastberechnung" ins LV

2. FUSSBODENHEIZUNG - EXKLUSIVE ZUSTÄNDIGKEIT:
   ✅ IMMER im Heizungs-LV:
   - Fußbodenheizung komplett
   - Heizrohre/Heizkreise verlegen
   - Verteiler für FBH inkl. Durchflussmesser
   - Systemplatten/Noppenplatten/Tackerplatten
   - Heizkreise anschließen und regulieren
   - Befüllung und Druckprobe FBH
   - Heizkreisverteiler inkl. Stellantriebe
   
   ❌ NIEMALS im Heizungs-LV:
   - Estrich (gehört zu ESTR)
   - Dämmung unter Estrich (gehört zu ESTR)
   - Randdämmstreifen (gehört zu ESTR)
   
   KORREKTE FORMULIERUNGEN:
   - "Lieferung und Verlegung Fußbodenheizung, Noppenplatte"
   - "FBH-Verteiler 8 Kreise inkl. Durchflussmesser"
   - NICHT: "Heizestrich" (das macht ESTR)
` : ''}

${trade.code === 'ESTR' ? `
KRITISCH FÜR ESTRICHARBEITEN:
1. ESTRICH KOMMT NACH ROHBAU:
   - Rohdecke muss fertig sein
   - Elektro/Sanitär-Leitungen verlegt
   - Innenputz idealerweise fertig

2. ESTRICH-POSITIONEN:
   - Dämmung unter Estrich
   - Trittschalldämmung
   - Randdämmstreifen
   - Fließestrich/Zementestrich/Anhydritestrich
   - Estrich schleifen
   - KEINE Rohdecken oder Betonarbeiten!

3. FUSSBODENHEIZUNG - KLARE ABGRENZUNG:
   ❌ NIEMALS "Fußbodenheizung verlegen" im Estrich-LV!
   ❌ NIEMALS "Heizrohre verlegen" oder "Heizkreise"!
   ✅ NUR "Heizestrich" oder "Estrich auf Fußbodenheizung"
   
   Die Fußbodenheizung selbst = IMMER Gewerk HEIZUNG
   Der Estrich darüber = Gewerk ESTRICH
   
   KORREKTE FORMULIERUNG:
   - "Heizestrich auf vorhandener Fußbodenheizung"
   - "Estrich schwimmend auf FBH-System"
   - NICHT: "inkl. Fußbodenheizung"!

4. MENGENERMITTLUNG:
   - Fläche = Bodenfläche der Räume
   - NICHT Deckenfläche (das ist Rohbau)
   - Dämmung = gleiche Fläche wie Estrich
` : ''}

${trade.code === 'SAN' ? `
KRITISCH FÜR SANITÄR:
HAUPTREGEL:
- Vorwandinstallation → IMMER Trockenbau (TRO)
- SAN macht NUR Sanitärobjekte, Anschlüsse und Leitungen
- Elektrische Handtuchheizkörper → SAN (da Sanitärobjekt)
REIHENFOLGE:
1. Rohinstallation (vor Fliesen)
2. Fliesenleger macht Fliesen
3. Endmontage (nach Fliesen)
NICHT VON SAN:
- Elektrische Fußbodenheizung → ELEKT oder FLI
` : ''}

${trade.code === 'ELEKT' ? `
KRITISCH FÜR ELEKTRO:
HAUPTREGEL:
- Schlitze in Wänden → IMMER Elektroinstallation selbst, nie Rohbau (ROH)
- Endmontage → IMMER nach Malerarbeiten
- FI-Schutzschalter Bad → PFLICHT
- Elektrische Fußbodenheizung → ELEKT macht Anschluss + Thermostat
SCHNITTSTELLEN:
- PV: Elektro macht AC-Seite, PV macht DC-Seite
- Heizung: Elektro macht Stromanschluss für Kessel/Wärmepumpe
- Bad: FI-Schutzschalter + Potentialausgleich
- Fußbodenheizung elektrisch: ELEKT (Anschluss) oder FLI (Komplett inkl. Verlegung)
- Handtuchheizkörper elektrisch: Stromanschluss von ELEKT, Gerät von SAN
` : ''}

${trade.code === 'FLI' ? `
KRITISCH FÜR FLIESENLEGER:
HAUPTREGEL:
- Elektrische Fußbodenheizung → FLI kann komplett machen (nach Estrich, vor Fliesen)
- Alternative: ELEKT macht Anschluss, FLI verlegt Heizmatten
REIHENFOLGE:
1. Estrich fertig
2. Elektrische Fußbodenheizung verlegen (falls vorhanden)
3. Fliesen verlegen
` : ''}

${trade.code === 'DACH' ? `
KRITISCH FÜR DACHARBEITEN:
- NUR Dachfenster wenn EXPLIZIT "Dachfenster" erwähnt
- Bei "Fenster" im Projekt → Das sind NORMALE Fenster (Gewerk FEN)
- KEINE Annahmen über nicht erwähnte Leistungen
- Fokus auf: Dämmung, Eindeckung, Abdichtung, Rinnen
` : ''}

${trade.code === 'FASS' ? `
KRITISCH FÜR FASSADENARBEITEN:

DÄMMSTÄRKE - ABSOLUT VERBINDLICH:
${criticalMeasurements.daemmstaerke ? `
- EXAKTE DÄMMSTÄRKE: ${criticalMeasurements.daemmstaerke.value} cm
- Diese Stärke MUSS in ALLEN Dämmpositionen verwendet werden
- KEINE Abweichungen erlaubt!
- Nutzerangabe war: "${criticalMeasurements.daemmstaerke.original}"
` : ''}

WICHTIG:
- NUR gerade Dämmstärken verwenden (10, 12, 14, 16, 18, 20 cm)
- Ungerade Zahlen sind NICHT handelsüblich
- Bei ungeraden Angaben: Auf nächste gerade Zahl aufrunden
- Die angegebene Dämmstärke MUSS exakt übernommen werden
- Sockeldämmung immer 2 cm dünner als WDVS

BEISPIEL KORREKT:
- "Lieferung und Montage WDVS, EPS WLG 035, ${criticalMeasurements.daemmstaerke?.value || 16} cm"

BEISPIEL FALSCH:
- "WDVS, 15 cm" (ungerade Zahl!)
- Andere Stärke als angegeben verwenden
` : ''}

${trade.code === 'TIS' ? `
KRITISCH FÜR TÜRARBEITEN:
1. DEMONTAGE/ENTSORGUNG:
   - NUR EINE Sammelposition für ALLE Demontagen
   - Format: "Demontage und Entsorgung sämtlicher Alttüren, [X] Stück"
   - NICHT einzeln aufführen!
   
2. NEUE TÜREN:
   - Jede unterschiedliche Größe = eigene Position
   - IMMER "Lieferung und Montage" in EINER Position
   - KEINE separaten Montage-Positionen wenn bereits in "Lieferung und Montage" enthalten
   
3. REALISTISCHE PREISE:
   - Demontage + Entsorgung: 60-100€ pro Tür
   - Innentür Standard (inkl. Montage): 400-800€
   - Wohnungstür Sicherheit: 1500-3000€
   - Beschläge Innentür: 60-150€
   - NIEMALS alle Positionen mit gleichem Preis!
` : ''}

${trade.code === 'SCHL' ? `
KRITISCH FÜR GELÄNDER:
- Jedes Geländer MUSS als einzelne "Lieferung und Montage" Position ausgeschrieben werden
- Format: "Lieferung und Montage [Typ]geländer [Material] [Länge]"
- KEINE separaten Positionen für:
  - Werkstattfertigung
  - Produktion
  - Füllungen/Metallstäbe
  - Verzinkung (außer Pulverbeschichtung als Zusatz)
  - Montage ohne Lieferung
- Diese Leistungen sind in der Hauptposition "Lieferung und Montage" enthalten
- Erlaubte Zusatzpositionen: Demontage Alt, Entsorgung, Pulverbeschichtung, Verankerung, Zusatz- und Nebenarbeiten!
` : ''}

OUTPUT FORMAT (NUR valides JSON):
{
  "trade": "${trade.name}",
  "tradeCode": "${trade.code}",
  "vorbemerkungen": [
    "Gebäudedaten und Baustellensituation aus Projekterfassung",
    "Zufahrt und Lagerungsmöglichkeiten",
    "Verfügbare Anschlüsse",
    "Arbeitszeiten und Einschränkungen"
  ],
  "projectType": "string",
  "dataQuality": {
    "measuredValues": 15,
    "estimatedValues": 3,
    "confidence": 0.85
  },
  "positions": [
    // KRITISCH: EXAKT ${orientation.min} bis ${orientation.max} POSITIONEN
    // NICHT WENIGER, NICHT MEHR!
    { 
      "pos": "01.01.001",
      "title": "Präziser Positionstitel",
      "description": "Detaillierte VOB-konforme Beschreibung mit Material, Ausführung, Qualität, Normen. Min. 2-3 Sätze.",
      "quantity": 150.00,
      "unit": "m²",
      "unitPrice": 45.50,
      "totalPrice": 6825.00,
      "priceBase": "Marktpreis 2024 inkl. Nebenleistungen",
      "dataSource": "measured|estimated|assumed",
      "notes": "Hinweise zu Annahmen"
    }
  ],
  "positionCount": ${orientation.max}, // MAXIMAL ERLAUBTE ANZAHL
  "totalSum": 0,
  "additionalNotes": "Wichtige Ausführungshinweise",
  "assumptions": ["Liste aller getroffenen Annahmen"],
  "excludedServices": ["Explizit nicht enthaltene Leistungen"],
  "priceDate": "${new Date().toISOString().split('T')[0]}",
  "validUntil": "3 Monate",
  "executionTime": "Geschätzte Ausführungsdauer"
}`;

// Cross-Check Funktion zur Duplikatsprüfung
async function checkForDuplicatePositions(projectId, currentTradeId, positions) {
  const otherLVs = await query(
    `SELECT t.name as trade_name, t.code as trade_code, l.content 
     FROM lvs l 
     JOIN trades t ON l.trade_id = t.id 
     WHERE l.project_id = $1 AND l.trade_id != $2`,
    [projectId, currentTradeId]
  );
  
  const duplicates = [];
  const criticalKeywords = [
    'Wanddurchbruch', 'Durchbruch', 
    'Gerüst', 'Arbeitsgerüst', 'Fassadengerüst',
    'Container', 'Baustelleneinrichtung',
    'Entsorgung', 'Abtransport', 'Abfuhr'
  ];
  
  for (const pos of positions) {
    for (const lv of otherLVs.rows) {

  // NEUE ZEILEN HIER EINFÜGEN:
  if (!lv.content || lv.content === '[object Object]') {
    console.log('[checkForDuplicatePositions] Skipping invalid LV content');
    continue;
  }
  
  let otherContent;
  try {
    otherContent = JSON.parse(lv.content);  // Original Zeile 1615
  } catch (error) {
    console.log('[checkForDuplicatePositions] Could not parse LV content:', error.message);
    continue;
  }      
  
      if (!otherContent.positions) continue;
      
      for (const otherPos of otherContent.positions) {
        for (const keyword of criticalKeywords) {
          if (pos.title?.toLowerCase().includes(keyword.toLowerCase()) && 
              otherPos.title?.toLowerCase().includes(keyword.toLowerCase())) {
            duplicates.push({
              position: pos.title,
              foundIn: lv.trade_name,
              tradeCode: lv.trade_code,
              keyword: keyword
            });
          }
        }
      }
    }
  }
  
  return duplicates;
}  
  
  const userPrompt = `GEWERK: ${trade.name} (${trade.code})
  
PFLICHT-ANFORDERUNG: Erstelle MINDESTENS ${orientation.min} Positionen!
LV-TEMPLATE (MUSS BEACHTET WERDEN!):
${lvPrompt || 'KEIN TEMPLATE GELADEN - FEHLER!'}

KRITISCH: Die Preise und Strukturvorgaben aus dem Template MÜSSEN eingehalten werden!

PROJEKTDATEN:
${JSON.stringify(project, null, 2)}

INTAKE-ANTWORTEN (${intakeAnswers.length} Antworten):
WICHTIG: Diese Intake-Daten müssen als Vorbemerkungen im LV erscheinen!
${intakeAnswers.map(a => 
  `[${a.question_id}] ${a.question}
  Antwort: ${a.answer}${a.assumption ? `\n  Annahme: ${a.assumption}` : ''}`
).join('\n\n')}

GEWERK-SPEZIFISCHE ANTWORTEN (${tradeAnswers.length} Antworten):
${tradeAnswers.map(a => 
  `[${a.question_id}] ${a.question}${a.unit ? ` (${a.unit})` : ''}
  Antwort: ${a.answer}${a.assumption ? `\n  Annahme: ${a.assumption}` : ''}`
).join('\n\n')}

VALIDIERTE WERTE:
${validationResult ? JSON.stringify(validationResult, null, 2) : 'Keine Validierung verfügbar'}

WICHTIG:
1. Erstelle NUR Positionen für explizit erfragte Leistungen
2. Verwende die validierten Mengen
3. Realistische Preise (Stand 2024/2025)
4. Dokumentiere alle Annahmen transparent`;  // HIER ENDET der userPrompt String

  try {
  const response = await llmWithPolicy('lv', [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ], { 
    maxTokens: 16000,
    temperature: 0.3,
    jsonMode: true,  // Nutzt jetzt den korrigierten JSON-Mode
    timeout: 120000
  });

// Debug was wirklich zurückkommt
console.log('[LV-DEBUG] Raw response type:', typeof response);
console.log('[LV-DEBUG] First 500 chars:', response.substring(0, 500));
    
  // Debug-Output für alle Gewerke (kann später auf problematische beschränkt werden)
  if (trade.code === 'FASS' || trade.code === 'FEN') {
    console.log(`\n========== ${trade.code} LLM RESPONSE DEBUG ==========`);
    console.log('Response length:', response.length);
    console.log('First 200 chars:', response.substring(0, 200));
    console.log('Last 200 chars:', response.substring(response.length - 200));
    
    // Prüfe ob Response mit { beginnt und } endet
    const startsWithBrace = response.trim().startsWith('{');
    const endsWithBrace = response.trim().endsWith('}');
    console.log('Starts with {:', startsWithBrace);
    console.log('Ends with }:', endsWithBrace);
    
    // Prüfe auf Markdown
    if (response.includes('```')) {
      console.log('⚠️ WARNING: Contains markdown blocks (should not happen with JSON mode)');
    }
    
    console.log('========================================\n');
  }
  
  // VERBESSERTE Bereinigung für Claude-Responses
let cleanedResponse = response.trim();

// Claude-spezifische Bereinigung (auch wenn jsonMode aktiv ist)
if (cleanedResponse.includes('```')) {
  console.warn(`[LV] Markdown wrapper detected for ${trade.code} - cleaning...`);
  // Entferne ```json oder ``` am Anfang und Ende
  cleanedResponse = cleanedResponse
    .replace(/^```(?:json)?\s*\n?/, '')
    .replace(/\n?```\s*$/, '');
}

// Weitere Claude-typische Probleme bereinigen
cleanedResponse = cleanedResponse
  .replace(/^json\s*\n?/i, '') // Falls "json" oder "JSON" am Anfang steht
  .trim();

// Validiere JSON-Struktur
if (!cleanedResponse.startsWith('{') || !cleanedResponse.endsWith('}')) {
  console.error(`[LV] Invalid JSON structure for ${trade.code}`);
  
  // Versuche zu reparieren
  const firstBrace = cleanedResponse.indexOf('{');
  const lastBrace = cleanedResponse.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    cleanedResponse = cleanedResponse.substring(firstBrace, lastBrace + 1);
    console.log(`[LV] Trimmed to valid JSON bounds for ${trade.code}`);
  }
}

// Parse mit erweiterter Fehlerbehandlung
let lv;
try {
  lv = JSON.parse(cleanedResponse);
  console.log(`[LV] Successfully parsed JSON for ${trade.code}`);
  
} catch (parseError) {
  console.error(`[LV] Parse error for ${trade.code}:`, parseError.message);
  console.error('[LV] First 200 chars of response:', cleanedResponse.substring(0, 200));
  
  // Versuche abgeschnittenes JSON zu reparieren
  if (parseError.message.includes('Unexpected end of JSON')) {
    console.log('[LV] Attempting to repair truncated JSON...');
    
    // Zähle offene Arrays/Objekte
    const openBraces = (cleanedResponse.match(/{/g) || []).length;
    const closeBraces = (cleanedResponse.match(/}/g) || []).length;
    const openBrackets = (cleanedResponse.match(/\[/g) || []).length;
    const closeBrackets = (cleanedResponse.match(/\]/g) || []).length;
    
    let repaired = cleanedResponse;
    
    // Schließe offene Arrays
    for (let i = 0; i < (openBrackets - closeBrackets); i++) {
      repaired += ']';
    }
    
    // Schließe offene Objekte
    for (let i = 0; i < (openBraces - closeBraces); i++) {
      repaired += '}';
    }
    
    try {
      lv = JSON.parse(repaired);
      console.log('[LV] Successfully repaired truncated JSON');
    } catch (repairError) {
      console.error('[LV] Repair attempt failed');
      throw new Error(`LV-Generierung für ${trade.name} fehlgeschlagen - Claude lieferte ungültiges JSON trotz JSON-Mode`);
    }
  } else {
    // Nicht reparierbar
    throw new Error(`LV-Generierung für ${trade.name} fehlgeschlagen - Claude lieferte ungültiges JSON trotz JSON-Mode`);
  }
}

// Validiere LV-Struktur
if (!lv || !lv.positions || !Array.isArray(lv.positions)) {
  throw new Error(`LV-Generierung für ${trade.name} fehlgeschlagen - Ungültige LV-Struktur`);
}

// ERWEITERTE VALIDIERUNG für alle maßrelevanten Bauteile
const dimensionConfig = DIMENSION_REQUIRED_ITEMS[trade.code];
if (dimensionConfig) {
  const hasInvalidPositions = lv.positions.some(pos => {
    const desc = pos.description.toLowerCase();
    // Prüfe ob Position eines der Keywords enthält
    const containsKeyword = dimensionConfig.keywords.some(kw => desc.includes(kw));
    
    // Bei Heizung: Flexiblere Prüfung
    if (trade.code === 'HEI') {
      const hasValidSpec = 
        dimensionConfig.format.test(pos.description) ||
        desc.includes('nach berechnung') ||
        desc.includes('gemäß heizlast') ||
        /\d+\s*watt/i.test(desc) ||
        /typ\s*\d+/i.test(desc);
      
      return containsKeyword && !hasValidSpec;
    }
    
    // Für andere Gewerke: Strikte Maßprüfung
    const hasDimensions = dimensionConfig.format.test(pos.description);
    return containsKeyword && !hasDimensions;
  });
  
  if (hasInvalidPositions) {
    console.error(`[LV] WARNUNG: ${dimensionConfig.itemName}-LV ohne detaillierte Maßangaben erkannt! Regeneriere...`);
    
    // Sammle alle relevanten Maßangaben aus den Antworten
    const dimensionAnswers = tradeAnswers.filter(a => 
      a.answer.match(/\d+\s*x\s*\d+/) || 
      a.answer.match(/\d+\s*(cm|mm|m)/)
    ).map(a => `- ${a.question}: ${a.answer}`).join('\n');
    
    const enhancedPrompt = userPrompt + `\n\nKRITISCH: Die vorherige Generierung hatte ${dimensionConfig.itemName} OHNE Maßangaben!
    
ABSOLUT VERPFLICHTEND für JEDE ${dimensionConfig.itemName}-Position:
- Format: ${dimensionConfig.example}
- Die Maße MÜSSEN aus den erfassten Antworten stammen!

ERFASSTE MAßANGABEN AUS DEN ANTWORTEN:
${dimensionAnswers || 'KEINE MAßANGABEN IN DEN ANTWORTEN GEFUNDEN'}

REGELN:
1. UNTERSCHIEDLICHE Abmessungen = SEPARATE Positionen
2. GLEICHE Abmessungen = EINE Position mit Stückzahl
3. Wenn KEINE Maße in den Antworten: "Maße vor Ort aufzunehmen" vermerken
4. NIEMALS Standardmaße erfinden!

Beispiel RICHTIG:
- "3 Stk. ${dimensionConfig.example}" (gleiche Maße)
- "1 Stk. ${dimensionConfig.itemName} [andere Maße]" (separate Position)

Beispiel FALSCH:
- "${dimensionConfig.itemName} verschiedene Größen"
- Maßangaben erfinden die nicht in den Antworten stehen

WICHTIG: Antworte NUR mit validem JSON!`;
    
    let retryResponse = await llmWithPolicy('lv', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: enhancedPrompt }
    ], { 
      maxTokens: 16000, 
      temperature: 0.3,
      jsonMode: true
    });
    
    // Bereinige auch die Retry-Response
    retryResponse = retryResponse.trim()
      .replace(/^```(?:json)?\s*\n?/, '')
      .replace(/\n?```\s*$/, '')
      .replace(/^json\s*\n?/i, '');
    
    try {
      lv = JSON.parse(retryResponse);
      console.log(`[LV] ${dimensionConfig.itemName}-LV erfolgreich regeneriert mit Maßangaben`);
    } catch (retryParseError) {
      console.error('[LV] Retry parse failed:', retryParseError.message);
      throw new Error(`LV-Regenerierung für ${trade.name} fehlgeschlagen - Claude lieferte erneut ungültiges JSON`);
    }
  }
}

// Post-Processing: Konsolidiere Demontage und entferne Redundanzen
if (trade.code === 'TIS' && lv.positions) {
  console.log('[LV-TIS] Starting TIS-specific post-processing...');
  
  // 1. Konsolidiere Demontage-Positionen
  const demontagePositionen = lv.positions.filter(p => 
    p.title?.toLowerCase().includes('demontage') && 
    !p.title?.toLowerCase().includes('entsorgung'));
  
  const entsorgungsPositionen = lv.positions.filter(p => 
    p.title?.toLowerCase().includes('entsorgung'));
  
  if (demontagePositionen.length > 1) {
    console.log(`[LV-TIS] Found ${demontagePositionen.length} separate Demontage positions - consolidating...`);
    
    const totalQuantity = demontagePositionen.reduce((sum, p) => 
      sum + (parseFloat(p.quantity) || 0), 0);
    
    const sammelPosition = {
      pos: "01.01",
      title: "Demontage und Entsorgung sämtlicher Alttüren",
      description: "Demontage bestehender Innentüren und Wohnungstür inkl. Türblätter aushängen, Zargen ausbauen, Beschläge demontieren und sortieren. Fachgerechte Entsorgung als Altholz Kategorie A II inkl. Transport zur Entsorgungsanlage.",
      quantity: totalQuantity,
      unit: "Stk",
      unitPrice: 120, // Demontage + Entsorgung kombiniert
      totalPrice: totalQuantity * 120,
      dataSource: "measured",
      notes: `Zusammengefasst aus ${demontagePositionen.length} Einzelpositionen`
    };
    
    // Entferne alte Positionen und füge neue hinzu
    lv.positions = lv.positions.filter(p => 
      !p.title?.toLowerCase().includes('demontage') && 
      !p.title?.toLowerCase().includes('entsorgung'));
    
    lv.positions.unshift(sammelPosition);
    console.log(`[LV-TIS] Created consolidated position for ${totalQuantity} doors`);
  }
  
  // 2. Entferne redundante Montage-Positionen
  const lieferungUndMontageCount = lv.positions.filter(p => 
    p.title?.toLowerCase().includes('lieferung und montage')).length;
  
  if (lieferungUndMontageCount > 0) {
    const redundantMontage = lv.positions.filter(p => {
      const title = p.title?.toLowerCase() || '';
      return (title.includes('montage') || title.includes('justage')) && 
             !title.includes('lieferung') && 
             !title.includes('demontage');
    });
    
    if (redundantMontage.length > 0) {
      console.log(`[LV-TIS] Removing ${redundantMontage.length} redundant Montage positions`);
      lv.positions = lv.positions.filter(p => !redundantMontage.includes(p));
    }
  }
  
  // 3. Neuberechnung der Positionsnummern
  lv.positions = lv.positions.map((pos, index) => ({
    ...pos,
    pos: `${String(index + 1).padStart(2, '0')}.01`
  }));
  
  console.log(`[LV-TIS] Post-processing complete. Final position count: ${lv.positions.length}`);
}
    
// NEUE PREISVALIDIERUNG - HIER EINFÜGEN (Zeile 1921)
const priceValidation = validateAndFixPrices(lv, trade.code);
if (priceValidation.fixedCount > 0) {
  console.warn(`[LV] Fixed ${priceValidation.fixedCount} unrealistic prices for ${trade.code}`);
  lv = priceValidation.lv;
}
    
    // Duplikatsprüfung durchführen
const duplicates = await checkForDuplicatePositions(projectId, tradeId, lv.positions);

if (duplicates.length > 0) {
  console.log(`Warnung: ${duplicates.length} potenzielle Duplikate gefunden für ${trade.name}`);
  
  // Prüfe ob spezialisierte Gewerke vorhanden sind
  const specializedTrades = await query(
    `SELECT code FROM trades t 
     JOIN project_trades pt ON t.id = pt.trade_id 
     WHERE pt.project_id = $1 AND t.code IN ('GERÜST', 'ABBR', 'ENTSO')`,
    [projectId]
  );
  
  const hasGerüstbau = specializedTrades.rows.some(t => t.code === 'GERÜST');
  const hasAbbruch = specializedTrades.rows.some(t => t.code === 'ABBR');
  
  // Filtere Duplikate basierend auf Gewerke-Hierarchie
  lv.positions = lv.positions.filter(pos => {
    // Entferne Gerüstpositionen wenn Gerüstbau-Gewerk existiert
    if (hasGerüstbau && trade.code !== 'GERÜST' && 
        pos.title?.toLowerCase().includes('gerüst')) {
      console.log(`Entferne Gerüstposition aus ${trade.code}`);
      return false;
    }
    
    // Entferne Wanddurchbruch aus Rohbau wenn Abbruch existiert
    if (hasAbbruch && trade.code === 'ROH' && 
        pos.title?.toLowerCase().includes('durchbruch')) {
      console.log(`Entferne Durchbruch aus Rohbau (gehört zu Abbruch)`);
      return false;
    }
    
    return true;
  });
  
  // Füge Hinweis zu Notes hinzu
  if (!lv.notes) lv.notes = '';
  lv.notes += '\n\nGewerkeabgrenzung beachtet - Duplikate wurden entfernt.';
}

    // NEU: Filtere Gerüstpositionen wenn Gerüst separates Gewerk ist
    if (hasGeruestGewerk && ['DACH', 'FASS', 'FEN'].includes(trade.code)) {
      const originalCount = lv.positions?.length || 0;
      lv.positions = lv.positions?.filter(pos => {
        const title = (pos.title || '').toLowerCase();
        const desc = (pos.description || '').toLowerCase();
        const isScaffolding = title.includes('gerüst') || desc.includes('gerüst') || 
                             title.includes('arbeitsgerüst') || desc.includes('arbeitsgerüst') ||
                             title.includes('fassadengerüst') || desc.includes('fassadengerüst');
        if (isScaffolding) {
          console.log(`[LV] Filtered scaffolding position in ${trade.code}: ${pos.title}`);
        }
        return !isScaffolding;
      }) || [];
      
      if (originalCount !== lv.positions.length) {
        console.log(`[LV] Removed ${originalCount - lv.positions.length} scaffolding positions from ${trade.code}`);
      }
      
      // Füge Vorbemerkungen hinzu wenn noch nicht vorhanden
      if (!lv.vorbemerkungen) lv.vorbemerkungen = [];
      if (!lv.vorbemerkungen.includes('Gerüst wird bauseits gestellt')) {
        lv.vorbemerkungen.unshift('Gerüst wird bauseits gestellt');
        lv.vorbemerkungen.unshift('Gerüstkosten sind in separatem Gewerk erfasst');
      }
    }
    
    // Post-Processing und Stundenlohnarbeiten hinzufügen
    if (lv.positions && Array.isArray(lv.positions)) {
  // Filtere leere/ungültige Positionen
  const validPositions = lv.positions.filter(pos => {
    // Entferne Positionen mit Menge 0, "-" oder ohne Menge
    if (!pos.quantity || pos.quantity === 0 || pos.quantity === '-') {
      console.log(`[LV] Filtered empty position: ${pos.title}`);
      return false;
    }
    
    // Entferne "nicht vorhanden" Positionen
    const title = (pos.title || '').toLowerCase();
    const desc = (pos.description || '').toLowerCase();
    if (title.includes('nicht vorhanden') || 
        title.includes('nicht enthalten') ||
        title.includes('nicht definiert') ||
        desc.includes('nicht vorhanden') ||
        desc.includes('keine position')) {
      console.log(`[LV] Filtered invalid position: ${pos.title}`);
      return false;
    }
    
    return true;
  });
  
  console.log(`[LV] Filtered ${lv.positions.length - validPositions.length} invalid positions`);
  lv.positions = validPositions;
  
  // Prüfe ob noch genug Positionen übrig sind (80% = 20% Toleranz)
  if (lv.positions.length < orientation.min * 0.8) {
    console.warn(`[LV] Only ${lv.positions.length} valid positions remain (80% minimum: ${Math.floor(orientation.min * 0.8)})`);
    // Optional: Hier könnte ein Retry getriggert werden
  }

// GER-spezifisch: Konsolidiere mehrfache Standzeit-Positionen
  if (trade.code === 'GER') {
    console.log('[GER] Prüfe auf mehrfache Standzeit-Positionen...');
    
    const weitereWochenPositionen = lv.positions.filter(pos => {
      const title = (pos.title || '').toLowerCase();
      return (
        (title.includes('woche') && 
         (title.includes('5') || title.includes('6') || title.includes('7') || 
          title.includes('8') || title.includes('9') || title.includes('10') ||
          title.includes('11') || title.includes('12'))) ||
        (title.includes('weitere') && title.includes('woche')) ||
        (title.includes('zusätzlich') && title.includes('standzeit'))
      ) && !title.includes('erste');
    });
    
    if (weitereWochenPositionen.length > 1) {
      console.log(`[GER] ${weitereWochenPositionen.length} Positionen für weitere Wochen - konsolidiere`);
      
      const consolidatedPos = {
        ...weitereWochenPositionen[0],
        title: "Gerüst-Standzeit jede weitere Woche (Eventualposition)",
        description: "Gerüstmiete für jede weitere Woche über 4 Wochen hinaus. Eventualposition. Abrechnung nach Bedarf.",
        unitPrice: 1.20,
        totalPrice: weitereWochenPositionen[0].quantity * 1.20,
        isNEP: true
      };
      
      lv.positions = lv.positions.filter(pos => !weitereWochenPositionen.includes(pos));
      lv.positions.splice(3, 0, consolidatedPos);
    }
    
    // Korrigiere EP
    lv.positions = lv.positions.map(pos => {
      const title = (pos.title || '').toLowerCase();
      if ((title.includes('weitere') || title.includes('eventualposition')) && 
          title.includes('woche') && pos.unitPrice > 1.20) {
        pos.unitPrice = 1.20;
        pos.totalPrice = pos.quantity * 1.20;
        pos.isNEP = true;
      }
      return pos;
    });
    
    // Entferne separate Demontage/Abtransport-Positionen
    const vorherAnzahl = lv.positions.length;
    lv.positions = lv.positions.filter(pos => {
      const title = (pos.title || '').toLowerCase();
      const desc = (pos.description || '').toLowerCase();
      
      // Entferne reine Demontage/Abbau-Positionen (ohne Aufbau)
      if ((title.includes('demontage') || title.includes('abbau') || title.includes('abtransport')) &&
          !title.includes('auf') && 
          !title.includes('lieferung') &&
          !title.includes('montage')) {
        console.log(`[GER] Entferne redundante Position: "${pos.title}"`);
        return false;
      }
      
      return true;
    });
    
    if (vorherAnzahl !== lv.positions.length) {
      console.log(`[GER] ${vorherAnzahl - lv.positions.length} redundante Abbau/Transport-Positionen entfernt`);
    }
  }

  // FASS-spezifisch: Teil 1 - Korrigiere falsche Dämmstärken
if (trade.code === 'FASS' && lv.positions) {
  // Prüfe ob Dämmstärke aus Antworten extrahiert wurde
  if (criticalMeasurements.daemmstaerke) {
    const korrekteDaemmstaerke = criticalMeasurements.daemmstaerke.value;
    console.log(`[FASS] Erzwinge Dämmstärke ${korrekteDaemmstaerke}cm aus Nutzerangaben`);
    
    // Gültige Dämmstärken (für Validierung)
    const gueltigeDaemmstaerken = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];
    
    if (!gueltigeDaemmstaerken.includes(korrekteDaemmstaerke)) {
      console.warn(`[FASS] Unübliche Dämmstärke ${korrekteDaemmstaerke}cm aus Antworten - verwende trotzdem!`);
    }
    
    lv.positions = lv.positions.map((pos, index) => {
      // Prüfe ob Position Dämmung betrifft
      const istDaemmPosition = 
        pos.title?.toLowerCase().includes('dämm') ||
        pos.title?.toLowerCase().includes('wdvs') ||
        pos.title?.toLowerCase().includes('eps') ||
        pos.title?.toLowerCase().includes('xps') ||
        pos.title?.toLowerCase().includes('sockeldämm') ||
        pos.title?.toLowerCase().includes('perimeter') ||
        pos.title?.toLowerCase().includes('steinwolle') ||
        pos.title?.toLowerCase().includes('mineralwolle');
      
      if (istDaemmPosition) {
        // Regex findet ALLE Zahlen vor cm (inkl. 0, ungerade, etc.)
        const daemmRegex = /\b\d+(\.\d+)?\s*cm\b/gi;
        
        let aenderungen = [];
        
        // Korrigiere Titel
        if (pos.title) {
          const oldTitle = pos.title;
          // Ersetze JEDE Zahl+cm Kombination mit korrektem Wert
          pos.title = pos.title.replace(daemmRegex, (match) => {
            const zahl = parseInt(match);
            // Nur ersetzen wenn: 0, ungerade, unter 10, oder nicht in gültiger Liste
            if (zahl === 0 || zahl < 10 || zahl % 2 !== 0 || !gueltigeDaemmstaerken.includes(zahl)) {
              aenderungen.push(`${match} → ${korrekteDaemmstaerke} cm`);
              return `${korrekteDaemmstaerke} cm`;
            }
            // Sonst: Wenn Zahl gültig aber nicht die aus Antworten
            if (zahl !== korrekteDaemmstaerke) {
              aenderungen.push(`${match} → ${korrekteDaemmstaerke} cm`);
              return `${korrekteDaemmstaerke} cm`;
            }
            return match;
          });
          
          if (oldTitle !== pos.title) {
            console.log(`[FASS] Position ${index+1} Titel korrigiert:`, aenderungen.join(', '));
          }
        }
        
        // Korrigiere Beschreibung mit gleichem Ansatz
        if (pos.description) {
          pos.description = pos.description.replace(daemmRegex, (match) => {
            const zahl = parseInt(match);
            if (zahl === 0 || zahl < 10 || zahl % 2 !== 0 || zahl !== korrekteDaemmstaerke) {
              return `${korrekteDaemmstaerke} cm`;
            }
            return match;
          });
          
          // Zusätzlich: Spezifische Kontexte korrigieren
          pos.description = pos.description.replace(/Stärke:\?\s*\d+\s*cm/gi, `Stärke ${korrekteDaemmstaerke} cm`);
          pos.description = pos.description.replace(/Dicke:\?\s*\d+\s*cm/gi, `Dicke ${korrekteDaemmstaerke} cm`);
          pos.description = pos.description.replace(/Höhe:\?\s*\d+\s*cm/gi, `Höhe ${korrekteDaemmstaerke} cm`);
        }
        
        // Finale Prüfung: Warne wenn immer noch problematische Werte
const nachPruefung = (pos.title + ' ' + pos.description).match(/\b\d+\s*cm\b/gi);
if (nachPruefung) {
  nachPruefung.forEach(match => {
    const zahl = parseInt(match);
    if (zahl !== korrekteDaemmstaerke && (zahl === 0 || zahl < 10 || zahl % 2 !== 0)) {
      console.error(`[FASS] KRITISCH: Position ${index+1} enthält noch falsche Dämmstärke: ${match}`);
    }
  });
}

// Spezialbehandlung für Sockeldämmung (2cm dünner als WDVS)
if (pos.title?.toLowerCase().includes('sockel')) {
  const sockeldaemmstaerke = Math.max(8, korrekteDaemmstaerke - 2); // 2cm dünner, min. 8cm
  console.log(`[FASS] Sockeldämmung: ${sockeldaemmstaerke}cm (WDVS-2cm)`);
  
  // Ersetze ALLE Dämmstärken in Sockelpositionen mit angepasster Stärke
  const alleZahlenRegex = /\b\d+(\.\d+)?\s*cm\b/gi;
  
  if (pos.title) {
    pos.title = pos.title.replace(alleZahlenRegex, `${sockeldaemmstaerke} cm`);
  }
  
  if (pos.description) {
  const originalDescription = pos.description; // Speichere Original
  
  pos.description = originalDescription.replace(alleZahlenRegex, (match, p1, offset) => {
    // Prüfe Kontext - verwende originalDescription statt fullString
    const vorher = originalDescription.substring(Math.max(0, offset - 20), offset).toLowerCase();
    if (vorher.includes('höhe') || vorher.includes('sichtbar') || vorher.includes('über')) {
      return match; // Sockelhöhe nicht ändern
    }
    return `${sockeldaemmstaerke} cm`;
  });
    
    // Explizit "Stärke X cm" ersetzen
    pos.description = pos.description.replace(/Stärke\s+\d+\s*cm/gi, `Stärke ${sockeldaemmstaerke} cm`);
    pos.description = pos.description.replace(/Dicke\s+\d+\s*cm/gi, `Dicke ${sockeldaemmstaerke} cm`);
    pos.description = pos.description.replace(/XPS-Platten.*?\d+\s*cm/gi, `XPS-Platten WLG 035, ${sockeldaemmstaerke} cm`);
  }
  
  console.log(`[FASS] Sockeldämmung korrigiert auf ${sockeldaemmstaerke}cm`);
} // DIESE KLAMMER FEHLTE!

      } // Ende von istDaemmPosition
      return pos;
    });
  } else {
    // KRITISCHER FEHLER: Keine Dämmstärke gefunden
    console.error('[FASS] KRITISCH: Keine Dämmstärke in Antworten gefunden!');
    console.error('[FASS] Suche Notfall-Dämmstärke in den LV-Positionen...');
    
    // Versuche Dämmstärke aus vorhandenen Positionen zu extrahieren
    let gefundeneDaemmstaerken = [];
    lv.positions.forEach(pos => {
      const matches = (pos.title + ' ' + pos.description).match(/\b(\d+)\s*cm\b/gi);
      if (matches) {
        matches.forEach(m => {
          const zahl = parseInt(m);
          if (zahl >= 10 && zahl <= 30 && zahl % 2 === 0) {
            gefundeneDaemmstaerken.push(zahl);
          }
        });
      }
    });
    
    // Wenn keine gültige Dämmstärke gefunden, verwende 16cm als Standard
    const notfallDaemmstaerke = gefundeneDaemmstaerken.length > 0 ? 
      gefundeneDaemmstaerken[0] : 16;
    
    console.warn(`[FASS] Verwende Notfall-Dämmstärke: ${notfallDaemmstaerke}cm`);
    
    // Korrigiere alle falschen Werte NUR FÜR DÄMMUNG
    lv.positions = lv.positions.map(pos => {
      if (pos.title?.toLowerCase().includes('dämm') || 
          pos.title?.toLowerCase().includes('wdvs')) {
        // Ersetze 0cm und alle ungeraden/falschen Werte
        pos.title = pos.title?.replace(/\b[0-9]\s*cm\b/gi, `${notfallDaemmstaerke} cm`);
        pos.title = pos.title?.replace(/\b\d*[13579]\s*cm\b/gi, `${notfallDaemmstaerke} cm`);
        
        pos.description = pos.description?.replace(/\b[0-9]\s*cm\b/gi, `${notfallDaemmstaerke} cm`);
        pos.description = pos.description?.replace(/\b\d*[13579]\s*cm\b/gi, `${notfallDaemmstaerke} cm`);
      }
      return pos;
    });
  }
  
// TEIL 2: Entferne falsche Positionen (Isokorb etc.)
  const vorherCount = lv.positions.length;
  lv.positions = lv.positions.filter(pos => {
    const title = (pos.title || '').toLowerCase();
    const desc = (pos.description || '').toLowerCase();
    
    if (title.includes('isokorb') || desc.includes('isokorb')) {
      console.error(`[FASS] FEHLER: Isokorb-Position entfernt - gehört zu Rohbau!`);
      return false;
    }   
    if ((title.includes('balkon') && title.includes('abtrennen')) ||
        (desc.includes('thermische trennung') && desc.includes('balkon'))) {
      console.error(`[FASS] FEHLER: Balkon-Trennung entfernt - unmöglich bei Sanierung!`);
      return false;
    }
    
    return true;
  });
  
  if (vorherCount !== lv.positions.length) {
    console.log(`[FASS] ${vorherCount - lv.positions.length} falsche Positionen entfernt`);
  }
} // Ende des FASS-Blocks
      
// MATERIAL-PREISKORREKTUREN (Kleber, Kabel, etc.)
lv.positions = lv.positions.map(pos => {
  const titleLower = (pos.title || pos.bezeichnung || '').toLowerCase();
  const descLower = (pos.description || '').toLowerCase();
  
  // UNIVERSELLE REGEL 1: Kleber/Klebstoff-Preise
  if (titleLower.includes('kleber') || titleLower.includes('klebstoff')) {
    if (pos.unit === 'm²' && pos.unitPrice > 15) {
      const oldPrice = pos.unitPrice;
      
      // Bestimme Kleber-Typ
      let neuerPreis = 5; // Standard
      if (titleLower.includes('2-komponenten') || titleLower.includes('epoxid')) {
        neuerPreis = 12; // Teurer Spezialkleber
      } else if (titleLower.includes('flexkleber') || titleLower.includes('naturstein')) {
        neuerPreis = 8; // Mittelpreisig
      }
      
      pos.unitPrice = neuerPreis;
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      console.log(`[KLEBER] Preis korrigiert: ${oldPrice}€/m² → ${neuerPreis}€/m²`);
    }
    
    // Kleber pro kg
    if (pos.unit === 'kg' && pos.unitPrice > 25) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 8; // Max 8€/kg für Spezialkleber
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      console.log(`[KLEBER] Preis/kg korrigiert: ${oldPrice}€ → 8€`);
    }
  }
  
  // UNIVERSELLE REGEL 2: Kabel/Leitungs-Preise
  if (titleLower.includes('nym') || titleLower.includes('kabel') || 
      titleLower.includes('leitung') || descLower.includes('nym')) {
    
    // NYM-J Kabel nach Querschnitt
    if (titleLower.includes('nym-j') || titleLower.includes('nym j') || 
        descLower.includes('nym-j')) {
      
      // Suche Querschnitt in Title oder Description
      const fullText = titleLower + ' ' + descLower;
      const querschnittMatch = fullText.match(/(\d+)\s*x\s*([\d,\.]+)\s*mm/);
      
      if (querschnittMatch) {
        const adern = parseInt(querschnittMatch[1]);
        const querschnitt = parseFloat(querschnittMatch[2].replace(',', '.'));
        
        let maxPreis = 15; // Basis
        
        // Preise nach Querschnitt (inkl. Verlegung)
        if (querschnitt <= 1.5) {
          maxPreis = 12; 
        } else if (querschnitt <= 2.5) {
          maxPreis = 15;
        } else if (querschnitt <= 4) {
          maxPreis = 20;
        } else if (querschnitt <= 6) {
          maxPreis = 25;
        } else if (querschnitt <= 10) {
          maxPreis = 35;
        } else {
          maxPreis = 45; // Große Querschnitte
        }
        
        // 5-adrig ist teurer
        if (adern === 5) {
          maxPreis = Math.round(maxPreis * 1.3);
        }
        
        if (pos.unit === 'm' && pos.unitPrice > maxPreis) {
          const oldPrice = pos.unitPrice;
          pos.unitPrice = maxPreis;
          pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
          console.log(`[KABEL] NYM-J ${adern}x${querschnitt}mm² korrigiert: ${oldPrice}€/m → ${maxPreis}€/m`);
        }
      }
    }
    
    // Datenkabel
    if (titleLower.includes('cat') || titleLower.includes('netzwerk') || 
        titleLower.includes('lan')) {
      if (pos.unit === 'm' && pos.unitPrice > 25) {
        const oldPrice = pos.unitPrice;
        let neuerPreis = 12; // Standard CAT
        
        if (titleLower.includes('cat7') || titleLower.includes('cat 7')) {
          neuerPreis = 18; // CAT7 teurer
        } else if (titleLower.includes('cat6') || titleLower.includes('cat 6')) {
          neuerPreis = 15; // CAT6 mittel
        }
        
        pos.unitPrice = neuerPreis;
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
        console.log(`[KABEL] Datenkabel korrigiert: ${oldPrice}€/m → ${neuerPreis}€/m`);
      }
    }
    
    // Erdkabel NYY
    if (titleLower.includes('nyy') || titleLower.includes('erdkabel')) {
      if (pos.unit === 'm' && pos.unitPrice > 50) {
        const oldPrice = pos.unitPrice;
        pos.unitPrice = 35; // Erdkabel max 35€/m inkl. Verlegung
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
        console.log(`[KABEL] Erdkabel korrigiert: ${oldPrice}€/m → 35€/m`);
      }
    }
  }
  
  return pos;
});

// ROH-spezifisch: Entferne falsche Holzbau-Positionen
if (trade.code === 'ROH' && lv.positions) {
  console.log('[ROH] Prüfe auf falsche Holzbau-Positionen...');
  
  const vorherCount = lv.positions.length;
  lv.positions = lv.positions.filter(pos => {
    const title = (pos.title || '').toLowerCase();
    const desc = (pos.description || '').toLowerCase();
    
    // Holzbau-Keywords die NICHT in ROH gehören
    const holzbauKeywords = [
      'holzständer', 'holzrahmen', 'holzbalkendecke', 'holzkonstruktion',
      'sparren', 'pfetten', 'firstbalken', 'gratbalken', 'windrispen',
      'konstruktionsvollholz', 'kvh', 'c24', 'balkenschuhe', 'holzschutz'
    ];
    
    // Prüfe ob Position Holzbau enthält
    const istHolzbau = holzbauKeywords.some(keyword => 
      title.includes(keyword) || desc.includes(keyword)
    );
    
    if (istHolzbau) {
      console.log(`[ROH] FEHLER: Holzbau-Position entfernt: "${pos.title}"`);
      return false; // Position entfernen
    }
    
    // Auch "Aufstockung in Holz" ist Zimmerer-Sache
    if ((title.includes('aufstockung') || desc.includes('aufstockung')) &&
        (title.includes('holz') || desc.includes('holz'))) {
      console.log(`[ROH] FEHLER: Holz-Aufstockung gehört zu ZIMM: "${pos.title}"`);
      return false;
    }
    
    return true; // Position behalten
  });
  
  if (vorherCount !== lv.positions.length) {
    console.error(`[ROH] KRITISCH: ${vorherCount - lv.positions.length} Holzbau-Positionen entfernt - gehören zu ZIMMERER!`);
    
    // Füge Hinweis-Position ein
    if (lv.positions.length < orientation.min * 0.7) {
      lv.positions.push({
        pos: `${lv.positions.length + 1}.00`,
        title: "HINWEIS: Holzbauarbeiten",
        description: "Holzbauarbeiten für Aufstockung siehe separates Gewerk ZIMMERER. Rohbau erstellt nur die Anschlüsse und Verstärkungen am Bestandsmauerwerk.",
        quantity: 1,
        unit: "psch",
        unitPrice: 0,
        totalPrice: 0,
        isNEP: true,
        notes: "Nur zur Information - keine Kosten"
      });
    }
  }
}  
    
// ZIMM-spezifisch: Prüfe ob Holzbau-Positionen vorhanden sind
if (trade.code === 'ZIMM' && lv.positions) {
  const hatHolzbau = lv.positions.some(pos => 
    pos.title?.toLowerCase().includes('holz') || 
    pos.description?.toLowerCase().includes('holz')
  );
  
  if (!hatHolzbau) {
    console.error('[ZIMM] WARNUNG: Zimmerer-LV ohne Holzbau-Positionen!');
  }
}
      
  let calculatedSum = 0;
  let nepSum = 0; // NEU: Summe der NEP-Positionen
  
  lv.positions = lv.positions.map(pos => {
    // NEU: NEP-Flag standardmäßig false
    if (pos.isNEP === undefined) {
      pos.isNEP = false;
    }
    
    if (!pos.totalPrice && pos.quantity && pos.unitPrice) {
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
    }
    
    // NEU: NEP-Positionen nicht zur Hauptsumme addieren
    if (!pos.isNEP) {
      calculatedSum += pos.totalPrice || 0;
    } else {
      nepSum += pos.totalPrice || 0;
    }
    
    return pos;
  });
  
  // NEU: NEP-Summe separat speichern
  lv.nepSum = Math.round(nepSum * 100) / 100;
  lv.totalSum = Math.round(calculatedSum * 100) / 100;  // DIESE ZEILE FEHLT!
      
      // Stundenlohnarbeiten hinzufügen
      const stundenSätze = {
        'MAL': { stunden: 5, satz: 45, bezeichnung: 'Maler/Lackierer' },
        'GER': { stunden: 5, satz: 35, bezeichnung: 'Gerüstbauer' },
        'ESTR': { stunden: 5, satz: 50, bezeichnung: 'Estrichleger' },
        'FLI': { stunden: 8, satz: 55, bezeichnung: 'Fliesenleger' },
        'DACH': { stunden: 15, satz: 65, bezeichnung: 'Dachdecker' },
        'ELEKT': { stunden: 12, satz: 70, bezeichnung: 'Elektriker' },
        'SAN': { stunden: 15, satz: 75, bezeichnung: 'Sanitärinstallateur' },
        'HEI': { stunden: 12, satz: 75, bezeichnung: 'Heizungsbauer' },
        'TIS': { stunden: 10, satz: 60, bezeichnung: 'Tischler' },
        'FEN': { stunden: 8, satz: 60, bezeichnung: 'Fensterbauer' },
        'ZIMM': { stunden: 12, satz: 65, bezeichnung: 'Zimmerer' },
        'DEFAULT': { stunden: 8, satz: 55, bezeichnung: 'Handwerker' }
      };
      
      const stundenConfig = stundenSätze[trade.code] || stundenSätze['DEFAULT'];
      
      // Füge Stundenlohnposition hinzu
      const stundenlohnPos = {
        pos: `${lv.positions.length + 1}.00`,
        title: `Stundenlohnarbeiten ${stundenConfig.bezeichnung}`,
        description: `Zusätzliche Arbeiten auf Stundenlohnbasis für unvorhergesehene oder kleinteilige Leistungen, die nicht im LV erfasst sind. Abrechnung nach tatsächlichem Aufwand.`,
        quantity: stundenConfig.stunden,
        unit: 'Std',
        unitPrice: stundenConfig.satz,
        totalPrice: stundenConfig.stunden * stundenConfig.satz,
        dataSource: 'standard',
        notes: 'Pauschal einkalkuliert für Zusatzarbeiten'
      };
      
      lv.positions.push(stundenlohnPos);
      // NEUE POSITION: Stundenlohn-Korrektur HIER, NACH dem Hinzufügen
const summeOhneStundenlohn = lv.totalSum; // Summe VOR Stundenlohn
if (summeOhneStundenlohn < 2000) {
  const maxStundenlohn = summeOhneStundenlohn * 0.10;
  
  if (stundenlohnPos.totalPrice > maxStundenlohn) {
    console.log(`[STUNDENLOHN] Korrigiere: ${stundenlohnPos.totalPrice}€ -> max ${maxStundenlohn}€`);
    
    if (summeOhneStundenlohn < 500) {
      stundenlohnPos.quantity = 1;
    } else if (summeOhneStundenlohn < 1000) {
      stundenlohnPos.quantity = 2;
    } else {
      stundenlohnPos.quantity = Math.max(2, Math.floor(maxStundenlohn / stundenlohnPos.unitPrice));
    }
    
    stundenlohnPos.totalPrice = stundenlohnPos.quantity * stundenlohnPos.unitPrice;
    console.log(`[STUNDENLOHN] Neue Menge: ${stundenlohnPos.quantity} Std`);
  }
}
      
      calculatedSum += stundenlohnPos.totalPrice;
      
      lv.totalSum = Math.round(calculatedSum * 100) / 100;

      // Vorbemerkungen aus Intake-Daten generieren falls nicht vorhanden
      if (!lv.vorbemerkungen || lv.vorbemerkungen.length === 0) {
        lv.vorbemerkungen = [];
        
        // Extrahiere relevante Intake-Infos
        const gebäudeInfo = intakeAnswers.find(a => a.question.toLowerCase().includes('gebäude'));
        const zufahrtInfo = intakeAnswers.find(a => a.question.toLowerCase().includes('zufahrt') || a.question.toLowerCase().includes('zugang'));
        const zeitInfo = intakeAnswers.find(a => a.question.toLowerCase().includes('zeit') || a.question.toLowerCase().includes('termin'));
        
        if (gebäudeInfo) {
          lv.vorbemerkungen.push(`Gebäude: ${gebäudeInfo.answer}`);
        }
        if (zufahrtInfo) {
          lv.vorbemerkungen.push(`Baustellenzugang: ${zufahrtInfo.answer}`);
        }
        if (zeitInfo) {
          lv.vorbemerkungen.push(`Ausführungszeitraum: ${zeitInfo.answer}`);
        }
        
        // Standard-Vorbemerkungen
        lv.vorbemerkungen.push('Alle Preise verstehen sich inklusive aller Nebenleistungen gemäß VOB/C');
        lv.vorbemerkungen.push('Baustrom und Bauwasser werden bauseits gestellt');
      }
      
      // Statistiken
      lv.statistics = {
        positionCount: lv.positions.length,
        averagePositionValue: Math.round((lv.totalSum / lv.positions.length) * 100) / 100,
        minPosition: Math.min(...lv.positions.map(p => p.totalPrice || 0)),
        maxPosition: Math.max(...lv.positions.map(p => p.totalPrice || 0)),
        measuredPositions: lv.positions.filter(p => p.dataSource === 'measured').length,
        estimatedPositions: lv.positions.filter(p => p.dataSource === 'estimated').length,
        hasStundenlohn: true
      };
    }
    
    // Metadaten
    const lvWithMeta = {
      ...lv,
      metadata: {
        generatedAt: new Date().toISOString(),
        projectId,
        tradeId,
        hasVorbemerkungen: lv.vorbemerkungen && lv.vorbemerkungen.length > 0,
        vorbemerkungCount: lv.vorbemerkungen?.length || 0,
        intakeAnswersCount: intakeAnswers.length,
        tradeAnswersCount: tradeAnswers.length,
        positionsCount: lv.positions?.length || 0,
        totalValue: lv.totalSum || 0,
        dataQuality: lv.dataQuality || { confidence: 0.5 }
      }
    };
    
    return lvWithMeta;
    
  } catch (err) {
    console.error('[LV] Generation failed:', err);
    throw new Error(`LV-Generierung für ${trade.name} fehlgeschlagen`);
  }
}

// Optimierte LV-Generierung - schnell und effizient
async function generateDetailedLVWithRetry(projectId, tradeId, maxRetries = 2) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[LV] Generation attempt ${attempt}/${maxRetries} for trade ${tradeId}`);
      
      const result = await generateDetailedLV(projectId, tradeId);
      
      console.log(`[LV] Successfully generated on attempt ${attempt}`);
      console.log(`[LV] Generated for trade ${tradeId}: ${result.positions?.length || 0} positions, Total: €${result.totalSum || 0}`);
      return result;
      
    } catch (error) {
      lastError = error;
      console.error(`[LV] Attempt ${attempt} failed:`, error.message);
      
      // Bei Datenfehlern NICHT wiederholen - das bringt nichts
      if (error.message.includes('JSON') || 
          error.message.includes('[object Object]') ||
          error.message.includes('undefined') ||
          error.message.includes('duplicate')) {
        console.error('[LV] Data/Structure error detected - not retrying:', error.message);
        throw error; // Sofort fehlschlagen
      }
      
      // Nur bei echten API/Netzwerk-Fehlern retry
      if (attempt < maxRetries) {
        // Nur bei OpenAI Rate Limits oder Timeouts wiederholen
        if (error.message.includes('Rate limit') || 
            error.message.includes('timeout') ||
            error.message.includes('OpenAI') ||
            error.message.includes('network')) {
          const waitTime = 500; // Kurze konstante Wartezeit
          console.log(`[LV] API/Network issue - waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          // Unbekannter Fehler - nicht wiederholen
          console.error('[LV] Unknown error type - not retrying');
          throw error;
        }
      }
    }
  }
  
  // Log den letzten Fehler ausführlich
  console.error('[LV] All attempts failed. Last error:', lastError);
  throw new Error(`LV-Generierung fehlgeschlagen: ${lastError.message}`);
}

/**
 * Intelligentere Preisvalidierung basierend auf Kontext
 */
function validateAndFixPrices(lv, tradeCode) {
  let fixedCount = 0;
  let warnings = [];
  
  if (!lv.positions || !Array.isArray(lv.positions)) {
    return { lv, fixedCount, warnings };
  }
 
  lv.positions = lv.positions.map(pos => {

  // Entferne Preisspannen und korrigiere Qualitätsbegriffe
    const originalTitle = pos.title || '';
    const originalDesc = pos.description || '';
    const ep = pos.unitPrice || 0;
    
    // Bereinige Titel
    if (pos.title) {
      pos.title = pos.title
        // Entferne Preisspannen
        .replace(/\(\s*\d+\s*-\s*\d+\s*€?\s*\)/g, '')     // (400-1000€)
        .replace(/\(\s*ab\s+\d+\s*€?\s*\)/g, '')          // (ab 500€)
        .replace(/\(\s*bis\s+\d+\s*€?\s*\)/g, '')         // (bis 1000€)
        .replace(/\(\s*ca\.\s*\d+\s*€?\s*\)/g, '')        // (ca. 250€)
        .replace(/\d+\s*-\s*\d+\s*€/g, '')                // 400-1000€ ohne Klammern
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // Bereinige Beschreibung
    if (pos.description) {
      pos.description = pos.description
        // Entferne Preisspannen
        .replace(/\(\s*\d+\s*-\s*\d+\s*€?\s*\)/g, '')
        .replace(/\(\s*ab\s+\d+\s*€?\s*\)/g, '')
        .replace(/\(\s*bis\s+\d+\s*€?\s*\)/g, '')
        .replace(/\(\s*ca\.\s*\d+\s*€?\s*\)/g, '')
        .replace(/\d+\s*-\s*\d+\s*€/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // Korrigiere Qualitätsbegriffe basierend auf EP
    const fullText = `${pos.title} ${pos.description}`.toLowerCase();
    
    // Bei niedrigen Preisen (<150€): Entferne Premium-Begriffe
    if (ep < 150) {
      if (fullText.includes('premium') || fullText.includes('luxus') || 
          fullText.includes('exklusiv') || fullText.includes('erstklassig')) {
        
        if (pos.title) {
          pos.title = pos.title
            .replace(/Premium(-| )?Qualität/gi, 'Standardausführung')
            .replace(/Premium(-| )?/gi, 'Standard-')
            .replace(/Luxus(-| )?/gi, '')
            .replace(/Exklusiv(-| )?/gi, '')
            .replace(/erstklassig(e|er|es)?/gi, 'solide');
        }
        
        if (pos.description) {
          pos.description = pos.description
            .replace(/Premium(-| )?Qualität/gi, 'Standardausführung')
            .replace(/hochwertig(e|er|es)?/gi, 'solide')
            .replace(/Luxus(-| )?/gi, '')
            .replace(/erstklassig(e|er|es)?/gi, 'bewährt');
        }
        
        warnings.push(`Qualitätsbegriff angepasst bei "${pos.title?.substring(0, 40)}..." (EP: €${ep})`);
        fixedCount++;
      }
    }
    
    // Bei hohen Preisen (>500€): Entferne Standard/Einfach-Begriffe
    else if (ep > 500) {
      if (fullText.includes('standard') || fullText.includes('einfach') || 
          fullText.includes('basis') || fullText.includes('baumarkt')) {
        
        if (pos.title) {
          pos.title = pos.title
            .replace(/Standard(-| )?Qualität/gi, 'gehobene Qualität')
            .replace(/Standard(-| )?/gi, '')
            .replace(/einfach(e|er|es)?/gi, 'hochwertig')
            .replace(/Basis(-| )?/gi, '');
        }
        
        if (pos.description) {
          pos.description = pos.description
            .replace(/Standard(-| )?Ausführung/gi, 'gehobene Ausführung')
            .replace(/Baumarkt(-| )?Qualität/gi, 'Markenqualität')
            .replace(/einfach(e|er|es)?/gi, 'qualitätsvoll');
        }
        
        warnings.push(`Qualitätsbegriff angepasst bei "${pos.title?.substring(0, 40)}..." (EP: €${ep})`);
        fixedCount++;
      }
    }
    
    // Logging bei Änderungen
    if (originalTitle !== pos.title || originalDesc !== pos.description) {
      console.log(`[PRICE-CLEAN] ${tradeCode}: Beschreibung bereinigt`);
      if (originalTitle !== pos.title) {
        console.log(`  Titel: "${originalTitle.substring(0, 50)}..." → "${pos.title?.substring(0, 50)}..."`);
      }
      if (originalDesc !== pos.description) {
        console.log(`  Desc: "${originalDesc.substring(0, 50)}..." → "${pos.description?.substring(0, 50)}..."`);
      }
    }
    
    // Skip Kleinmaterial
    if (pos.title?.toLowerCase().includes('kleinmaterial')) {
  return pos;
}
   
    const titleLower = pos.title?.toLowerCase() || '';
    const descLower = pos.description?.toLowerCase() || '';
    
    // NEUE REGEL: "Lieferung und Demontage" ist VERBOTEN
if (titleLower.includes('lieferung') && titleLower.includes('demontage') && 
    !titleLower.includes('montage')) {
  console.error(`[KRITISCH] Verbotene Kombination "Lieferung und Demontage" in ${tradeCode}`);
  
  // Korrigiere im Titel (case-insensitive)
  pos.title = pos.title.replace(/Lieferung\s+(und\s+)?Demontage/gi, 'Lieferung und Montage');
  
  // Korrigiere auch in der Beschreibung
  if (pos.description) {
    pos.description = pos.description.replace(/Lieferung\s+(und\s+)?Demontage/gi, 'Lieferung und Montage');
  }
  
  warnings.push(`"Lieferung und Demontage" korrigiert zu "Lieferung und Montage"`);
  fixedCount++;
}

// Zusätzlich: Demontage ohne Entsorgung ist auch falsch
if (titleLower.includes('demontage') && 
    !titleLower.includes('entsorgung') && 
    !titleLower.includes('lieferung')) {
  // Füge "und Entsorgung" hinzu
  pos.title = pos.title.replace(/Demontage\b/gi, 'Demontage und Entsorgung');
  
  if (pos.description && !pos.description.toLowerCase().includes('entsorgung')) {
    pos.description = pos.description.replace(/Demontage\b/gi, 'Demontage und Entsorgung');
  }
  
  warnings.push(`"Demontage" erweitert zu "Demontage und Entsorgung"`);
  fixedCount++;
}
    
    // NEUE REGEL: Vorwandinstallation NUR bei Trockenbau
    if (tradeCode !== 'TRO' && 
        (titleLower.includes('vorwand') || descLower.includes('vorwandinstallation'))) {
      console.error(`[KRITISCH] Vorwandinstallation in ${tradeCode} statt TRO`);
      
      if (tradeCode === 'SAN') {
        pos.title = pos.title.replace(/vorwand.*installation/gi, 'Unterputz-Installation');
        pos.description = pos.description?.replace(/vorwand/gi, 'Unterputz');
        warnings.push(`Vorwandinstallation in SAN korrigiert zu Unterputz`);
        fixedCount++;
      } else {
        // Bei anderen Gewerken: Position markieren
        pos._remove = true;
      }
    }
    
    // 1. NEUE REGEL: Entsorgungskosten prüfen
    if (titleLower.includes('entsorg') || 
        titleLower.includes('abtransport') ||
        titleLower.includes('abfuhr') ||
        titleLower.includes('demontage und entsorgung')) {
      
      // Entsorgung pro Stück (Fenster, Türen, etc.)
      if (pos.unit === 'Stk' && pos.unitPrice > 100) {
        const oldPrice = pos.unitPrice;
        pos.unitPrice = titleLower.includes('demontage') ? 120 : 40; // 120€ wenn Demontage dabei, sonst 40€
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
        warnings.push(`Entsorgung/Stück korrigiert: "${pos.title}": €${oldPrice} → €${pos.unitPrice}`);
        fixedCount++;
      }
      
      // Entsorgung pro m³
      if (pos.unit === 'm³' && pos.unitPrice > 200) {
        const oldPrice = pos.unitPrice;
        pos.unitPrice = 120; // Realistisch für Bauschutt
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
        warnings.push(`Entsorgung/m³ korrigiert: "${pos.title}": €${oldPrice} → €${pos.unitPrice}`);
        fixedCount++;
      }
      
      // Entsorgung pauschal
      if (pos.unit === 'psch' && pos.unitPrice > 2000) {
        const oldPrice = pos.unitPrice;
        pos.unitPrice = 800; // Maximal für Pauschal-Entsorgung
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
        warnings.push(`Entsorgung/pauschal korrigiert: "${pos.title}": €${oldPrice} → €${pos.unitPrice}`);
        fixedCount++;
      }
    }
    
    // 2. VERBESSERTE REGEL: Putzarbeiten und Ausbesserungen
if (titleLower.includes('putz') || 
    titleLower.includes('laibung') || 
    titleLower.includes('leibung') ||  // NEU: beide Schreibweisen
    titleLower.includes('spachtel') ||
    titleLower.includes('glätten') ||
    titleLower.includes('ausbesser')) {
  
  // NEU: Spezialfall Leibungsverputz nach Fenstermontage
  if ((titleLower.includes('leibung') || titleLower.includes('laibung')) && 
      titleLower.includes('verputz')) {
    if (pos.unit === 'm' && pos.unitPrice > 45) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 35;  // Speziell für Leibungsverputz
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Leibungsverputz korrigiert: €${oldPrice}/m → €35/m`);
      fixedCount++;
    }
  }
  // Normale Putzarbeiten pro lfd. Meter
  else if (pos.unit === 'm' && pos.unitPrice > 80) {
    const oldPrice = pos.unitPrice;
    pos.unitPrice = 45;
    pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
    warnings.push(`Putzarbeit/m korrigiert: €${oldPrice}/m → €${pos.unitPrice}/m`);
    fixedCount++;
  }
  
  // Für Quadratmeter (z.B. Wandflächen)
  else if (pos.unit === 'm²' && pos.unitPrice > 60) {
    const oldPrice = pos.unitPrice;
    pos.unitPrice = 35; // Etwas günstiger pro m² als pro laufenden Meter
    pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
    warnings.push(`Putzarbeit/m² korrigiert: "${pos.title}": €${oldPrice}/m² → €${pos.unitPrice}/m²`);
    fixedCount++;
  }
  
  // Für Pauschalpreise (kleine Ausbesserungen)
  else if (pos.unit === 'psch' && pos.unitPrice > 500) {
    const oldPrice = pos.unitPrice;
    pos.unitPrice = 250;
    pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
    warnings.push(`Ausbesserung pauschal korrigiert: "${pos.title}": €${oldPrice} → €${pos.unitPrice}`);
    fixedCount++;
  }
}
    
    // 3. ERWEITERTE REGEL: Nebenleistungen mit intelligenter Mengenerkennung
const EXPENSIVE_EQUIPMENT_KEYWORDS = [
  'kran', 'gerüst', 'bagger', 'aufzug', 'hebebühne', 
  'spezialgerät', 'schwerlast', 'transport'
];

const isSpecialEquipment = EXPENSIVE_EQUIPMENT_KEYWORDS.some(keyword => 
  titleLower.includes(keyword)
);

const isNebenleistung = 
  titleLower.includes('anschluss') ||
  titleLower.includes('abdichtung') ||
  titleLower.includes('laibung') ||
  titleLower.includes('leibung') ||
  titleLower.includes('befestigung') ||
  titleLower.includes('dämmstreifen') ||
  titleLower.includes('anarbeiten');

// NEU: Intelligente Mengenprüfung für Nebenleistungen
if (isNebenleistung && pos.unit === 'm') {
  const fensterPositionen = lv.positions.filter(p => 
    p.title?.toLowerCase().includes('fenster') && 
    !p.title?.toLowerCase().includes('bank') &&
    p.unit === 'Stk'
  );
  
  if (fensterPositionen.length > 0) {
    const totalFenster = fensterPositionen.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const erwarteteLeibungsMeter = totalFenster * 3;
    
    if (titleLower.includes('leibung') && pos.quantity > erwarteteLeibungsMeter * 2) {
      const oldQuantity = pos.quantity;
      pos.quantity = Math.round(erwarteteLeibungsMeter * 10) / 10;
      warnings.push(`Leibungsmenge korrigiert: ${oldQuantity}m → ${pos.quantity}m`);
      fixedCount++;
    }
  }
}

// Preiskorrektur für Nebenleistungen
if (isNebenleistung && !isSpecialEquipment && pos.unit !== 'psch') {
  const maxPreise = {
    'leibung': { m: 45, m2: 60 },
    'laibung': { m: 45, m2: 60 },
    'abdichtung': { m: 40, m2: 55 },
    'anschluss': { m: 60, m2: 80 },
    'befestigung': { m: 30, Stk: 25 },
    'dämmstreifen': { m: 15, m2: 25 }
  };
  
  Object.entries(maxPreise).forEach(([keyword, limits]) => {
    if (titleLower.includes(keyword) && limits[pos.unit]) {
      if (pos.unitPrice > limits[pos.unit]) {
        const oldPrice = pos.unitPrice;
        pos.unitPrice = limits[pos.unit];
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
        warnings.push(`${keyword} korrigiert: €${oldPrice}/${pos.unit} → €${pos.unitPrice}/${pos.unit}`);
        fixedCount++;
      }
    }
  });
}

// WICHTIGE REGEL BLEIBT ERHALTEN: Warnung bei teuren Spezialleistungen
if (isSpecialEquipment && pos.unitPrice > 1000) {
  console.log(`[PRICE-CHECK] Spezialleistung erkannt: "${pos.title}" - €${pos.unitPrice} (keine Korrektur)`);
  if (pos.unitPrice > 5000) {
    warnings.push(`REVIEW: Hoher Preis für Spezialleistung "${pos.title}": €${pos.unitPrice}`);
  }
}
    
    // 4. BESTEHENDE REGEL: Hauptpositionen Mindestpreise
    const isMainPosition = 
      titleLower.includes('fenster') && !titleLower.includes('entsorg') ||
      titleLower.includes('tür') && !titleLower.includes('entsorg') ||
      titleLower.includes('heizung') ||
      titleLower.includes('sanitär');
    
    if (isMainPosition && pos.unitPrice < 50) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 50;  
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;  
      warnings.push(`Mindestpreis: €${oldPrice} → €50`);  
      fixedCount++;  
      }  
      
     // 5. FENSTER-SPEZIFISCHE PREISKORREKTUREN
if (tradeCode === 'FEN') {
  
  // Hauptfenster-Positionen (Lieferung und Montage)
  if (titleLower.includes('fenster') && 
      (titleLower.includes('lieferung') || titleLower.includes('montage')) &&
      !titleLower.includes('reinigung') && 
      !titleLower.includes('abdichtung') && 
      !titleLower.includes('vermessung')) {
    
    const oldPrice = pos.unitPrice;
    const sizeMatch = (pos.title || pos.description || '').match(/(\d+)\s*x\s*(\d+)/);
    
    if (sizeMatch) {
      // Berechne Preis basierend auf Größe
      const width = parseInt(sizeMatch[1]);
      const height = parseInt(sizeMatch[2]);
      const area = (width * height) / 10000; // in m²
      
      // Preisberechnung nach Material
      if (titleLower.includes('kunststoff')) {
        pos.unitPrice = Math.round(400 + (area * 300));
      } else if (titleLower.includes('holz-alu') || titleLower.includes('holz-aluminium')) {
        pos.unitPrice = Math.round(800 + (area * 600));
      } else if (titleLower.includes('aluminium') || titleLower.includes('alu')) {
        pos.unitPrice = Math.round(700 + (area * 500));
      } else if (titleLower.includes('holz')) {
        pos.unitPrice = Math.round(600 + (area * 500));
      } else {
        pos.unitPrice = Math.round(500 + (area * 400));
      }
      
      warnings.push(`Fenster-Preis angepasst: €${oldPrice} → €${pos.unitPrice}`);
      fixedCount++;
      
    } else if (titleLower.includes('demontage')) {
      // Demontage ohne Maße
      pos.unitPrice = 80;
      warnings.push(`Fenster-Demontage: €${oldPrice} → €80`);
      fixedCount++;
      
    } else {
      // Standard-Fenster ohne Maße
      pos.unitPrice = 800;
      warnings.push(`Standard-Fenster: €${oldPrice} → €800`);
      fixedCount++;
    }
  }
  
  // Nebenleistungen Fenster
  
  // Reinigung
  if (titleLower.includes('reinigung') && pos.unitPrice > 50) {
    const oldPrice = pos.unitPrice;
    pos.unitPrice = 25;
    pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
    warnings.push(`Fensterreinigung korrigiert: €${oldPrice} → €25`);
    fixedCount++;
  }
  
  // Abdichtung (pro lfd. Meter)
  if (titleLower.includes('abdichtung') && pos.unit === 'm' && pos.unitPrice > 60) {
    const oldPrice = pos.unitPrice;
    pos.unitPrice = 35;
    pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
    warnings.push(`Abdichtung korrigiert: €${oldPrice}/m → €35/m`);
    fixedCount++;
  }

  // Fensterbänke (pro lfd. Meter)
if (titleLower.includes('fensterbank') || titleLower.includes('fenstersims')) {
  // Außenfensterbänke
  if (titleLower.includes('außen') || titleLower.includes('aussen')) {
    if (pos.unit === 'm' && pos.unitPrice > 85) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 65; // Realistisch für Alu-Fensterbänke
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Außenfensterbank korrigiert: €${oldPrice}/m → €65/m`);
      fixedCount++;
    }
  }
  // Innenfensterbänke
  else if (titleLower.includes('innen')) {
    if (pos.unit === 'm' && pos.unitPrice > 120) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 85; // Naturstein/Kunststein teurer
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Innenfensterbank korrigiert: €${oldPrice}/m → €85/m`);
      fixedCount++;
    }
  }
  // Unspezifizierte Fensterbänke
  else {
    if (pos.unit === 'm' && pos.unitPrice > 100) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 75; // Mittelwert
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Fensterbank korrigiert: €${oldPrice}/m → €75/m`);
      fixedCount++;
    }
  }
}
  
  // Vermessung/Aufmaß
  if ((titleLower.includes('vermessung') || titleLower.includes('aufmaß')) && pos.unitPrice > 150) {
    const oldPrice = pos.unitPrice;
    pos.unitPrice = 75;
    pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
    warnings.push(`Aufmaß korrigiert: €${oldPrice} → €75`);
    fixedCount++;
  }
  
  // Silikonverfugung
  if ((titleLower.includes('silikon') || titleLower.includes('verfugung')) && 
      pos.unit === 'm' && pos.unitPrice > 25) {
    const oldPrice = pos.unitPrice;
    pos.unitPrice = 15;
    pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
    warnings.push(`Verfugung korrigiert: €${oldPrice}/m → €15/m`);
    fixedCount++;
  }
}
      
// NEUE REGEL: INNENTÜREN MINDESTPREISE MIT SONDERMASS-BERECHNUNG
if (tradeCode === 'TIS') {
  // Extrahiere Maße aus Beschreibung für Sondermaß-Berechnung
  const sizeMatch = (pos.description || pos.title || '').match(/(\d+)\s*x\s*(\d+)/);
  let priceMultiplier = 1;
  
  if (sizeMatch) {
    const width = parseInt(sizeMatch[1]);
    const height = parseInt(sizeMatch[2]);
    
    // Realistischere Aufpreise für Sondermaße
    if (width > 100 || height > 210) {
      priceMultiplier = 1.3;  // 30% Aufschlag
    }
    if (width > 120 || height > 230) {
      priceMultiplier = 1.5;  // 50% Aufschlag für extreme Größen
    }
  }
  
  // NUR echte Türen prüfen, NICHT Zubehör
  const istEchteTuer = (
    (titleLower.includes('innentür') || 
     titleLower.includes('wohnungstür') ||
     (titleLower.includes('tür') && titleLower.includes('lieferung'))) &&
    !titleLower.includes('drücker') &&
    !titleLower.includes('beschlag') &&
    !titleLower.includes('spion') &&
    !titleLower.includes('dichtung') &&
    !titleLower.includes('schloss') &&
    !titleLower.includes('band') &&
    !titleLower.includes('zubehör')
  );

  if (istEchteTuer) {
    // Wohnungstür/Sicherheitstür
    if (descLower.includes('wohnungseingang') || 
        titleLower.includes('wohnungstür') ||
        titleLower.includes('sicherheit')) {
      const minPrice = Math.round(1500 * priceMultiplier);
      const maxPrice = Math.round(3000 * priceMultiplier);
      
      if (pos.unitPrice < minPrice || pos.unitPrice > maxPrice) {
        const oldPrice = pos.unitPrice;
        pos.unitPrice = Math.round(2200 * priceMultiplier);
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
        warnings.push(`Wohnungstür korrigiert: €${oldPrice} → €${pos.unitPrice}`);
        fixedCount++;
      }
    } 
    // Standard Innentür
    else {
      const minPrice = Math.round(400 * priceMultiplier);
      const maxPrice = Math.round(800 * priceMultiplier);
      
      if (pos.unitPrice < minPrice || pos.unitPrice > maxPrice) {
        const oldPrice = pos.unitPrice;
        pos.unitPrice = Math.round(600 * priceMultiplier);
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
        warnings.push(`Innentür ${sizeMatch ? `(${sizeMatch[1]}x${sizeMatch[2]}cm)` : ''} korrigiert: €${oldPrice} → €${pos.unitPrice}`);
        fixedCount++;
      }
    }
  }
  
  // Demontage speziell prüfen
  if (titleLower.includes('demontage') && titleLower.includes('tür')) {
    if (pos.unitPrice < 60 || pos.unitPrice > 150) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 80;
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Tür-Demontage korrigiert: €${oldPrice} → €${pos.unitPrice}`);
      fixedCount++;
    }
  }
  
  // Zargen separat prüfen (MIT SONDERMASS-AUFSCHLAG!)
if (titleLower.includes('zarge') && !titleLower.includes('dichtung')) {
  const minPrice = 120 * priceMultiplier;  // Mit Multiplikator!
  const maxPrice = 300 * priceMultiplier;  // Mit Multiplikator!
  
  if (pos.unitPrice < minPrice || pos.unitPrice > maxPrice) {
    const oldPrice = pos.unitPrice;
    pos.unitPrice = 180 * priceMultiplier;  // Mit Multiplikator!
    pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
    warnings.push(`Zarge ${sizeMatch ? `(${sizeMatch[1]}x${sizeMatch[2]}cm)` : ''} korrigiert: €${oldPrice} → €${pos.unitPrice}`);
    fixedCount++;
  }
}

// Türdrücker/Beschläge
if (titleLower.includes('drücker') || 
    (titleLower.includes('beschlag') && !titleLower.includes('zarge'))) {
  const istSicherheit = titleLower.includes('sicherheit') || titleLower.includes('wohnungstür');
  const minPrice = istSicherheit ? 200 : 60;
  const maxPrice = istSicherheit ? 400 : 150;
  
  if (pos.unitPrice < minPrice || pos.unitPrice > maxPrice) {
    const oldPrice = pos.unitPrice;
    pos.unitPrice = istSicherheit ? 280 : 95;
    pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
    warnings.push(`${istSicherheit ? 'Sicherheits-' : ''}Beschlag korrigiert: €${oldPrice} → €${pos.unitPrice}`);
    fixedCount++;
  }
}

// Türspion
if (titleLower.includes('spion')) {
  if (pos.unitPrice < 35 || pos.unitPrice > 80) {
    const oldPrice = pos.unitPrice;
    pos.unitPrice = 55;
    pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
    warnings.push(`Türspion korrigiert: €${oldPrice} → €${pos.unitPrice}`);
    fixedCount++;
  }
}  

// Zargendichtung
if (titleLower.includes('zargendichtung') || 
    (titleLower.includes('dichtung') && titleLower.includes('tür'))) {
  if (pos.unitPrice < 25 || pos.unitPrice > 60) {
    const oldPrice = pos.unitPrice;
    pos.unitPrice = 35;
    pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
    warnings.push(`Zargendichtung korrigiert: €${oldPrice} → €${pos.unitPrice}`);
    fixedCount++;
  }
}
} 
    
// ZUSÄTZLICHE REGEL: KEINE PREISE UNTER 10€ (außer Kleinmaterial)
if (!titleLower.includes('kleinmaterial') && 
    !titleLower.includes('befestigungsmaterial') &&
    pos.unitPrice < 10 && 
    pos.unit === 'Stk') {
  const oldPrice = pos.unitPrice;
  
  // Bestimme Mindestpreis basierend auf Gewerk
  let minPrice = 50; // Default
  
  if (tradeCode === 'TIS') minPrice = 250;
  if (tradeCode === 'FEN') minPrice = 400;
  if (tradeCode === 'SAN') minPrice = 150;
  if (tradeCode === 'ELEKT') minPrice = 30;
  
  pos.unitPrice = minPrice;
  pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
  warnings.push(`Unrealistischer Preis korrigiert: "${pos.title}": €${oldPrice} → €${pos.unitPrice}`);
  fixedCount++;
}

// NEUE REGEL: Gewerk-spezifische Begriffskorrekturen
if (tradeCode === 'MAL') {
  // Maler liefern NICHTS - nur Oberflächenbearbeitung
  if (titleLower.includes('lieferung')) {
    // Entferne "Lieferung und" komplett
    pos.title = pos.title.replace(/Lieferung\s+(und\s+)?/gi, '');
    
    // Falls nur "Lieferung" übrig bleibt, ersetze komplett
    if (pos.title.trim() === '') {
      pos.title = 'Oberflächenbehandlung';
    }
    
    warnings.push(`Maler: "Lieferung" entfernt aus "${originalTitle}"`);
    fixedCount++;
  }
  
  // Maler-typische Leistungen sicherstellen
  if (titleLower.includes('fenster') && !titleLower.includes('anstrich') && 
      !titleLower.includes('lackier') && !titleLower.includes('streich')) {
    pos.title += ' - Anstrich und Lackierung';
    warnings.push(`Maler: Leistungsbeschreibung präzisiert`);
    fixedCount++;
  }
}

// Ähnlich für andere Gewerke
if (tradeCode === 'ELEK') {
  // Elektriker liefern keine Fenster/Türen
  if ((titleLower.includes('fenster') || titleLower.includes('tür')) && 
      titleLower.includes('lieferung')) {
    pos.title = pos.title.replace(/Lieferung\s+(und\s+)?Montage/gi, 'Installation');
    warnings.push(`Elektriker: Falsche Leistung korrigiert`);
    fixedCount++;
  }
}
    
    // SPEZIAL-REGEL FÜR GERÜST
if (tradeCode === 'GER') {
  if (titleLower.includes('auf') && titleLower.includes('abbau') || 
      titleLower.includes('gerüst') && titleLower.includes('montage')) {
    if (pos.unit === 'm²' && pos.unitPrice > 15) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 10; // Realistischer Mittelwert
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Gerüst Auf-/Abbau korrigiert: €${oldPrice}/m² → €${pos.unitPrice}/m²`);
      fixedCount++;
    }
  }
  
  if (titleLower.includes('standzeit') || titleLower.includes('miete')) {
    if (pos.unit === 'm²' && pos.unitPrice > 10) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 5; // Für 4 Wochen
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Gerüst Standzeit korrigiert: €${oldPrice}/m² → €${pos.unitPrice}/m²`);
      fixedCount++;
    }
  }
} 

    // SPEZIAL-REGEL FÜR FENSTER-DEMONTAGE
if (tradeCode === 'FEN' && lv.positions) {
  // Sammle alle Demontage-Positionen
  const demontagePositions = lv.positions.filter(pos => 
    pos.title?.toLowerCase().includes('demontage') && 
    pos.title?.toLowerCase().includes('fenster')
  );
  
  if (demontagePositions.length > 1) {
    console.warn(`[FEN] Konsolidiere ${demontagePositions.length} Demontage-Positionen zu einer`);
    
    // Berechne Gesamtmenge
    const totalQuantity = demontagePositions.reduce((sum, pos) => 
      sum + (pos.quantity || 0), 0
    );
    
    // Erstelle eine konsolidierte Position
    const consolidatedDemontage = {
      pos: demontagePositions[0].pos,
      title: 'Demontage und Entsorgung sämtlicher Altfenster',
      description: 'Fachgerechte Demontage aller Bestandsfenster inkl. Entsorgung und Recycling gemäß Abfallverordnung',
      quantity: totalQuantity,
      unit: 'Stk',
      unitPrice: 60, // Realistischer Preis
      totalPrice: totalQuantity * 60,
      dataSource: 'consolidated'
    };
    
    // Entferne alte Positionen und füge neue hinzu
    lv.positions = lv.positions.filter(pos => 
      !demontagePositions.includes(pos)
    );
    lv.positions.unshift(consolidatedDemontage); // Am Anfang einfügen
    
    fixedCount++;
    warnings.push(`Fenster-Demontage zu Sammelposition konsolidiert`);
  }
}    

// SPEZIAL-REGEL FÜR ZIMMERER - VOLLSTÄNDIG ERWEITERT
if (tradeCode === 'ZIMM') {
  // Dachstuhl-Preiskorrektur (bestehend)
  if (titleLower.includes('dachstuhl')) {
    if (pos.unit === 'm²' && pos.unitPrice > 250) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 180;
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Dachstuhl korrigiert: €${oldPrice}/m² → €${pos.unitPrice}/m²`);
      fixedCount++;
    }
  }
  
  // VERBESSERTE REGEL: Gaubenkonstruktion mit Größenberechnung
  if (titleLower.includes('gaube')) {
    if (titleLower.includes('konstruktion') || 
        titleLower.includes('erstellen') || 
        titleLower.includes('sparren') ||
        titleLower.includes('zimmermann')) {
      
      // Extrahiere Größe aus Beschreibung
      const sizeMatch = (pos.title + ' ' + pos.description).match(/(\d+(?:[,\.]\d+)?)\s*m/);
      const width = sizeMatch ? parseFloat(sizeMatch[1].replace(',', '.')) : 2.5; // Default 2.5m
      
      // Grundpreis nach Gaubentyp
      let basePrice;
      if (titleLower.includes('schlepp')) {
        basePrice = 3500; // pro Meter Breite
      } else if (titleLower.includes('sattel') || titleLower.includes('giebel')) {
        basePrice = 4000; // pro Meter Breite
      } else if (titleLower.includes('walm')) {
        basePrice = 4500; // pro Meter Breite
      } else if (titleLower.includes('fledermaus')) {
        basePrice = 5000; // pro Meter Breite
      } else {
        basePrice = 3800; // Standard
      }
      
      // Berechne Preis basierend auf Breite
      const calculatedPrice = Math.round(basePrice * width);
      
      // Preiskorrektur wenn nötig
      if (pos.unit === 'Stk' && (pos.unitPrice < calculatedPrice * 0.7 || pos.unitPrice > calculatedPrice * 1.5)) {
        const oldPrice = pos.unitPrice;
        pos.unitPrice = calculatedPrice;
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
        warnings.push(`Gaube ${width}m (${titleLower.includes('schlepp') ? 'Schlepp' : 'Standard'}): €${oldPrice} → €${pos.unitPrice}`);
        fixedCount++;
      }
      
      // Wenn Einheit m² ist, umrechnen
      if (pos.unit === 'm²') {
        const oldPrice = pos.unitPrice;
        pos.unitPrice = 650; // Pauschale für Gaube pro m²
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
        warnings.push(`Gaube/m² korrigiert: €${oldPrice}/m² → €650/m²`);
        fixedCount++;
      }
    }
  }
  
  // NEU: Kehlbalken - niemals über 150€ pro Stück
  if (titleLower.includes('kehlbalken')) {
    if (pos.unit === 'Stk' && pos.unitPrice > 150) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 95;
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Kehlbalken korrigiert: €${oldPrice} → €95/Stk`);
      fixedCount++;
    }
  }
  
  // NEU: Wechselkonstruktion - realistischer Preis
  if (titleLower.includes('wechsel') && titleLower.includes('konstruktion')) {
    if (pos.unit === 'Stk' && pos.unitPrice > 1500) {
      const oldPrice = pos.unitPrice;
      const sizeMatch = (pos.title + ' ' + pos.description).match(/(\d+(?:[,\.]\d+)?)\s*m/);
      const width = sizeMatch ? parseFloat(sizeMatch[1].replace(',', '.')) : 2.0;
      pos.unitPrice = Math.round(350 * width); // ~350€ pro Meter
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Wechselkonstruktion ${width}m: €${oldPrice} → €${pos.unitPrice}`);
      fixedCount++;
    }
  }
  
  // NEU: Gaubenwangen - max 600€ pro Stück
  if (titleLower.includes('gaubenwange')) {
    if (pos.unit === 'Stk' && (pos.unitPrice < 300 || pos.unitPrice > 600)) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 420;
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Gaubenwangen korrigiert: €${oldPrice} → €420/Stk`);
      fixedCount++;
    }
  }
  
  // NEU: Sparrenverstärkung - max 250€ pro Stück
  if (titleLower.includes('verstärkung') && titleLower.includes('sparren')) {
    if (pos.unit === 'Stk' && pos.unitPrice > 250) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 180;
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Sparrenverstärkung korrigiert: €${oldPrice} → €180/Stk`);
      fixedCount++;
    }
  }
  
  // NEU: Begutachtung/Statik - Pauschale max 1500€
  if (titleLower.includes('begutachtung') || titleLower.includes('statisch')) {
    if (pos.unit === 'psch' && pos.unitPrice > 1500) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 850;
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Statische Begutachtung korrigiert: €${oldPrice} → €850`);
      fixedCount++;
    }
  }
  
  // NEU: Kranstellung - Tagespreis max 1200€
  if (titleLower.includes('kran')) {
    if (pos.unit === 'Tag' && pos.unitPrice > 1200) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 850;
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Kranstellung korrigiert: €${oldPrice} → €850/Tag`);
      fixedCount++;
    }
  }
  
  // NEU: Windrispen - max 40€/m
  if (titleLower.includes('windrisp') || titleLower.includes('aussteifung')) {
    if (pos.unit === 'lfd.m' && pos.unitPrice > 40) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 22;
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Windrispen korrigiert: €${oldPrice} → €22/m`);
      fixedCount++;
    }
  }
  
  // Dachlatten und Unterkonstruktion (bestehend)
  if (titleLower.includes('dachlatte') || titleLower.includes('lattung')) {
    if (pos.unit === 'm²' && pos.unitPrice > 35) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 25;
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Dachlattung korrigiert: €${oldPrice}/m² → €25/m²`);
      fixedCount++;
    }
  }
  
  // Carport/Überdachung mit Größenfaktor (bestehend)
  if (titleLower.includes('carport') || titleLower.includes('überdachung')) {
    const areaMatch = (pos.title + ' ' + pos.description).match(/(\d+)\s*m²/);
    const area = areaMatch ? parseInt(areaMatch[1]) : 20; // Default 20m²
    
    // Kleinere Flächen sind teurer pro m²
    let pricePerSqm = area < 15 ? 300 : area < 30 ? 250 : 200;
    
    if (pos.unit === 'm²' && pos.unitPrice > pricePerSqm * 1.3) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = pricePerSqm;
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Carport ${area}m²: €${oldPrice}/m² → €${pricePerSqm}/m²`);
      fixedCount++;
    }
  }
  
  // Holzbalkendecke (bestehend)
  if (titleLower.includes('holzbalkendecke') || titleLower.includes('balkendecke')) {
    if (pos.unit === 'm²' && pos.unitPrice > 200) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 150;
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Holzbalkendecke korrigiert: €${oldPrice}/m² → €150/m²`);
      fixedCount++;
    }
  }
  
  // NEU: Allgemeine Holzkonstruktion m² Preise
  if (pos.unit === 'm²' && !titleLower.includes('dachstuhl')) {
    const maxPreise = {
      'gaubendach': 150,
      'gaubenstirnwand': 120,
      'holzrahmenbau': 180,
      'schalung': 45,
      'lattung': 25
    };
    
    Object.entries(maxPreise).forEach(([keyword, maxPrice]) => {
      if (titleLower.includes(keyword) && pos.unitPrice > maxPrice * 1.2) {
        const oldPrice = pos.unitPrice;
        pos.unitPrice = maxPrice;
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
        warnings.push(`${keyword} korrigiert: €${oldPrice}/m² → €${maxPrice}/m²`);
        fixedCount++;
      }
    });
  }
  
  // FEHLERHAFTE POSITIONEN entfernen (bestehend)
  if (titleLower.includes('eindeckung') || 
      titleLower.includes('dachziegel') || 
      titleLower.includes('dachstein')) {
    console.error(`[KRITISCH] Eindeckung bei ZIMM statt DACH`);
    pos._remove = true;
    warnings.push(`Eindeckung gehört zu DACHDECKER`);
    fixedCount++;
  }
}

  // ZUSÄTZLICH: Dachdecker darf keine Zimmererarbeiten haben
if (tradeCode === 'DACH') {
  // Dachdecker macht KEINE Holzkonstruktionen
  if ((titleLower.includes('gaube') && titleLower.includes('erstellen')) ||
      titleLower.includes('dachstuhl') ||
      titleLower.includes('sparren') ||
      titleLower.includes('zimmermann') ||
      titleLower.includes('holzkonstruktion')) {
    
    console.error(`[KRITISCH] Zimmererarbeit bei DACH`);
    pos._remove = true;
    pos._moveToTrade = 'ZIMM';
    warnings.push(`Holzkonstruktion gehört zu ZIMMERER`);
    fixedCount++;
  }
}
    
  // SPEZIAL-REGEL FÜR ROHBAU - Betonstahl-Preise
if (tradeCode === 'ROH') {
  // Betonstahl BSt 500 - Stabstahl
  if ((titleLower.includes('betonstahl') || titleLower.includes('bst 500')) && 
      !titleLower.includes('matte')) {
    
    // Prüfe ob Einheit kg ist
    if (pos.unit === 'kg') {
      const korrektPreis = 1.85; // €/kg für Stabstahl
      
      if (pos.unitPrice < korrektPreis * 0.8 || pos.unitPrice > korrektPreis * 1.5) {
        const oldPrice = pos.unitPrice;
        pos.unitPrice = korrektPreis;
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
        warnings.push(`Betonstahl BSt 500 korrigiert: ${oldPrice}€/kg → ${korrektPreis}€/kg`);
        fixedCount++;
      }
    }
  }
  
  // Betonstahlmatten
  if (titleLower.includes('betonstahlmatte') || 
      (titleLower.includes('matte') && titleLower.includes('stahl'))) {
    
    if (pos.unit === 'kg' || pos.unit === 'm²') {
      const korrektPreis = pos.unit === 'kg' ? 2.20 : 35.00; // €/kg oder €/m²
      
      if (pos.unitPrice < korrektPreis * 0.8 || pos.unitPrice > korrektPreis * 1.5) {
        const oldPrice = pos.unitPrice;
        pos.unitPrice = korrektPreis;
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
        warnings.push(`Betonstahlmatten korrigiert: ${oldPrice}€/${pos.unit} → ${korrektPreis}€/${pos.unit}`);
        fixedCount++;
      }
    }
  }
  
  // Weitere Rohbau-Preise
  const rohbauPreise = {
    'beton c25/30': { unit: 'm³', price: 135 },
    'beton c20/25': { unit: 'm³', price: 125 },
    'schalung': { unit: 'm²', price: 45 },
    'mauerwerk': { unit: 'm²', price: 95 },
    'poroton': { unit: 'm²', price: 85 },
    'kalksandstein': { unit: 'm²', price: 75 }
  };
  
  // Prüfe gegen definierte Preise
  Object.entries(rohbauPreise).forEach(([material, config]) => {
    if (titleLower.includes(material) && pos.unit === config.unit) {
      if (pos.unitPrice < config.price * 0.7 || pos.unitPrice > config.price * 1.3) {
        const oldPrice = pos.unitPrice;
        pos.unitPrice = config.price;
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
        warnings.push(`${material} korrigiert: ${oldPrice}€/${config.unit} → ${config.price}€/${config.unit}`);
        fixedCount++;
      }
    }
  });
}
    
    // 5. GENERELLE ABSURDITÄTSPRÜFUNG
    if (pos.unit === 'm' && pos.unitPrice > 500) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 80;
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Absurder Preis/m korrigiert: "${pos.title}": €${oldPrice} → €${pos.unitPrice}`);
      fixedCount++;
    }
    
    if (pos.unit === 'm²' && pos.unitPrice > 500) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 120;
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Absurder Preis/m² korrigiert: "${pos.title}": €${oldPrice} → €${pos.unitPrice}`);
      fixedCount++;
    }
    
    // 6. NEUE REGEL: Demontage darf nicht teurer als Montage sein
    if (titleLower.includes('demontage') || titleLower.includes('ausbau')) {
      // Demontage maximal 30% der Montage
      if (pos.unit === 'Stk' && pos.unitPrice > 200) {
        const oldPrice = pos.unitPrice;
        pos.unitPrice = 80; // Pauschal für Demontage
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
        warnings.push(`Demontage korrigiert: "${pos.title}": €${oldPrice} → €${pos.unitPrice}`);
        fixedCount++;
      }
    }
    
    return pos;
  }).filter(pos => !pos._remove); 
  
  // Neuberechnung der Gesamtsumme wenn Änderungen
  if (fixedCount > 0) {
    const newTotal = lv.positions.reduce((sum, pos) => sum + (pos.totalPrice || 0), 0);
    lv.totalSum = Math.round(newTotal * 100) / 100;
  }
  
  if (warnings.length > 0) {
    console.warn(`[PRICE-CHECK] ${tradeCode}: ${fixedCount} kritische Preise korrigiert`);
    warnings.forEach(w => console.warn(`  - ${w}`));
  }

  // Rechenfehler IMMER korrigieren
lv.positions = lv.positions.map(pos => {
  const sollSumme = Math.round((pos.quantity || 0) * (pos.unitPrice || 0) * 100) / 100;
  if (Math.abs((pos.totalPrice || 0) - sollSumme) > 0.01) {
    console.error(`[RECHENFEHLER] "${pos.title}": ${pos.quantity} × ${pos.unitPrice} = ${sollSumme} (war: ${pos.totalPrice})`);
    pos.totalPrice = sollSumme;
    fixedCount++;
  }
  return pos;
});

// Verhältnismäßigkeiten prüfen
if (tradeCode === 'FEN') {
  const fensterBanks = lv.positions.filter(p => p.title?.toLowerCase().includes('fensterbank'));
  const leibungen = lv.positions.filter(p => 
    p.title?.toLowerCase().includes('leibung') || p.title?.toLowerCase().includes('laibung')
  );
  
  if (fensterBanks.length > 0 && leibungen.length > 0) {
    const avgBankMeter = fensterBanks.reduce((sum, p) => sum + p.quantity, 0) / fensterBanks.length;
    leibungen.forEach(pos => {
      // Leibungen sollten 2-3x mehr Meter haben als Fensterbänke
      if (Math.abs(pos.quantity - avgBankMeter) < 1) { // Fast identisch = Problem
        pos.quantity = Math.round(avgBankMeter * 2.5 * 10) / 10;
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
        warnings.push(`Leibungsmenge angepasst auf ${pos.quantity}m`);
        fixedCount++;
      }
    });
  }
}

  // Nach der Rechenfehler-Korrektur
if (fixedCount > 0) {
  const newTotal = lv.positions.reduce((sum, pos) => sum + (pos.totalPrice || 0), 0);
  lv.totalSum = Math.round(newTotal * 100) / 100;
}
  
  return { lv, fixedCount, warnings };
}

/**
 * Finale LV-Validierung für alle Gewerke
 */
function finalLVValidation(lv, tradeCode) {
  const issues = [];
  
  // UMFASSENDE Cross-Trade-Keywords für alle Gewerke
  const crossTradeKeywords = {
    'DACH': { 
      forbidden: ['fassadendämmung', 'wdvs', 'fenster', 'haustür', 'innentür', 'sanitär', 'elektro', 'heizung', 'fliesen', 'parkett'],
      except: ['dachfenster', 'dachausstieg', 'blitzschutz']
    },
    'FASS': { 
      forbidden: ['fenster einbau', 'fenster lieferung', 'isokorb', 'tür montage', 'dachziegel', 'dachrinne', 'heizung', 'sanitär', 'elektro', 'parkett', 'fliesen'],
      except: ['fensterbank', 'laibung', 'fenstersims']
    },
    'FEN': { 
      forbidden: ['fassadendämmung', 'wdvs', 'außenputz', 'dachziegel', 'heizung', 'sanitär', 'elektro komplett'],
      except: ['fensterbank', 'rollladenkasten']
    },
    'ZIMM': {
    forbidden: ['innentüren', 'wohnungseingangstür', 'möbel', 'fenster', 'dachfenster', 'elektro', 'sanitär', 'fliesen'],
    except: ['holzverbindung', 'zimmermannsverbindung']
    },    
    'GER': { 
      forbidden: ['dämmung', 'putz', 'fenster einbau', 'malerarbeiten', 'elektro', 'sanitär', 'heizung', 'fliesen'],
      except: []
    },
    'ELEKT': {
      forbidden: ['sanitär objekte', 'heizkessel', 'heizkörper', 'fliesen', 'parkett', 'fenster', 'dämmung'],
      except: ['durchlauferhitzer', 'elektro-heizung']
    },
    'SAN': {
      forbidden: ['elektro verteiler', 'steckdosen', 'schalter', 'fenster', 'parkett', 'dämmung', 'dachziegel'],
      except: ['durchlauferhitzer', 'elektro-boiler']
    },
    'HEI': {
      forbidden: ['sanitär objekte', 'wc', 'dusche', 'elektro verteiler', 'fenster', 'fliesen', 'parkett'],
      except: ['warmwasser', 'zirkulation']
    },
    'FLI': {
      forbidden: ['parkett', 'laminat', 'vinyl', 'teppich', 'elektro', 'sanitär', 'heizung', 'fenster'],
      except: ['sockelleiste', 'übergangsprofil']
    },
    'BOD': {
      forbidden: ['fliesen', 'naturstein bad', 'elektro', 'sanitär', 'heizung', 'fenster', 'dämmung'],
      except: ['sockelleiste', 'übergangsprofil']
    },
    'MAL': {
      forbidden: ['fenster einbau', 'elektro installation', 'sanitär installation', 'heizung', 'fliesen', 'parkett'],
      except: ['malervorarbeiten']
    },
    'TRO': {
      forbidden: ['fenster', 'türen', 'elektro komplett', 'sanitär komplett', 'heizung komplett', 'fliesen'],
      except: ['revisionsklappen', 'aussparungen', 'installationsschächte']
    },
    'TIS': {
      forbidden: ['fenster', 'elektro installation', 'sanitär', 'heizung', 'rigips', 'gipskarton', 'sockelleisten'],
      except: ['fensterbank innen', 'möbelanschluss']
    },
    'ROH': {
      forbidden: ['fenster einbau', 'estrich', 'gaube', 'elektro feininstallation', 'sanitär objekte', 'fliesen', 'parkett', 'rigips'],
      except: ['kernbohrung', 'durchbruch']
    },
    'ABBR': {
      forbidden: ['neubau', 'lieferung', 'neue fenster', 'neue elektro', 'neue sanitär', 'aufbau'],
      except: ['schutzmaßnahmen', 'sicherung']
    },
    'ESTR': {
      forbidden: ['warmwasser', 'bewehrung', 'rohrsystem', 'aufheizprotokoll', 'dichtheitsprüfung', 'heizkreisverteiler', 'fliesen', 'parkett', 'oberbelag', 'elektro', 'sanitär', 'fenster'],
      except: ['fußbodenheizung', 'dämmung unter estrich']
    },
    'AUSS': {
      forbidden: ['innenputz', 'innentüren', 'elektro innen', 'sanitär innen', 'heizung'],
      except: ['außensteckdose', 'außenbeleuchtung', 'außenwasserhahn']
    },
    'SCHL': {
      forbidden: ['holzarbeiten', 'elektro installation', 'sanitär', 'heizung', 'fliesen'],
      except: ['metallzargen', 'stahlunterkonstruktion']
    },
    'KLIMA': {
      forbidden: ['heizkessel', 'heizkörper', 'sanitär objekte', 'fenster', 'fliesen'],
      except: ['kombianlagen', 'wärmepumpe']
    }
  };
  
   if (crossTradeKeywords[tradeCode] && lv.positions) {
    lv.positions.forEach(pos => {
      const titleLower = pos.title?.toLowerCase() || '';
      const descLower = pos.description?.toLowerCase() || '';
      const combined = titleLower + ' ' + descLower;
      
      const forbidden = crossTradeKeywords[tradeCode].forbidden;
      const exceptions = crossTradeKeywords[tradeCode].except;
      
      forbidden.forEach(keyword => {
        if (combined.includes(keyword)) {
          const isException = exceptions.some(ex => combined.includes(ex));
          if (!isException) {
            issues.push(`Position "${pos.title}" gehört nicht in ${tradeCode}`);
            console.error(`[FINAL-CHECK] Cross-trade violation in ${tradeCode}: ${pos.title}`);
          }
        }
      });
    });
  }
  
  // 2. Prüfe Mindestanforderungen
  if (tradeCode === 'FASS' && lv.positions) {
    const hasFlaeche = lv.positions.some(pos => 
      pos.unit === 'm²' && pos.title?.toLowerCase().includes('dämmung')
    );
    if (!hasFlaeche) {
      issues.push('Keine Flächenposition für Dämmung gefunden');
    }
  }
  
  // 3. Log finale Warnung wenn Issues
  if (issues.length > 0) {
    console.warn(`[FINAL-CHECK] ${tradeCode} hat ${issues.length} Issues:`);
    issues.forEach(issue => console.warn(`  - ${issue}`));
  }
  
  return { lv, issues };
}

// Helper function to get handwerker ID from company ID
async function getHandwerkerIdFromCompanyId(companyId) {
  const result = await query(
    'SELECT id FROM handwerker WHERE company_id = $1',
    [companyId]
  );
  return result.rows[0]?.id || null;
}

/**
 * PDF Generation für komplettes Projekt-LV
 */
function generateCompleteLVPDF(project, lvs, withPrices = true) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Titelseite
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .text('GESAMT-LEISTUNGSVERZEICHNIS', { align: 'center' });
      
      doc.moveDown(0.5);
      
      doc.fontSize(16)
         .font('Helvetica')
         .fillColor('#666666')
         .text(withPrices ? 'Komplette Kalkulation' : 'Angebotsanfrage', { align: 'center' });
      
      doc.moveDown(2);
      
      // Projektinfo
      doc.fontSize(14)
         .fillColor('black')
         .font('Helvetica-Bold')
         .text('Projekt:', { continued: false });
      
      doc.fontSize(12)
         .font('Helvetica')
         .text(project.description || 'Keine Beschreibung vorhanden');
      
      if (project.category) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold')
           .text('Kategorie: ', { continued: true })
           .font('Helvetica')
           .text(project.category);
      }
      
      if (project.budget) {
        doc.font('Helvetica-Bold')
           .text('Budget: ', { continued: true })
           .font('Helvetica')
           .text(project.budget);
      }
      
      doc.moveDown(1);
      
      doc.font('Helvetica-Bold')
         .text('Datum: ', { continued: true })
         .font('Helvetica')
         .text(new Date().toLocaleDateString('de-DE', {
           year: 'numeric',
           month: 'long',
           day: 'numeric'
         }));

      // Globale Projekt-Vorbemerkungen aus Intake-Daten
// Lade Intake-Antworten für Vorbemerkungen
const intakeData = [];
for (const row of lvs) {
  const lv = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
  if (lv.vorbemerkungen && lv.vorbemerkungen.length > 0) {
    // Sammle alle Vorbemerkungen aus den LVs (die aus Intake-Daten generiert wurden)
    intakeData.push(...lv.vorbemerkungen.filter(v => 
      v.includes('Gebäude') || 
      v.includes('Zufahrt') || 
      v.includes('Arbeitszeit') || 
      v.includes('Baustrom') || 
      v.includes('Bauwasser')
    ));
  }
}

// Entferne Duplikate
const uniqueVorbemerkungen = [...new Set(intakeData)];

if (uniqueVorbemerkungen.length > 0) {
  doc.moveDown(2);
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .text('ALLGEMEINE VORBEMERKUNGEN:', { underline: true });

  doc.moveDown(0.5);
  doc.fontSize(10)
     .font('Helvetica');

  uniqueVorbemerkungen.forEach(vorbemerkung => {
    doc.text(`• ${vorbemerkung}`, { indent: 20 });
  });
}
      
      // Inhaltsverzeichnis
      doc.moveDown(2);
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('ENTHALTENE GEWERKE:', { underline: true });
      
      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica');
      
      let grandTotal = 0;
      const tradeSummaries = [];
      
      // Berechne Summen für Übersicht
for (const row of lvs) {
  const lv = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
  
  // NEU: Berechne Summe OHNE NEP-Positionen
  const tradeTotal = lv.positions && lv.positions.length > 0 
    ? lv.positions.reduce((sum, pos) => {
        // NEP-Positionen NICHT mitzählen
        if (!pos.isNEP) {
          return sum + (parseFloat(pos.totalPrice) || 0);
        }
        return sum;
      }, 0)
    : (parseFloat(lv.totalSum) || 0);
  
  // NEU: NEP-Summe separat erfassen
  const nepTotal = lv.positions && lv.positions.length > 0
    ? lv.positions.reduce((sum, pos) => {
        if (pos.isNEP) {
          return sum + (parseFloat(pos.totalPrice) || 0);
        }
        return sum;
      }, 0)
    : (lv.nepSum || 0);
  
  grandTotal += tradeTotal;  // NEP NICHT in Gesamtsumme
  
  tradeSummaries.push({
    code: row.trade_code,
    name: row.trade_name,
    total: tradeTotal,
    nepTotal: nepTotal  // NEU: NEP-Summe speichern
  });
  
  // Berechne und zeige die Gewerke in der Übersicht
  let displayText = `• ${row.trade_code} - ${row.trade_name}: ${withPrices ? formatCurrency(tradeTotal) : '________'}`;
  if (nepTotal > 0 && withPrices) {
  displayText += ` (+ NEP: ${formatCurrency(nepTotal)})`;
  }
  doc.text(displayText, { indent: 20 });
}    
      if (withPrices) {
        doc.moveDown(1);
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text(`Gesamtsumme (netto): ${formatCurrency(grandTotal)}`);
        doc.text(`MwSt. (19%): ${formatCurrency(grandTotal * 0.19)}`);
        doc.text(`Gesamtsumme (brutto): ${formatCurrency(grandTotal * 1.19)}`);
      }
      
      // Neue Seite für erstes Gewerk
      doc.addPage();
      
      // Einzelne Gewerke
      for (let i = 0; i < lvs.length; i++) {
        const row = lvs[i];
        const lv = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
        
        if (i > 0) {
          doc.addPage();
        }
        
        // Gewerk-Header
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .text(`GEWERK: ${row.trade_code} - ${row.trade_name}`, { align: 'center' });
        
        doc.moveDown(1);

        // Vorbemerkungen für dieses Gewerk
if (lv.vorbemerkungen && lv.vorbemerkungen.length > 0) {
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .text('VORBEMERKUNGEN:', { underline: true });
  
  doc.moveDown(0.3);
  doc.fontSize(9)
     .font('Helvetica');
  
  lv.vorbemerkungen.forEach((vorbemerkung, index) => {
    doc.text(`${index + 1}. ${vorbemerkung}`, {
      indent: 20,
      width: 480
    });
    doc.moveDown(0.2);
  });
  
  doc.moveDown(0.5);
}
        
        // Positionen-Tabelle
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('POSITIONEN:', { underline: true });
        
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
        let tradeSum = 0; // FIX: Initialisierung der Gewerk-Summe
        
        doc.font('Helvetica')
           .fontSize(9);
        
        if (lv && lv.positions && Array.isArray(lv.positions)) {
          lv.positions.forEach((pos, index) => {
            // Prüfe Seitenumbruch VOR dem Schreiben
            if (yPosition > 680) {  // Früher umbrechen für mehr Sicherheit
              doc.addPage();
              yPosition = 50;
              
              // Header wiederholen
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
            
            // Position
            doc.text(pos.pos || `${index + 1}`, col1, yPosition, { width: 35 });
            
            // Titel mit Höhenberechnung
            const titleHeight = doc.heightOfString(pos.title || '', { width: 150 });
            doc.text(pos.title || 'Keine Bezeichnung', col2, yPosition, { width: 150 });
            
            // Andere Spalten auf gleicher Höhe
            doc.text(pos.quantity?.toString() || '-', col3, yPosition, { width: 50, align: 'right' });
            doc.text(pos.unit || '-', col4, yPosition, { width: 50 });
            
            if (withPrices && pos.unitPrice) {
              doc.text(formatCurrency(pos.unitPrice), col5, yPosition, { width: 70, align: 'right' });
              doc.text(formatCurrency(pos.totalPrice || 0), col6, yPosition, { width: 70, align: 'right' });
              tradeSum += parseFloat(pos.totalPrice) || 0; // FIX: Berechnung der Gewerk-Summe
            } else {
              doc.text('________', col5, yPosition, { width: 70, align: 'right' });
              doc.text('________', col6, yPosition, { width: 70, align: 'right' });
            }
            
            // Zeilenhöhe basierend auf Titel
            yPosition += Math.max(titleHeight, 20) + 5;
            
            // Beschreibung mit Abstandsprüfung
            if (pos.description) {
              const descHeight = doc.heightOfString(pos.description, { width: 400 });
              
              // Prüfe ob Beschreibung auf Seite passt
              if (yPosition + descHeight > 680) {
                doc.addPage();
                yPosition = 50;
              }
              
              doc.fontSize(8)
                 .fillColor('#666666')
                 .text(pos.description, col2, yPosition, { width: 400 });
              
              yPosition += descHeight + 10; // Extra Abstand nach Beschreibung
              
              doc.fontSize(9)
                 .fillColor('black');
            } else {
              yPosition += 8; // Kleinerer Abstand ohne Beschreibung
            }
          });
        }
        
        // Gewerk-Summe
        yPosition += 10;
        doc.moveTo(col5 - 10, yPosition)
           .lineTo(545, yPosition)
           .stroke();
        
        yPosition += 10;
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text(`Summe ${row.trade_code}:`, col5 - 80, yPosition)
           .text(withPrices ? formatCurrency(tradeSum) : '________', col6, yPosition, { width: 70, align: 'right' }); // FIX: Verwendung der berechneten Summe
      }
      
      // Abschlussseite mit Zusammenfassung
      doc.addPage();
      
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .text('KOSTENZUSAMMENFASSUNG', { align: 'center' });
      
      doc.moveDown(2);
      
      // Gewerke-Übersicht
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('Einzelkosten der Gewerke:');
      
      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica');
      
      for (const trade of tradeSummaries) {
        doc.text(`${trade.code} - ${trade.name}:`, 70, doc.y)
           .text(withPrices ? formatCurrency(trade.total) : '________', 400, doc.y - 11, { width: 100, align: 'right' });
      }
      
      doc.moveDown(1);
      doc.moveTo(70, doc.y)
         .lineTo(500, doc.y)
         .stroke();
      
      doc.moveDown(0.5);
      
      if (withPrices) {
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('Nettosumme:', 70, doc.y)
           .text(formatCurrency(grandTotal), 400, doc.y - 12, { width: 100, align: 'right' });
        
        doc.moveDown(0.5);
        
        const planningCosts = grandTotal * 0.10;
        const contingency = grandTotal * 0.05;
        const subtotal = grandTotal + planningCosts + contingency;
        const vat = subtotal * 0.19;
        const finalTotal = subtotal + vat;
        
        doc.fontSize(11)
           .font('Helvetica')
           .text('Planungskosten (10%):', 70, doc.y)
           .text(formatCurrency(planningCosts), 400, doc.y - 11, { width: 100, align: 'right' });
        
        doc.text('Unvorhergesehenes (5%):', 70, doc.y)
           .text(formatCurrency(contingency), 400, doc.y - 11, { width: 100, align: 'right' });
        
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold')
           .text('Zwischensumme:', 70, doc.y)
           .text(formatCurrency(subtotal), 400, doc.y - 11, { width: 100, align: 'right' });
        
        doc.moveDown(0.5);
        doc.font('Helvetica')
           .text('MwSt. (19%):', 70, doc.y)
           .text(formatCurrency(vat), 400, doc.y - 11, { width: 100, align: 'right' });
        
        doc.moveDown(0.5);
        doc.moveTo(70, doc.y)
           .lineTo(500, doc.y)
           .stroke();
        doc.moveTo(70, doc.y + 2)
           .lineTo(500, doc.y + 2)
           .stroke();
        
        doc.moveDown(0.5);
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('GESAMTSUMME:', 70, doc.y)
           .text(formatCurrency(finalTotal), 380, doc.y - 14, { width: 120, align: 'right' });
      } else {
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('Gesamtsumme:', 70, doc.y)
           .text('________', 400, doc.y - 12, { width: 100, align: 'right' });
      }
      
      // Footer
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor('#666666')
         .text('Alle Preise verstehen sich inklusive aller Nebenleistungen gemäß VOB/C.', 50, 750)
         .text(`Erstellt am ${new Date().toLocaleDateString('de-DE')} mit BYNDL`, 50, 765);
      
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
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
      
      // NEU: Vorbemerkungen einfügen (nach Projektinfo, vor Positionen)
  if (lv.vorbemerkungen && lv.vorbemerkungen.length > 0) {
    doc.moveDown(1);
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('VORBEMERKUNGEN', { underline: true });
    
    doc.moveDown(0.5);
    doc.fontSize(10)
       .font('Helvetica');
    
    lv.vorbemerkungen.forEach((vorbemerkung, index) => {
      doc.text(`${index + 1}. ${vorbemerkung}`, {
        indent: 20,
        width: 500
      });
      doc.moveDown(0.3);
    });
    
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y)
       .lineTo(545, doc.y)
       .stroke();
    doc.moveDown(1);
  }
  
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
      
      // Datenqualität anzeigen
      if (lv.dataQuality) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold')
           .text('Datenqualität: ', { continued: true })
           .font('Helvetica')
           .text(`${Math.round(lv.dataQuality.confidence * 100)}% Konfidenz`);
      }
      
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
          
          // Position mit NEP-Kennzeichnung
let posText = pos.pos || `${index + 1}`;
if (pos.isNEP) {
  posText += ' (NEP)';
}
doc.text(posText, col1, yPosition, { width: 30 });
          
          let titleText = pos.title || 'Keine Bezeichnung';
if (pos.isNEP) {
  titleText = '(NEP) ' + titleText;
}
const titleHeight = doc.heightOfString(titleText, { width: 150 });
doc.text(titleText, col2, yPosition, { width: 150 });
          
          doc.text(pos.quantity?.toString() || '-', col3, yPosition, { width: 50, align: 'right' });
          doc.text(pos.unit || '-', col4, yPosition, { width: 50 });
          
          if (withPrices && pos.unitPrice) {
            doc.text(formatCurrency(pos.unitPrice), col5, yPosition, { width: 70, align: 'right' });
          } else {
            doc.text('________', col5, yPosition, { width: 70, align: 'right' });
          }
          
          if (withPrices && pos.totalPrice) {
  // NEU: Bei NEP-Positionen den Preis in Klammern setzen
  if (pos.isNEP) {
    doc.text(`(${formatCurrency(pos.totalPrice)})`, col6, yPosition, { 
      width: 70, 
      align: 'right' 
    });
    // NEP nicht zur totalSum addieren!
  } else {
    doc.text(formatCurrency(pos.totalPrice), col6, yPosition, { 
      width: 70, 
      align: 'right' 
    });
    totalSum += parseFloat(pos.totalPrice) || 0;
  }
} else {
  doc.text('________', col6, yPosition, { width: 70, align: 'right' });
}
          
          // Beschreibung und Datenquelle
          if (pos.description) {
            yPosition += Math.max(titleHeight, 15);
            doc.fontSize(8)
               .fillColor('#666666')
               .text(pos.description, col2, yPosition, { width: 400 });
            
            const descHeight = doc.heightOfString(pos.description, { width: 400 });
            yPosition += descHeight;
            
            // FIX: Datenquelle UNTER der Beschreibung anzeigen
            if (pos.dataSource && pos.dataSource !== 'measured') {
              const sourceText = pos.dataSource === 'estimated' ? '(geschätzt)' : '(angenommen)';
              yPosition += 2; // Kleine Lücke
              doc.fontSize(7)
                 .fillColor('#FF6600')
                 .text(sourceText, col2, yPosition);
              yPosition += 10; // Abstand nach Label
            }
            
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

        // NEU: NEP-Summe anzeigen wenn vorhanden
  if (lv.nepSum && lv.nepSum > 0) {
    yPosition += 20;
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('#666666')
       .text('NEP-Positionen:', col5 - 80, yPosition)
       .text(formatCurrency(lv.nepSum), col6, yPosition, { width: 70, align: 'right' });
    doc.fillColor('black');
  }
        
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
      
      // Annahmen anzeigen
      if (lv.assumptions && lv.assumptions.length > 0) {
        yPosition += 40;
        
        if (yPosition > 650) {
          doc.addPage();
          yPosition = 50;
        }
        
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('Annahmen und Hinweise:', 50, yPosition);
        
        yPosition += 15;
        doc.fontSize(8)
           .font('Helvetica');
        
        lv.assumptions.forEach(assumption => {
          doc.text(`• ${assumption}`, 60, yPosition, { width: 485 });
          yPosition += doc.heightOfString(assumption, { width: 485 }) + 5;
        });
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

// Create project with trade detection
app.post('/api/projects', async (req, res) => {
  try {
    const { 
      category, 
      subCategory, 
      description, 
      timeframe, 
      budget, 
      bauherrId,
      address,      // Frontend sendet address-Objekt
      userName,     // Auch diese Felder kommen vom Frontend
      userEmail
    } = req.body;
    
    // Address-Daten extrahieren - Frontend sendet "zipCode" (camelCase)
    const { street, houseNumber, zipCode, city } = address || {};
    
    // Debug-Log um zu sehen was ankommt
    console.log('Received address data:', { street, houseNumber, zipCode, city });
    
    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }
    
    const extractedData = extractProjectKeyData(description, category);
    
    // INSERT mit korrektem Mapping: zipCode -> zip_code
    const projectResult = await query(
      `INSERT INTO projects (
        bauherr_id, category, sub_category, description, 
        timeframe, budget, 
        zip_code,    -- Datenbank-Spalte mit Unterstrich
        city, 
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        bauherrId || null,
        category || null,
        subCategory || null,
        description,
        timeframe || null,
        budget || null,
        zipCode || null,    // JavaScript-Variable in camelCase
        city || null,
        JSON.stringify({ extracted: extractedData })
      ]
    );
    
    const project = projectResult.rows[0];
    
    // ERST Trades erkennen
    const detectedTrades = await detectTrades({
      category,
      subCategory,
      description,
      timeframe,
      budget,
      extractedData // NEU: Weitergabe der extrahierten Daten
    });
    
    // DANN Komplexität berechnen (mit den erkannten Trades)
    const projectComplexity = determineProjectComplexity({
      ...project,
      detectedTrades: detectedTrades  // Jetzt ist detectedTrades definiert!
    });
    
    // Komplexität in Metadata speichern (zusammen mit extrahierten Daten)
    await query(
      `UPDATE projects 
       SET metadata = jsonb_set(
         jsonb_set(
           COALESCE(metadata, '{}')::jsonb,
           '{complexity}',
           $1::jsonb
         ),
         '{extracted}',
         $2::jsonb
       )
       WHERE id = $3`,
      [
        JSON.stringify({
          level: projectComplexity,
          calculatedAt: new Date().toISOString(),
          tradeCount: detectedTrades.length
        }), 
        JSON.stringify(extractedData),
        project.id
      ]
    );
    
    // Nur erkannte Trades hinzufügen
    console.log(`[PROJECT] Creating project ${project.id} with ${detectedTrades.length} detected trades`);
    console.log(`[PROJECT] Project complexity: ${projectComplexity}`);
    console.log(`[PROJECT] Extracted quantities:`, extractedData.quantities);
    console.log(`[PROJECT] Extracted measures:`, extractedData.measures);
    
    for (const trade of detectedTrades) {
      await ensureProjectTrade(project.id, trade.id, 'detection');
    }
    
    res.json({
      project: {
        ...project,
        trades: detectedTrades,
        complexity: projectComplexity,  // Verwende die berechnete Komplexität
        extractedData // NEU: Sende extrahierte Daten zurück an Frontend
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
    const trades = await getProjectTrades(projectId);
    
    // Parse metadata falls vorhanden
    if (project.metadata && typeof project.metadata === 'string') {
      try {
        project.metadata = JSON.parse(project.metadata);
      } catch (e) {
        console.error('[PROJECT] Failed to parse metadata:', e);
        project.metadata = {};
      }
    }
    
    // NEU: Verwende gespeicherte Komplexität ODER berechne mit den geladenen Trades
    const projectComplexity = project.metadata?.complexity?.level || 
      determineProjectComplexity({
        ...project,
        detectedTrades: trades  // WICHTIG: Übergebe die geladenen Trades!
      });
    
    const extractedData = project.metadata?.extracted || null;
    
    project.trades = trades;
    project.complexity = projectComplexity;  // Verwende korrekte Komplexität
    project.extractedData = extractedData;
    
    console.log(`[PROJECT] Retrieved project ${projectId} with ${trades.length} trades, complexity: ${projectComplexity}`);
    if (extractedData) {
      console.log(`[PROJECT] Has extracted data:`, extractedData.quantities);
    }
    
    res.json(project);
    
  } catch (err) {
    console.error('Failed to fetch project:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all selected trades for a project (for LVReviewPage)
app.get('/api/projects/:projectId/selected-trades', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Hole Projekt
    const project = await query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (project.rows.length === 0) {
      return res.status(404).json({ error: 'Projekt nicht gefunden' });
    }
    
    // Hole alle Trades die dem Projekt zugeordnet sind (außer INT)
    const trades = await query(`
      SELECT 
        t.id,
        t.code,
        t.name,
        t.description,
        pt.is_manual,
        pt.is_ai_recommended,
        pt.is_additional,
        tp.status as progress_status,
        tp.completed_at,
        tp.reviewed_at,
        l.id as lv_id,
        l.content as lv_content,
        l.status as lv_status,
        l.questions_completed,
        l.skipped
      FROM trades t
      JOIN project_trades pt ON t.id = pt.trade_id
      LEFT JOIN trade_progress tp ON t.id = tp.trade_id AND tp.project_id = $1
      LEFT JOIN lvs l ON t.id = l.trade_id AND l.project_id = $1
      WHERE pt.project_id = $1 
      AND t.code != 'INT'
      ORDER BY t.name
    `, [projectId]);
    
    // Formatiere Trades mit Status
    const formattedTrades = trades.rows.map(trade => {
      let lvContent = null;
      let totalCost = 0;
      
      // Parse LV content wenn vorhanden
      if (trade.lv_content) {
        lvContent = typeof trade.lv_content === 'string' 
          ? JSON.parse(trade.lv_content) 
          : trade.lv_content;
        
        // Berechne Gesamtkosten (ohne NEP)
        if (lvContent.totalSum) {
          totalCost = parseFloat(lvContent.totalSum) || 0;
        } else if (lvContent.positions) {
          totalCost = lvContent.positions
            .filter(pos => !pos.isNEP)
            .reduce((sum, pos) => sum + (parseFloat(pos.totalPrice) || 0), 0);
        }
      }
      
      return {
        id: trade.id,
        name: trade.name,
        code: trade.code,
        description: trade.description,
        isManual: trade.is_manual || false,
        isAiRecommended: trade.is_ai_recommended || false,
        isAdditional: trade.is_additional || false,
        status: trade.progress_status || 'pending',
        hasLV: !!trade.lv_id,
        lvId: trade.lv_id,
        lv: lvContent,
        totalCost: totalCost,
        questionsCompleted: trade.questions_completed || false,
        skipped: trade.skipped || false,
        completedAt: trade.completed_at,
        reviewedAt: trade.reviewed_at
      };
    });
    
    // Kategorisiere nach Status
    const completedTrades = formattedTrades.filter(t => t.hasLV && !t.skipped);
    const pendingTrades = formattedTrades.filter(t => !t.hasLV && !t.skipped);
    const skippedTrades = formattedTrades.filter(t => t.skipped);
    
    res.json({ 
      trades: formattedTrades,
      summary: {
        total: formattedTrades.length,
        completed: completedTrades.length,
        pending: pendingTrades.length,
        skipped: skippedTrades.length,
        totalCost: completedTrades.reduce((sum, t) => sum + t.totalCost, 0)
      },
      projectStatus: {
        id: project.rows[0].id,
        name: project.rows[0].description,
        budget: project.rows[0].budget,
        allTradesCompleted: project.rows[0].all_trades_completed || false
      }
    });
    
  } catch (error) {
    console.error('Error fetching selected trades:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Gewerke' });
  }
});

// NEU: Navigation Helper Endpoint
app.get('/api/projects/:projectId/navigation', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Hole alle Trades des Projekts
    const trades = await query(`
      SELECT 
        t.id,
        t.name,
        t.code,
        COALESCE(tp.status, 'pending') as status,
        l.id as lv_id
      FROM trades t
      JOIN project_trades pt ON t.id = pt.trade_id
      LEFT JOIN trade_progress tp ON t.id = tp.trade_id AND tp.project_id = $1
      LEFT JOIN lvs l ON t.id = l.trade_id AND l.project_id = $1
      WHERE pt.project_id = $1
      AND t.code != 'INT'
      ORDER BY t.name
    `, [projectId]);
    
    const completedTrades = trades.rows.filter(t => t.lv_id);
    const pendingTrades = trades.rows.filter(t => !t.lv_id && t.status === 'pending');
    
    res.json({
      totalTrades: trades.rows.length,
      completedTrades: completedTrades,
      pendingTrades: pendingTrades,
      allCompleted: pendingTrades.length === 0,
      nextTrade: pendingTrades[0] || null
    });
    
  } catch (error) {
    console.error('Error fetching navigation info:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Navigation' });
  }
});

// NEU: Project Status Endpoint
app.get('/api/projects/:projectId/status', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const project = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
    
    if (project.rows.length === 0) {
      return res.status(404).json({ error: 'Projekt nicht gefunden' });
    }
    
    // Detaillierter Status mit LV-Informationen
    const tradeDetails = await query(`
      SELECT 
        t.id,
        t.name,
        t.code,
        tp.status as progress_status,
        l.id as lv_id,
        l.content as lv_content,
        l.skipped
      FROM trades t
      JOIN project_trades pt ON t.id = pt.trade_id
      LEFT JOIN trade_progress tp ON t.id = tp.trade_id AND tp.project_id = $1
      LEFT JOIN lvs l ON t.id = l.trade_id AND l.project_id = $1
      WHERE pt.project_id = $1
      AND t.code != 'INT'
    `, [projectId]);
    
    const pendingTrades = tradeDetails.rows.filter(t => !t.lv_id && !t.skipped);
    const completedTrades = tradeDetails.rows.filter(t => t.lv_id && !t.skipped);
    
    // Berechne Gesamtkosten
    let totalCost = 0;
    completedTrades.forEach(trade => {
      if (trade.lv_content) {
        const content = typeof trade.lv_content === 'string' 
          ? JSON.parse(trade.lv_content) 
          : trade.lv_content;
        totalCost += parseFloat(content.totalSum) || 0;
      }
    });
    
    res.json({
      projectId: projectId,
      projectName: project.rows[0].description,
      allTradesComplete: pendingTrades.length === 0,
      totalTrades: tradeDetails.rows.length,
      completedCount: completedTrades.length,
      pendingCount: pendingTrades.length,
      pendingTrades: pendingTrades.map(t => ({
        id: t.id,
        name: t.name,
        code: t.code
      })),
      totalCost: totalCost
    });
    
  } catch (error) {
    console.error('Error fetching project status:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Status' });
  }
});

// NEU: Mark trade as complete
app.post('/api/projects/:projectId/trades/:tradeId/complete', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    const { questionsCompleted, lvGenerated } = req.body;
    
    // Upsert in trade_progress
    await query(`
      INSERT INTO trade_progress (
        project_id, 
        trade_id, 
        status, 
        completed_at
      ) VALUES ($1, $2, $3, NOW())
      ON CONFLICT (project_id, trade_id)
      DO UPDATE SET 
        status = $3,
        completed_at = NOW()
    `, [projectId, tradeId, lvGenerated ? 'lv_generated' : 'questions_completed']);
    
    // Update LV status wenn vorhanden
    if (lvGenerated) {
      await query(
        'UPDATE lvs SET status = $1, questions_completed = $2 WHERE project_id = $3 AND trade_id = $4',
        ['generated', true, projectId, tradeId]
      );
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error marking trade complete:', error);
    res.status(500).json({ error: 'Fehler beim Markieren des Gewerks' });
  }
});

// NEU: Skip trade
app.post('/api/projects/:projectId/trades/:tradeId/skip', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    
    // Markiere als übersprungen
    await query(`
      INSERT INTO trade_progress (
        project_id,
        trade_id,
        status,
        completed_at
      ) VALUES ($1, $2, 'skipped', NOW())
      ON CONFLICT (project_id, trade_id)
      DO UPDATE SET
        status = 'skipped',
        completed_at = NOW()
    `, [projectId, tradeId]);
    
    // Update LV falls vorhanden
    await query(
      'UPDATE lvs SET skipped = TRUE WHERE project_id = $1 AND trade_id = $2',
      [projectId, tradeId]
    );
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error skipping trade:', error);
    res.status(500).json({ error: 'Fehler beim Überspringen' });
  }
});

// NEU: Mark LV as reviewed (nach den anderen neuen Endpoints)
app.post('/api/projects/:projectId/trades/:tradeId/review-complete', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    
    // Update trade_progress
    await query(`
      UPDATE trade_progress 
      SET status = 'reviewed', reviewed_at = NOW()
      WHERE project_id = $1 AND trade_id = $2
    `, [projectId, tradeId]);
    
    // Falls kein Eintrag existiert, erstelle einen
    const result = await query(
      'SELECT * FROM trade_progress WHERE project_id = $1 AND trade_id = $2',
      [projectId, tradeId]
    );
    
    if (result.rows.length === 0) {
      await query(`
        INSERT INTO trade_progress (project_id, trade_id, status, reviewed_at, completed_at)
        VALUES ($1, $2, 'reviewed', NOW(), NOW())
      `, [projectId, tradeId]);
    }
    
    // Update LV
    await query(
      'UPDATE lvs SET reviewed_at = NOW(), status = $1 WHERE project_id = $2 AND trade_id = $3',
      ['reviewed', projectId, tradeId]
    );
    
    // Update project last_reviewed_at
    await query(
      'UPDATE projects SET last_reviewed_at = NOW() WHERE id = $1',
      [projectId]
    );
    
    // Prüfe ob alle Trades reviewed sind
    const allTrades = await query(`
      SELECT COUNT(*) as total
      FROM project_trades pt
      JOIN trades t ON pt.trade_id = t.id
      WHERE pt.project_id = $1 AND t.code != 'INT'
    `, [projectId]);
    
    const reviewedTrades = await query(`
      SELECT COUNT(*) as reviewed
      FROM trade_progress
      WHERE project_id = $1 AND status = 'reviewed'
    `, [projectId]);
    
    const allReviewed = allTrades.rows[0].total === reviewedTrades.rows[0].reviewed;
    
    if (allReviewed) {
      await query(
        'UPDATE projects SET all_trades_completed = TRUE WHERE id = $1',
        [projectId]
      );
    }
    
    res.json({ 
      success: true,
      allReviewed: allReviewed,
      message: allReviewed ? 'Alle Gewerke wurden überprüft' : 'Gewerk als überprüft markiert'
    });
    
  } catch (error) {
    console.error('Error marking review complete:', error);
    res.status(500).json({ error: 'Fehler beim Markieren der Review' });
  }
});

// Generate Intake Questions
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
    
    await ensureProjectTrade(projectId, tradeId, 'intake');
    
    // Lade erkannte Gewerke
    const detectedTrades = await query(
      `SELECT t.code, t.name 
       FROM trades t 
       JOIN project_trades pt ON t.id = pt.trade_id 
       WHERE pt.project_id = $1 AND t.code != 'INT'`,
      [projectId]
    );

    // Erweitere Projektkontext mit erkannten Gewerken
    const projectContext = {
      category: project.category,
      subCategory: project.sub_category,
      description: project.description,
      timeframe: project.timeframe,
      budget: project.budget,
      detectedTrades: detectedTrades.rows
    };
    
    // NEU: Berechne intelligente Fragenanzahl basierend auf Gewerke-Anzahl
    const tradeCount = detectedTrades.rows.length;
    let targetQuestionCount;
    
    if (tradeCount === 1) {
      targetQuestionCount = 16;  // 14-18 Fragen für Einzelgewerk
    } else if (tradeCount <= 3) {
      targetQuestionCount = 18;  // 16-20 Fragen für 2-3 Gewerke
    } else if (tradeCount <= 5) {
      targetQuestionCount = 21;  // 18-24 Fragen für 4-5 Gewerke
    } else {
      targetQuestionCount = 25;  // 22-28 Fragen für 6+ Gewerke
    }
    
    // Modifiziere Projektkontext mit Ziel-Fragenanzahl
    const modifiedProjectContext = {
      ...projectContext,
      targetQuestionCount: targetQuestionCount,
      tradeCount: tradeCount
    };
    
    let questions;
    try {
      // WICHTIG: Verwende modifiedProjectContext statt projectContext
      questions = await generateQuestions(tradeId, modifiedProjectContext);
    } catch (err) {
      console.error('[INTAKE] generateQuestions error:', err);
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
      questions: questionsWithIds,
      saved,
      targetCount: targetQuestionCount,  // Verwende berechnete Anzahl
      tradeCount: tradeCount,            // Sende Gewerke-Anzahl zurück
      completeness: tradeCount <= 2 ? 'EINFACH' : tradeCount <= 5 ? 'MITTEL' : 'HOCH'
    });
    
  } catch (err) {
    console.error('intake/questions failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Intake Summary
app.get('/api/projects/:projectId/intake/summary', async (req, res) => {
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

// ========== NEUE VALIDIERTE GEWERKE-ERKENNUNG ==========
// Hole NUR die ERFORDERLICHEN Gewerke (nicht die empfohlenen!)
const requiredTradesResult = await query(
  `SELECT t.code FROM project_trades pt 
   JOIN trades t ON pt.trade_id = t.id 
   WHERE pt.project_id = $1 
   AND t.code != 'INT'
   AND (pt.is_ai_recommended = false OR pt.is_ai_recommended IS NULL)`,
  [projectId]
);
const requiredTradesForValidation = requiredTradesResult.rows.map(r => r.code); // NUR die Code-Strings!

// Nutze neue Validierungsfunktion
const projectDescription = project.description || '';
const validationResult = detectAndValidateTradesFromIntake(
  answers,
  requiredTradesForValidation,  // GEÄNDERT: Neuer Name
  projectDescription
);

// Filtere bereits empfohlene Trades heraus
const alreadyRecommended = await query(
  `SELECT t.code FROM project_trades pt 
   JOIN trades t ON pt.trade_id = t.id 
   WHERE pt.project_id = $1 AND pt.is_ai_recommended = true`,
  [projectId]
);
const recommendedCodes = new Set(alreadyRecommended.rows.map(r => r.code));

// Filtere und verwende nur eine Variable
const additionalTrades = validationResult.trades.filter(t => 
  !recommendedCodes.has(t.code)
);

const rejectedTrades = validationResult.rejected;
    
// Für Kompatibilität mit bestehendem Code
const relevantAnswers = answers
  .filter(a => a.answer.length > 15 && !['ja', 'nein', 'keine', 'vorhanden'].includes(a.answer.toLowerCase().trim()))
  .map(a => ({ question: a.question, answer: a.answer }));

// Definiere allAnswersText für Keyword-Matching
const allAnswersText = answers.map(a => `${a.question} ${a.answer}`).join(' ').toLowerCase();
    
console.log('[INTAKE-VALIDATION] Erkannt:', additionalTrades.length, 'Gewerke');
if (rejectedTrades.length > 0) {
  console.log('[INTAKE-VALIDATION] Abgelehnt:', rejectedTrades.map(r => 
    `${r.code}: ${r.reason}`
  ));
}
// ========== ENDE NEUE VALIDIERUNG ==========

// Debug-Logs NACH den Definitionen
console.log('[DEBUG] additionalTrades found:', additionalTrades.length);
console.log('[DEBUG] relevantAnswers count:', relevantAnswers.length);

// LLM-basierte Analyse für intelligente Begründungen
if (additionalTrades.length > 0) {
  console.log('[INTAKE-SUMMARY] Starte LLM-Analyse für', additionalTrades.length, 'Trades');
  
  const tradeNames = {
    'ELEKT': 'Elektroinstallationen',
    'SAN': 'Sanitärinstallationen', 
    'HEI': 'Heizungsinstallation',
    'KLIMA': 'Klimatechnik',
    'TIS': 'Tischlerarbeiten',
    'FLI': 'Fliesenarbeiten',
    'MAL': 'Malerarbeiten',
    'BOD': 'Bodenbelagsarbeiten',
    'TRO': 'Trockenbauarbeiten',
    'FEN': 'Fensterarbeiten',
    'ROH': 'Rohbauarbeiten',
    'DACH': 'Dacharbeiten',
    'FASS': 'Fassadenarbeiten',
    'GER': 'Gerüstbau',
    'ZIMM': 'Zimmererarbeiten',
    'ESTR': 'Estricharbeiten',
    'SCHL': 'Schlosserarbeiten',
    'AUSS': 'Außenanlagen',
    'PV': 'Photovoltaik-Installation',
    'ABBR': 'Abbrucharbeiten'
  };
  
  try {
    // Sammle relevante Nutzerantworten für den Kontext
    const contextAnswers = relevantAnswers
      .slice(0, 6)
      .map(qa => qa.answer)
      .join(' | ');
    
    // Erstelle Trades-Info für Prompt
    const tradesInfo = additionalTrades.map(t => {
      const relevantAnswer = relevantAnswers.find(qa => 
        t.matchedKeywords.some(kw => qa.answer.toLowerCase().includes(kw))
      );
      return `${t.code}: gefunden wegen "${t.matchedKeywords.slice(0,2).join(', ')}" in Antwort "${relevantAnswer ? relevantAnswer.answer.substring(0,50) : 'diverse Angaben'}"`;
    }).join('\n');

    const prompt = `Basierend auf diesen Nutzerangaben:
"${contextAnswers}"

Erstelle kurze, spezifische Begründungen für diese Gewerke:
${tradesInfo}

Gib für jedes Gewerk eine vollständige, verständliche Begründung (15-25 Wörter) die erklärt, 
warum dieses Gewerk basierend auf den konkreten Nutzerangaben benötigt wird.

Beispiel-Format:
{
  "ELEKT": "Zusätzliche Steckdosen im Wohnzimmer benötigen Elektroinstallation",
  "SAN": "Neues WC im Keller erfordert Sanitärarbeiten"
}

Antworte NUR mit validem JSON.`;

    const llmResult = await llmWithPolicy('analysis', [
      { role: 'user', content: prompt }
    ], { maxTokens: 1000, temperature: 0.3, jsonMode: true });
    
    console.log('[LLM] Raw response:', llmResult);
    const reasons = JSON.parse(llmResult);
    
    // Weise die Begründungen zu
    additionalTrades.forEach(trade => {
      trade.reason = reasons[trade.code] || `${tradeNames[trade.code]} basierend auf Ihren Angaben empfohlen`;
      console.log(`[LLM] ${trade.code}: ${trade.reason}`);
    });

    // WICHTIG: Auch validationResult updaten!
if (validationResult && validationResult.trades) {
  validationResult.trades.forEach(trade => {
    if (reasons[trade.code]) {
      trade.reason = reasons[trade.code];
    }
  });
}
    
  } catch (error) {
    console.error('[INTAKE-SUMMARY] LLM failed:', error);
    // Fallback mit Keywords
    additionalTrades.forEach(trade => {
      const keywords = trade.matchedKeywords.slice(0, 2).join(' und ');
      trade.reason = `Wegen erwähnter Begriffe: ${keywords}`;
    });
  }
}

// Sammle ALLE empfohlenen Trades
const allRecommendedTrades = [];

// 1. Speichere neu erkannte Trades
for (const trade of additionalTrades) {
  const tradeInfo = await query('SELECT id, name FROM trades WHERE code = $1', [trade.code]);
  if (tradeInfo.rows[0]) {
    await query(
      `INSERT INTO project_trades (project_id, trade_id, is_ai_recommended)
       VALUES ($1, $2, true)
       ON CONFLICT (project_id, trade_id) 
       DO UPDATE SET is_ai_recommended = true`,
      [projectId, tradeInfo.rows[0].id]
    );
    
    allRecommendedTrades.push({
      id: tradeInfo.rows[0].id,
      code: trade.code,
      name: tradeInfo.rows[0].name,
      reason: trade.reason,
      confidence: trade.confidence,
      matchedKeywords: trade.matchedKeywords
    });
  }
}

// 2. Hole ALLE gespeicherten empfohlenen Trades
const allRecommendedFromDB = await query(
  `SELECT t.id, t.code, t.name
   FROM project_trades pt 
   JOIN trades t ON pt.trade_id = t.id 
   WHERE pt.project_id = $1 
   AND pt.is_ai_recommended = true`,
  [projectId]
);

// Definiere tradeKeywords aus TRADE_DETECTION_RULES
const tradeKeywords = {};
for (const [code, keywords] of Object.entries(TRADE_DETECTION_RULES.exclusive)) {
  tradeKeywords[code] = keywords.slice(0, 10);
}    
    
// 3. Füge gespeicherte hinzu (ohne Duplikate)
const newCodesSet = new Set(additionalTrades.map(t => t.code));
for (const trade of allRecommendedFromDB.rows) {
  if (!newCodesSet.has(trade.code)) {
    const keywords = tradeKeywords[trade.code] || [];
    const matchedKeywords = keywords.filter(kw => allAnswersText.includes(kw));
    
    allRecommendedTrades.push({
      id: trade.id,
      code: trade.code,
      name: trade.name,
      reason: matchedKeywords.length > 0 
        ? `Begriffe gefunden: ${matchedKeywords.join(', ')}` 
        : 'Aus vorheriger Analyse erkannt',
      confidence: 85,
      matchedKeywords: matchedKeywords
    });
  }
}

// 4. Hole erforderliche Trades
const requiredTrades = await query(
  `SELECT t.id, t.code, t.name
   FROM project_trades pt 
   JOIN trades t ON pt.trade_id = t.id 
   WHERE pt.project_id = $1 
   AND (pt.is_ai_recommended = false OR pt.is_ai_recommended IS NULL)
   AND t.code != 'INT'`,
  [projectId]
);

// 5. Erstelle Response mit verbesserter Kategorisierung
// Prüfe ob die Trades aus detectAndValidateTradesFromIntake source/category Info haben
const tradesWithSourceInfo = validationResult?.trades?.some(t => t.source !== undefined);
let groupedTrades; // WICHTIG: Variable außerhalb deklarieren

if (tradesWithSourceInfo) {
  // Hole IDs für die Trades aus validationResult
  const tradesWithIds = await Promise.all(
    validationResult.trades.map(async (trade) => {
      const dbResult = await query(
        'SELECT id, name FROM trades WHERE code = $1',
        [trade.code]
      );
      return {
        ...trade,
        id: dbResult.rows[0]?.id,
        name: dbResult.rows[0]?.name || trade.code
      };
    })
  );
  
  // Neue Version mit IDs
  const allDetectedTrades = [
    ...requiredTrades.rows.map(t => ({ ...t, source: 'description' })),
    ...tradesWithIds  // Jetzt mit IDs!
  ];
  
  groupedTrades = {
    required: allDetectedTrades.filter(t => 
      t.source === 'description' || t.category === 'required'
    ),
    recommended: allDetectedTrades.filter(t => 
      t.source === 'intake' || t.category === 'recommended'
    )
  };
} else {  // <- Direkt nach der schließenden Klammer vom if
  // Fallback: Alte Version ohne source tracking
  groupedTrades = {
    required: requiredTrades.rows.map(trade => ({
      ...trade,
      reason: 'Direkt aus Ihrer Projektbeschreibung erkannt'
    })),
    recommended: allRecommendedTrades
  };
}

console.log('[INTAKE-SUMMARY] Required trades:', groupedTrades.required.length);
console.log('[INTAKE-SUMMARY] Recommended trades:', groupedTrades.recommended.length);

res.json({ 
  ok: true, 
  summary,
  groupedTrades,
  additionalTradesDetected: allRecommendedTrades
});

  } catch (err) {
    console.error('intake/summary failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Confirm trades for project
app.post('/api/projects/:projectId/trades/confirm', async (req, res) => {
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
          
          await query(
  `INSERT INTO project_trades (project_id, trade_id, is_manual, is_ai_recommended)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT (project_id, trade_id) 
   DO UPDATE SET 
     is_manual = EXCLUDED.is_manual, 
     is_ai_recommended = EXCLUDED.is_ai_recommended`,
  [projectId, tradeId, isManual, isAiRecommended]  // KORRIGIERT!
);
        }
      } else {
        // Normale Bestätigung: Alle hinzufügen
        for (const tradeId of confirmedTrades) {
          const isManual = manuallyAddedTrades.includes(tradeId);
          const isAiRecommended = aiRecommendedTrades.includes(tradeId);
          
          await query(
  `INSERT INTO project_trades (project_id, trade_id, is_manual, is_ai_recommended)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT (project_id, trade_id) 
   DO UPDATE SET is_manual = $3, is_ai_recommended = $4`,
  [projectId, tradeId, isManual, isAiRecommended]  // KORRIGIERT!
);

console.log(`[TRADES] Added trade ${tradeId}: manual=${isManual}, AI=${isAiRecommended}`);
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
app.post('/api/projects/:projectId/trades/add-single', async (req, res) => {
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

// Generate adaptive questions for a specific trade
app.post('/api/projects/:projectId/trades/:tradeId/questions', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    const {
      includeIntakeContext,
      isManuallyAdded: manualFromBody,
      projectDescription: descriptionFromBody,
      projectCategory: categoryFromBody,
      projectBudget: budgetFromBody
    } = req.body;
    
    // Prüfe Trade-Status
    const tradeStatusResult = await query(
      `SELECT is_manual, is_ai_recommended 
       FROM project_trades 
       WHERE project_id = $1 AND trade_id = $2`,
      [projectId, tradeId]
    );
    
    const tradeStatus = tradeStatusResult.rows[0] || {};
    const needsContextQuestion = tradeStatus.is_manual && !tradeStatus.is_ai_recommended;
    // NUR manuelle Gewerke brauchen Kontextfrage, AI-empfohlene NICHT!
    
    console.log('[QUESTIONS] Trade status:', {
      manual: tradeStatus.is_manual,
      aiRecommended: tradeStatus.is_ai_recommended,
      needsContext: needsContextQuestion
    });
    
    const isAssigned = await isTradeAssignedToProject(projectId, tradeId);
    const tradeInfo = await query('SELECT code, name FROM trades WHERE id = $1', [tradeId]);
    const tradeCode = tradeInfo.rows[0]?.code;
    const tradeName = tradeInfo.rows[0]?.name;
    
    if (!isAssigned && tradeCode !== 'INT') {
      console.log(`[QUESTIONS] Trade ${tradeId} not assigned to project ${projectId}, adding it now`);
      await ensureProjectTrade(projectId, tradeId, 'questions_request');
    }
    
    const projectResult = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = projectResult.rows[0];
    
    // Parse metadata
    if (project.metadata && typeof project.metadata === 'string') {
      project.metadata = JSON.parse(project.metadata);
    }
    
    // ERST intakeContext laden
    let intakeContext = '';
    if (tradeCode !== 'INT') {
      const intakeAnswers = await query(
        `SELECT q.text as question, a.answer_text as answer
         FROM answers a
         JOIN questions q ON q.project_id = a.project_id 
           AND q.trade_id = a.trade_id 
           AND q.question_id = a.question_id
         JOIN trades t ON t.id = a.trade_id
         WHERE a.project_id = $1 
         AND t.code = 'INT'`,
        [projectId]
      );
      
      if (intakeAnswers.rows.length > 0) {
        intakeContext = intakeAnswers.rows
          .map(a => `${a.question}: ${a.answer}`)
          .join('\n');
      }
    }
    
    // Lade Projekt-Trades
    const projectTrades = await query(
      `SELECT t.code, t.name FROM trades t 
       JOIN project_trades pt ON t.id = pt.trade_id 
       WHERE pt.project_id = $1`,
      [projectId]
    );
    
    // DANN EINMAL projectContext erstellen mit ALLEN Daten
    const projectContext = {
      category: req.body.projectCategory || project.category,
      subCategory: project.sub_category,
      description: req.body.projectDescription || project.description,
      timeframe: project.timeframe,
      budget: req.body.projectBudget || project.budget,
      projectId: projectId,
      isManuallyAdded: tradeStatus.is_manual || req.body.isManuallyAdded,
      isAiRecommended: tradeStatus.is_ai_recommended || req.body.isAiRecommended,
      intakeContext: intakeContext,
      hasIntakeAnswers: intakeContext.length > 0,
      trades: projectTrades.rows,
      // NEU: Komplexität aus Metadata
      complexity: project.metadata?.complexity?.level || 'MITTEL',
      metadata: project.metadata
    };
    
    console.log('[DEBUG] projectContext.isManuallyAdded:', projectContext.isManuallyAdded);
    console.log('[DEBUG] Project complexity:', projectContext.complexity);
    
    const questions = await generateQuestions(tradeId, projectContext);
    
    // Filter anwenden
    const filteredQuestions = filterDuplicateQuestions(questions, projectContext.intakeData || []);
    console.log(`[QUESTIONS] Filtered ${questions.length - filteredQuestions.length} duplicate questions`);
    
    // Speichere Fragen
    for (const question of filteredQuestions) {
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
          question.dependsOn || null,
          question.showIf || null
        ]
      );
    }
    
    // Verwende projectContext für intelligente Count
    const intelligentCount = getIntelligentQuestionCount(tradeCode, projectContext, []);
    
    res.json({ 
      questions: filteredQuestions,
      targetCount: intelligentCount.count,
      actualCount: questions.length,
      completeness: intelligentCount.completeness,
      missingInfo: intelligentCount.missingInfo,
      tradeName: tradeName,
      needsContextQuestion
    });
    
  } catch (err) {
    console.error('Failed to generate questions:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get questions for a trade
app.get('/api/projects/:projectId/trades/:tradeId/questions', async (req, res) => {
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

// Save answers with validation
app.post('/api/projects/:projectId/trades/:tradeId/answers', async (req, res) => {
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

// Save intake answers specifically
app.post('/api/projects/:projectId/intake/answers', async (req, res) => {
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

app.post('/api/projects/:projectId/trades/:tradeId/context-questions', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    const { contextAnswer } = req.body;
    
    if (!contextAnswer) {
      return res.status(400).json({ error: 'Kontextantwort fehlt' });
    }
    
    // HIER: Rufe die verbesserte Funktion auf (aus Änderung 3)
    const questions = await generateContextBasedQuestions(tradeId, projectId, contextAnswer);
    
    // Speichere die neuen Fragen (dieser Teil bleibt gleich)
    for (const q of questions) {
      await query(
        `INSERT INTO questions (project_id, trade_id, question_id, text, type, required, options)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (project_id, trade_id, question_id)
         DO UPDATE SET text=$4, type=$5, required=$6, options=$7`,
        [projectId, tradeId, q.id, q.question || q.text, q.type || 'text', q.required ?? true, 
         q.options ? JSON.stringify(q.options) : null]
      );
    }
    
    res.json({ questions, count: questions.length });
    
  } catch (err) {
    console.error('Context questions generation failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint für Rückfragen zu Fragen - "Frage zur Frage" Feature
app.post('/api/projects/:projectId/trades/:tradeId/question-clarification', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    const { questionText, questionContext, userQuery } = req.body;
    
    if (!questionText || !userQuery) {
      return res.status(400).json({ 
        error: 'Frage und Rückfrage sind erforderlich' 
      });
    }
    
    // Hole Trade-Info für Kontext
    const tradeInfo = await query(
      'SELECT name, code FROM trades WHERE id = $1', 
      [tradeId]
    );
    
    if (tradeInfo.rows.length === 0) {
      return res.status(404).json({ error: 'Gewerk nicht gefunden' });
    }
    
    const tradeName = tradeInfo.rows[0].name;
    const tradeCode = tradeInfo.rows[0].code;
    
    // Hole Projekt für zusätzlichen Kontext
    const projectResult = await query(
      'SELECT description, category, budget FROM projects WHERE id = $1', 
      [projectId]
    );
    const project = projectResult.rows[0];
    
    const systemPrompt = `Du bist ein geduldiger Experte für ${tradeName}, der Laien hilft.
    
KONTEXT:
- Gewerk: ${tradeName} (${tradeCode})
- Gestellte Frage: "${questionText}"
- Projekt: ${project?.description || 'Keine Beschreibung'}
- Kategorie: ${project?.category || 'Nicht angegeben'}

AUFGABE:
Beantworte die Rückfrage des Nutzers zur gestellten Frage.
Erkläre in einfachen Worten, gib praktische Tipps.
Maximal 150 Wörter. Sei konkret und hilfreich.

WICHTIG:
- Keine Fachbegriffe ohne Erklärung
- Praktische Beispiele aus dem Alltag
- Schritt-für-Schritt wenn nach Anleitung gefragt
- Produktbeispiele wenn nach Qualität gefragt
- Preisrahmen wenn nach Kosten gefragt`;

    const userPrompt = `Original-Frage an den Nutzer: "${questionText}"
${questionContext ? `\nKontext: ${questionContext}` : ''}

Nutzer-Rückfrage: "${userQuery}"

Gib eine hilfreiche, verständliche Antwort die dem Laien weiterhilft.`;

    const response = await llmWithPolicy('clarification', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { 
      maxTokens: 1000,
      temperature: 0.3 
    });
    
    console.log(`[CLARIFICATION] Question clarified for trade ${tradeCode}`);
    
    res.json({ 
      success: true, 
      response: response,
      tradeInfo: {
        name: tradeName,
        code: tradeCode
      }
    });
    
  } catch (err) {
    console.error('Question clarification failed:', err);
    res.status(500).json({ 
      error: 'Fehler bei der Beantwortung Ihrer Rückfrage' 
    });
  }
});

// Generate detailed LV for a trade
app.post('/api/projects/:projectId/trades/:tradeId/lv', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    
    const isAssigned = await isTradeAssignedToProject(projectId, tradeId);
    
    const tradeInfo = await query('SELECT code FROM trades WHERE id = $1', [tradeId]);
    const tradeCode = tradeInfo.rows[0]?.code;
    
    if (!isAssigned && tradeCode !== 'INT') {
      console.log(`[LV] Trade ${tradeId} not assigned to project ${projectId}, adding it now`);
      await ensureProjectTrade(projectId, tradeId, 'lv_generation');
    }
    
    // Generiere detailliertes LV
    const lv = await generateDetailedLVWithRetry(projectId, tradeId);
    
    // Speichere LV in DB
await query(
  `INSERT INTO lvs (project_id, trade_id, content)
   VALUES ($1,$2,$3)
   ON CONFLICT (project_id, trade_id)
   DO UPDATE SET content=$3, updated_at=NOW()`,
  [projectId, tradeId, JSON.stringify(lv)]  // <-- JSON.stringify() hinzugefügt!
);
    
    console.log(`[LV] Generated for trade ${tradeId}: ${lv.positions?.length || 0} positions, Total: €${lv.totalSum || 0}`);
    
    res.json({ 
      ok: true, 
      trade: { 
        id: tradeId, 
        code: tradeCode, 
        name: tradeInfo.rows[0]?.name 
      }, 
      lv
    });
    
  } catch (err) {
    console.error('Generate LV failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ANPASSUNG des bestehenden Endpoints: Get aggregated LVs for a project
app.get('/api/projects/:projectId/lv', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { includeSkipped } = req.query; // NEU: Optional Parameter
    
    // ANGEPASSTE Query mit Filter für übersprungene Trades
    let query_string = `
      SELECT 
        l.trade_id, 
        t.code, 
        t.name, 
        l.content,
        l.status as lv_status,
        l.reviewed_at,
        l.questions_completed,
        l.skipped,
        tp.status as progress_status
      FROM lvs l 
      JOIN trades t ON t.id = l.trade_id
      LEFT JOIN trade_progress tp ON l.trade_id = tp.trade_id AND l.project_id = tp.project_id
      WHERE l.project_id = $1
    `;
    
    // NEU: Filtere übersprungene, außer explizit angefordert
    if (includeSkipped !== 'true') {
      query_string += ` AND (l.skipped = FALSE OR l.skipped IS NULL)`;
    }
    
    query_string += ` ORDER BY t.name`;
    
    const rows = (await query(query_string, [projectId])).rows;

    const lvs = rows.map(row => ({
      ...row,
      trade_id: row.trade_id, // Wichtig für Frontend
      trade_name: row.name,    // Wichtig für Frontend
      trade_code: row.code,    // Wichtig für Frontend
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
      // NEU: Zusätzliche Status-Informationen
      isReviewed: !!row.reviewed_at,
      isSkipped: row.skipped || false,
      progressStatus: row.progress_status || 'pending'
    }));
    
    // NEU: Berechne Summen mit NEP-Berücksichtigung
    let totalSum = 0;
    let totalNepSum = 0;
    let totalPositions = 0;
    
    lvs.forEach(lv => {
      if (lv.content) {
        totalSum += parseFloat(lv.content.totalSum) || 0;
        totalNepSum += parseFloat(lv.content.nepSum) || 0;
        totalPositions += lv.content.positions?.length || 0;
      }
    });
    
    // NEU: Erweiterte Summary
    const summary = {
      totalTrades: lvs.length,
      totalPositions,
      totalSum,
      totalNepSum,  // NEU
      vat: totalSum * 0.19,
      grandTotal: totalSum * 1.19,
      reviewedCount: lvs.filter(lv => lv.isReviewed).length,  // NEU
      skippedCount: lvs.filter(lv => lv.isSkipped).length     // NEU
    };
    
    res.json({ 
      ok: true, 
      lvs,
      summary
    });
    
  } catch (err) {
    console.error('aggregate LV failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ZUSÄTZLICH: Neuer Endpoint für einzelnes LV (für Review-Page)
app.get('/api/projects/:projectId/trades/:tradeId/lv', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    
    const result = await query(`
      SELECT 
        l.*,
        t.name as trade_name,
        t.code as trade_code,
        tp.status as progress_status,
        tp.reviewed_at as review_date
      FROM lvs l
      JOIN trades t ON l.trade_id = t.id
      LEFT JOIN trade_progress tp ON l.trade_id = tp.trade_id AND l.project_id = tp.project_id
      WHERE l.project_id = $1 AND l.trade_id = $2
    `, [projectId, tradeId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'LV nicht gefunden' });
    }
    
    const lv = result.rows[0];
    lv.content = typeof lv.content === 'string' ? JSON.parse(lv.content) : lv.content;
    
    res.json({ 
      lv: {
        ...lv,
        isReviewed: !!lv.review_date,
        progressStatus: lv.progress_status || 'pending'
      }
    });
    
  } catch (error) {
    console.error('Error fetching single LV:', error);
    res.status(500).json({ error: 'Fehler beim Laden des LVs' });
  }
});

// Get all LVs for a project
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

// Update LV positions (für Edit und Delete)
app.post('/api/projects/:projectId/trades/:tradeId/lv/update', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    const { positions, totalSum } = req.body;
    
    // Hole existierendes LV
    const existing = await query(
      'SELECT content FROM lvs WHERE project_id = $1 AND trade_id = $2',
      [projectId, tradeId]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'LV not found' });
    }
    
    const existingContent = typeof existing.rows[0].content === 'string' 
      ? JSON.parse(existing.rows[0].content) 
      : existing.rows[0].content;
    
    // NEU: Berechne Summen mit NEP-Berücksichtigung
    let calculatedSum = 0;
    let nepSum = 0;
    
    const updatedPositions = positions.map(pos => {
      if (!pos.isNEP) {
        calculatedSum += parseFloat(pos.totalPrice) || 0;
      } else {
        nepSum += parseFloat(pos.totalPrice) || 0;
      }
      return pos;
    });
    
    // Update mit neuen Daten
    const updatedContent = {
      ...existingContent,
      positions: updatedPositions,
      totalSum: calculatedSum,
      nepSum: nepSum
    };
    
    // Speichere in DB
    await query(
      'UPDATE lvs SET content = $1, updated_at = NOW() WHERE project_id = $2 AND trade_id = $3',
      [JSON.stringify(updatedContent), projectId, tradeId]
    );
    
    res.json({ ok: true });
    
  } catch (err) {
    console.error('Update LV failed:', err);
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
        ...pos,
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

// Generate complete PDF with all LVs for a project
app.get('/api/projects/:projectId/lv-complete.pdf', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { withPrices } = req.query;
    
    // Hole Projektdaten und alle LVs
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = projectResult.rows[0];
    
    const lvsResult = await query(
      `SELECT l.content, t.name as trade_name, t.code as trade_code
       FROM lvs l 
       JOIN trades t ON t.id = l.trade_id
       WHERE l.project_id = $1
       ORDER BY t.name`,
      [projectId]
    );
    
    if (lvsResult.rows.length === 0) {
      return res.status(404).json({ error: 'No LVs found for this project' });
    }
    
    // Erstelle komplettes PDF
    const pdfBuffer = await generateCompleteLVPDF(
      project,
      lvsResult.rows,
      withPrices !== 'false'
    );
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Projekt_${projectId}_Komplett_LV_${withPrices !== 'false' ? 'mit' : 'ohne'}_Preise.pdf"`);
    res.send(pdfBuffer);
    
  } catch (err) {
    console.error('Complete PDF generation failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update LV (für Editierung im Frontend)
app.put('/api/projects/:projectId/trades/:tradeId/lv', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    const { positions } = req.body;
    
    // Hole aktuelles LV
    const currentLV = await query(
      'SELECT content FROM lvs WHERE project_id = $1 AND trade_id = $2',
      [projectId, tradeId]
    );
    
    if (currentLV.rows.length === 0) {
      return res.status(404).json({ error: 'LV not found' });
    }
    
    let lv = typeof currentLV.rows[0].content === 'string' 
      ? JSON.parse(currentLV.rows[0].content) 
      : currentLV.rows[0].content;
    
    // Update Positionen
    lv.positions = positions;
    
    // Neuberechnung der Summe
    let totalSum = 0;
    lv.positions = lv.positions.map((pos, idx) => {
      // Stelle sicher dass Positionsnummer vorhanden ist
      if (!pos.pos) {
        pos.pos = `${idx + 1}.00`;
      }
      
      // Berechne Gesamtpreis wenn nötig
      if (pos.quantity && pos.unitPrice && !pos.totalPrice) {
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      }
      
      totalSum += pos.totalPrice || 0;
      return pos;
    });
    
    lv.totalSum = Math.round(totalSum * 100) / 100;
    lv.lastModified = new Date().toISOString();
    lv.modifiedBy = 'user';
    
    // Speichere aktualisiertes LV
    await query(
      `UPDATE lvs 
       SET content = $1, updated_at = NOW()
       WHERE project_id = $2 AND trade_id = $3`,
      [lv, projectId, tradeId]
    );
    
    res.json({ 
      ok: true, 
      message: 'LV erfolgreich aktualisiert',
      lv 
    });
    
  } catch (err) {
    console.error('Failed to update LV:', err);
    res.status(500).json({ error: err.message });
  }
});

// Einzelne Position hinzufügen
app.post('/api/projects/:projectId/trades/:tradeId/lv/position', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    const newPosition = req.body;
    
    const currentLV = await query(
      'SELECT content FROM lvs WHERE project_id = $1 AND trade_id = $2',
      [projectId, tradeId]
    );
    
    if (currentLV.rows.length === 0) {
      return res.status(404).json({ error: 'LV not found' });
    }
    
    let lv = typeof currentLV.rows[0].content === 'string' 
      ? JSON.parse(currentLV.rows[0].content) 
      : currentLV.rows[0].content;
    
    if (!lv.positions || !Array.isArray(lv.positions)) {
      lv.positions = [];
    }
    
    // Füge neue Position hinzu mit NEP-Unterstützung
    const nextPos = lv.positions.length + 1;
    const positionToAdd = {
      pos: newPosition.pos || `${nextPos}.00`,
      title: newPosition.title || 'Neue Position',
      description: newPosition.description || '',
      quantity: parseFloat(newPosition.quantity) || 1,
      unit: newPosition.unit || 'Stk',
      unitPrice: parseFloat(newPosition.unitPrice) || 0,
      totalPrice: 0,
      dataSource: 'manual',
      notes: 'Manuell hinzugefügt',
      isNEP: newPosition.isNEP || false  // NEU: NEP-Flag übernehmen
    };
    
    // Berechne totalPrice
    positionToAdd.totalPrice = Math.round(
      positionToAdd.quantity * positionToAdd.unitPrice * 100
    ) / 100;
    
    lv.positions.push(positionToAdd);
    
    // NEU: Neuberechnung mit NEP-Berücksichtigung
    let calculatedSum = 0;
    let nepSum = 0;
    
    lv.positions.forEach(pos => {
      if (pos.isNEP) {
        nepSum += pos.totalPrice || 0;
      } else {
        calculatedSum += pos.totalPrice || 0;
      }
    });
    
    lv.totalSum = Math.round(calculatedSum * 100) / 100;
    lv.nepSum = Math.round(nepSum * 100) / 100;
    
    lv.lastModified = new Date().toISOString();
    
    // Speichere aktualisiertes LV
    await query(
      `UPDATE lvs 
       SET content = $1, updated_at = NOW()
       WHERE project_id = $2 AND trade_id = $3`,
      [JSON.stringify(lv), projectId, tradeId]
    );
    
    res.json({ 
      ok: true,
      success: true,
      message: 'Position hinzugefügt',
      position: positionToAdd,
      totalSum: lv.totalSum,
      nepSum: lv.nepSum,  // NEU: NEP-Summe zurückgeben
      lv
    });
    
  } catch (err) {
    console.error('Failed to add position:', err);
    res.status(500).json({ error: err.message });
  }
});

// Position löschen
app.delete('/api/projects/:projectId/trades/:tradeId/lv/position/:positionId', async (req, res) => {
  try {
    const { projectId, tradeId, positionId } = req.params;
    
    const currentLV = await query(
      'SELECT content FROM lvs WHERE project_id = $1 AND trade_id = $2',
      [projectId, tradeId]
    );
    
    if (currentLV.rows.length === 0) {
      return res.status(404).json({ error: 'LV not found' });
    }
    
    let lv = typeof currentLV.rows[0].content === 'string' 
      ? JSON.parse(currentLV.rows[0].content) 
      : currentLV.rows[0].content;
    
    // Entferne Position
    lv.positions = lv.positions.filter(pos => pos.pos !== positionId);
    
    // Neuberechnung
    lv.totalSum = lv.positions.reduce((sum, pos) => sum + (pos.totalPrice || 0), 0);
    lv.lastModified = new Date().toISOString();
    
    // Nummeriere Positionen neu
    lv.positions = lv.positions.map((pos, idx) => {
      pos.pos = `${idx + 1}.00`;
      return pos;
    });
    
    await query(
      `UPDATE lvs 
       SET content = $1, updated_at = NOW()
       WHERE project_id = $2 AND trade_id = $3`,
      [lv, projectId, tradeId]
    );
    
    res.json({ 
      ok: true, 
      message: 'Position gelöscht',
      totalSum: lv.totalSum
    });
    
  } catch (err) {
    console.error('Failed to delete position:', err);
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

    // Projekt-Daten laden (NEUER CODE)
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = projectResult.rows[0];    
    
    const summary = {
      trades: [],
      totalCost: 0,
      budget: project.budget,  // DIESE ZEILE HINZUFÜGEN
      pricesComplete: true,
      dataQuality: {
        measured: 0,
        estimated: 0,
        assumed: 0
      }
    };
    
    for (const row of lvsResult.rows) {
      const lv = typeof row.content === 'string' 
        ? JSON.parse(row.content) 
        : row.content;
      
      const tradeCost = parseFloat(lv.totalSum) || 
  (lv.positions || []).reduce((sum, pos) => 
    sum + (parseFloat(pos.totalPrice) || 0), 0
  );
      
      // Zähle Datenqualität
      if (lv.positions) {
        lv.positions.forEach(pos => {
          if (pos.dataSource === 'measured') summary.dataQuality.measured++;
          else if (pos.dataSource === 'estimated') summary.dataQuality.estimated++;
          else summary.dataQuality.assumed++;
        });
      }
      
      summary.trades.push({
  name: row.trade_name,
  code: row.trade_code,
  cost: parseFloat(tradeCost) || 0,
  hasPrice: tradeCost > 0,
  positionCount: lv.positions?.length || 0,
  confidence: lv.dataQuality?.confidence || 0.5
});

summary.totalCost = summary.totalCost + (parseFloat(tradeCost) || 0);
      
      if (tradeCost === 0) {
        summary.pricesComplete = false;
      }
    }
    
    // Berechne Gesamtdatenqualität
    const totalPositions = summary.dataQuality.measured + 
                          summary.dataQuality.estimated + 
                          summary.dataQuality.assumed;
    
    summary.dataQuality.confidence = totalPositions > 0
      ? (summary.dataQuality.measured / totalPositions)
      : 0;
    
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

function formatCurrency(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(value || 0);
}

// Helper-Funktion für Gewerk-Beschreibungen
function getTradeDescription(tradeCode) {
  const descriptions = {
    'ABBR': 'Abbruch, Entkernung, Rückbau, Entsorgung',
    'ROH': 'Rohbau, Mauerarbeiten, Betonarbeiten, Fundamente',
    'GER': 'Gerüstbau, Arbeitsplattformen, Absturzsicherung',
    'ZIMM': 'Zimmererarbeiten, Gauben, Dachstuhl, Holzkonstruktionen, Carports, Holzrahmenbau',
    'DACH': 'Dachdeckerarbeiten, Abdichtungen, Terrassen, Flachdach',
    'FEN': 'Fenster, Außentüren, Haustüren, Montage, Rollläden',
    'FASS': 'Fassadenbau, Fassadensanierung, WDVS',
    'AUSS': 'Außenanlagen, Garten- und Landschaftsbau, Pflasterarbeiten',
    'ELEKT': 'Elektroinstallation, Schalter, Steckdosen, Beleuchtung',
    'SAN': 'Sanitärinstallation, Armaturen, Rohre, Bad, WC',
    'HEI': 'Heizungsinstallation, Heizkörper, Thermostate, Warmwasser',
    'KLIMA': 'Lüftung, Klimatechnik, Kühlung, Be- und Entlüftung',
    'PV': 'Photovoltaik, Solarmodule, Wechselrichter, Batteriespeicher',
    'ESTR': 'Estricharbeiten, Bodenaufbau, Dämmung, Fußbodenheizung',
    'TRO': 'Trockenbau, Wände, Decken, Dämmung, Schallschutz',
    'FLI': 'Fliesen, Plattenarbeiten, Verfugung, Abdichtung',
    'TIS': 'Innentüren, Wohnungseingangstüren, Innenausbau, Einbaumöbel, Holzarbeiten',
    'BOD': 'Bodenbeläge, Parkett, Laminat, Vinyl, Teppich, PVC',
    'MAL': 'Malerarbeiten, Lackieren, Tapezieren, Spachteln',
    'SCHL': 'Schlosserarbeiten, Metallbau, Geländer, Treppengeländer, Stahlkonstruktionen',
    'INT': 'Allgemeine Projektaufnahme, Bestandserfassung'
  };
  return descriptions[tradeCode] || 'Allgemeine Bauarbeiten';
}

// Vereinfachte Budget-Übersicht - zeigt nur Zusammenfassung
app.post('/api/projects/:projectId/budget-optimization', async (req, res) => {
  console.log('[BUDGET-OVERVIEW] Generating optimization overview for project:', req.params.projectId);
  
  try {
    const { projectId } = req.params;
    const { currentTotal, targetBudget, lvBreakdown } = req.body;
    
    const overspend = currentTotal - targetBudget;
    const percentOver = ((overspend / targetBudget) * 100).toFixed(1);
    
    // Einfache Übersicht ohne Details
    const overview = {
      summary: {
        currentTotal,
        targetBudget,
        overspend,
        percentOver,
        message: `Budget um ${formatCurrency(overspend)} (${percentOver}%) überschritten`
      },
      tradesPotential: lvBreakdown.map(lv => {
        // Grobe Schätzung des Einsparpotenzials pro Gewerk (10-20% je nach Gewerk)
        const potentialPercent = getTypicalSavingPercent(lv.tradeCode);
        const potentialAmount = Math.round(lv.total * potentialPercent / 100);
        
        return {
          tradeCode: lv.tradeCode,
          tradeName: lv.tradeName,
          currentCost: lv.total,
          estimatedPotential: potentialAmount,
          potentialPercent,
          hint: getSavingHint(lv.tradeCode)
        };
      }).sort((a, b) => b.estimatedPotential - a.estimatedPotential),
      totalEstimatedPotential: 0,
      recommendation: ''
    };
    
    // Berechne Gesamtpotenzial
    overview.totalEstimatedPotential = overview.tradesPotential.reduce(
      (sum, t) => sum + t.estimatedPotential, 0
    );
    
    // Empfehlung
    if (overview.totalEstimatedPotential >= overspend) {
      overview.recommendation = 'Die Budgetüberschreitung kann durch gezielte Optimierungen ausgeglichen werden.';
    } else {
      overview.recommendation = 'Eine vollständige Kompensation der Überschreitung erfordert größere Einschnitte.';
    }
    
    res.json(overview);
    
  } catch (err) {
    console.error('Overview generation failed:', err);
    res.status(500).json({ error: 'Fehler bei der Übersichtserstellung' });
  }
});

// Detaillierte Analyse für einzelnes Gewerk
app.post('/api/projects/:projectId/trades/:tradeId/optimize', async (req, res) => {
  console.log('[TRADE-OPTIMIZE] Detailed analysis for trade:', req.params.tradeId);
  
  try {
    const { projectId, tradeId } = req.params;
    const { targetSaving } = req.body;
    
    // Lade LV mit Positionen
    const lvData = await query(
      `SELECT l.*, t.name as trade_name, t.code as trade_code 
       FROM lvs l 
       JOIN trades t ON t.id = l.trade_id 
       WHERE l.project_id = $1 AND l.trade_id = $2`,
      [projectId, tradeId]
    );
    
    if (!lvData.rows[0]) {
      return res.status(404).json({ error: 'LV nicht gefunden' });
    }
    
    const lv = lvData.rows[0];
    
    // KORREKTUR: Sichere Verarbeitung des content Feldes
    let lvContent;
    if (typeof lv.content === 'string') {
      try {
        lvContent = JSON.parse(lv.content);
      } catch (parseError) {
        console.error('[TRADE-OPTIMIZE] Failed to parse LV content as string:', parseError);
        return res.status(500).json({ error: 'LV-Daten fehlerhaft' });
      }
    } else if (typeof lv.content === 'object' && lv.content !== null) {
      // Ist bereits ein Objekt
      lvContent = lv.content;
    } else {
      console.error('[TRADE-OPTIMIZE] Invalid LV content type:', typeof lv.content);
      return res.status(500).json({ error: 'LV-Daten ungültig' });
    }
    
    // Validiere dass positions existiert
    if (!lvContent.positions || !Array.isArray(lvContent.positions)) {
      console.error('[TRADE-OPTIMIZE] No positions found in LV');
      return res.status(400).json({ error: 'Keine Positionen im LV gefunden' });
    }
    
    // Lade Projekt-Kontext
    const projectData = await query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    // Lade ursprüngliche Antworten
    const answers = await query(
      `SELECT q.text as question, a.answer_text as answer 
       FROM answers a
       JOIN questions q ON q.question_id = a.question_id 
         AND q.trade_id = a.trade_id
       WHERE a.project_id = $1 AND a.trade_id = $2`,
      [projectId, tradeId]
    );
    
    // System-Prompt für Claude
    const systemPrompt = `Du bist ein erfahrener Baukostenoptimierer spezialisiert auf ${lv.trade_name}.

AUFGABE: Analysiere jede Position des LVs und finde KONKRETE, UMSETZBARE Einsparmöglichkeiten.

WICHTIGE REGELN:
1. Beziehe dich IMMER auf die konkrete Position (Pos-Nr und Titel)
2. Unterscheide klar zwischen:
   - MATERIAL: Günstigere Alternative bei gleicher Funktion
   - EIGENLEISTUNG: Was kann der Bauherr selbst machen
   - VERZICHT: Was ist wirklich verzichtbar ohne Funktionsverlust
   - REDUZIERUNG: Weniger Menge/Umfang
   - VERSCHIEBUNG: Kann später gemacht werden

3. Bewerte jede Alternative nach:
   - Einsparpotenzial in Euro und Prozent
   - Qualitätsauswirkung (keine/gering/mittel/hoch)
   - Machbarkeit für Laien bei Eigenleistung
   - Risiken und Nachteile

GEWERK-SPEZIFISCHE OPTIMIERUNGEN für ${lv.trade_code}:
${getDetailedTradeRules(lv.trade_code)}

AUSGABE als JSON:
{
  "optimizations": [
    {
      "positionRef": "Exakte Pos-Nr aus LV",
      "originalPosition": "Exakter Titel der Position",
      "originalCost": Zahl,
      "category": "material|eigenleistung|verzicht|reduzierung|verschiebung",
      "measure": "Kurze prägnante Maßnahme",
      "alternativeDescription": "Detaillierte Beschreibung der Alternative mit konkreten Produkten/Methoden",
      "savingAmount": Zahl (realistisch!),
      "savingPercent": Zahl,
      "qualityImpact": "keine|gering|mittel|hoch",
      "feasibility": "einfach|mittel|schwer",
      "timeNeeded": "Zeitaufwand in Stunden bei Eigenleistung",
      "risks": "Konkrete Risiken und Nachteile",
      "recommendation": "empfohlen|bedingt|nur_notfall",
      "prerequisites": "Was wird benötigt (Werkzeug, Kenntnisse)"
    }
  ],
  "summary": {
    "totalPossibleSaving": Zahl,
    "recommendedSaving": Zahl (nur empfohlene Maßnahmen),
    "qualityPreservedSaving": Zahl (ohne/geringe Qualitätseinbuße),
    "eigenleistungSaving": Zahl (nur Eigenleistung),
    "topThree": ["Die drei wirkungsvollsten Maßnahmen"]
  }
}

WICHTIG: Sei REALISTISCH! Keine Fantasie-Einsparungen!

KRITISCH: Antworte NUR mit validem JSON ohne Markdown-Codeblocks!
Gib das JSON direkt aus, keine zusätzliche Formatierung.`;
    
    const userPrompt = `LEISTUNGSVERZEICHNIS ${lv.trade_name}:

${lvContent.positions.map((pos, idx) => 
  `Position ${pos.pos}:
   Titel: ${pos.title}
   Beschreibung: ${pos.description || 'Keine Details'}
   Menge: ${pos.quantity} ${pos.unit}
   Einzelpreis: ${pos.unitPrice}€
   Gesamtpreis: ${pos.totalPrice}€
   ${pos.isNEP ? '(NEP - Eventualposition)' : ''}
   ---`
).join('\n')}

GESAMTSUMME LV: ${lvContent.totalSum}€

PROJEKT-KONTEXT:
Kategorie: ${projectData.rows[0]?.category || 'Sanierung'}
${answers.rows.map(a => `- ${a.question}: ${a.answer}`).join('\n')}

${targetSaving ? `ZIEL-EINSPARUNG: ${targetSaving}€` : 'ZIEL: Maximale sinnvolle Einsparung ohne große Qualitätsverluste'}

Analysiere JEDE Position und finde konkrete Einsparmöglichkeiten!`;

    // Claude API Call
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

console.log('[TRADE-OPTIMIZE] Calling Claude for detailed analysis...');

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 6000,
  temperature: 0.3,
  messages: [
    { 
      role: 'user', 
      content: systemPrompt + '\n\n' + userPrompt 
    }
  ]
});

let optimizations;
try {
  // Claude gibt den Text im content Array zurück
  let responseText = response.content[0].text;
  
  // NEUE BEREINIGUNG: Entferne Markdown-Codeblocks
  responseText = responseText.trim();
  
  // Entferne ```json am Anfang und ``` am Ende
  if (responseText.startsWith('```json')) {
    responseText = responseText.substring(7); // Entferne ```json
  } else if (responseText.startsWith('```')) {
    responseText = responseText.substring(3); // Entferne ```
  }
  
  if (responseText.endsWith('```')) {
    responseText = responseText.substring(0, responseText.length - 3);
  }
  
  // Nochmal trimmen nach dem Entfernen
  responseText = responseText.trim();
  
  console.log('[TRADE-OPTIMIZE] Cleaned response (first 200 chars):', responseText.substring(0, 200));
  
  optimizations = JSON.parse(responseText);
  
} catch (parseError) {
  console.error('[TRADE-OPTIMIZE] Parse error:', parseError);
  console.error('[TRADE-OPTIMIZE] Raw response:', response.content[0].text.substring(0, 500));
  
  return res.status(500).json({ 
    error: 'Fehler bei der Analyse', 
    details: parseError.message 
  });
}
    
    // Validierung und Bereinigung
    if (optimizations.optimizations) {
      optimizations.optimizations = optimizations.optimizations
        .filter(opt => opt.savingAmount > 50) // Mindestens 50€ Ersparnis
        .map(opt => ({
          ...opt,
          savingAmount: Math.round(opt.savingAmount),
          savingPercent: Math.round(opt.savingPercent * 10) / 10
        }));
    }
    
    // Speichere in DB
    await query(
      `INSERT INTO trade_optimizations (project_id, trade_id, suggestions, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (project_id, trade_id) 
       DO UPDATE SET suggestions = $3, created_at = NOW()`,
      [projectId, tradeId, JSON.stringify(optimizations)]
    );
    
    console.log(`[TRADE-OPTIMIZE] Found ${optimizations.optimizations?.length || 0} optimizations`);
    res.json(optimizations);
    
  } catch (err) {
    console.error('[TRADE-OPTIMIZE] Analysis failed:', err);
    res.status(500).json({ 
      error: 'Optimierung fehlgeschlagen',
      details: err.message 
    });
  }
});

// Helper-Funktionen für die Übersicht
function getTypicalSavingPercent(tradeCode) {
  const typicalSavings = {
    'FEN': 25,    // Fenster: Material-Alternativen
    'TIS': 20,    // Türen: Material-Alternativen
    'DACH': 18,   // Dach: Materialwahl
    'MAL': 35,    // Maler: Hohe Eigenleistung möglich
    'FLI': 25,    // Fliesen: Material + Eigenleistung
    'SAN': 20,    // Sanitär: Armaturen-Alternativen
    'HEI': 15,    // Heizung: Optimierung möglich
    'ELEKT': 18,  // Elektro: Umfang reduzierbar
    'BOD': 22,    // Boden: Material-Alternativen
    'FASS': 15,   // Fassade: Begrenzt
    'GER': 5,     // Gerüst: Kaum Spielraum
    'ROH': 8,     // Rohbau: Wenig Spielraum
    'ZIMM': 12,   // Zimmerer: Begrenzt
    'ESTR': 10    // Estrich: Begrenzt
  };
  return typicalSavings[tradeCode] || 15;
}

function getSavingHint(tradeCode) {
  const hints = {
    'FEN': 'Materialwahl und Anzahl prüfen',
    'TIS': 'Türqualität optimieren',
    'DACH': 'Ziegel-Alternative prüfen',
    'MAL': 'Hohe Eigenleistung möglich',
    'FLI': 'Material + Eigenleistung',
    'SAN': 'Armaturenwahl überdenken',
    'HEI': 'Heizkörper optimieren',
    'ELEKT': 'Ausstattung reduzieren',
    'BOD': 'Günstigere Beläge wählen',
    'FASS': 'Dämmstärke prüfen',
    'GER': 'Standzeit optimieren',
    'ROH': 'Wenig Einsparpotenzial',
    'ZIMM': 'Konstruktion vereinfachen',
    'ESTR': 'Standardausführung wählen'
  };
  return hints[tradeCode] || 'Detailanalyse empfohlen';
}

// Erweiterte Helper-Funktion mit detaillierten Regeln
function getDetailedTradeRules(tradeCode) {
  const rules = {
    'FEN': `
    MATERIAL-ALTERNATIVEN:
    - Kunststoff statt Holz: 30-40% günstiger, pflegeleichter
    - Kunststoff statt Holz-Alu: 50% günstiger
    - 2-fach statt 3-fach Verglasung: 15% günstiger (Achtung: EnEV prüfen!)
    - Standard-Beschläge statt RC2: 200-300€ pro Fenster
    - Standardmaße statt Sondermaße: 20% günstiger
    
    EIGENLEISTUNG:
    - Demontage Altfenster: 50-80€ pro Fenster
    - Entsorgung selbst: 30€ pro Fenster
    - Fensterbank-Montage innen: 50€ pro Fenster
    
    VERZICHT/REDUZIERUNG:
    - Einzelne Fenster weglassen/später
    - Festverglasungen statt Flügel wo möglich
    - Rollläden weglassen: 400-600€ pro Fenster`,
    
    'DACH': `
    MATERIAL-ALTERNATIVEN:
    - Betondachsteine statt Tonziegel: 15-20€/m² günstiger
    - Standardziegel statt Premiumziegel: 20-40€/m² Unterschied
    - PVC-Dachrinnen statt Zink: 60% günstiger
    - Standarddämmung statt Premium: 10-15€/m² 
    
    EIGENLEISTUNG:
    - Dämmung verlegen (nur Geschossdecke!): 25-30€/m²
    - Alte Ziegel abdecken: 15€/m²
    - Entrümpelung Dachboden: 200-500€
    
    VERZICHT:
    - Dachfenster reduzieren: 1.500-3.000€ pro Stück
    - Gauben später: 8.000-15.000€ pro Gaube
    - Schneefanggitter nur wo nötig`,
    
    'SAN': `
    MATERIAL-ALTERNATIVEN:
    - Standard-Armaturen statt Grohe/Hansgrohe: 50-70% günstiger
    - Acryl-Duschwanne statt Mineralguss: 200-400€ Differenz
    - Standard-WC statt Dusch-WC: 2.000-3.000€
    - Aufputz-Spülkasten wo möglich: 150€ günstiger
    
    EIGENLEISTUNG:
    - Demontage alte Sanitärobjekte: 100% Arbeitskosten
    - Fliesenspiegel selbst: 50€/m²
    - Silikonfugen ziehen: 15€/m
    
    REDUZIERUNG:
    - Einhebelmischer statt Thermostat: 100-200€
    - Duschwanne statt bodengleich: 800-1.500€
    - Kleinerer Waschtisch: 200-400€`,
    
    'MAL': `
    EIGENLEISTUNG (SEHR HOCH!):
    - Komplette Malerarbeiten selbst: 25-40€/m² sparen
    - Tapeten entfernen: 8-12€/m²
    - Grundierung: 5€/m²
    - Streichen: 15-20€/m²
    - Spachteln Q2: 10€/m²
    
    MATERIAL:
    - Dispersionsfarbe statt Silikat: 5€/m²
    - Raufaser statt Vlies: 8€/m²
    - Standardfarbe statt Öko-Premium: 30-50%
    
    REDUZIERUNG:
    - Q2 statt Q3 Qualität: 5-8€/m²
    - Nur Wände, Decken später
    - Nebenräume einfacher`,

    'FASS': `
MATERIAL-ALTERNATIVEN:
- EPS statt Mineralwolle WDVS: 20-30€/m² günstiger
- Dünnere Dämmstärke (EnEV-Minimum): 15-25€/m² sparen
- Kunstharzputz statt Silikatputz: 8-12€/m²
- Standardfarbe statt Silikatfarbe: 5-8€/m²
- Verzicht auf Sockelprofile Alu: 15€/m

EIGENLEISTUNG:
- Alte Fassade reinigen: 10€/m²
- Grundierung auftragen: 8€/m²
- Kleinere Ausbesserungen: 20€/m²

REDUZIERUNG:
- Nur Wetterseiten dämmen: 40% sparen
- Sockeldämmung weglassen: 80-120€/m
- Teilflächen später: flexibel`,

'ELEKT': `
MATERIAL-ALTERNATIVEN:
- Standard-Schalterserie (Busch-Jaeger) statt Premium: 15-25€ pro Stelle
- Aufputz in Keller/Garage: 30% günstiger
- LED-Einbaustrahler Standard statt Premium: 20-40€ pro Stück
- Normale Steckdosen statt USB-Kombi: 30€ pro Stück

EIGENLEISTUNG:
- Schlitze stemmen: 15-20€/m
- Dosen setzen: 10€ pro Dose
- Kabel einziehen (mit Elektriker): 8€/m
- Alte Installation demontieren: 100% Arbeitskosten

REDUZIERUNG:
- Mindestausstattung statt Komfort: 2.000-4.000€
- Weniger Steckdosen (nur DIN-Minimum): 30%
- Smart-Home später nachrüsten: 3.000-5.000€`,

'FLI': `
MATERIAL-ALTERNATIVEN:
- Baumarkt-Fliesen statt Markenfliesen: 20-60€/m²
- Feinsteinzeug statt Naturstein: 40-80€/m²
- Großformate (weniger Fugen): 10€/m² Verlegung sparen
- Standardformat 30x60 statt Mosaik: 30€/m²

EIGENLEISTUNG:
- Alte Fliesen entfernen: 15-25€/m²
- Grundierung/Ausgleich: 10€/m²
- Sockelfliesen selbst: 15€/m
- Verfugen: 8-10€/m²

REDUZIERUNG:
- Nur Nassbereiche fliesen: 50% sparen
- Teilverfliesung statt raumhoch: 30%
- Einfaches Verlegemuster: 10€/m²`,

'TIS': `
MATERIAL-ALTERNATIVEN:
- CPL-Türen statt Echtholz: 200-400€ pro Tür
- Röhrenspan statt Vollspan: 50-80€ pro Tür
- Standard-Zarge statt Blockzarge: 80-150€
- Buntbart statt Profilzylinder: 40€ pro Tür
- Standardmaße statt Sondermaße: 30%

EIGENLEISTUNG:
- Demontage alte Türen: 50€ pro Tür
- Türblätter einhängen (vorbereitet): 30€ pro Tür
- Beschläge montieren: 20€ pro Tür

VERZICHT:
- Schiebetüren vermeiden: 800-1.500€ Mehrpreis
- Glastüren reduzieren: 300-500€ Mehrpreis
- Schallschutz nur wo nötig: 150€ pro Tür`,

'SCHL': `
MATERIAL-ALTERNATIVEN:
- Stahl verzinkt statt Edelstahl: 40% günstiger
- Standardprofile statt Sonderanfertigung: 30%
- Gitterrost statt Lochblech: 25% günstiger
- Pulverbeschichtung statt feuerverzinkt: 20%

EIGENLEISTUNG:
- Demontage Altgeländer: 30€/m
- Grundierung Handlauf: 10€/m
- Montage vorbereiten: 20€/m

REDUZIERUNG:
- Einfache Füllung statt aufwendig: 50€/m
- Standardhöhe 90cm statt 110cm: 20%
- Handlauf nur einseitig: 40€/m`,

'TRO': `
MATERIAL-ALTERNATIVEN:
- Standardplatten 12,5mm statt Spezial: 3-5€/m²
- Metallständer Standard statt verstärkt: 5€/m²
- Mineralwolle statt Spezial-Dämmung: 8€/m²
- Q2 statt Q3 Verspachtelung: 5€/m²

EIGENLEISTUNG:
- Alte Verkleidungen entfernen: 10€/m²
- Grundierung auftragen: 5€/m²
- Dämmung einlegen: 8€/m²
- Erste Spachtelgänge: 10€/m²

REDUZIERUNG:
- Einfache statt doppelte Beplankung: 15€/m²
- Ohne Dämmung wo nicht nötig: 10€/m²
- Direktbeplankung statt Ständerwerk: 20€/m²`,

'PV': `
MATERIAL-ALTERNATIVEN:
- Standard-Module statt Premium: 50-80€/kWp
- String-Wechselrichter statt Optimizer: 100€/kWp
- Standardmontage statt Indach: 200€/kWp
- Einfacher Zählerschrank: 500-800€

EIGENLEISTUNG:
- Kabelwege vorbereiten: 20€/m
- DC-Verkabelung unterstützen: 15€/m
- Dokumentation erstellen: 200€

REDUZIERUNG:
- Kleinere Anlage (nur Eigenverbrauch): 30%
- Speicher später nachrüsten: 6.000-10.000€
- Nur Südseite belegen: 20-40%`,

'KLIMA': `
MATERIAL-ALTERNATIVEN:
- Split-Geräte statt zentrale Anlage: 40% günstiger
- Standard-Geräte statt Premium: 30%
- Einzelraumgeräte statt Multi-Split: 25%
- Kanalgeräte statt Kassetten: 20%

EIGENLEISTUNG:
- Wanddurchbrüche vorbereiten: 100€/Stück
- Kabelkanäle verlegen: 15€/m
- Kondensat-Ableitung vorbereiten: 50€/Gerät

REDUZIERUNG:
- Nur Haupträume klimatisieren: 50%
- Mobile Geräte für Übergang: 60% günstiger
- Kleinere Leistung wählen: 20%`,

'HEI': `
MATERIAL-ALTERNATIVEN:
- Heizkörper Typ 11 statt 22 (wo möglich): 30%
- Standard-Thermostate statt Smart: 50€/Stück
- Stahl-Heizkörper statt Design: 40%
- Standard-Pumpe statt Hocheffizienz: 200€

EIGENLEISTUNG:
- Alte Heizkörper demontieren: 50€/Stück
- Heizkörper grundieren: 30€/Stück
- Dämmung Heizungsleitungen: 10€/m

REDUZIERUNG:
- FBH nur in Bad: 2.000-3.000€ sparen
- Anzahl Heizkreise reduzieren: 300€/Kreis
- Pufferspeicher kleiner: 500-1.000€`,

'BOD': `
MATERIAL-ALTERNATIVEN:
- Laminat statt Parkett: 30-50€/m²
- Vinyl statt Echtholz: 40-60€/m²
- 2-Schicht statt 3-Schicht Parkett: 20-30€/m²
- Click statt verklebt: 15€/m² Verlegung

EIGENLEISTUNG:
- Alte Beläge entfernen: 10-15€/m²
- Ausgleichsmasse gießen: 10€/m²
- Sockelleisten montieren: 8€/m
- Click-Laminat selbst verlegen: 25€/m²

REDUZIERUNG:
- Teppich in Schlafzimmern belassen: 30%
- Nur Haupträume neu: 40%
- Standardformate statt Sonderwünsche: 20%`,

'AUSS': `
MATERIAL-ALTERNATIVEN:
- Betonstein statt Naturstein: 40-60€/m²
- Kies statt Pflaster in Nebenflächen: 30€/m²
- Standard-Zaun statt Sichtschutz: 50%
- Rasengitter statt Pflaster: 25€/m²

EIGENLEISTUNG:
- Aushub Terrasse: 25€/m³
- Splittbett verteilen: 15€/m²
- Pflaster verlegen (einfach): 30€/m²
- Zaun streichen: 10€/m²

REDUZIERUNG:
- Kleinere Terrasse: flexibel
- Carport statt Garage: 10.000€
- Wege schmaler anlegen: 30%`,

'ABBR': `
EIGENLEISTUNG (SEHR HOCH!):
- Nicht-tragende Wände selbst: 30-40€/m²
- Bodenbeläge entfernen: 15€/m²
- Tapeten/Putz abschlagen: 10€/m²
- Sanitär demontieren: 80€/Objekt
- Entsorgung Container selbst: 50%

OPTIMIERUNG:
- Wertstoffe separat: 20€/m³
- Verkauf Altmaterial: variabel

REDUZIERUNG:
- Nur notwendige Bereiche: variabel
- Teilentkernung: 30-50%
- Erhaltenswertes stehen lassen: flexibel`,

'ROH': `
MATERIAL-ALTERNATIVEN:
- Poroton statt KS-Stein: 10-15€/m²
- Fertigteile wo möglich: 20% Arbeitszeit
- Standardbeton statt Spezialmix: 20€/m³
- Filigrandecke statt Ortbeton: 15%`,    
   
    'DEFAULT': `
    ALLGEMEINE OPTIMIERUNGEN:
    - Standardprodukte statt Premium
    - Eigenleistung bei Vorarbeiten
    - Teilausführung/Reduzierung
    - Verschiebung auf später`
  };
  
  return rules[tradeCode] || rules['DEFAULT'];
}

// Route zum Anwenden ausgewählter Optimierungen auf das LV
app.post('/api/projects/:projectId/trades/:tradeId/apply-optimizations', async (req, res) => {
  console.log('[APPLY-OPT] Starting optimization application for trade:', req.params.tradeId);
  
  try {
    const { projectId, tradeId } = req.params;
    const { optimizations } = req.body;
    
    if (!optimizations || !Array.isArray(optimizations) || optimizations.length === 0) {
      return res.status(400).json({ error: 'Keine Optimierungen ausgewählt' });
    }
    
    // Lade aktuelles LV
    const lvData = await query(
      `SELECT * FROM lvs WHERE project_id = $1 AND trade_id = $2`,
      [projectId, tradeId]
    );
    
    if (!lvData.rows[0]) {
      return res.status(404).json({ error: 'LV nicht gefunden' });
    }
    
    const lv = lvData.rows[0];
    
    // Parse LV content
    let lvContent;
    if (typeof lv.content === 'string') {
      lvContent = JSON.parse(lv.content);
    } else {
      lvContent = lv.content;
    }
    
    if (!lvContent.positions || !Array.isArray(lvContent.positions)) {
      return res.status(400).json({ error: 'Keine Positionen im LV gefunden' });
    }
    
    console.log(`[APPLY-OPT] Applying ${optimizations.length} optimizations to ${lvContent.positions.length} positions`);
    
    // Kopie der Positionen für Bearbeitung
    let updatedPositions = [...lvContent.positions];
    let appliedCount = 0;
    let totalSavings = 0;
    
    // Verarbeite jede Optimierung
    for (const opt of optimizations) {
      console.log(`[APPLY-OPT] Processing optimization for position ${opt.positionRef}`);
      
      // Finde die betroffene Position
      const posIndex = updatedPositions.findIndex(pos => 
        pos.pos === opt.positionRef || 
        pos.title?.toLowerCase().includes(opt.originalPosition?.toLowerCase().substring(0, 20))
      );
      
      if (posIndex === -1) {
        console.warn(`[APPLY-OPT] Position not found: ${opt.positionRef}`);
        continue;
      }
      
      const position = updatedPositions[posIndex];
      const originalPrice = position.totalPrice || (position.quantity * position.unitPrice);
      
      // Wende Optimierung basierend auf Kategorie an
      switch (opt.category) {
        case 'material':
          // Material-Optimierung: Titel und Beschreibung anpassen, Preis reduzieren
          position.title = position.title + ' (optimiert)';
          position.description = `${opt.alternativeDescription}\n\nUrsprünglich: ${position.description || ''}`;
          position.unitPrice = Math.round((position.unitPrice * (100 - opt.savingPercent) / 100) * 100) / 100;
          position.totalPrice = Math.round(position.quantity * position.unitPrice * 100) / 100;
          appliedCount++;
          break;
          
        case 'eigenleistung':
          // Eigenleistung: Position als Eigenleistung markieren, Arbeitskosten abziehen
          position.title = position.title + ' (Eigenleistung)';
          position.description = `EIGENLEISTUNG: ${opt.measure}\n\n${position.description || ''}`;
          // Reduziere nur Arbeitskosten (ca. 60-80% bei Eigenleistung)
          const laborReduction = opt.savingPercent || 70;
          position.unitPrice = Math.round((position.unitPrice * (100 - laborReduction) / 100) * 100) / 100;
          position.totalPrice = Math.round(position.quantity * position.unitPrice * 100) / 100;
          position.isEigenleistung = true;
          appliedCount++;
          break;
          
        case 'verzicht':
          // Verzicht: Position auf 0 setzen oder als NEP markieren
          position.title = position.title + ' (ENTFÄLLT)';
          position.description = `POSITION ENTFÄLLT: ${opt.measure}\n\n${position.description || ''}`;
          position.quantity = 0;
          position.totalPrice = 0;
          position.isNEP = true;
          appliedCount++;
          break;
          
        case 'reduzierung':
          // Reduzierung: Menge oder Umfang reduzieren
          const reductionFactor = (100 - opt.savingPercent) / 100;
          position.title = position.title + ' (reduziert)';
          position.description = `REDUZIERT: ${opt.measure}\n\n${position.description || ''}`;
          
          // Entscheide ob Menge oder Preis reduziert wird
          if (opt.measure.toLowerCase().includes('menge') || 
              opt.measure.toLowerCase().includes('weniger') ||
              opt.measure.toLowerCase().includes('fläche')) {
            // Mengenreduzierung
            position.quantity = Math.round(position.quantity * reductionFactor * 100) / 100;
          } else {
            // Preisreduzierung (z.B. einfachere Ausführung)
            position.unitPrice = Math.round(position.unitPrice * reductionFactor * 100) / 100;
          }
          position.totalPrice = Math.round(position.quantity * position.unitPrice * 100) / 100;
          appliedCount++;
          break;
          
        case 'verschiebung':
          // Verschiebung: Als Eventualposition markieren
          position.title = position.title + ' (Optional - spätere Ausführung)';
          position.description = `OPTIONAL/SPÄTER: ${opt.measure}\n\n${position.description || ''}`;
          position.isNEP = true;
          appliedCount++;
          break;
          
        default:
          console.warn(`[APPLY-OPT] Unknown optimization category: ${opt.category}`);
      }
      
      // Berechne tatsächliche Ersparnis
      const newPrice = position.totalPrice || 0;
      const actualSaving = originalPrice - newPrice;
      totalSavings += actualSaving;
      
      console.log(`[APPLY-OPT] Applied ${opt.category} to position ${posIndex}: saved ${actualSaving}€`);
    }
    
    // Berechne neue Gesamtsumme
    const newTotalSum = updatedPositions.reduce((sum, pos) => {
      if (!pos.isNEP) {
        return sum + (pos.totalPrice || 0);
      }
      return sum;
    }, 0);
    
    const nepSum = updatedPositions.reduce((sum, pos) => {
      if (pos.isNEP) {
        return sum + (pos.totalPrice || 0);
      }
      return sum;
    }, 0);
    
    // Aktualisiere LV-Content
    lvContent.positions = updatedPositions;
    lvContent.totalSum = Math.round(newTotalSum * 100) / 100;
    lvContent.nepSum = Math.round(nepSum * 100) / 100;
    lvContent.optimizationsApplied = appliedCount;
    lvContent.totalSavings = Math.round(totalSavings * 100) / 100;
    lvContent.lastOptimized = new Date().toISOString();
    
    // Füge Optimierungs-Historie hinzu
    if (!lvContent.optimizationHistory) {
      lvContent.optimizationHistory = [];
    }
    lvContent.optimizationHistory.push({
      date: new Date().toISOString(),
      appliedCount: appliedCount,
      totalSavings: totalSavings,
      optimizations: optimizations.map(opt => ({
        position: opt.positionRef,
        category: opt.category,
        measure: opt.measure,
        saving: opt.savingAmount
      }))
    });
    
    // Speichere aktualisiertes LV
    await query(
      `UPDATE lvs 
       SET content = $1, 
           updated_at = NOW() 
       WHERE project_id = $2 AND trade_id = $3`,
      [JSON.stringify(lvContent), projectId, tradeId]
    );
    
    // Log für Audit
    await query(
      `INSERT INTO project_logs (project_id, action, details, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [
        projectId, 
        'lv_optimized',
        JSON.stringify({
          tradeId: tradeId,
          appliedOptimizations: appliedCount,
          totalSavings: totalSavings,
          newTotal: newTotalSum
        })
      ]
    );
    
    console.log(`[APPLY-OPT] Successfully applied ${appliedCount} optimizations, saved ${totalSavings}€`);
    
    res.json({
      success: true,
      appliedCount: appliedCount,
      totalSavings: Math.round(totalSavings * 100) / 100,
      newTotal: newTotalSum,
      message: `${appliedCount} Optimierungen erfolgreich angewendet. Ersparnis: ${formatCurrency(totalSavings)}`
    });
    
  } catch (err) {
    console.error('[APPLY-OPT] Failed to apply optimizations:', err);
    res.status(500).json({ 
      error: 'Fehler beim Anwenden der Optimierungen',
      details: err.message 
    });
  }
});

// ============================================================================
// NEUE ROUTEN FÜR DIE ERWEITERTE PLATTFORM
// ============================================================================

// 1. AUTH ROUTES - Registrierung & Login für Bauherren/Handwerker
// ----------------------------------------------------------------------------

// Korrigierte Bauherr Registrierung Backend-Route
app.post('/api/bauherr/register', async (req, res) => {
  try {
    const { 
      email, 
      password, 
      name, 
      phone, 
      street, 
      houseNumber, 
      zipCode, 
      city,
      projectId
    } = req.body;
    
    // Validierung
    if (!email || !password || !name || !phone) {
      return res.status(400).json({ 
        error: 'Pflichtfelder fehlen' 
      });
    }
    
    // Check if user exists
    const userCheck = await query(
      'SELECT * FROM bauherren WHERE email = $1', 
      [email.toLowerCase()]
    );
    
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: 'E-Mail bereits registriert' 
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate email verification token
    const crypto = require('crypto');
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 Stunden
    
    // Insert bauherr mit Token
    const result = await query(
      `INSERT INTO bauherren (
        email, 
        password, 
        name, 
        phone, 
        street, 
        house_number, 
        zip, 
        city,
        email_verified,
        email_verification_token,
        email_verification_expires,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, $10, NOW())
      RETURNING id, email, name`,
      [
        email.toLowerCase(), 
        hashedPassword, 
        name, 
        phone, 
        street || null, 
        houseNumber || null, 
        zipCode || null, 
        city || null,
        emailVerificationToken,
        emailVerificationExpires
      ]
    );
    
    const bauherrId = result.rows[0].id;
    
    // Wenn projectId vorhanden, verknüpfe Projekt mit Bauherr
    if (projectId) {
      await query(
        'UPDATE projects SET bauherr_id = $1 WHERE id = $2',
        [bauherrId, projectId]
      );
    }

    // Hole Projektdetails falls projectId vorhanden
let projectDetails = null;
let projectResult = null; // Außerhalb definieren!
    
  if (projectId) {
  projectResult = await query(
    'SELECT category, sub_category, description FROM projects WHERE id = $1',
    [projectId]
  );
  
  if (projectResult.rows.length > 0) {
    const proj = projectResult.rows[0];
    projectDetails = `${proj.category}${proj.sub_category ? ' - ' + proj.sub_category : ''}: ${proj.description?.substring(0, 100)}`;
  }
}
    
    // E-Mail senden mit Token
    const emailService = require('./emailService');
    const emailResult = await emailService.sendBauherrRegistrationEmail({
    id: bauherrId,
    name: name,
    email: email,
    verificationToken: emailVerificationToken,
    projectDetails: projectResult.rows.length > 0 ? {
    category: projectResult.rows[0].category,
    subCategory: projectResult.rows[0].sub_category,
    description: projectResult.rows[0].description
  } : null
});
    
    // JWT Token für Session (aber E-Mail noch nicht verifiziert)
    const token = jwt.sign(
      { 
        id: bauherrId, 
        type: 'bauherr',
        email: email,
        name: name,
        emailVerified: false
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: bauherrId,
        email: email,
        name: name,
        emailVerified: false
      },
      message: 'Registrierung erfolgreich! Bitte bestätigen Sie Ihre E-Mail-Adresse.',
      emailSent: emailResult.success,
      requiresVerification: true
    });
    
  } catch (error) {
    console.error('Bauherr registration error:', error);
    res.status(500).json({ 
      error: 'Registrierung fehlgeschlagen' 
    });
  }
});

// Korrigierte Handwerker Registrierung mit E-Mail-Token
app.post('/api/handwerker/register', async (req, res) => {
  try {
    const {
      companyName, 
      email, 
      password,
      phone, 
      contactPerson,
      street, 
      houseNumber, 
      zipCode,
      city,
      companyType,
      registrationNumber,
      taxNumber,
      website,
      references,
      trades, 
      actionRadius, 
      maxProjectVolume,
      availableFrom,
      employees, 
      insurances, 
      certifications
    } = req.body;
    
    // Validierung
    if (!companyName || !email || !password || !phone || !contactPerson) {
      return res.status(400).json({ 
        error: 'Pflichtfelder fehlen' 
      });
    }
    
    // Check if email exists
    const existingCheck = await query(
      'SELECT * FROM handwerker WHERE email = $1', 
      [email.toLowerCase()]
    );
    
    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Diese E-Mail-Adresse ist bereits registriert' 
      });
    }
    
    // Generate company ID
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 9000) + 1000;
    const companyId = `HW-${year}-${random}`;
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate email verification token
    const crypto = require('crypto');
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 Stunden
    
    // Start transaction
    await query('BEGIN');
    
    try {
      // Insert handwerker mit E-Mail-Token
      const result = await query(
        `INSERT INTO handwerker (
          company_id, 
          email, 
          password_hash,
          company_name, 
          contact_person, 
          phone,
          street, 
          house_number, 
          zip_code, 
          city, 
          company_type,
          registration_number,
          tax_number,
          website,
          action_radius,
          max_project_volume, 
          available_from, 
          employee_count, 
          company_references,
          verification_status,
          email_verified,
          email_verification_token,
          email_verification_expires,
          active,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
          $11, $12, $13, $14, $15, $16, $17, $18, $19,
          'pending', false, $20, $21, true, NOW(), NOW()
        )
        RETURNING id, company_id, company_name, email`,
        [
          companyId, 
          email.toLowerCase(), 
          hashedPassword,
          companyName, 
          contactPerson, 
          phone,
          street, 
          houseNumber, 
          zipCode,
          city, 
          companyType || null,
          registrationNumber || null,
          taxNumber || null,
          website || null,
          actionRadius || 25,
          maxProjectVolume || 50000, 
          availableFrom || null, 
          employees || null,
          references || null,
          emailVerificationToken,
          emailVerificationExpires
        ]
      );
      
      const handwerkerId = result.rows[0].id;

      // HIER EINFÜGEN - direkt nach der handwerkerId Zuweisung:
await query(
  `UPDATE handwerker SET 
    street = $1, house_number = $2, zip_code = $3, city = $4, action_radius = $5
   WHERE id = $6`,
  [street, houseNumber, zipCode, city, actionRadius || 25, handwerkerId]
);
      
      // Insert trades
      if (trades && trades.length > 0) {
  for (const tradeCode of trades) {
    const tradeInfo = await query(
      'SELECT id, name FROM trades WHERE code = $1',
      [tradeCode]
    );
    
    if (tradeInfo.rows.length > 0) {
      const trade = tradeInfo.rows[0];
      await query(
        'INSERT INTO handwerker_trades (handwerker_id, trade_id, trade_code, trade_name) VALUES ($1, $2, $3, $4)',
        [handwerkerId, trade.id, tradeCode, trade.name]
      );
    }
  }
}
      
      // Insert insurances
      if (insurances && insurances.length > 0) {
        for (const insurance of insurances) {
          await query(
            'INSERT INTO handwerker_insurances (handwerker_id, insurance_type) VALUES ($1, $2)',
            [handwerkerId, insurance]
          );
        }
      }
      
      // Insert certifications
      if (certifications && certifications.length > 0) {
        for (const cert of certifications) {
          await query(
            'INSERT INTO handwerker_certifications (handwerker_id, certification_name) VALUES ($1, $2)',
            [handwerkerId, cert]
          );
        }
      }
      
      // Commit transaction
      await query('COMMIT');
      
      // E-MAIL MIT TOKEN VERSENDEN
      const emailService = require('./emailService');
      const emailResult = await emailService.sendHandwerkerRegistrationEmail({
        id: handwerkerId,
        companyId: companyId,
        companyName: companyName,
        email: email,
        contactPerson: contactPerson,
        verificationToken: emailVerificationToken
      });
      
      // JWT Token erstellen (aber E-Mail noch nicht verifiziert)
      const token = jwt.sign(
        {
          id: handwerkerId,
          companyId: companyId,
          email: email,
          companyName: companyName,
          emailVerified: false
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );
      
      res.status(201).json({
        success: true,
        companyId,
        token,
        handwerker: {
          id: handwerkerId,
          companyId: companyId,
          companyName: companyName,
          email: result.rows[0].email,
          emailVerified: false
        },
        message: 'Registrierung erfolgreich! Bitte bestätigen Sie Ihre E-Mail-Adresse.',
        emailSent: emailResult.success,
        requiresVerification: true
      });
      
    } catch (innerErr) {
      await query('ROLLBACK');
      console.error('Transaction error:', innerErr);
      throw innerErr;
    }
    
  } catch (error) {
    console.error('Handwerker registration error:', error);
    res.status(500).json({ 
      error: 'Registrierung fehlgeschlagen' 
    });
  }
});

app.get('/api/handwerker/:identifier/tenders/new', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Handwerker ID bestimmen (wie vorher)
    let handwerkerId;
    if (/^\d+$/.test(identifier)) {
      handwerkerId = parseInt(identifier);
    } else if (identifier.startsWith('HW-')) {
      const handwerkerResult = await query(
        'SELECT id FROM handwerker WHERE company_id = $1',
        [identifier]
      );
      if (handwerkerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Handwerker nicht gefunden' });
      }
      handwerkerId = handwerkerResult.rows[0].id;
    }
    
    // Handwerker-Daten laden
    const handwerker = await query(
      'SELECT id, company_name, zip_code, action_radius FROM handwerker WHERE id = $1',
      [handwerkerId]
    );
    
    if (handwerker.rows.length === 0) {
      return res.status(404).json({ error: 'Handwerker nicht gefunden' });
    }
    
    const hw = handwerker.rows[0];
    
    // Trades des Handwerkers
    const trades = await query(
      'SELECT trade_id FROM handwerker_trades WHERE handwerker_id = $1',
      [handwerkerId]
    );
    
    const tradeIds = trades.rows.map(t => t.trade_id);
    
    // ALLE passenden Tenders im Radius finden (nicht nur verknüpfte!)
    const result = await query(
      `SELECT DISTINCT
        t.id,
        t.project_id,
        t.trade_id,
        t.status,
        t.deadline,
        t.created_at,
        t.estimated_value,
        t.timeframe,
        tr.name as trade_name,
        tr.code as trade_code,
        p.description as project_description,
        p.category,
        p.sub_category,
        p.zip_code as project_zip,
        p.city as project_city,
        th.viewed_at,
        CASE 
          WHEN z1.latitude IS NOT NULL AND z2.latitude IS NOT NULL THEN
            ST_Distance(
              ST_MakePoint(z1.longitude, z1.latitude)::geography,
              ST_MakePoint(z2.longitude, z2.latitude)::geography
            ) / 1000
          WHEN p.zip_code = $2 THEN 0
          ELSE $3
        END AS distance_km,
        CASE WHEN th.id IS NULL THEN true ELSE false END as "isNew",
        o.id as offer_id
      FROM tenders t
      JOIN trades tr ON t.trade_id = tr.id
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN zip_codes z1 ON z1.zip = p.zip_code
      LEFT JOIN zip_codes z2 ON z2.zip = $2
      LEFT JOIN tender_handwerker th ON th.tender_id = t.id AND th.handwerker_id = $1
      LEFT JOIN offers o ON o.tender_id = t.id AND o.handwerker_id = $1
      WHERE t.trade_id = ANY($4::int[])
        AND t.status = 'open'
        AND o.id IS NULL
        AND (
          p.zip_code = $2
          OR (
            z1.latitude IS NOT NULL AND z2.latitude IS NOT NULL
            AND ST_DWithin(
              ST_MakePoint(z1.longitude, z1.latitude)::geography,
              ST_MakePoint(z2.longitude, z2.latitude)::geography,
              $3 * 1000
            )
          )
        )
      ORDER BY t.created_at DESC`,
      [handwerkerId, hw.zip_code, hw.action_radius, tradeIds]
    );
    
    // Automatisch verknüpfen wenn noch nicht vorhanden
    for (const tender of result.rows) {
      if (tender.isNew) {
        await query(
          `INSERT INTO tender_handwerker (tender_id, handwerker_id, status, notified_at, distance_km)
           VALUES ($1, $2, 'pending', NOW(), $3)
           ON CONFLICT DO NOTHING`,
          [tender.id, handwerkerId, Math.round(tender.distance_km || 0)]
        );
      }
    }
    
    console.log(`Found ${result.rows.length} tenders for ${hw.company_name}`);
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error in tenders/new:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET Trades für einen Handwerker
app.get('/api/handwerker/:id/trades', async (req, res) => {
  try {
    const result = await query(
      `SELECT array_agg(trade_code) as trades 
       FROM handwerker_trades 
       WHERE handwerker_id = $1`,
      [req.params.id]
    );
    
    res.json({ 
      trades: result.rows[0]?.trades || [] 
    });
  } catch (err) {
    console.error('Error fetching trades:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Gewerke' });
  }
});

// PUT Trades für einen Handwerker
app.put('/api/handwerker/:id/gewerke', async (req, res) => {
  try {
    const { trades } = req.body;
    const handwerkerId = req.params.id;
    
    await query('BEGIN');
    
    await query('DELETE FROM handwerker_trades WHERE handwerker_id = $1', [handwerkerId]);
    
    for (const tradeCode of trades) {
      const tradeResult = await query(
        'SELECT id, name FROM trades WHERE code = $1',
        [tradeCode]
      );
      
      if (tradeResult.rows.length > 0) {
        const trade = tradeResult.rows[0];
        await query(
          'INSERT INTO handwerker_trades (handwerker_id, trade_id, trade_code, trade_name) VALUES ($1, $2, $3, $4)',
          [handwerkerId, trade.id, tradeCode, trade.name]
        );
      }
    }
    
    await query('COMMIT');
    res.json({ success: true });
    
  } catch (err) {
    await query('ROLLBACK');
    console.error('Gewerke update error:', err);
    res.status(500).json({ error: 'Update fehlgeschlagen' });
  }
});

// ============================================================================
// PASSWORT RESET - AKTUALISIERT MIT E-MAIL
// ============================================================================
app.post('/api/handwerker/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        error: 'E-Mail-Adresse erforderlich' 
      });
    }
    
    // Rate Limiting prüfen
    const rateLimitCheck = await query(
      'SELECT check_email_rate_limit($1, $2, 3, 60) as allowed',
      [email, 'password_reset']
    );
    
    if (!rateLimitCheck.rows[0].allowed) {
      return res.status(429).json({ 
        error: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.' 
      });
    }
    
    // Prüfe ob E-Mail existiert
    const result = await query(
      'SELECT id, company_name, contact_person FROM handwerker WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    
    if (result.rows.length === 0) {
      // Aus Sicherheitsgründen keine Info ob E-Mail existiert
      return res.json({ 
        message: 'Falls ein Account mit dieser E-Mail existiert, wurde eine Nachricht versendet.' 
      });
    }
    
    const handwerker = result.rows[0];
    
    // Reset-Token generieren
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 Stunde
    
    // Token in DB speichern
    await query(
      `UPDATE handwerker 
       SET reset_token = $2, 
           reset_token_expiry = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [handwerker.id, resetToken, resetTokenExpiry]
    );
    
    // E-MAIL VERSENDEN - NEU!
    const emailResult = await emailService.sendPasswordResetEmail(
      email,
      resetToken,
      {
        companyName: handwerker.company_name,
        contactPerson: handwerker.contact_person
      }
    );
    
    // E-Mail Log erstellen
    await query(
      `INSERT INTO email_logs (recipient_email, email_type, subject, status, handwerker_id, sent_at)
       VALUES ($1, 'password_reset', 'Passwort zurücksetzen', $2, $3, $4)`,
      [email, emailResult.success ? 'sent' : 'failed', handwerker.id, emailResult.success ? new Date() : null]
    );
    
    res.json({ 
      message: 'Falls ein Account mit dieser E-Mail existiert, wurde eine Nachricht versendet.' 
    });
    
  } catch (err) {
    console.error('Passwort-Reset Fehler:', err);
    res.status(500).json({ 
      error: 'Ein Fehler ist aufgetreten' 
    });
  }
});

// ============================================================================
// E-MAIL VERIFIZIERUNG - NEU!
// ============================================================================
app.get('/api/handwerker/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Token erforderlich' });
    }
    
    // Handwerker mit Token finden
    const result = await query(
      `SELECT id, company_id, company_name, email FROM handwerker 
       WHERE email_verification_token = $1 
       AND email_verification_expires > NOW()`,
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Ungültiger oder abgelaufener Token' });
    }
    
    const handwerker = result.rows[0];
    
    // E-Mail als verifiziert markieren
    await query(
      `UPDATE handwerker 
       SET email_verified = true,
           email_verification_token = NULL,
           email_verification_expires = NULL,
           verification_status = 'verified',
           updated_at = NOW()
       WHERE id = $1`,
      [handwerker.id]
    );
    
    // Log erstellen
    await query(
      `INSERT INTO email_logs (recipient_email, email_type, subject, status, handwerker_id, sent_at)
       VALUES ($1, 'verification_success', 'E-Mail verifiziert', 'sent', $2, NOW())`,
      [handwerker.email, handwerker.id]
    );
    
    // JWT Token generieren
    const jwtToken = jwt.sign(
      {
        id: handwerker.id,
        companyId: handwerker.company_id,
        email: handwerker.email,
        companyName: handwerker.company_name,
        emailVerified: true
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    res.json({ 
      success: true, 
      message: 'E-Mail erfolgreich verifiziert. Sie können sich jetzt anmelden.',
      id: handwerker.id,
      companyId: handwerker.company_id,
      companyName: handwerker.company_name,
      email: handwerker.email,
      token: jwtToken  // JWT Token mitschicken
    });
    
  } catch (error) {
    console.error('E-Mail-Verifikationsfehler:', error);
    res.status(500).json({ error: 'Verifikation fehlgeschlagen' });
  }
});

// Dokument Upload
app.post('/api/handwerker/upload-document', upload.single('document'), async (req, res) => {
  try {
    const { handwerkerId, documentType } = req.body;
    const fileBuffer = req.file.buffer;
    
    await query(
      `INSERT INTO handwerker_documents 
       (handwerker_id, document_type, file_data, file_name, file_size, mime_type) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [handwerkerId, documentType, fileBuffer, req.file.originalname, req.file.size, req.file.mimetype]
    );
    
    res.json({ success: true, message: 'Dokument erfolgreich hochgeladen' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload fehlgeschlagen' });
  }
});

// Dokument abrufen
app.get('/api/handwerker/document/:id', async (req, res) => {
  try {
    const result = await query(
      'SELECT file_data, file_name, mime_type FROM handwerker_documents WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length > 0) {
      const doc = result.rows[0];
      res.setHeader('Content-Type', doc.mime_type);
      res.setHeader('Content-Disposition', `inline; filename="${doc.file_name}"`);
      res.send(doc.file_data);
    } else {
      res.status(404).json({ error: 'Dokument nicht gefunden' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Abrufen' });
  }
});

// Bauherr Login mit Passwort ODER nur E-Mail (Rückwärtskompatibilität)
app.post('/api/bauherr/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        error: 'E-Mail erforderlich' 
      });
    }
    
    const result = await query(
      `SELECT id, name, email, password, phone, 
       street, house_number, zip, city,
       email_verified, last_login
       FROM bauherren WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Account nicht gefunden' 
      });
    }
    
    const bauherr = result.rows[0];
    
    // Passwort-Logik für Rückwärtskompatibilität
    if (bauherr.password && password) {
      const isPasswordValid = await bcrypt.compare(password, bauherr.password);
      if (!isPasswordValid) {
        return res.status(401).json({ 
          error: 'Ungültiges Passwort' 
        });
      }
    } else if (bauherr.password && !password) {
      return res.status(401).json({ 
        error: 'Passwort erforderlich' 
      });
    }
    // Wenn kein Passwort gesetzt (alte Accounts), erlaube Login nur mit E-Mail
    
    // Update last_login
    await query(
      'UPDATE bauherren SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [bauherr.id]
    );
    
    // JWT Token
    const token = jwt.sign(
      {
        id: bauherr.id,
        type: 'bauherr',
        email: bauherr.email,
        name: bauherr.name
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    // Projekte holen
    const projectsResult = await query(
      'SELECT id, category, sub_category, created_at FROM projects WHERE bauherr_id = $1 ORDER BY created_at DESC',
      [bauherr.id]
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: bauherr.id,
        name: bauherr.name,
        email: bauherr.email,
        phone: bauherr.phone,
        emailVerified: bauherr.email_verified,
        projects: projectsResult.rows
      }
    });
    
  } catch (err) {
    console.error('Bauherr Login-Fehler:', err);
    res.status(500).json({ 
      error: 'Login fehlgeschlagen' 
    });
  }
});

// Bauherr Passwort vergessen
app.post('/api/bauherr/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        error: 'E-Mail-Adresse erforderlich' 
      });
    }
    
    // Rate Limiting
    const rateLimitCheck = await query(
      'SELECT check_email_rate_limit($1, $2, 3, 60) as allowed',
      [email, 'password_reset']
    );
    
    if (!rateLimitCheck.rows[0].allowed) {
      return res.status(429).json({ 
        error: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.' 
      });
    }
    
    // Prüfe ob E-Mail existiert
    const result = await query(
      'SELECT id, name FROM bauherren WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.json({ 
        message: 'Falls ein Account existiert, wurde eine E-Mail versendet.' 
      });
    }
    
    const bauherr = result.rows[0];
    
    // Reset-Token generieren
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000);
    
    // Token speichern
    await query(
      `UPDATE bauherren 
       SET reset_token = $2, 
           reset_token_expiry = $3
       WHERE id = $1`,
      [bauherr.id, resetToken, resetTokenExpiry]
    );
    
    // E-Mail senden
    const emailService = require('./emailService');
    await emailService.sendBauherrPasswordResetEmail(
      email,
      resetToken,
      {
        name: bauherr.name
      }
    );
    
    res.json({ 
      message: 'Falls ein Account existiert, wurde eine E-Mail versendet.' 
    });
    
  } catch (err) {
    console.error('Passwort-Reset Fehler:', err);
    res.status(500).json({ 
      error: 'Ein Fehler ist aufgetreten' 
    });
  }
});

// Bauherr Passwort zurücksetzen
app.post('/api/bauherr/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ 
        error: 'Token und neues Passwort erforderlich' 
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'Passwort muss mindestens 8 Zeichen lang sein' 
      });
    }
    
    // Finde Bauherr mit gültigem Token
    const result = await query(
      `SELECT id FROM bauherren 
       WHERE reset_token = $1 
       AND reset_token_expiry > NOW()`,
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ 
        error: 'Ungültiger oder abgelaufener Reset-Link' 
      });
    }
    
    const bauherrId = result.rows[0].id;
    
    // Hashe neues Passwort
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update Passwort
    await query(
      `UPDATE bauherren 
       SET password = $2,
           reset_token = NULL,
           reset_token_expiry = NULL,
           password_changed_at = NOW()
       WHERE id = $1`,
      [bauherrId, hashedPassword]
    );
    
    res.json({ 
      success: true,
      message: 'Passwort erfolgreich zurückgesetzt' 
    });
    
  } catch (err) {
    console.error('Reset-Passwort Fehler:', err);
    res.status(500).json({ 
      error: 'Passwort konnte nicht zurückgesetzt werden' 
    });
  }
});

// E-Mail verifizieren
app.get('/api/bauherr/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Token erforderlich' });
    }
    
    const result = await query(
      `SELECT id, name, email FROM bauherren 
       WHERE email_verification_token = $1 
       AND email_verification_expires > NOW()`,
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ 
        error: 'Ungültiger oder abgelaufener Token' 
      });
    }
    
    const bauherr = result.rows[0];
    
    await query(
      `UPDATE bauherren 
       SET email_verified = true,
           email_verification_token = NULL,
           email_verification_expires = NULL
       WHERE id = $1`,
      [bauherr.id]
    );
    
    // JWT Token generieren (andere Variable verwenden!)
    const jwtToken = jwt.sign(  // <-- jwtToken statt token
      {
        id: bauherr.id,
        type: 'bauherr',
        email: bauherr.email,
        name: bauherr.name,
        emailVerified: true
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    // NUR EINE Response:
    res.json({ 
      success: true, 
      message: 'E-Mail erfolgreich verifiziert',
      id: bauherr.id,
      name: bauherr.name,
      email: bauherr.email,
      token: jwtToken  // JWT Token mitschicken
    });
    
  } catch (error) {
    console.error('E-Mail-Verifikationsfehler:', error);
    res.status(500).json({ 
      error: 'Verifikation fehlgeschlagen' 
    });
  }
});

// Handwerker Verify
app.post('/api/handwerker/verify', async (req, res) => {
  try {
    const { email, companyId } = req.body;
    
    const result = await query(
      `SELECT h.*, array_agg(ht.trade_code) as trades
       FROM handwerker h
       LEFT JOIN handwerker_trades ht ON ht.handwerker_id = h.id
       WHERE h.email = $1 AND h.company_id = $2
       GROUP BY h.id`,
      [email, companyId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Betrieb nicht gefunden' });
    }
    
    const handwerker = result.rows[0];
    
    res.json({
      id: handwerker.id,
      companyId: handwerker.company_id,
      companyName: handwerker.company_name,
      email: handwerker.email,
      trades: handwerker.trades || [],
      region: `${handwerker.zip_code} ${handwerker.city}`, // zip_code statt zip
      actionRadius: handwerker.action_radius
    });
    
  } catch (error) {
    console.error('Handwerker verify error:', error);
    res.status(500).json({ error: 'Verifizierung fehlgeschlagen' });
  }
});

// Handwerker Login mit Passwort
app.post('/api/handwerker/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'E-Mail und Passwort sind erforderlich' 
      });
    }

    // Handwerker finden
    const result = await query(
      `SELECT 
        id, company_id, company_name, email, password_hash,
        phone, contact_person, street, house_number, zip_code, city,
        action_radius, verification_status, two_factor_enabled,
        active, email_verified, login_notification_enabled
       FROM handwerker 
       WHERE LOWER(email) = LOWER($1) 
       AND deleted_at IS NULL`,
      [email]
    );

    if (result.rows.length === 0) {
      // Log fehlgeschlagenen Versuch mit unbekannter E-Mail
      await query(
        `INSERT INTO login_attempts (handwerker_id, ip_address, success, attempted_at) 
         VALUES (NULL, $1, false, CURRENT_TIMESTAMP)`,
        [req.ip]
      );
      
      return res.status(401).json({ 
        error: 'Ungültige E-Mail oder Passwort' 
      });
    }

    const handwerker = result.rows[0];

    // Account-Status prüfen
    if (!handwerker.active) {
      return res.status(403).json({ 
        error: 'Ihr Account wurde deaktiviert.' 
      });
    }

    // E-Mail-Verifikation prüfen (optional - je nach Anforderung)
    if (!handwerker.email_verified) {
      // Trotzdem Login erlauben, aber mit Warnung
      console.log('Login ohne E-Mail-Verifikation:', email);
    }

    // Passwort prüfen
    const isPasswordValid = await bcrypt.compare(password, handwerker.password_hash);
    
    if (!isPasswordValid) {
      // Log fehlgeschlagenen Versuch
      await query(
        `INSERT INTO login_attempts (handwerker_id, ip_address, success, attempted_at) 
         VALUES ($1, $2, false, CURRENT_TIMESTAMP)`,
        [handwerker.id, req.ip]
      );
      
      return res.status(401).json({ 
        error: 'Ungültige E-Mail oder Passwort' 
      });
    }

    // Erfolgreichen Login loggen
    await query(
      `INSERT INTO login_attempts (handwerker_id, ip_address, success, attempted_at, user_agent) 
       VALUES ($1, $2, true, CURRENT_TIMESTAMP, $3)`,
      [handwerker.id, req.ip, req.headers['user-agent']]
    );

    // Last Login aktualisieren
    await query(
      `UPDATE handwerker 
       SET last_login = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [handwerker.id]
    );

    // Prüfe auf verdächtigen Login (neue IP, neue Location, etc.)
    const previousLogins = await query(
      `SELECT DISTINCT ip_address 
       FROM login_attempts 
       WHERE handwerker_id = $1 
       AND success = true 
       AND attempted_at > NOW() - INTERVAL '30 days'
       LIMIT 5`,
      [handwerker.id]
    );
    
    const isNewLocation = !previousLogins.rows.some(row => row.ip_address === req.ip);
    
    // Bei neuem Standort und aktivierter Benachrichtigung: E-Mail senden
    if (isNewLocation && handwerker.login_notification_enabled) {
      await emailService.sendLoginNotification(
        {
          companyName: handwerker.company_name,
          email: handwerker.email
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          loginTime: new Date(),
          location: 'Deutschland' // Kann mit IP-Geolocation Service erweitert werden
        }
      );
    }

    // JWT Token generieren
    const tokenExpiry = rememberMe ? '30d' : '24h';
    const token = jwt.sign(
      {
        id: handwerker.id,
        companyId: handwerker.company_id,
        email: handwerker.email,
        companyName: handwerker.company_name,
        emailVerified: handwerker.email_verified
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: tokenExpiry }
    );

    // Response
    res.json({
      success: true,
      token,
      handwerker: {
        id: handwerker.id,
        companyId: handwerker.company_id,
        companyName: handwerker.company_name,
        email: handwerker.email,
        phone: handwerker.phone,
        contactPerson: handwerker.contact_person,
        address: {
          street: handwerker.street,
          houseNumber: handwerker.house_number,
          zipCode: handwerker.zip_code,
          city: handwerker.city
        },
        actionRadius: handwerker.action_radius,
        verificationStatus: handwerker.verification_status,
        emailVerified: handwerker.email_verified,
        twoFactorEnabled: handwerker.two_factor_enabled
      },
      warnings: !handwerker.email_verified ? ['E-Mail-Adresse noch nicht verifiziert'] : []
    });

  } catch (err) {
    console.error('Login-Fehler:', err);
    res.status(500).json({ 
      error: 'Login fehlgeschlagen' 
    });
  }
});

// ============================================================================
// E-MAIL ERNEUT SENDEN - NEU!
// ============================================================================
// Bauherr - E-Mail erneut senden
app.post('/api/bauherr/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'E-Mail erforderlich' });
    }
    
    // Rate Limiting
    const rateLimitCheck = await query(
  `SELECT COUNT(*) as count FROM email_logs 
   WHERE recipient_email = $1 
   AND email_type = 'verification_resend' 
   AND sent_at > NOW() - INTERVAL '1 hour'`,
  [email]
);
    
    if (rateLimitCheck.rows[0].count >= 3) {
      return res.status(429).json({ 
        error: 'Zu viele Anfragen. Bitte warten Sie eine Stunde.' 
      });
    }
    
    // Bauherr finden
    const result = await query(
      'SELECT id, name, email_verified FROM bauherren WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account nicht gefunden' });
    }
    
    const bauherr = result.rows[0];
    
    if (bauherr.email_verified) {
      return res.json({ 
        success: true,
        message: 'E-Mail bereits verifiziert' 
      });
    }
    
    // Neuen Token generieren
    const crypto = require('crypto');
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);
    
    // Token in DB aktualisieren
    await query(
      `UPDATE bauherren 
       SET email_verification_token = $1,
           email_verification_expires = $2
       WHERE id = $3`,
      [verificationToken, verificationExpires, bauherr.id]
    );
    
    // E-Mail senden
    const emailService = require('./emailService');
    const emailResult = await emailService.sendBauherrRegistrationEmail({
    id: bauherrId,  // Auch hier: bauherrId statt bauherr.id
    name: name,
    email: email,
    verificationToken: emailVerificationToken  // RICHTIGE Variable!
  });
    
    // Log erstellen
    await query(
      `INSERT INTO email_logs (recipient_email, email_type, sent_at)
       VALUES ($1, 'verification_resend', NOW())`,
      [email]
    );
    
    res.json({ 
      success: true,
      message: 'Verifizierungs-E-Mail wurde erneut gesendet',
      emailSent: emailResult.success
    });
    
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Fehler beim E-Mail-Versand' });
  }
});

app.post('/api/handwerker/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'E-Mail erforderlich' });
    }
    
    // Rate Limiting
    const rateLimitCheck = await query(
      'SELECT check_email_rate_limit($1, $2, 3, 60) as allowed',
      [email, 'verification']
    );
    
    if (!rateLimitCheck.rows[0].allowed) {
      return res.status(429).json({ 
        error: 'Zu viele Anfragen. Bitte warten Sie eine Stunde.' 
      });
    }
    
    // Handwerker finden
    const result = await query(
      'SELECT id, company_id, company_name, contact_person, email_verified FROM handwerker WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account nicht gefunden' });
    }
    
    const handwerker = result.rows[0];
    
    if (handwerker.email_verified) {
      return res.json({ message: 'E-Mail bereits verifiziert' });
    }
    
    // Neuen Verification Token generieren
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    await query(
      `UPDATE handwerker 
       SET email_verification_token = $1,
           email_verification_expires = $2
       WHERE id = $3`,
      [
        verificationToken,
        new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 Stunden
        handwerker.id
      ]
    );
    
    // E-Mail senden
    await emailService.sendHandwerkerRegistrationEmail({
    id: handwerkerId,  // Verwende handwerkerId (aus result.rows[0].id)
    companyId: companyId,  // Die Variable die du oben definiert hast
    companyName: companyName,  // Aus req.body
    email: email,
    contactPerson: contactPerson,  // Aus req.body
    verificationToken: emailVerificationToken  // RICHTIGE Variable!
  });
    
    res.json({ 
      success: true,
      message: 'Verifizierungs-E-Mail wurde erneut gesendet' 
    });
    
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Fehler beim E-Mail-Versand' });
  }
});

// Route zum nachträglichen Verknüpfen von Projekten
app.post('/api/projects/claim', async (req, res) => {
  try {
    const { projectId, bauherrId } = req.body;
    
    // Prüfe ob Projekt existiert und noch keinem Bauherrn zugeordnet ist
    const projectCheck = await query(
      'SELECT bauherr_id FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Projekt nicht gefunden' });
    }
    
    if (projectCheck.rows[0].bauherr_id) {
      return res.status(400).json({ error: 'Projekt bereits zugeordnet' });
    }
    
    // Verknüpfe Projekt mit Bauherr
    await query(
      'UPDATE projects SET bauherr_id = $1 WHERE id = $2',
      [bauherrId, projectId]
    );
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error claiming project:', error);
    res.status(500).json({ error: 'Fehler beim Zuordnen des Projekts' });
  }
});

// 2. PROJECT MANAGEMENT ROUTES
// ----------------------------------------------------------------------------

// Get user projects (for Bauherr Dashboard)
app.get('/api/projects/user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const result = await query(
      `SELECT p.* 
       FROM projects p
       JOIN bauherren b ON p.bauherr_id = b.id
       WHERE b.email = $1
       ORDER BY p.created_at DESC`,
      [email]
    );
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching user projects:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Projekte' });
  }
});

// Get project trades
app.get('/api/projects/:projectId/trades', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const result = await query(
      `SELECT t.*, pt.is_manual, pt.is_ai_recommended
       FROM trades t
       JOIN project_trades pt ON t.id = pt.trade_id
       WHERE pt.project_id = $1
       ORDER BY t.name`,
      [projectId]
    );
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching project trades:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Gewerke' });
  }
});

// Get project with full details for dashboard
app.get('/api/projects/:projectId/dashboard-details', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Get project
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Projekt nicht gefunden' });
    }
    
    const project = projectResult.rows[0];
    
    // Get trades
    const tradesResult = await query(
      `SELECT t.*, pt.is_manual, pt.is_ai_recommended
       FROM trades t
       JOIN project_trades pt ON t.id = pt.trade_id
       WHERE pt.project_id = $1`,
      [projectId]
    );
    
    // Get LVs
    const lvsResult = await query(
      `SELECT * FROM lvs WHERE project_id = $1`,
      [projectId]
    );
    
    // Get tender status
    const tendersResult = await query(
      `SELECT COUNT(*) as count FROM tenders WHERE project_id = $1`,
      [projectId]
    );
    
    // Get offers
    const offersResult = await query(
      `SELECT o.* FROM offers o
       JOIN tenders t ON o.tender_id = t.id
       WHERE t.project_id = $1`,
      [projectId]
    );
    
    res.json({
      project: project,
      trades: tradesResult.rows,
      lvs: lvsResult.rows,
      hasTenders: tendersResult.rows[0].count > 0,
      offers: offersResult.rows,
      completedLvs: lvsResult.rows.filter(lv => {
        const content = typeof lv.content === 'string' ? 
          JSON.parse(lv.content) : lv.content;
        return content?.positions?.length > 0;
      }).length
    });
    
  } catch (error) {
    console.error('Dashboard details error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Details' });
  }
});

// 3. TENDER & OFFER ROUTES
// ----------------------------------------------------------------------------

// EINZIGE Tenders-Route (detailliert) – ersetzt die alte kurze Liste
app.get('/api/projects/:projectId/tenders', async (req, res) => {
  try {
    const { projectId } = req.params;

    const result = await query(
      `
      SELECT
        t.*,
        tr.name AS trade_name,
        COALESCE(stats.total_handwerker, 0)       AS total_handwerker,
        COALESCE(stats.viewed_count, 0)           AS viewed_count,
        COALESCE(stats.offer_count, 0)            AS offer_count,
        COALESCE(stats.handwerkers, '[]'::json)   AS handwerkers
      FROM tenders t
      JOIN trades tr ON tr.id = t.trade_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS total_handwerker,
          COUNT(*) FILTER (WHERE ths.status = 'viewed') AS viewed_count,
          COUNT(o.id) AS offer_count,
          json_agg(
            json_build_object(
              'company_name',   h.company_name,
              'handwerker_id',  h.id,
              'status',         ths.status,
              'viewed_at',      ths.viewed_at,
              'in_progress_at', ths.in_progress_at,
              'submitted_at',   ths.submitted_at,
              'offer_id',       o.id
            )
            ORDER BY h.company_name
          ) AS handwerkers
        FROM tender_handwerker th
        JOIN handwerker h ON h.id = th.handwerker_id
        LEFT JOIN tender_handwerker_status ths 
          ON ths.tender_id = th.tender_id AND ths.handwerker_id = th.handwerker_id
        LEFT JOIN offers o 
          ON o.tender_id = th.tender_id AND o.handwerker_id = th.handwerker_id
        WHERE th.tender_id = t.id
      ) stats ON TRUE
      WHERE t.project_id = $1
      ORDER BY t.created_at DESC
      `,
      [projectId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching detailed tenders:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Ausschreibungen' });
  }
});

// Get project offers
app.get('/api/projects/:projectId/offers', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const result = await query(
      `SELECT o.*, h.company_name, h.email, h.phone, t.name as trade_name
       FROM offers o
       JOIN handwerker h ON o.handwerker_id = h.id
       JOIN tenders tn ON o.tender_id = tn.id
       JOIN trades t ON tn.trade_id = t.id
       WHERE tn.project_id = $1
       ORDER BY o.created_at DESC`,
      [projectId]
    );
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Angebote' });
  }
});

// Ungelesene Angebote zählen
app.get('/api/projects/:projectId/offers/unread-count', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const result = await query(
      `SELECT COUNT(*) as count
       FROM offers o
       JOIN tenders t ON o.tender_id = t.id
       WHERE t.project_id = $1 AND o.viewed_at IS NULL`,
      [projectId]
    );
    
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Zählen' });
  }
});

// Korrigierte bestehende Route
app.get('/api/projects/:projectId/offers/:offerId', async (req, res) => {
  try {
    const { projectId, offerId } = req.params;
    
    const result = await query(
      `SELECT o.*, 
              h.company_name, 
              h.email, 
              h.phone, 
              h.street, 
              h.house_number, 
              h.zip_code, 
              h.city,
              t.name as trade_name,
              t.code as trade_code
       FROM offers o
       JOIN handwerker h ON o.handwerker_id = h.id
       JOIN tenders tn ON o.tender_id = tn.id
       JOIN trades t ON tn.trade_id = t.id  -- HIER IST DIE KORREKTUR
       WHERE tn.project_id = $1 AND o.id = $2`,
      [projectId, offerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Angebot nicht gefunden' });
    }
    
    // Kontaktdaten-Schutz basierend auf Status
    const offer = result.rows[0];
    if (offer.status !== 'preliminary' && offer.status !== 'accepted') {
      // Kontaktdaten nur bei vorläufiger/finaler Beauftragung sichtbar
      offer.email = 'Wird nach Beauftragung freigegeben';
      offer.phone = 'Wird nach Beauftragung freigegeben';
      offer.street = null;
      offer.house_number = null;
    }
    
    res.json(offer);
    
  } catch (error) {
    console.error('Error fetching offer details:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Angebots' });
  }
});

// ============= ZWEISTUFIGE VERGABE SYSTEM =============

// Stufe 1: Vorläufige Beauftragung mit Kontaktfreigabe
app.post('/api/offers/:offerId/preliminary-accept', async (req, res) => {
  try {
    const { offerId } = req.params;
    const { projectId } = req.body;
    
    await query('BEGIN');
    
    // Hole Angebotsdaten
    const offerResult = await query(
      `SELECT o.*, h.*, t.name as trade_name
       FROM offers o
       JOIN handwerker h ON o.handwerker_id = h.id
       JOIN tenders tn ON o.tender_id = tn.id
       JOIN trades t ON tn.trade_id = t.id
       WHERE o.id = $1`,
      [offerId]
    );
    
    if (offerResult.rows.length === 0) {
      throw new Error('Angebot nicht gefunden');
    }
    
    const offer = offerResult.rows[0];
    
    // Update Offer Status zu Stufe 1
    await query(
      `UPDATE offers 
       SET status = 'preliminary',
           stage = 1,
           preliminary_accepted_at = NOW(),
           nachwirkfrist_expires_at = NOW() + INTERVAL '24 months'
       WHERE id = $1`,
      [offerId]
    );

    // Schritt 2: Tender-Handwerker-Status (HINZUFÜGEN)
await query(
  `UPDATE tender_handwerker 
   SET status = 'preliminary_accepted'
   WHERE tender_id = (SELECT tender_id FROM offers WHERE id = $1) 
   AND handwerker_id = (SELECT handwerker_id FROM offers WHERE id = $1)`,
  [offerId]
);
    
    // Protokolliere Kontaktfreigabe
    await query(
      `INSERT INTO contract_negotiations 
       (offer_id, action_type, action_by, action_data)
       VALUES ($1, 'contact_shared', 'system', $2)`,
      [offerId, JSON.stringify({
        bauherr_contact: true,
        handwerker_contact: true,
        timestamp: new Date().toISOString()
      })]
    );
    
    // Sende E-Mail-Benachrichtigungen
if (transporter) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"byndl" <info@byndl.de>',
      to: offer.email,
      subject: 'Vorläufige Beauftragung erhalten - Kontaktdaten freigegeben',
      html: `
        <h2>Glückwunsch! Sie haben eine vorläufige Beauftragung erhalten</h2>
        <p>Der Bauherr hat Ihr Angebot vorläufig angenommen und möchte Sie kennenlernen. Die Kontaktdaten wurden freigegeben.</p>
        
        <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0;">
          <strong>Status: Vertragsanbahnung</strong><br>
          Sie befinden sich nun in der geschützten Kennenlernphase. Die 24-monatige Nachwirkfrist ist aktiv.
          Beide Seiten können das Angebot noch anpassen oder zurückziehen.
        </div>
        
        <h3>Nächste Schritte:</h3>
        <ul>
          <li>Kontaktieren Sie den Bauherren für einen Ortstermin</li>
          <li>Bestätigen oder passen Sie Ihr Angebot nach der Besichtigung an</li>
          <li>Nach Ihrer Bestätigung kann der Bauherr verbindlich beauftragen</li>
        </ul>
        
        <p><strong>Projektdetails:</strong> ${offer.trade_name}</p>
        <a href="https://byndl.de/handwerker/dashboard">Zum Dashboard</a>
      `
    });
  } catch (emailError) {
    console.error('Email-Versand fehlgeschlagen:', emailError.message);
  }
}
    
    await query('COMMIT');
    
    res.json({
      success: true,
      message: 'Vorläufige Beauftragung erfolgreich',
      contactDetails: {
        handwerker: {
          company: offer.company_name,
          contact: offer.contact_person,
          phone: offer.phone,
          email: offer.email
        }
      }
    });
    
  } catch (error) {
    await query('ROLLBACK');
    console.error('Error in preliminary acceptance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handwerker bestätigt Angebot nach Ortstermin
app.post('/api/offers/:offerId/confirm-after-inspection', async (req, res) => {
  try {
    const { offerId } = req.params;
    const { adjustedAmount, notes } = req.body;
    
    await query(
      `UPDATE offers 
       SET offer_confirmed_at = NOW(),
           amount = COALESCE($2, amount),
           notes = COALESCE($3, notes),
           status = 'confirmed'  -- FEHLT IN ORIGINAL!
       WHERE id = $1`,
      [offerId, adjustedAmount, notes]
    );
    
    // Protokolliere
    await query(
      `INSERT INTO contract_negotiations 
       (offer_id, action_type, action_by, action_data)
       VALUES ($1, 'offer_confirmed', 'handwerker', $2)`,
      [offerId, JSON.stringify({ adjustedAmount, notes })]
    );
    
    res.json({ success: true, message: 'Verbindliches Angebot bestätigt' });
    
  } catch (error) {
    console.error('Error confirming offer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Terminvorschlag vom Handwerker
app.post('/api/offers/:offerId/propose-appointment', async (req, res) => {
  try {
    const { offerId } = req.params;
    const { proposedDates, message } = req.body;
    
    // Hole Kontaktdaten für Email
    const contactData = await query(
      `SELECT b.email, b.name, h.company_name, t.name as trade_name
       FROM offers o
       JOIN tenders tn ON o.tender_id = tn.id
       JOIN projects p ON tn.project_id = p.id
       JOIN bauherren b ON p.bauherr_id = b.id
       JOIN handwerker h ON o.handwerker_id = h.id
       JOIN trades t ON tn.trade_id = t.id
       WHERE o.id = $1 AND o.status = 'preliminary'`,
      [offerId]
    );
    
    if (contactData.rows.length === 0) {
      return res.status(404).json({ error: 'Angebot nicht in Vertragsanbahnung' });
    }
    
    // Speichere Terminvorschlag
    await query(
      `INSERT INTO appointment_proposals 
       (offer_id, proposed_by, proposed_dates, message, status, created_at)
       VALUES ($1, 'handwerker', $2, $3, 'pending', NOW())`,
      [offerId, JSON.stringify(proposedDates), message]
    );
    
    // Email an Bauherr
    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"byndl" <info@byndl.de>',
        to: contactData.rows[0].email,
        subject: `Terminvorschlag für Ortstermin - ${contactData.rows[0].trade_name}`,
        html: `
          <h2>Neuer Terminvorschlag</h2>
          <p>${contactData.rows[0].company_name} hat Termine für einen Ortstermin vorgeschlagen:</p>
          <ul>
            ${proposedDates.map(date => `<li>${new Date(date).toLocaleString('de-DE')}</li>`).join('')}
          </ul>
          ${message ? `<p>Nachricht: ${message}</p>` : ''}
          <a href="https://byndl.de/dashboard">Zum Dashboard</a>
        `
      });
    }
    
    res.json({ success: true, message: 'Terminvorschläge gesendet' });
    
  } catch (error) {
    console.error('Error proposing appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stufe 2: Verbindliche Beauftragung
app.post('/api/offers/:offerId/final-accept', async (req, res) => {
  try {
    const { offerId } = req.params;
    
    await query('BEGIN');
    
    // Update zu Stufe 2
    await query(
      `UPDATE offers 
       SET status = 'accepted',
           stage = 2,
           final_accepted_at = NOW()
       WHERE id = $1`,
      [offerId]
    );
    
    // Erstelle Werkvertrag
    const contractResult = await query(
      `INSERT INTO orders 
       (offer_id, project_id, handwerker_id, trade_id, amount, status, created_at)
       SELECT o.id, tn.project_id, o.handwerker_id, tn.trade_id, o.amount, 'active', NOW()
       FROM offers o
       JOIN tenders tn ON o.tender_id = tn.id
       WHERE o.id = $1
       RETURNING id`,
      [offerId]
    );
    
    // Aktiviere Premium-Features
    await query(
      `UPDATE projects 
       SET premium_features_active = true 
       WHERE id = (
         SELECT tn.project_id 
         FROM offers o 
         JOIN tenders tn ON o.tender_id = tn.id 
         WHERE o.id = $1
       )`,
      [offerId]
    );
    
    // Erstelle Rechnung für BYNDL-Provision
    const provisionAmount = await calculateProvision(offerId);
    await query(
      `INSERT INTO invoices 
       (type, reference_id, amount, status, due_date)
       VALUES ('provision', $1, $2, 'pending', NOW() + INTERVAL '14 days')`,
      [offerId, provisionAmount]
    );
    
    await query('COMMIT');
    
    res.json({
      success: true,
      message: 'Verbindliche Beauftragung erfolgreich',
      contractId: contractResult.rows[0].id,
      premiumFeaturesActivated: true
    });
    
  } catch (error) {
    await query('ROLLBACK');
    console.error('Error in final acceptance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper-Funktion für Provisionsberechnung
async function calculateProvision(offerId) {
  const result = await query(
    'SELECT amount FROM offers WHERE id = $1',
    [offerId]
  );
  
  const amount = result.rows[0].amount;
  const provisionRate = 0.05; // 5% Provision
  return amount * provisionRate;
}

// Get project orders
app.get('/api/projects/:projectId/orders', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const result = await query(
      `SELECT o.*, h.company_name, t.name as trade_name
       FROM orders o
       JOIN handwerker h ON o.handwerker_id = h.id
       JOIN trades t ON o.trade_id = t.id
       WHERE o.project_id = $1
       ORDER BY o.created_at DESC`,
      [projectId]
    );
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Aufträge' });
  }
});

// Get project supplements
app.get('/api/projects/:projectId/supplements', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const result = await query(
      `SELECT s.*, h.company_name
       FROM supplements s
       JOIN orders o ON s.order_id = o.id
       JOIN handwerker h ON o.handwerker_id = h.id
       WHERE o.project_id = $1
       ORDER BY s.created_at DESC`,
      [projectId]
    );
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching supplements:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Nachträge' });
  }
});

// Bauherr Settings Endpoints

// Get Bauherr Settings
app.get('/api/bauherr/:id/settings', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM bauherren WHERE id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bauherr nicht gefunden' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Einstellungen' });
  }
});

// Update Personal Data
app.put('/api/bauherr/:id/personal', async (req, res) => {
  try {
    const { name, email, phone, street, houseNumber, zipCode, city } = req.body;
    
    await query(
      `UPDATE bauherren SET
        name = $2,
        email = $3,
        phone = $4,
        street = $5,
        house_number = $6,
        zip = $7,
        city = $8,
        updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, name, email, phone, street, houseNumber, zipCode, city]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating personal data:', err);
    res.status(500).json({ error: 'Update fehlgeschlagen' });
  }
});

// Update Notifications
app.put('/api/bauherr/:id/notifications', async (req, res) => {
  try {
    await query(
      `UPDATE bauherren SET
        notification_settings = $2,
        updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, JSON.stringify(req.body)]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating notifications:', err);
    res.status(500).json({ error: 'Update fehlgeschlagen' });
  }
});

// Change Password
app.put('/api/bauherr/:id/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Get current password hash
    const result = await query(
      'SELECT password_hash FROM bauherren WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bauherr nicht gefunden' });
    }
    
    // Verify current password
    const isValid = await bcryptjs.compare(currentPassword, result.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Falsches Passwort' });
    }
    
    // Hash new password
    const hashedPassword = await bcryptjs.hash(newPassword, 10);
    
    // Update password
    await query(
      `UPDATE bauherren SET
        password_hash = $2,
        updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, hashedPassword]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ error: 'Passwortänderung fehlgeschlagen' });
  }
});

// Toggle Two-Factor
app.put('/api/bauherr/:id/two-factor', async (req, res) => {
  try {
    const { enabled } = req.body;
    
    await query(
      `UPDATE bauherren SET
        two_factor_enabled = $2,
        updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, enabled]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error toggling 2FA:', err);
    res.status(500).json({ error: 'Update fehlgeschlagen' });
  }
});

// Export Data
app.get('/api/bauherr/:id/export', async (req, res) => {
  try {
    // Get all user data
    const bauherrResult = await query('SELECT * FROM bauherren WHERE id = $1', [req.params.id]);
    const projectsResult = await query('SELECT * FROM projects WHERE bauherr_id = $1', [req.params.id]);
    
    const exportData = {
      personal: bauherrResult.rows[0],
      projects: projectsResult.rows,
      exportDate: new Date().toISOString()
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="byndl-export.json"');
    res.json(exportData);
  } catch (err) {
    console.error('Error exporting data:', err);
    res.status(500).json({ error: 'Export fehlgeschlagen' });
  }
});

// Delete Account
app.delete('/api/bauherr/:id/account', async (req, res) => {
  try {
    const { password } = req.body;
    
    // Verify password
    const result = await query(
      'SELECT password_hash FROM bauherren WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account nicht gefunden' });
    }
    
    const isValid = await bcryptjs.compare(password, result.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Falsches Passwort' });
    }
    
    // Delete all related data
    await query('BEGIN');
    
    // Delete projects and all related data
    const projects = await query('SELECT id FROM projects WHERE bauherr_id = $1', [req.params.id]);
    for (const project of projects.rows) {
      await query('DELETE FROM questions WHERE project_id = $1', [project.id]);
      await query('DELETE FROM project_trades WHERE project_id = $1', [project.id]);
      await query('DELETE FROM lvs WHERE project_id = $1', [project.id]);
      await query('DELETE FROM tenders WHERE project_id = $1', [project.id]);
    }
    
    await query('DELETE FROM projects WHERE bauherr_id = $1', [req.params.id]);
    await query('DELETE FROM bauherren WHERE id = $1', [req.params.id]);
    
    await query('COMMIT');
    
    res.json({ success: true });
  } catch (err) {
    await query('ROLLBACK');
    console.error('Error deleting account:', err);
    res.status(500).json({ error: 'Account-Löschung fehlgeschlagen' });
  }
});

// Delete Project
app.delete('/api/projects/:id', async (req, res) => {
  try {
    await query('BEGIN');
    
    // Delete all related data
    await query('DELETE FROM questions WHERE project_id = $1', [req.params.id]);
    await query('DELETE FROM answers WHERE project_id = $1', [req.params.id]);
    await query('DELETE FROM project_trades WHERE project_id = $1', [req.params.id]);
    await query('DELETE FROM lvs WHERE project_id = $1', [req.params.id]);
    await query('DELETE FROM tenders WHERE project_id = $1', [req.params.id]);
    await query('DELETE FROM trade_progress WHERE project_id = $1', [req.params.id]);
    await query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    
    await query('COMMIT');
    
    res.json({ success: true });
  } catch (err) {
    await query('ROLLBACK');
    console.error('Error deleting project:', err);
    res.status(500).json({ error: 'Projekt-Löschung fehlgeschlagen' });
  }
});

// 5. HANDWERKER DASHBOARD ROUTES
// ----------------------------------------------------------------------------

// KORRIGIERTE ROUTE für abgegebene Angebote
app.get('/api/handwerker/:identifier/offers', async (req, res) => {
  try {
    const { identifier } = req.params;
    let handwerkerId;
    
    // Flexible ID-Erkennung
    if (/^\d+$/.test(identifier)) {
      handwerkerId = parseInt(identifier);
    } else {
      const result = await query(
        'SELECT id FROM handwerker WHERE company_id = $1',
        [identifier]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Handwerker nicht gefunden' });
      }
      handwerkerId = result.rows[0].id;
    }
    
    const result = await query(
      `SELECT 
        o.*, 
        t.name as trade, 
        p.description as projectType, 
        p.zip_code || ' ' || p.city as location,
        o.created_at as submittedDate,
        o.status,
        o.amount,
        o.viewed_at,
        CASE 
          WHEN o.status = 'submitted' THEN 'Vorläufiges Angebot'
          WHEN o.status = 'confirmed' THEN 'Verbindliches Angebot'
          WHEN o.status = 'preliminary' THEN 'Vorläufig beauftragt'
          ELSE o.status
        END as status_text
       FROM offers o
       JOIN tenders tn ON o.tender_id = tn.id
       JOIN trades t ON tn.trade_id = t.id
       JOIN projects p ON tn.project_id = p.id
       WHERE o.handwerker_id = $1
         AND o.status IN ('submitted', 'confirmed')
         AND o.status NOT IN ('preliminary', 'accepted', 'withdrawn')
       ORDER BY o.created_at DESC`,
      [handwerkerId]  // WICHTIG: handwerkerId statt companyId
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching handwerker offers:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Angebote' });
  }
});

// KORRIGIERTE ROUTE für Vertragsanbahnungen
app.get('/api/handwerker/:identifier/contracts', async (req, res) => {
  try {
    const { identifier } = req.params;
    let handwerkerId;
    
    // Flexible ID-Erkennung
    if (/^\d+$/.test(identifier)) {
      handwerkerId = parseInt(identifier);
    } else {
      const result = await query(
        'SELECT id FROM handwerker WHERE company_id = $1',
        [identifier]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Handwerker nicht gefunden' });
      }
      handwerkerId = result.rows[0].id;
    }
    
    const result = await query(
      `SELECT 
        o.*,
        p.description as projectType,
        p.street || ' ' || p.house_number || ', ' || p.zip_code || ' ' || p.city as projectAddress,
        b.name as clientName,
        b.email as clientEmail,
        b.phone as clientPhone,
        b.street || ' ' || b.house_number || ', ' || b.zip || ' ' || b.city as clientAddress,
        t.name as trade,
        o.preliminary_accepted_at,
        o.offer_confirmed_at,
        o.amount,
        o.notes,
        o.lv_data,
        CASE 
          WHEN o.offer_confirmed_at IS NOT NULL THEN 'Angebot bestätigt - wartet auf finale Beauftragung'
          ELSE 'Vorläufig beauftragt - Ortstermin ausstehend'
        END as negotiation_status
       FROM offers o
       JOIN tenders tn ON o.tender_id = tn.id
       JOIN projects p ON tn.project_id = p.id
       JOIN bauherren b ON p.bauherr_id = b.id
       JOIN trades t ON tn.trade_id = t.id
       WHERE o.handwerker_id = $1
         AND o.status = 'preliminary'
         AND o.stage = 1
       ORDER BY o.preliminary_accepted_at DESC`,
      [handwerkerId]  // WICHTIG: handwerkerId
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching contract negotiations:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Vertragsanbahnungen' });
  }
});

// Withdraw offer
app.post('/api/offers/:offerId/withdraw', async (req, res) => {
  try {
    const { offerId } = req.params;
    
    await query(
      `UPDATE offers SET status = 'withdrawn', withdrawn_at = NOW() WHERE id = $1`,
      [offerId]
    );
    
    res.json({ success: true, message: 'Angebot zurückgezogen' });
    
  } catch (error) {
    console.error('Error withdrawing offer:', error);
    res.status(500).json({ error: 'Fehler beim Zurückziehen' });
  }
});

// ============= AUSSCHREIBUNGS-SYSTEM =============

// kleiner Helfer
function safeParseJSON(v) {
  if (!v) return null;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return null; }
}

// Gemeinsamer Handler NUR für die alte URL
async function createProjectTenders(req, res) {
  const { projectId } = req.params;
  const { tradeIds, timeframe, bundleSettings } = req.body || {};

  try {
    await query('BEGIN');

    // 1) Projekt + Bauherr laden
    const projectResult = await query(
      `SELECT p.*, b.zip AS bauherr_zip, b.id AS bauherr_id, b.email AS bauherr_email, b.name AS bauherr_name
         FROM projects p
         JOIN bauherren b ON p.bauherr_id = b.id
        WHERE p.id = $1`,
      [projectId]
    );
    if (projectResult.rows.length === 0) {
      throw new Error('Projekt nicht gefunden');
    }
    const project = projectResult.rows[0];

    // 2) ZIP prüfen (Projekt oder Bauherr)
    const targetZip = project.zip_code || project.bauherr_zip;
    if (!targetZip) {
      throw new Error('Projekt hat keine gültige PLZ für Handwerker-Matching');
    }

    // 3) Gewerke bestimmen
    let tradesToProcess;
    if (tradeIds === 'all') {
      tradesToProcess = await query(
        `SELECT DISTINCT t.*
           FROM trades t
           JOIN project_trades pt ON t.id = pt.trade_id
          WHERE pt.project_id = $1
            AND t.code != 'INT'
          ORDER BY t.name`,
        [projectId]
      );
    } else {
      const ids = Array.isArray(tradeIds) ? tradeIds : (tradeIds ? [tradeIds] : []);
      if (ids.length === 0) {
        await query('ROLLBACK');
        return res.status(400).json({ error: 'Keine Gewerke übergeben (tradeIds) und "all" nicht gesetzt' });
      }
      tradesToProcess = await query(
        `SELECT * FROM trades WHERE id = ANY($1::int[]) ORDER BY name`,
        [ids]
      );
    }
    if (tradesToProcess.rows.length === 0) {
      await query('ROLLBACK');
      return res.status(400).json({ error: 'Keine passenden Gewerke gefunden' });
    }

    const createdTenders = [];
    const skipped = []; // z.B. { tradeId, tradeName, reason: 'no_lv'|'exists' }

    // 4) pro Gewerk Tender erzeugen
    for (const trade of tradesToProcess.rows) {
      // 4a) Schon vorhanden?
      const existingTender = await query(
        `SELECT id
           FROM tenders
          WHERE project_id = $1
            AND trade_id   = $2
            AND status    != 'cancelled'`,
        [projectId, trade.id]
      );
      if (existingTender.rows.length > 0) {
        skipped.push({ tradeId: trade.id, tradeName: trade.name, reason: 'exists' });
        continue;
      }

      // 4b) LV laden (ohne LV kein Tender)
      const lvResult = await query(
        `SELECT * FROM lvs WHERE project_id = $1 AND trade_id = $2`,
        [projectId, trade.id]
      );
      if (lvResult.rows.length === 0) {
        skipped.push({ tradeId: trade.id, tradeName: trade.name, reason: 'no_lv' });
        continue;
      }

      const lv = lvResult.rows[0];
      const lvContent = safeParseJSON(lv.content) || lv.content || {};
      const estimatedValue = Number(lvContent?.totalSum || 0);

      // 4c) Tender anlegen
      const tenderInsert = await query(
        `INSERT INTO tenders (
           project_id, trade_id, status,
           deadline, estimated_value, timeframe,
           lv_data, created_at
         ) VALUES (
           $1, $2, 'open',
           NOW() + INTERVAL '14 days', $3, $4,
           $5, NOW()
         )
         RETURNING id, deadline`,
        [
          projectId,
          trade.id,
          estimatedValue,
          timeframe || project.timeframe || 'Nach Absprache',
          JSON.stringify(lvContent || {})
        ]
      );
      const tenderId = tenderInsert.rows[0].id;

      // 4d) Matching (PostGIS)
      await query(`SELECT zip, latitude, longitude FROM zip_codes WHERE zip = $1`, [targetZip]); // nur Check

      const matchingHandwerker = await query(
        `SELECT DISTINCT h.*,
                CASE
                  WHEN z1.latitude IS NOT NULL AND z2.latitude IS NOT NULL THEN
                    ST_Distance(
                      ST_MakePoint(z1.longitude, z1.latitude)::geography,
                      ST_MakePoint(z2.longitude, z2.latitude)::geography
                    ) / 1000
                  WHEN h.zip_code = $1 THEN 0
                  ELSE h.action_radius
                END AS distance_km
           FROM handwerker h
           JOIN handwerker_trades ht ON h.id = ht.handwerker_id
      LEFT JOIN zip_codes z1 ON z1.zip::text = h.zip_code::text
      LEFT JOIN zip_codes z2 ON z2.zip::text = $1::text
          WHERE ht.trade_id = $2
            AND h.active = true
            AND (
              h.zip_code = $1
              OR (
                z1.latitude IS NOT NULL AND z1.longitude IS NOT NULL
                AND z2.latitude IS NOT NULL AND z2.longitude IS NOT NULL
                AND ST_DWithin(
                  ST_MakePoint(z1.longitude, z1.latitude)::geography,
                  ST_MakePoint(z2.longitude, z2.latitude)::geography,
                  GREATEST(h.action_radius * 1000, 1)
                )
              )
              OR (
                (z1.latitude IS NULL OR z2.latitude IS NULL)
                AND h.action_radius >= 30
              )
            )
        ORDER BY distance_km ASC`,
        [targetZip, trade.id]
      );

      // 4e) HW verknüpfen + Tracking + (optional) Mail
      for (const hw of matchingHandwerker.rows) {
        try {
          await query(
            `INSERT INTO tender_handwerker (tender_id, handwerker_id, status, notified_at, distance_km)
             VALUES ($1, $2, 'pending', NOW(), $3)
             ON CONFLICT (tender_id, handwerker_id) DO NOTHING`,
            [tenderId, hw.id, Math.round(hw.distance_km || 0)]
          );

          await query(
            `INSERT INTO tender_handwerker_status (tender_id, handwerker_id, status, created_at)
             VALUES ($1, $2, 'sent', NOW())
             ON CONFLICT (tender_id, handwerker_id)
             DO UPDATE SET status = 'sent', created_at = NOW()`,
            [tenderId, hw.id]
          );

          if (typeof transporter !== 'undefined' && transporter && hw.email) {
            try {
              await transporter.sendMail({
                from: process.env.SMTP_FROM || '"byndl" <info@byndl.de>',
                to: hw.email,
                subject: `Neue Ausschreibung: ${trade.name} - ${project.category || 'Bauprojekt'}`,
                html: `
                  <!doctype html>
                  <html><body style="font-family:Arial,sans-serif;">
                    <h2>Neue passende Ausschreibung</h2>
                    <p>Guten Tag ${hw.company_name || hw.contact_person || ''},</p>
                    <p>Es gibt eine neue Ausschreibung in Ihrer Region.</p>
                    <table>
                      <tr><td><strong>Gewerk:</strong></td><td>${trade.name}</td></tr>
                      <tr><td><strong>Standort:</strong></td><td>${targetZip} (${Math.round(hw.distance_km || 0)} km)</td></tr>
                      <tr><td><strong>Geschätztes Volumen:</strong></td><td>${formatCurrency(estimatedValue)}</td></tr>
                      <tr><td><strong>Angebotsfrist:</strong></td><td>${new Date(tenderInsert.rows[0].deadline).toLocaleDateString('de-DE')}</td></tr>
                    </table>
                    <p><a href="https://byndl.de/handwerker/dashboard">Zum Dashboard →</a></p>
                  </body></html>`
              });

              await query(
                `INSERT INTO email_logs (recipient_email, email_type, status, sent_at, handwerker_id, metadata)
                 VALUES ($1,'tender_notification','sent',NOW(),$2,$3)`,
                [hw.email, hw.id, JSON.stringify({ tender_id: tenderId, trade_id: trade.id })]
              );
            } catch (mailErr) {
              console.error('E-Mail (HW) fehlgeschlagen:', mailErr?.message || mailErr);
            }
          }
        } catch (linkErr) {
          console.error(`Linking HW ${hw.id} fehlgeschlagen:`, linkErr?.message || linkErr);
        }
      }

      createdTenders.push({
        tenderId,
        tradeId: trade.id,
        tradeName: trade.name,
        matchedHandwerker: matchingHandwerker.rows.length
      });
    }

    // 5) Optional Bundles
    if (bundleSettings?.eligible && typeof checkAndCreateBundles === 'function' && createdTenders.length > 0) {
      try {
        await checkAndCreateBundles(project, createdTenders);
      } catch (bundleErr) {
        console.warn('Bundle-Erstellung übersprungen:', bundleErr?.message || bundleErr);
      }
    }

    // 6) E-Mail an Bauherr (Zusammenfassung)
    if (
      createdTenders.length > 0 &&
      project.bauherr_email &&
      typeof transporter !== 'undefined' &&
      transporter
    ) {
      const totalHw = createdTenders.reduce((s, t) => s + (t.matchedHandwerker || 0), 0);
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"byndl" <info@byndl.de>',
          to: project.bauherr_email,
          subject: 'Ihre Ausschreibung wurde versendet',
          html: `
            <!doctype html>
            <html><body style="font-family:Arial,sans-serif;">
              <h2>Ihre Ausschreibung ist raus</h2>
              <p>Hallo ${project.bauherr_name || ''},</p>
              <p>Wir haben Ihre Ausschreibung an passende Handwerker versendet.</p>
              <ul>
                ${createdTenders
                  .map(t => `<li><strong>${t.tradeName}:</strong> ${t.matchedHandwerker} Handwerker benachrichtigt</li>`)
                  .join('')}
              </ul>
              <p><strong>Gesamt:</strong> ${totalHw} Handwerker</p>
              <p>Den Status sehen Sie jederzeit in Ihrem Dashboard.</p>
            </body></html>`
        });
      } catch (mailErr) {
        console.error('E-Mail (Bauherr) fehlgeschlagen:', mailErr?.message || mailErr);
      }
    }

    await query('COMMIT');
    return res.json({
      success: true,
      message: `${createdTenders.length} Ausschreibung(en) erstellt`,
      tenders: createdTenders,
      skipped
    });
  } catch (error) {
    await query('ROLLBACK');
    console.error('Error creating tenders:', error);
    return res.status(500).json({ error: error.message || 'Interner Fehler' });
  }
}

// Behalte NUR diese Route:
app.post('/api/projects/:projectId/tender/create', createProjectTenders);

// Route für nachträgliches Matching von neuen Handwerkern zu bestehenden Tendern
app.post('/api/admin/rematch-tenders', async (req, res) => {
  const { 
    tenderId,      // Optional: Nur eine spezifische Tender
    tradeId,       // Optional: Nur ein spezifisches Gewerk
    handwerkerId,  // Optional: Nur einen spezifischen Handwerker
    dryRun = false // Optional: Simulationsmodus ohne DB-Änderungen
  } = req.body;

  try {
    await query('BEGIN');

    // 1) Relevante Tenders laden
    let tenderQuery = `
      SELECT DISTINCT t.*, p.zip_code as project_zip, tr.name as trade_name, tr.code as trade_code
      FROM tenders t
      JOIN projects p ON t.project_id = p.id
      JOIN trades tr ON t.trade_id = tr.id
      WHERE t.status = 'open'`;
    
    const tenderParams = [];
    let paramCount = 0;
    
    if (tenderId) {
      tenderQuery += ` AND t.id = $${++paramCount}`;
      tenderParams.push(tenderId);
    }
    
    if (tradeId) {
      tenderQuery += ` AND t.trade_id = $${++paramCount}`;
      tenderParams.push(tradeId);
    }
    
    tenderQuery += ` ORDER BY t.created_at DESC`;
    
    const tendersResult = await query(tenderQuery, tenderParams);
    
    if (tendersResult.rows.length === 0) {
      await query('ROLLBACK');
      return res.json({ 
        success: true, 
        message: 'Keine offenen Tenders gefunden',
        matched: 0 
      });
    }

    const matchResults = [];
    let totalNewMatches = 0;
    let totalSkipped = 0;

    // 2) Pro Tender neue Handwerker suchen
    for (const tender of tendersResult.rows) {
      const targetZip = tender.project_zip;
      
      if (!targetZip) {
        console.warn(`Tender ${tender.id} hat keine Projekt-PLZ`);
        continue;
      }

      // 3) Bereits verknüpfte Handwerker IDs holen
      const existingHandwerkerResult = await query(
        `SELECT handwerker_id FROM tender_handwerker WHERE tender_id = $1`,
        [tender.id]
      );
      const existingHandwerkerIds = existingHandwerkerResult.rows.map(r => r.handwerker_id);

      // 4) Neue passende Handwerker finden (gleiche Logik wie in createProjectTenders)
      let matchQuery = `
        SELECT DISTINCT h.*,
          CASE
            WHEN z1.latitude IS NOT NULL AND z2.latitude IS NOT NULL THEN
              ST_Distance(
                ST_MakePoint(z1.longitude, z1.latitude)::geography,
                ST_MakePoint(z2.longitude, z2.latitude)::geography
              ) / 1000
            WHEN h.zip_code = $1 THEN 0
            ELSE h.action_radius
          END AS distance_km
        FROM handwerker h
        JOIN handwerker_trades ht ON h.id = ht.handwerker_id
        LEFT JOIN zip_codes z1 ON z1.zip::text = h.zip_code::text
        LEFT JOIN zip_codes z2 ON z2.zip::text = $1::text
        WHERE ht.trade_id = $2
          AND h.active = true`;
      
      // Nur neue Handwerker (nicht bereits verknüpft)
      if (existingHandwerkerIds.length > 0) {
        matchQuery += ` AND h.id NOT IN (${existingHandwerkerIds.join(',')})`;
      }

      // Optional: Nur einen spezifischen Handwerker
      if (handwerkerId) {
        matchQuery += ` AND h.id = ${handwerkerId}`;
      }

      // Standard PostGIS Matching-Bedingungen
      matchQuery += `
          AND (
            h.zip_code = $1
            OR (
              z1.latitude IS NOT NULL AND z1.longitude IS NOT NULL
              AND z2.latitude IS NOT NULL AND z2.longitude IS NOT NULL
              AND ST_DWithin(
                ST_MakePoint(z1.longitude, z1.latitude)::geography,
                ST_MakePoint(z2.longitude, z2.latitude)::geography,
                GREATEST(h.action_radius * 1000, 1)
              )
            )
            OR (
              (z1.latitude IS NULL OR z2.latitude IS NULL)
              AND h.action_radius >= 30
            )
          )
        ORDER BY distance_km ASC`;

      const newHandwerker = await query(matchQuery, [targetZip, tender.trade_id]);
      
      const tenderMatchInfo = {
        tenderId: tender.id,
        tradeCode: tender.trade_code,
        tradeName: tender.trade_name,
        projectZip: targetZip,
        newMatches: [],
        existingCount: existingHandwerkerIds.length
      };

      // 5) Neue Handwerker verknüpfen
      for (const hw of newHandwerker.rows) {
        if (!dryRun) {
          try {
            // In tender_handwerker eintragen
            await query(
              `INSERT INTO tender_handwerker (tender_id, handwerker_id, status, notified_at, distance_km)
               VALUES ($1, $2, 'pending', NOW(), $3)
               ON CONFLICT (tender_id, handwerker_id) DO NOTHING`,
              [tender.id, hw.id, Math.round(hw.distance_km || 0)]
            );

            // Status tracking
            await query(
              `INSERT INTO tender_handwerker_status (tender_id, handwerker_id, status, created_at)
               VALUES ($1, $2, 'rematched', NOW())
               ON CONFLICT (tender_id, handwerker_id)
               DO UPDATE SET status = 'rematched', created_at = NOW()`,
              [tender.id, hw.id]
            );

            // Optional: E-Mail an neu gematchten Handwerker
            if (hw.email && typeof transporter !== 'undefined' && transporter) {
              try {
                const estimatedValue = Number(tender.estimated_value || 0);
                await transporter.sendMail({
                  from: process.env.SMTP_FROM || '"byndl" <info@byndl.de>',
                  to: hw.email,
                  subject: `Neue Ausschreibung: ${tender.trade_name}`,
                  html: `
                    <!doctype html>
                    <html><body style="font-family:Arial,sans-serif;">
                      <h2>Neue passende Ausschreibung in Ihrer Region</h2>
                      <p>Guten Tag ${hw.company_name || hw.contact_person || ''},</p>
                      <p>Eine Ausschreibung in Ihrer Nähe passt zu Ihrem Gewerk.</p>
                      <table style="border-collapse:collapse;">
                        <tr><td style="padding:5px;"><strong>Gewerk:</strong></td><td>${tender.trade_name}</td></tr>
                        <tr><td style="padding:5px;"><strong>PLZ:</strong></td><td>${targetZip}</td></tr>
                        <tr><td style="padding:5px;"><strong>Entfernung:</strong></td><td>${Math.round(hw.distance_km || 0)} km</td></tr>
                        ${estimatedValue > 0 ? `<tr><td style="padding:5px;"><strong>Volumen:</strong></td><td>${formatCurrency(estimatedValue)}</td></tr>` : ''}
                        <tr><td style="padding:5px;"><strong>Frist:</strong></td><td>${tender.deadline ? new Date(tender.deadline).toLocaleDateString('de-DE') : 'Offen'}</td></tr>
                      </table>
                      <p style="margin-top:20px;">
                        <a href="https://byndl.de/handwerker/dashboard" 
                           style="background:#007bff;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">
                          → Jetzt Angebot abgeben
                        </a>
                      </p>
                    </body></html>`
                });
              } catch (mailErr) {
                console.error(`E-Mail an HW ${hw.id} fehlgeschlagen:`, mailErr?.message);
              }
            }

            totalNewMatches++;
          } catch (err) {
            console.error(`Fehler beim Verknüpfen HW ${hw.id} mit Tender ${tender.id}:`, err?.message);
            totalSkipped++;
          }
        } else {
          totalNewMatches++; // Im dry-run nur zählen
        }

        tenderMatchInfo.newMatches.push({
          handwerkerId: hw.id,
          companyName: hw.company_name,
          distance: Math.round(hw.distance_km || 0)
        });
      }

      if (tenderMatchInfo.newMatches.length > 0) {
        matchResults.push(tenderMatchInfo);
      }
    }

    // 6) Statistik für Admin
    const stats = {
      tendersProcessed: tendersResult.rows.length,
      totalNewMatches,
      totalSkipped,
      details: matchResults
    };

    if (!dryRun) {
      await query('COMMIT');
      
      // Optional: Log für Admin
      await query(
        `INSERT INTO admin_logs (action, metadata, created_at, created_by)
         VALUES ('rematch_tenders', $1, NOW(), 'system')`,
        [JSON.stringify(stats)]
      ).catch(e => console.log('Admin log fehlgeschlagen:', e.message));
    } else {
      await query('ROLLBACK');
    }

    return res.json({
      success: true,
      message: dryRun 
        ? `Simulation: ${totalNewMatches} neue Matches gefunden (keine Änderungen vorgenommen)`
        : `${totalNewMatches} neue Handwerker zu bestehenden Ausschreibungen hinzugefügt`,
      dryRun,
      stats
    });

  } catch (error) {
    await query('ROLLBACK');
    console.error('Fehler beim Rematch:', error);
    return res.status(500).json({ 
      error: error.message || 'Interner Fehler beim nachträglichen Matching'
    });
  }
});

// ============================================
// 3. OFFER MANAGEMENT (ANGEBOTE)
// ============================================

// Angebote für Projekt laden (Bauherr)
app.get('/api/projects/:projectId/offers/detailed', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const offers = await query(
      `SELECT 
        o.*,
        h.company_name,
        h.rating,
        h.verified,
        h.email as handwerker_email,
        h.phone as handwerker_phone,
        t.name as trade_name,
        tn.estimated_value,
        CASE 
          WHEN o.viewed_at IS NULL THEN false 
          ELSE true 
        END as viewed
       FROM offers o
       JOIN handwerker h ON o.handwerker_id = h.id
       JOIN tenders tn ON o.tender_id = tn.id
       JOIN trades t ON tn.trade_id = t.id
       WHERE tn.project_id = $1
       ORDER BY o.status DESC, t.name, o.amount ASC`,
      [projectId]
    );
    
    // Gruppiere nach Trade für bessere Übersicht
    const groupedOffers = {};
    for (const offer of offers.rows) {
      if (!groupedOffers[offer.trade_name]) {
        groupedOffers[offer.trade_name] = [];
      }
      
      // Kontaktdaten nur bei preliminary/accepted zeigen
      if (offer.status !== 'preliminary' && offer.status !== 'accepted') {
        offer.handwerker_email = 'Nach Beauftragung sichtbar';
        offer.handwerker_phone = 'Nach Beauftragung sichtbar';
      }
      
      groupedOffers[offer.trade_name].push(offer);
    }
    
    res.json(groupedOffers);
    
  } catch (error) {
    console.error('Error fetching detailed offers:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Angebote' });
  }
});

// Handwerker: LV für Angebot abrufen
app.get('/api/tenders/:tenderId/lv', async (req, res) => {
  try {
    const { tenderId } = req.params;
    
    const result = await query(
      `SELECT 
        t.lv_data,
        t.project_id,
        t.trade_id,
        tr.name as trade_name,
        p.description as project_description
      FROM tenders t
      JOIN trades tr ON t.trade_id = tr.id
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = $1`,
      [tenderId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ausschreibung nicht gefunden' });
    }
    
    const tender = result.rows[0];
    const lv = typeof tender.lv_data === 'string' 
      ? JSON.parse(tender.lv_data) 
      : tender.lv_data;
    
    // Preise entfernen für Handwerker-Ansicht
    const lvWithoutPrices = {
      ...lv,
      positions: lv.positions.map(pos => ({
        ...pos,
        unitPrice: 0,
        totalPrice: 0
      }))
    };
    
    res.json({
      tenderId,
      projectId: tender.project_id,
      tradeId: tender.trade_id,
      tradeName: tender.trade_name,
      projectDescription: tender.project_description,
      lv: lvWithoutPrices
    });
    
  } catch (error) {
    console.error('Error fetching tender LV:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des LV' });
  }
});

// Angebot als gelesen markieren
app.post('/api/offers/:offerId/mark-read', async (req, res) => {
  try {
    const { offerId } = req.params;
    
    await query(
      'UPDATE offers SET viewed_at = COALESCE(viewed_at, NOW()) WHERE id = $1',
      [offerId]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Fehler' });
  }
});

// 3. Erweiterte Angebots-Submission mit Status-Management
app.post('/api/tenders/:tenderId/submit-offer', async (req, res) => {
  try {
    const { tenderId } = req.params;
    const { handwerkerId, positions, notes, totalSum, isPreliminary = true } = req.body;
    
    await query('BEGIN');
    
    // Prüfen ob bereits ein Angebot existiert
    const existingOffer = await query(
      'SELECT id, status FROM offers WHERE tender_id = $1 AND handwerker_id = $2',
      [tenderId, handwerkerId]
    );
    
    let offerId;
    let status = isPreliminary ? 'submitted' : 'confirmed';
    
    if (existingOffer.rows.length > 0) {
      offerId = existingOffer.rows[0].id;
      
      // Update nur wenn Status-Übergang erlaubt
      if (existingOffer.rows[0].status === 'preliminary' && !isPreliminary) {
        status = 'confirmed';
      }
      
      await query(
        `UPDATE offers 
         SET lv_data = $1, notes = $2, amount = $3, status = $4, updated_at = NOW()
         WHERE id = $5`,
        [JSON.stringify(positions), notes, totalSum, status, offerId]
      );
    } else {
      const result = await query(
        `INSERT INTO offers (
          tender_id, handwerker_id, amount, 
          lv_data, notes, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id`,
        [tenderId, handwerkerId, totalSum, JSON.stringify(positions), notes, status]
      );
      offerId = result.rows[0].id;
    }
    
    await query('COMMIT');
    
    res.json({ 
      success: true, 
      offerId,
      message: isPreliminary ? 
        'Vorläufiges Angebot abgegeben. Der Bauherr kann nun Kontakt aufnehmen.' :
        'Verbindliches Angebot bestätigt.'
    });
  } catch (error) {
    await query('ROLLBACK');
    console.error('Error:', error);
    res.status(500).json({ error: 'Fehler beim Abgeben des Angebots' });
  }
});

// Erweiterte Route für Angebote mit mehr Details
app.get('/api/projects/:projectId/offers/detailed', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const result = await query(
      `SELECT 
        o.*,
        h.company_name,
        h.email,
        h.phone,
        h.street,
        h.house_number,
        h.zip_code,
        h.city,
        h.rating,
        t.name as trade_name,
        tn.estimated_value,
        tn.timeframe,
        o.lv_data,
        o.notes,
        CASE 
          WHEN o.viewed_at IS NULL THEN false 
          ELSE true 
        END as viewed
       FROM offers o
       JOIN handwerker h ON o.handwerker_id = h.id
       JOIN tenders tn ON o.tender_id = tn.id
       JOIN trades t ON tn.trade_id = t.id
       WHERE tn.project_id = $1
       ORDER BY t.name, o.amount ASC`,
      [projectId]
    );
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching detailed offers:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Angebote' });
  }
});

// ============================================
// 5. BUNDLE MANAGEMENT (PROJEKTBÜNDEL)
// ============================================

// Verfügbare Bündel für Handwerker laden
app.get('/api/handwerker/:identifier/bundles', async (req, res) => {
  try {
    const { identifier } = req.params;
    let handwerkerId;
    
    // Flexible ID-Erkennung
    if (/^\d+$/.test(identifier)) {
      handwerkerId = parseInt(identifier);
    } else {
      const result = await query(
        'SELECT id FROM handwerker WHERE company_id = $1',
        [identifier]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Handwerker nicht gefunden' });
      }
      handwerkerId = result.rows[0].id;
    }
    
    console.log(`Loading bundles for handwerker_id: ${handwerkerId}`);
    
    // Handwerker-Trades laden
    const tradesResult = await query(
      `SELECT ht.trade_id, t.code as trade_code 
       FROM handwerker_trades ht
       JOIN trades t ON ht.trade_id = t.id
       WHERE ht.handwerker_id = $1`,
      [handwerkerId]
    );
    
    const tradeCodes = tradesResult.rows.map(t => t.trade_code);
    
    if (tradeCodes.length === 0) {
      return res.json([]);
    }
    
    // Aktive Bündel über tenders.bundle_id finden
    const bundles = await query(
      `SELECT 
        b.id,
        b.trade_code,
        b.region,
        b.status,
        b.max_projects,
        b.current_projects,
        b.total_volume,
        b.created_at,
        b.closes_at,
        t.name as trade_name,
        COUNT(DISTINCT tn.id) as tender_count,
        COUNT(DISTINCT tn.project_id) as project_count,
        SUM(tn.estimated_value) as calculated_volume
       FROM bundles b
       JOIN trades t ON b.trade_code = t.code
       JOIN tenders tn ON tn.bundle_id = b.id
       WHERE b.trade_code = ANY($1::varchar[])
       AND b.status IN ('forming', 'open')
       AND tn.status = 'open'
       AND NOT EXISTS (
         SELECT 1 FROM offers o 
         WHERE o.tender_id = tn.id 
         AND o.handwerker_id = $2
       )
       GROUP BY b.id, t.name
       HAVING COUNT(DISTINCT tn.id) >= 2`,
      [tradeCodes, handwerkerId]
    );
    
    res.json(bundles.rows);
  } catch (error) {
    console.error('Error fetching bundles:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Bündel' });
  }
});

// Bündel-Details mit Karte und LV-Daten laden
app.get('/api/bundles/:bundleId/details', async (req, res) => {
  try {
    const { bundleId } = req.params;
    
    const bundleResult = await query(
      `SELECT 
        b.*,
        t.name as trade_name,
        array_agg(
          json_build_object(
            'tender_id', tn.id,
            'project_id', p.id,
            'title', p.category || ' - ' || p.sub_category,
            'description', p.description,
            'address', CONCAT(p.street, ' ', p.house_number),
            'zip', p.zip_code,
            'city', p.city,
            'lat', z.latitude,
            'lng', z.longitude,
            'lv_data', tn.lv_data,
            'estimated_value', tn.estimated_value,
            'timeframe', tn.timeframe,
            'deadline', tn.deadline
          )
        ) as projects
       FROM bundles b
       JOIN tenders tn ON tn.bundle_id = b.id
       JOIN projects p ON tn.project_id = p.id
       JOIN trades t ON b.trade_code = t.code
       LEFT JOIN zip_codes z ON p.zip_code = z.zip
       WHERE b.id = $1
       GROUP BY b.id, t.name`,
      [bundleId]
    );
    
    if (bundleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bündel nicht gefunden' });
    }
    
    const bundle = bundleResult.rows[0];
    
    // Berechne Gesamt-LV für das Bündel
    let totalPositions = [];
    let totalSum = 0;
    
    for (const project of bundle.projects) {
      const lvData = typeof project.lv_data === 'string' 
        ? JSON.parse(project.lv_data) 
        : project.lv_data;
      
      if (lvData?.positions) {
        totalPositions = totalPositions.concat(
          lvData.positions.map(pos => ({
            ...pos,
            project_id: project.project_id,
            project_title: project.title
          }))
        );
        totalSum += lvData.totalSum || 0;
      }
    }
    
    bundle.combined_lv = {
      positions: totalPositions,
      totalSum: totalSum,
      projectCount: bundle.projects.length
    };
    
    // Berechne optimale Route (nur wenn Funktionen existieren)
    if (typeof calculateOptimalRoute === 'function') {
      bundle.optimal_route = calculateOptimalRoute(bundle.projects);
    }
    
    // Map-Daten aufbereiten
    bundle.map_data = {
      center: calculateCenter(bundle.projects),
      zoom: calculateZoomLevel(bundle.projects),
      markers: bundle.projects.map(p => ({
        id: p.project_id,
        position: { lat: parseFloat(p.lat), lng: parseFloat(p.lng) },
        title: p.title,
        address: `${p.address}, ${p.zip} ${p.city}`
      }))
    };
    
    res.json(bundle);
    
  } catch (error) {
    console.error('Error fetching bundle details:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Bündeldetails' });
  }
});

// Bündel-Angebot abgeben (angepasst)
app.post('/api/bundles/:bundleId/submit-offer', async (req, res) => {
  try {
    const { bundleId } = req.params;
    const { companyId, bundleDiscount, individualOffers } = req.body;
    
    await query('BEGIN');
    
    // CompanyId zu HandwerkerId konvertieren
    const handwerkerResult = await query(
      'SELECT id FROM handwerker WHERE company_id = $1',
      [companyId]
    );
    
    if (handwerkerResult.rows.length === 0) {
      throw new Error('Handwerker nicht gefunden');
    }
    
    const handwerkerId = handwerkerResult.rows[0].id;
    
    // Tenders für dieses Bundle laden
    const bundleTenders = await query(
      `SELECT id as tender_id, project_id 
       FROM tenders 
       WHERE bundle_id = $1`,
      [bundleId]
    );
    
    const createdOffers = [];
    let totalAmount = 0;
    
    // Für jede Tender im Bündel ein Angebot erstellen
    for (const tender of bundleTenders.rows) {
      const offerData = individualOffers[tender.tender_id];
      
      if (!offerData) continue;
      
      // Prüfe ob bundle_id Spalte in offers existiert
      const offerResult = await query(
        `INSERT INTO offers (
          tender_id, handwerker_id, 
          amount, lv_data, notes,
          ${typeof bundle_discount !== 'undefined' ? 'bundle_discount,' : ''}
          status, stage, created_at
        ) VALUES ($1, $2, $3, $4, $5, ${typeof bundle_discount !== 'undefined' ? '$6,' : ''} 'submitted', 1, NOW())
        RETURNING id`,
        typeof bundle_discount !== 'undefined' 
          ? [tender.tender_id, handwerkerId, offerData.amount, JSON.stringify(offerData.positions), offerData.notes, bundleDiscount]
          : [tender.tender_id, handwerkerId, offerData.amount, JSON.stringify(offerData.positions), offerData.notes]
      );
      
      createdOffers.push(offerResult.rows[0].id);
      totalAmount += offerData.amount;
    }
    
    // Bundle-Status aktualisieren (nur wenn Status-Spalte vorhanden ist)
    await query(
      `UPDATE bundles 
       SET status = 'offered'
       WHERE id = $1`,
      [bundleId]
    );
    
    // tender_handwerker Status aktualisieren
    for (const tender of bundleTenders.rows) {
      await query(
        `UPDATE tender_handwerker 
         SET offered_at = NOW(), status = 'offered'
         WHERE tender_id = $1 AND handwerker_id = $2`,
        [tender.tender_id, handwerkerId]
      );
    }
    
    await query('COMMIT');
    
    res.json({
      success: true,
      message: `Bündel-Angebot über ${createdOffers.length} Projekte abgegeben`,
      totalAmount: bundleDiscount ? totalAmount * (1 - bundleDiscount/100) : totalAmount,
      offerIds: createdOffers
    });
    
  } catch (error) {
    await query('ROLLBACK');
    console.error('Error submitting bundle offer:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 8. HELPER FUNCTIONS
// ============================================

// Bundle-Check-Funktion - ANGEPASST an tatsächliche DB-Struktur
async function checkAndCreateBundles(project, tenders) {
  for (const tender of tenders) {
    // Suche nach ähnlichen Projekten in der Region
    const similarProjects = await query(
      `SELECT DISTINCT t.*, p.zip_code, p.bauherr_id, tr.code as trade_code
       FROM tenders t
       JOIN projects p ON t.project_id = p.id
       JOIN trades tr ON t.trade_id = tr.id
       JOIN zip_codes z1 ON z1.zip = p.zip_code
       JOIN zip_codes z2 ON z2.zip = $1
       WHERE t.trade_id = $2
       AND t.status = 'open'
       AND t.project_id != $3
       AND t.bundle_id IS NULL  -- Noch nicht in einem Bundle
       AND ST_DWithin(
         ST_MakePoint(z1.longitude, z1.latitude)::geography,
         ST_MakePoint(z2.longitude, z2.latitude)::geography,
         10000 -- 10km Radius für Bündel
       )`,
      [project.zip_code, tender.tradeId, project.id]
    );
    
    if (similarProjects.rows.length > 0) {
      const tradeCode = similarProjects.rows[0].trade_code;
      
      // Existierendes offenes Bundle suchen oder neues erstellen
      let bundleId;
      const existingBundle = await query(
        `SELECT id FROM bundles 
         WHERE trade_code = $1 
         AND region = $2 
         AND status = 'forming'
         AND (max_projects IS NULL OR current_projects < max_projects)`,
        [tradeCode, project.zip_code]
      );
      
      if (existingBundle.rows.length > 0) {
        bundleId = existingBundle.rows[0].id;
      } else {
        // Neues Bundle erstellen
        const bundleResult = await query(
          `INSERT INTO bundles (
            trade_code, region, status, max_projects, current_projects, created_at
          ) VALUES ($1, $2, 'forming', 5, 0, NOW())
          RETURNING id`,
          [tradeCode, project.zip_code]
        );
        bundleId = bundleResult.rows[0].id;
      }
      
      // Tender mit Bundle verknüpfen
      await query(
        `UPDATE tenders SET bundle_id = $1 WHERE id = $2`,
        [bundleId, tender.tenderId]
      );
      
      // Ähnliche Tenders auch zum Bundle hinzufügen
      for (const similar of similarProjects.rows) {
        await query(
          `UPDATE tenders SET bundle_id = $1 WHERE id = $2 AND bundle_id IS NULL`,
          [bundleId, similar.id]
        );
      }
      
      // Bundle-Projekte Tabelle befüllen (falls verwendet)
      await query(
        `INSERT INTO bundle_projects (bundle_id, project_id, joined_at)
         SELECT $1, project_id, NOW() FROM tenders WHERE bundle_id = $1
         ON CONFLICT DO NOTHING`,
        [bundleId]
      );
      
      // Current_projects im Bundle aktualisieren
      await query(
        `UPDATE bundles 
         SET current_projects = (SELECT COUNT(*) FROM tenders WHERE bundle_id = $1),
             total_volume = (SELECT SUM(estimated_value) FROM tenders WHERE bundle_id = $1)
         WHERE id = $1`,
        [bundleId]
      );
    }
  }
}

// Berechne maximale Distanz zwischen Koordinaten
function calculateMaxDistance(coords) {
  let maxDist = 0;
  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 1; j < coords.length; j++) {
      const dist = haversineDistance(coords[i], coords[j]);
      if (dist > maxDist) maxDist = dist;
    }
  }
  return Math.round(maxDist * 10) / 10;
}

// Haversine Distanz-Berechnung
function haversineDistance(coord1, coord2) {
  const R = 6371; // Erdradius in km
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI/180);
}

// Berechne optimale Route (vereinfacht - TSP)
function calculateOptimalRoute(projects) {
  // Vereinfachte Implementation - in Produktion würde man hier
  // einen richtigen TSP-Algorithmus verwenden
  return projects.map(p => ({
    project_id: p.project_id,
    address: p.address,
    lat: p.lat,
    lng: p.lng
  }));
}

// Berechne Zentrum für Map
function calculateCenter(projects) {
  if (projects.length === 0) return { lat: 50.9375, lng: 6.9603 }; // Köln als Default
  
  const sumLat = projects.reduce((sum, p) => sum + p.lat, 0);
  const sumLng = projects.reduce((sum, p) => sum + p.lng, 0);
  
  return {
    lat: sumLat / projects.length,
    lng: sumLng / projects.length
  };
}

// Berechne Zoom-Level basierend auf Projektverteilung
function calculateZoomLevel(projects) {
  if (projects.length <= 1) return 14;
  
  const coords = projects.map(p => ({ lat: p.lat, lng: p.lng }));
  const maxDistance = calculateMaxDistance(coords);
  
  // Zoom-Level basierend auf maximaler Distanz
  if (maxDistance < 2) return 14;
  if (maxDistance < 5) return 13;
  if (maxDistance < 10) return 12;
  if (maxDistance < 20) return 11;
  return 10;
}

// ============================================
// 9. NOTIFICATION & STATUS UPDATES
// ============================================

// Ungelesene Benachrichtigungen zählen
app.get('/api/:userType/:userId/notifications/unread-count', async (req, res) => {
  try {
    const { userType, userId } = req.params;
    
    const result = await query(
      `SELECT COUNT(*) as count
       FROM notifications
       WHERE user_type = $1 AND user_id = $2 AND read_at IS NULL`,
      [userType, userId]
    );
    
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Zählen' });
  }
});

// Benachrichtigungen als gelesen markieren
app.post('/api/notifications/:notificationId/mark-read', async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET read_at = NOW() WHERE id = $1`,
      [req.params.notificationId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Fehler' });
  }
});

// Handwerker Aufträge laden
app.get('/api/handwerker/:identifier/orders', async (req, res) => {
  try {
    const { identifier } = req.params;
    let handwerkerId;
    
    // Flexible ID-Erkennung
    if (/^\d+$/.test(identifier)) {
      handwerkerId = parseInt(identifier);
    } else {
      const result = await query(
        'SELECT id FROM handwerker WHERE company_id = $1',
        [identifier]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Handwerker nicht gefunden' });
      }
      handwerkerId = result.rows[0].id;
    }
    
    const result = await query(
      `SELECT 
        ord.*,
        o.amount as contract_amount,
        o.lv_data,
        o.final_accepted_at as contract_date,
        p.description as projectType,
        p.street || ' ' || p.house_number || ', ' || p.zip_code || ' ' || p.city as projectAddress,
        b.name as clientName,
        b.email as clientEmail,
        b.phone as clientPhone,
        t.name as trade,
        o.execution_time as planned_execution,
        CASE 
          WHEN ord.status = 'active' THEN 'In Ausführung'
          WHEN ord.status = 'completed' THEN 'Abgeschlossen'
          ELSE ord.status
        END as status_text
       FROM orders ord
       JOIN offers o ON ord.offer_id = o.id
       JOIN projects p ON ord.project_id = p.id
       JOIN bauherren b ON p.bauherr_id = b.id
       JOIN trades t ON ord.trade_id = t.id
       WHERE ord.handwerker_id = $1
         AND o.status = 'accepted'
         AND o.stage = 2
       ORDER BY ord.created_at DESC`,
      [handwerkerId]  // WICHTIG: handwerkerId
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching handwerker orders:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Aufträge' });
  }
});

// NEU - Fehlte komplett
app.get('/api/bundles/:bundleId/map-data', async (req, res) => {
  try {
    const { bundleId } = req.params;
    
    const mapData = await query(
      `SELECT 
        p.id,
        p.street || ' ' || p.house_number as address,
        p.zip_code,
        p.city,
        z.latitude as lat,
        z.longitude as lng,
        tn.estimated_value as value
       FROM bundle_projects bp
       JOIN tenders tn ON bp.tender_id = tn.id
       JOIN projects p ON tn.project_id = p.id
       JOIN zip_codes z ON p.zip_code = z.zip
       WHERE bp.bundle_id = $1`,
      [bundleId]
    );
    
    res.json(mapData.rows);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Kartendaten' });
  }
});

// ============================================
// 8. HELPER FUNCTIONS
// ============================================

// Berechne maximale Distanz zwischen Koordinaten
function calculateMaxDistance(coords) {
  let maxDist = 0;
  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 1; j < coords.length; j++) {
      const dist = haversineDistance(coords[i], coords[j]);
      if (dist > maxDist) maxDist = dist;
    }
  }
  return Math.round(maxDist * 10) / 10;
}

// Haversine Distanz-Berechnung
function haversineDistance(coord1, coord2) {
  const R = 6371; // Erdradius in km
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI/180);
}

// Berechne optimale Route (vereinfacht - TSP)
function calculateOptimalRoute(projects) {
  // Vereinfachte Implementation - in Produktion würde man hier
  // einen richtigen TSP-Algorithmus verwenden
  return projects.map(p => ({
    project_id: p.project_id,
    address: p.address,
    lat: p.lat,
    lng: p.lng
  }));
}

// ============================================
// HANDWERKER SETTINGS ENDPOINTS
// ============================================

// Settings laden
app.get('/api/handwerker/:id/settings', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        company_name as "companyName",
        email, phone, street, house_number as "houseNumber",
        zip_code as "zipCode", city, website,
        action_radius as "actionRadius",
        min_order_value as "minOrderValue",
        hourly_rates as "hourlyRates",
        payment_terms as "paymentTerms",
        vacation_dates as "vacationDates",
        notification_settings as "notificationSettings",
        bank_iban as "bankIban",
        bank_bic as "bankBic",
        invoice_address as "invoiceAddress",
        two_factor_enabled as "twoFactorEnabled",
        excluded_areas as "excludedAreas",
        travel_cost_per_km as "travelCostPerKm"
       FROM handwerker WHERE id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Handwerker nicht gefunden' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Einstellungen' });
  }
});

// Firmendaten updaten
app.put('/api/handwerker/:id/firmendaten', async (req, res) => {
  try {
    const { companyName, email, phone, street, houseNumber, zipCode, city, website } = req.body;
    
    await query(
      `UPDATE handwerker SET
        company_name = $2,
        email = $3,
        phone = $4,
        street = $5,
        house_number = $6,
        zip_code = $7,
        city = $8,
        website = $9
       WHERE id = $1`,
      [req.params.id, companyName, email, phone, street, houseNumber, zipCode, city, website]
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Update fehlgeschlagen' });
  }
});

// ERSETZE die bestehende Einsatzgebiet-Route mit dieser:
app.put('/api/handwerker/:id/einsatzgebiet', async (req, res) => {
  try {
    const handwerkerId = req.params.id;
    console.log('Update Einsatzgebiet für Handwerker ID:', handwerkerId);
    
    const { 
      actionRadius,
      excludedAreas,
      travelCostPerKm,
      preferredZipCodes,
      minOrderValue10km,
      minOrderValue25km,
      minOrderValue50km,
      minOrderValueOver50km,
      latitude,
      longitude
    } = req.body;
    
    // Basis-Update - WICHTIG: excluded_areas ist JSONB, nicht TEXT!
    await query(
      `UPDATE handwerker SET
        action_radius = $2,
        excluded_areas = $3::jsonb,  -- Cast zu JSONB
        travel_cost_per_km = $4
       WHERE id = $1`,
      [
        handwerkerId, 
        actionRadius || 25,
        JSON.stringify(excludedAreas || []),  // JSON.stringify für JSONB
        travelCostPerKm || 0.5
      ]
    );
    
    // Erweiterte Einstellungen
    const coverageSettings = {
      preferred_zip_codes: preferredZipCodes || [],
      min_order_values: {
        up_to_10km: minOrderValue10km || 0,
        up_to_25km: minOrderValue25km || 0,
        up_to_50km: minOrderValue50km || 0,
        over_50km: minOrderValueOver50km || 0
      },
      coordinates: { 
        latitude: latitude || null, 
        longitude: longitude || null 
      }
    };
    
    // Update coverage_settings (auch JSONB)
    await query(
      `UPDATE handwerker SET coverage_settings = $2::jsonb WHERE id = $1`,
      [handwerkerId, JSON.stringify(coverageSettings)]
    );
    
    res.json({ 
      success: true,
      message: 'Einsatzgebiet erfolgreich aktualisiert'
    });
    
  } catch (err) {
    console.error('Update Einsatzgebiet Error:', err);
    res.status(500).json({ 
      error: 'Update fehlgeschlagen',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Verfügbarkeit updaten
app.put('/api/handwerker/:id/verfuegbarkeit', async (req, res) => {
  try {
    const { earliestStart, capacity, vacationDates } = req.body;
    
    await query(
      `UPDATE handwerker SET
        available_from = $2,
        vacation_dates = $3
       WHERE id = $1`,
      [req.params.id, earliestStart, JSON.stringify(vacationDates)]
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Update fehlgeschlagen' });
  }
});

// Preise updaten
app.put('/api/handwerker/:id/preise', async (req, res) => {
  try {
    const { minOrderValue, travelCostPerKm, hourlyRates } = req.body;
    
    await query(
      `UPDATE handwerker SET
        min_order_value = $2,
        travel_cost_per_km = $3,
        hourly_rates = $4
       WHERE id = $1`,
      [req.params.id, minOrderValue, travelCostPerKm, JSON.stringify(hourlyRates)]
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Update fehlgeschlagen' });
  }
});

// Benachrichtigungen updaten - ERWEITERTE VERSION
app.put('/api/handwerker/:id/benachrichtigungen', async (req, res) => {
  try {
    const { 
      emailNotifications, 
      smsNotifications, 
      newsletterSubscribed,
      notificationEmail,
      notificationPhone 
    } = req.body;
    
    // Validierung der E-Mail
    if (notificationEmail && !isValidEmail(notificationEmail)) {
      return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
    }
    
    // Validierung der Telefonnummer
    if (notificationPhone && !isValidPhone(notificationPhone)) {
      return res.status(400).json({ error: 'Ungültige Telefonnummer' });
    }
    
    const notificationSettings = {
      email: emailNotifications,
      sms: smsNotifications,
      newsletter: newsletterSubscribed,
      notificationEmail: notificationEmail,
      notificationPhone: notificationPhone
    };
    
    // Update der Datenbank mit zusätzlichen Feldern
    await query(
      `UPDATE handwerker SET
        notification_settings = $2,
        notification_email = $3,
        notification_phone = $4,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [
        req.params.id, 
        JSON.stringify(notificationSettings),
        notificationEmail || null,
        notificationPhone || null
      ]
    );
    
    res.json({ 
      success: true,
      message: 'Benachrichtigungseinstellungen erfolgreich aktualisiert'
    });
  } catch (err) {
    console.error('Fehler beim Update der Benachrichtigungen:', err);
    res.status(500).json({ error: 'Update fehlgeschlagen' });
  }
});

// Hilfsfunktionen für Validierung
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhone(phone) {
  // Erlaubt deutsche Telefonnummern mit verschiedenen Formaten
  const phoneRegex = /^(\+49|0049|0)?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s\-\/\(\)]/g, ''));
}

// Zahlungsdaten updaten
app.put('/api/handwerker/:id/zahlungsdaten', async (req, res) => {
  try {
    const { bankIban, bankBic, paymentTerms, invoiceAddress } = req.body;
    
    await query(
      `UPDATE handwerker SET
        bank_iban = $2,
        bank_bic = $3,
        payment_terms = $4,
        invoice_address = $5
       WHERE id = $1`,
      [req.params.id, bankIban, bankBic, paymentTerms, invoiceAddress]
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Update fehlgeschlagen' });
  }
});

const bcryptjs = require('bcryptjs');

// Passwort ändern - PRODUKTIONSREIFE VERSION
app.put('/api/handwerker/:id/password', async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    // Validierung
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        error: 'Alle Passwortfelder müssen ausgefüllt sein' 
      });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        error: 'Die neuen Passwörter stimmen nicht überein' 
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'Das neue Passwort muss mindestens 8 Zeichen lang sein' 
      });
    }
    
    // Hole aktuelles Passwort-Hash aus DB
    const result = await query(
      'SELECT password_hash FROM handwerker WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Handwerker nicht gefunden' 
      });
    }
    
    // Prüfe ob das aktuelle Passwort korrekt ist
    const isPasswordValid = await bcryptjs.compare(
      currentPassword, 
      result.rows[0].password_hash
    );
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: 'Das aktuelle Passwort ist falsch' 
      });
    }
    
    // Hashe das neue Passwort
    const hashedPassword = await bcryptjs.hash(newPassword, 10);
    
    // Update Passwort in DB
    await query(
      `UPDATE handwerker 
       SET password_hash = $2, 
           password_changed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [req.params.id, hashedPassword]
    );
    
    res.json({ 
      success: true, 
      message: 'Passwort erfolgreich geändert' 
    });
    
  } catch (err) {
    console.error('Passwort-Update Fehler:', err);
    res.status(500).json({ 
      error: 'Passwortänderung fehlgeschlagen' 
    });
  }
});

// Zwei-Faktor-Authentifizierung aktivieren/deaktivieren
app.put('/api/handwerker/:id/two-factor', async (req, res) => {
  try {
    const { twoFactorEnabled } = req.body;
    
    // Validierung
    if (typeof twoFactorEnabled !== 'boolean') {
      return res.status(400).json({ 
        error: 'Ungültiger Wert für Zwei-Faktor-Authentifizierung' 
      });
    }
    
    // Prüfe ob Handwerker existiert
    const checkResult = await query(
      'SELECT id, phone FROM handwerker WHERE id = $1',
      [req.params.id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Handwerker nicht gefunden' 
      });
    }
    
    // Wenn 2FA aktiviert werden soll, prüfe ob Telefonnummer vorhanden
    if (twoFactorEnabled && !checkResult.rows[0].phone) {
      return res.status(400).json({ 
        error: 'Für 2FA muss eine Telefonnummer hinterlegt sein' 
      });
    }
    
    // Update 2FA Status
    await query(
      `UPDATE handwerker 
       SET two_factor_enabled = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [req.params.id, twoFactorEnabled]
    );
    
    res.json({ 
      success: true,
      message: twoFactorEnabled 
        ? 'Zwei-Faktor-Authentifizierung wurde aktiviert' 
        : 'Zwei-Faktor-Authentifizierung wurde deaktiviert'
    });
    
  } catch (err) {
    console.error('2FA Update Fehler:', err);
    res.status(500).json({ 
      error: 'Änderung der Zwei-Faktor-Authentifizierung fehlgeschlagen' 
    });
  }
});

// Account löschen - MIT PASSWORT-BESTÄTIGUNG
app.delete('/api/handwerker/:id/account', async (req, res) => {
  try {
    const { password } = req.body;
    
    // Passwort ist erforderlich für Account-Löschung
    if (!password) {
      return res.status(400).json({ 
        error: 'Passwort zur Bestätigung erforderlich' 
      });
    }
    
    // Hole Passwort-Hash aus DB
    const result = await query(
      'SELECT password_hash, company_name FROM handwerker WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Account nicht gefunden' 
      });
    }
    
    // Prüfe Passwort
    const isPasswordValid = await bcryptjs.compare(
      password, 
      result.rows[0].password_hash
    );
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: 'Falsches Passwort. Account-Löschung abgebrochen.' 
      });
    }
    
    // Start Transaction für sichere Löschung
    await query('BEGIN');
    
    try {
      // Lösche zuerst alle abhängigen Daten
      await query('DELETE FROM handwerker_trades WHERE handwerker_id = $1', [req.params.id]);
      await query('DELETE FROM handwerker_insurances WHERE handwerker_id = $1', [req.params.id]);
      await query('DELETE FROM handwerker_certifications WHERE handwerker_id = $1', [req.params.id]);
      await query('DELETE FROM handwerker_documents WHERE handwerker_id = $1', [req.params.id]);
      
      // Optional: Soft Delete (markiere als gelöscht statt zu löschen)
      // await query(
      //   `UPDATE handwerker 
      //    SET deleted_at = CURRENT_TIMESTAMP,
      //        active = false,
      //        email = CONCAT(email, '_deleted_', $2)
      //    WHERE id = $1`,
      //   [req.params.id, Date.now()]
      // );
      
      // Hard Delete - endgültiges Löschen
      await query('DELETE FROM handwerker WHERE id = $1', [req.params.id]);
      
      await query('COMMIT');
      
      res.json({ 
        success: true, 
        message: `Account '${result.rows[0].company_name}' wurde erfolgreich gelöscht` 
      });
      
    } catch (innerErr) {
      await query('ROLLBACK');
      throw innerErr;
    }
    
  } catch (err) {
    console.error('Account-Löschung Fehler:', err);
    res.status(500).json({ 
      error: 'Account konnte nicht gelöscht werden' 
    });
  }
});

// Account-Einstellungen abrufen (für initiales Laden)
app.get('/api/handwerker/:id/account', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        two_factor_enabled,
        last_login,
        created_at,
        password_changed_at
       FROM handwerker 
       WHERE id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Handwerker nicht gefunden' 
      });
    }
    
    res.json({
      twoFactorEnabled: result.rows[0].two_factor_enabled || false,
      lastLogin: result.rows[0].last_login,
      createdAt: result.rows[0].created_at,
      passwordChangedAt: result.rows[0].password_changed_at
    });
    
  } catch (err) {
    console.error('Account-Daten Abruf Fehler:', err);
    res.status(500).json({ 
      error: 'Abrufen der Account-Daten fehlgeschlagen' 
    });
  }
});

// Allgemeine Settings-Route (für alle Tabs)
app.get('/api/handwerker/:id/settings', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        company_name,
        email,
        phone,
        street,
        house_number,
        zip_code,
        city,
        website,
        action_radius,
        two_factor_enabled,
        last_login,
        created_at,
        notification_settings
       FROM handwerker 
       WHERE id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Handwerker nicht gefunden' 
      });
    }
    
    const data = result.rows[0];
    const notificationSettings = data.notification_settings 
      ? JSON.parse(data.notification_settings) 
      : {};
    
    res.json({
      // Firmendaten
      companyName: data.company_name,
      email: data.email,
      phone: data.phone,
      street: data.street,
      houseNumber: data.house_number,
      zipCode: data.zip_code,
      city: data.city,
      website: data.website,
      
      // Einsatzgebiet
      actionRadius: data.action_radius,
      
      // Account
      twoFactorEnabled: data.two_factor_enabled || false,
      lastLogin: data.last_login,
      createdAt: data.created_at,
      
      // Benachrichtigungen
      emailNotifications: notificationSettings.email || true,
      smsNotifications: notificationSettings.sms || false,
      newsletterSubscribed: notificationSettings.newsletter || false,
      notificationEmail: notificationSettings.notificationEmail || data.email,
      notificationPhone: notificationSettings.notificationPhone || data.phone
    });
    
  } catch (err) {
    console.error('Settings Abruf Fehler:', err);
    res.status(500).json({ 
      error: 'Abrufen der Einstellungen fehlgeschlagen' 
    });
  }
});

// Logo upload
app.post('/api/handwerker/:id/logo', upload.single('logo'), async (req, res) => {
  try {
    const fileBuffer = req.file.buffer;
    
    await query(
      `UPDATE handwerker SET logo_url = $2 WHERE id = $1`,
      [req.params.id, `data:${req.file.mimetype};base64,${fileBuffer.toString('base64')}`]
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Logo-Upload fehlgeschlagen' });
  }
});

// Dokument hochladen
app.post('/api/handwerker/documents/upload', upload.single('document'), async (req, res) => {
  try {
    const handwerkerId = req.params.id;
    if (!handwerkerId) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }
    
    const { document_type } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }
    
    // Speichere in DB
    const result = await query(
      `INSERT INTO handwerker_documents 
       (handwerker_id, document_type, file_name, file_data, uploaded_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, document_type, file_name, uploaded_at`,
      [handwerkerId, document_type, file.originalname, file.buffer]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload fehlgeschlagen' });
  }
});

// Dokumente abrufen - KORRIGIERT
app.get('/api/handwerker/:id/documents', async (req, res) => {
  try {
    const handwerkerId = req.params.id; // :id aus der URL
    
    const result = await query(
      `SELECT id, document_type, file_name, uploaded_at
       FROM handwerker_documents
       WHERE handwerker_id = $1
       ORDER BY uploaded_at DESC`,
      [handwerkerId]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// Dokument hochladen - KORRIGIERT
app.post('/api/handwerker/:id/documents/upload', upload.single('document'), async (req, res) => {
  try {
    const handwerkerId = req.params.id; // :id aus der URL
    const { document_type } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }
    
    const result = await query(
      `INSERT INTO handwerker_documents 
       (handwerker_id, document_type, file_name, file_data, uploaded_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, document_type, file_name, uploaded_at`,
      [handwerkerId, document_type, file.originalname, file.buffer]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload fehlgeschlagen' });
  }
});

// Dokument herunterladen - KORRIGIERT
app.get('/api/handwerker/:handwerkerId/documents/:docId', async (req, res) => {
  try {
    const { handwerkerId, docId } = req.params;
    
    const result = await query(
      `SELECT file_name, file_data
       FROM handwerker_documents
       WHERE id = $1 AND handwerker_id = $2`,
      [docId, handwerkerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dokument nicht gefunden' });
    }
    
    const doc = result.rows[0];
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.file_name}"`);
    res.send(doc.file_data);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Download fehlgeschlagen' });
  }
});

// Dokument löschen - KORRIGIERT
app.delete('/api/handwerker/:handwerkerId/documents/:docId', async (req, res) => {
  try {
    const { handwerkerId, docId } = req.params;
    
    await query(
      'DELETE FROM handwerker_documents WHERE id = $1 AND handwerker_id = $2',
      [docId, handwerkerId]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Löschen fehlgeschlagen' });
  }
});

// ============= ERWEITERTE TENDER & TRACKING ROUTES =============

// Ausschreibungs-Status tracken
app.post('/api/tenders/:tenderId/track-view', async (req, res) => {
  try {
    const { tenderId } = req.params;
    const { handwerkerId } = req.body;
    
    await query(
      `UPDATE tender_handwerker 
       SET viewed_at = COALESCE(viewed_at, NOW()), status = 'viewed'
       WHERE tender_id = $1 AND handwerker_id = $2`,
      [tenderId, handwerkerId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({ error: 'Fehler beim Tracking' });
  }
});

// Ausschreibungs-Status auf "in Bearbeitung" setzen
app.post('/api/tenders/:tenderId/start-offer', async (req, res) => {
  try {
    const { tenderId } = req.params;
    const { handwerkerId } = req.body;
    
    await query(
      `UPDATE tender_handwerker_status 
       SET status = 'in_progress', in_progress_at = NOW()
       WHERE tender_id = $1 AND handwerker_id = $2`,
      [tenderId, handwerkerId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Fehler beim Status-Update' });
  }
});

// Erweiterte Route für Handwerker-Tenders mit Status
app.get('/api/handwerker/:handwerkerId/tenders/detailed', async (req, res) => {
  try {
    const { handwerkerId } = req.params;
    
    const result = await query(
      `SELECT DISTINCT ON (t.id)
        t.*,
        tr.name as trade_name,
        p.description as project_description,
        p.category,
        p.sub_category,
        p.zip_code as project_zip,
        p.city as project_city,
        ths.status as tender_status,
        ths.viewed_at,
        th.status as th_status,  -- NEU: Status aus tender_handwerker
        o.id as offer_id,
        o.status as offer_status,
        o.stage as offer_stage
       FROM tenders t
       JOIN trades tr ON t.trade_id = tr.id
       JOIN projects p ON t.project_id = p.id
       JOIN tender_handwerker th ON t.id = th.tender_id AND th.handwerker_id = $1  -- NEU
       LEFT JOIN tender_handwerker_status ths ON t.id = ths.tender_id AND ths.handwerker_id = $1
       LEFT JOIN offers o ON t.id = o.tender_id AND o.handwerker_id = $1
       WHERE t.trade_id IN (SELECT trade_id FROM handwerker_trades WHERE handwerker_id = $1)
       AND t.status = 'open'
       AND th.status != 'rejected'  -- NEU: Keine abgelehnten
       AND o.id IS NULL  -- NEU: Keine mit Angeboten (statt der komplexen OR Bedingung)
       ORDER BY t.id, t.created_at DESC`,
      [handwerkerId]
    );
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching detailed tenders:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Ausschreibungen' });
  }
});

// Angebote als gelesen markieren
app.post('/api/projects/:projectId/offers/mark-all-read', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    await query(
      `UPDATE offers o
       SET viewed_at = NOW()
       FROM tenders t
       WHERE o.tender_id = t.id 
       AND t.project_id = $1 
       AND o.viewed_at IS NULL`,
      [projectId]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Markieren' });
  }
});

// Fehlende Route: LV-Daten für Projekt
app.get('/api/projects/:projectId/lv', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const result = await query(
      `SELECT l.*, t.name as trade_name, t.code as trade_code
       FROM lvs l
       JOIN trades t ON l.trade_id = t.id
       WHERE l.project_id = $1
       ORDER BY t.name`,
      [projectId]
    );
    
    res.json({ 
      lvs: result.rows.map(lv => ({
        ...lv,
        content: typeof lv.content === 'string' ? JSON.parse(lv.content) : lv.content
      }))
    });
    
  } catch (error) {
    console.error('Error fetching LVs:', error);
    res.status(500).json({ error: 'Fehler beim Laden der LVs' });
  }
});

// Fehlende Route: Projekt mit Bauherr verknüpfen
app.post('/api/projects/claim', async (req, res) => {
  try {
    const { projectId, bauherrId } = req.body;
    
    await query(
      `UPDATE projects 
       SET bauherr_id = $2, updated_at = NOW()
       WHERE id = $1`,
      [projectId, bauherrId]
    );
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error claiming project:', error);
    res.status(500).json({ error: 'Fehler bei der Projektzuweisung' });
  }
});

// LV-Status für Dashboard
app.get('/api/projects/:projectId/lv-status', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const result = await query(
      `SELECT 
        COUNT(DISTINCT pt.trade_id) as total_trades,
        COUNT(DISTINCT CASE 
          WHEN l.content IS NOT NULL AND l.content::text != '{}' 
          THEN l.trade_id 
        END) as completed_lvs,
        COUNT(DISTINCT CASE 
          WHEN pt.trade_id = (SELECT id FROM trades WHERE code = 'INT')
          THEN pt.trade_id 
        END) as internal_trades
       FROM project_trades pt
       LEFT JOIN lvs l ON pt.project_id = l.project_id AND pt.trade_id = l.trade_id
       WHERE pt.project_id = $1`,
      [projectId]
    );
    
    const status = result.rows[0];
    // INT-Trade von der Gesamtzahl abziehen
    status.total_trades = status.total_trades - status.internal_trades;
    
    res.json(status);
    
  } catch (error) {
    console.error('Error fetching LV status:', error);
    res.status(500).json({ error: 'Fehler beim Laden des LV-Status' });
  }
});

// Helper-Funktion (fehlte)
async function getHandwerkerIdFromCompanyId(companyId) {
  const result = await query(
    'SELECT id FROM handwerker WHERE company_id = $1',
    [companyId]
  );
  return result.rows.length > 0 ? result.rows[0].id : null;
}

// ============= TERMINVEREINBARUNGS-ROUTES =============

// Angebotsdaten mit Kontaktinfos für Ortstermin
app.get('/api/offers/:offerId/details', async (req, res) => {
  try {
    const { offerId } = req.params;
    
    const result = await query(
      `SELECT 
        o.*,
        h.company_name,
        h.email as handwerker_email,
        h.phone as handwerker_phone,
        h.contact_person,
        b.name as bauherr_name,
        b.email as bauherr_email,
        b.phone as bauherr_phone,
        p.street as project_street,
        p.house_number as project_house_number,
        p.zip_code as project_zip,
        p.city as project_city,
        p.description as project_description,
        t.name as trade_name
       FROM offers o
       JOIN handwerker h ON o.handwerker_id = h.id
       JOIN tenders tn ON o.tender_id = tn.id
       JOIN projects p ON tn.project_id = p.id
       JOIN bauherren b ON p.bauherr_id = b.id
       JOIN trades t ON tn.trade_id = t.id
       WHERE o.id = $1`,
      [offerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Angebot nicht gefunden' });
    }
    
    res.json(result.rows[0]);
    
  } catch (error) {
    console.error('Error fetching offer details:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Details' });
  }
});

// Terminvorschläge abrufen
app.get('/api/offers/:offerId/appointments', async (req, res) => {
  try {
    const { offerId } = req.params;
    
    const result = await query(
      `SELECT * FROM appointment_proposals 
       WHERE offer_id = $1 
       ORDER BY created_at DESC`,
      [offerId]
    );
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Termine' });
  }
});

// Neuen Terminvorschlag erstellen
app.post('/api/offers/:offerId/appointments/propose', async (req, res) => {
  try {
    const { offerId } = req.params;
    const { proposed_by, proposed_date, duration, message } = req.body;
    
    const result = await query(
      `INSERT INTO appointment_proposals 
       (offer_id, proposed_by, proposed_date, proposed_duration, message, status)
       VALUES ($1, $2, $3, $4, $5, 'proposed')
       RETURNING id`,
      [offerId, proposed_by, proposed_date, duration, message]
    );
    
    // Benachrichtigung erstellen
const offerData = await query(
  `SELECT o.*, tn.project_id, h.id as handwerker_id, h.email as handwerker_email, 
   h.company_name, p.bauherr_id, b.email as bauherr_email, b.name as bauherr_name,
   p.street, p.house_number, p.zip_code, p.city, t.name as trade_name
   FROM offers o
   JOIN tenders tn ON o.tender_id = tn.id
   JOIN handwerker h ON o.handwerker_id = h.id
   JOIN projects p ON tn.project_id = p.id
   JOIN bauherren b ON p.bauherr_id = b.id
   JOIN trades t ON tn.trade_id = t.id
   WHERE o.id = $1`,
  [offerId]
);

if (offerData.rows.length > 0) {
  const offer = offerData.rows[0];
  const recipient_type = proposed_by === 'bauherr' ? 'handwerker' : 'bauherr';
  const recipient_id = proposed_by === 'bauherr' ? offer.handwerker_id : offer.bauherr_id;
  const recipient_email = proposed_by === 'bauherr' ? offer.handwerker_email : offer.bauherr_email;
  const recipient_name = proposed_by === 'bauherr' ? offer.company_name : offer.bauherr_name;
  const sender_name = proposed_by === 'bauherr' ? offer.bauherr_name : offer.company_name;
  
  // Notification in DB
  await query(
    `INSERT INTO notifications 
     (user_type, user_id, type, reference_id, message, created_at)
     VALUES ($1, $2, 'appointment_request', $3, $4, NOW())`,
    [recipient_type, recipient_id, result.rows[0].id, 
     `Neuer Terminvorschlag für Ortstermin`]
  );
  
  // EMAIL-VERSAND
  if (transporter && recipient_email) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"byndl" <info@byndl.de>',
        to: recipient_email,
        subject: `Terminvorschlag für Ortstermin - ${offer.trade_name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0;">
              <h1>Neuer Terminvorschlag</h1>
            </div>
            
            <div style="padding: 30px; background: #f7f7f7;">
              <p>Hallo ${recipient_name},</p>
              
              <p><strong>${sender_name}</strong> hat einen Terminvorschlag für einen Ortstermin gemacht:</p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #667eea;">Termindetails:</h3>
                <table style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0;"><strong>Datum/Zeit:</strong></td>
                    <td>${new Date(proposed_date).toLocaleString('de-DE', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Dauer:</strong></td>
                    <td>${duration} Minuten</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Projekt:</strong></td>
                    <td>${offer.trade_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Adresse:</strong></td>
                    <td>${offer.street} ${offer.house_number}, ${offer.zip_code} ${offer.city}</td>
                  </tr>
                  ${message ? `
                  <tr>
                    <td style="padding: 8px 0; vertical-align: top;"><strong>Nachricht:</strong></td>
                    <td>${message}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>
              
              <p><strong>Was möchten Sie tun?</strong></p>
              <p>Bitte melden Sie sich in Ihrem Dashboard an, um den Termin zu bestätigen oder einen alternativen Termin vorzuschlagen.</p>
              
              <div style="text-align: center; margin-top: 30px;">
                <a href="https://byndl.de/${recipient_type}/dashboard" 
                   style="display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px;">
                  Zum Dashboard →
                </a>
              </div>
              
              <div style="margin-top: 30px; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                <strong>Hinweis:</strong> Sie befinden sich in der Vertragsanbahnung. 
                Die Kontaktdaten wurden bereits freigegeben und die 24-monatige Nachwirkfrist ist aktiv.
              </div>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #666; font-size: 12px; background: #e9ecef;">
              <p>© 2025 byndl - Die digitale Handwerkerplattform</p>
            </div>
          </div>
        `
      });
      
      // Email-Log
      await query(
        `INSERT INTO email_logs (recipient, type, reference_id, status, sent_at)
         VALUES ($1, 'appointment_proposal', $2, 'sent', NOW())`,
        [recipient_email, result.rows[0].id]
      );
    } catch (emailError) {
      console.error('Email-Versand fehlgeschlagen:', emailError);
    }
  }
}
    
    res.json({ success: true, id: result.rows[0].id });
    
  } catch (error) {
    console.error('Error proposing appointment:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Terminvorschlags' });
  }
});

// Auf Terminvorschlag antworten
app.post('/api/appointments/:appointmentId/respond', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { response } = req.body; // 'accepted' oder 'rejected'
    
    await query(
      `UPDATE appointment_proposals 
       SET status = $2, responded_at = NOW()
       WHERE id = $1`,
      [appointmentId, response]
    );
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error responding to appointment:', error);
    res.status(500).json({ error: 'Fehler beim Antworten' });
  }
});

// ============= ERWEITERTE LV-ROUTES FÜR TENDER =============

// LV-Daten für Tender (für HandwerkerOfferPage)
app.get('/api/tenders/:tenderId/lv', async (req, res) => {
  try {
    const { tenderId } = req.params;
    
    const result = await query(
      `SELECT 
        t.lv_data,
        t.project_id,
        t.trade_id,
        tr.name as trade_name,
        p.description as project_description
      FROM tenders t
      JOIN trades tr ON t.trade_id = tr.id
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = $1`,
      [tenderId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ausschreibung nicht gefunden' });
    }
    
    const tender = result.rows[0];
    const lv = typeof tender.lv_data === 'string' 
      ? JSON.parse(tender.lv_data) 
      : tender.lv_data;
    
    // Preise entfernen für Handwerker-Ansicht
    const lvWithoutPrices = {
      ...lv,
      positions: lv.positions?.map(pos => ({
        ...pos,
        unitPrice: 0,
        totalPrice: 0
      })) || []
    };
    
    res.json({
      tenderId,
      projectId: tender.project_id,
      tradeId: tender.trade_id,
      tradeName: tender.trade_name,
      projectDescription: tender.project_description,
      lv: lvWithoutPrices
    });
    
  } catch (error) {
    console.error('Error fetching tender LV:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des LV' });
  }
});

// Handwerker kann Ausschreibung ablehnen/ausblenden
app.post('/api/tenders/:tenderId/reject', async (req, res) => {
  try {
    const { tenderId } = req.params;
    const { handwerkerId } = req.body;
    
    await query(
      `UPDATE tender_handwerker 
       SET status = 'rejected', 
           rejected_at = NOW()
       WHERE tender_id = $1 AND handwerker_id = $2`,
      [tenderId, handwerkerId]
    );
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error rejecting tender:', error);
    res.status(500).json({ error: 'Fehler beim Ablehnen' });
  }
});

// ============= ANGEBOTS-STATUS-VERWALTUNG =============

// Erweiterte Angebots-Submission mit Phasen-Management
app.post('/api/tenders/:tenderId/submit-offer', async (req, res) => {
  try {
    const { tenderId } = req.params;
    const { handwerkerId, positions, notes, totalSum, stage = 'preliminary' } = req.body;
    
    await query('BEGIN');
    
    // Update tender-handwerker status
    await query(
      `UPDATE tender_handwerker_status 
       SET status = 'submitted', submitted_at = NOW()
       WHERE tender_id = $1 AND handwerker_id = $2`,
      [tenderId, handwerkerId]
    );
    
    // Prüfen ob bereits ein Angebot existiert
    const existingOffer = await query(
      'SELECT id FROM offers WHERE tender_id = $1 AND handwerker_id = $2',
      [tenderId, handwerkerId]
    );
    
    let offerId;
    
    if (existingOffer.rows.length > 0) {
      offerId = existingOffer.rows[0].id;
      
      await query(
        `UPDATE offers 
         SET lv_data = $1, notes = $2, amount = $3, stage = $4, updated_at = NOW()
         WHERE id = $5`,
        [JSON.stringify(positions), notes, totalSum, stage, offerId]
      );
    } else {
      const result = await query(
        `INSERT INTO offers (
          tender_id, handwerker_id, amount, 
          lv_data, notes, status, stage, created_at
        ) VALUES ($1, $2, $3, $4, $5, 'submitted', $6, NOW())
        RETURNING id`,
        [tenderId, handwerkerId, totalSum, JSON.stringify(positions), notes, stage]
      );
      offerId = result.rows[0].id;
    }
    
    // Benachrichtigung für Bauherr
    const tenderInfo = await query(
      `SELECT project_id FROM tenders WHERE id = $1`,
      [tenderId]
    );
    
    if (tenderInfo.rows.length > 0) {
      const projectInfo = await query(
        `SELECT bauherr_id FROM projects WHERE id = $1`,
        [tenderInfo.rows[0].project_id]
      );
      
      if (projectInfo.rows.length > 0) {
        await query(
          `INSERT INTO notifications 
           (user_type, user_id, type, reference_id, message)
           VALUES ('bauherr', $1, 'new_offer', $2, 'Neues Angebot eingegangen')`,
          [projectInfo.rows[0].bauherr_id, offerId]
        );
      }
    }
    
    await query('COMMIT');
    
    res.json({ 
      success: true, 
      offerId,
      message: stage === 'preliminary' ? 
        'Vorläufiges Angebot abgegeben. Der Bauherr kann nun Kontakt aufnehmen.' :
        'Verbindliches Angebot abgegeben.'
    });
  } catch (error) {
    await query('ROLLBACK');
    console.error('Error submitting offer:', error);
    res.status(500).json({ error: 'Fehler beim Abgeben des Angebots' });
  }
});

// ADMIN ROUTES - COMPLETE DASHBOARD API
// ===========================================================================

// Simple token storage (in production, use Redis or database)
const activeSessions = new Map();

// Generate random token
function generateToken() {
  return require('crypto').randomBytes(32).toString('hex');
}

// Simple admin authentication without bcrypt
app.post('/api/admin/auth', async (req, res) => {
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

// Logout endpoint
app.post('/api/admin/logout', requireAdmin, async (req, res) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    activeSessions.delete(token);
  }
  res.json({ message: 'Logout successful' });
});

// ===========================================================================
// DASHBOARD OVERVIEW STATS
// ===========================================================================

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    // Get total users
    const userStats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM bauherren) as bauherren_count,
        (SELECT COUNT(*) FROM handwerker) as handwerker_count
    `);
    
    // Get project stats
    const projectStats = await query(`
      SELECT 
        COUNT(*) as total_projects,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_projects,
        SUM(budget) as total_value
      FROM projects
    `);
    
    // Get payment stats
    const paymentStats = await query(`
      SELECT 
        SUM(CASE WHEN status = 'completed' THEN amount END) as total_revenue,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments
      FROM payments
    `);
    
    // Get order stats
    const orderStats = await query(`
      SELECT COUNT(CASE WHEN status = 'active' THEN 1 END) as active_orders
      FROM orders
    `);
    
    // Get verification queue
    const verificationStats = await query(`
      SELECT COUNT(*) as verification_queue
      FROM handwerker
      WHERE verified = false OR verification_status = 'pending'
    `);
    
    const totalUsers = parseInt(userStats.rows[0].bauherren_count || 0) + 
                      parseInt(userStats.rows[0].handwerker_count || 0);
    
    res.json({
      totalUsers: totalUsers,
      totalProjects: parseInt(projectStats.rows[0].total_projects || 0),
      totalRevenue: parseFloat(paymentStats.rows[0].total_revenue || 0),
      activeOrders: parseInt(orderStats.rows[0].active_orders || 0),
      pendingPayments: parseInt(paymentStats.rows[0].pending_payments || 0),
      verificationQueue: parseInt(verificationStats.rows[0].verification_queue || 0)
    });
  } catch (err) {
    console.error('Failed to fetch stats:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ===========================================================================
// USER MANAGEMENT
// ===========================================================================

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    // Bauherren - hat sowohl zip als auch zip_code
    const bauherrenResult = await query(`
      SELECT 
        b.id,
        b.name,
        b.email,
        b.phone,
        b.street,
        b.house_number,
        b.zip,  -- Verwende zip (existiert in der Tabelle)
        b.city,
        b.created_at,
        COUNT(DISTINCT p.id) as project_count
      FROM bauherren b
      LEFT JOIN projects p ON p.bauherr_id = b.id
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `);
    
    // Handwerker - hat zip_code
    const handwerkerResult = await query(`
      SELECT 
        h.id,
        h.company_name,
        h.company_id,
        h.contact_person,
        h.email,
        h.phone,
        h.street,
        h.house_number,
        h.zip_code,  -- Korrekt: zip_code
        h.city,
        h.verified,
        h.verification_status,
        h.created_at,
        STRING_AGG(ht.trade_name, ', ' ORDER BY ht.trade_name) as trades
      FROM handwerker h
      LEFT JOIN handwerker_trades ht ON ht.handwerker_id = h.id
      GROUP BY h.id
      ORDER BY h.created_at DESC
    `);
    
    res.json({
      bauherren: bauherrenResult.rows,
      handwerker: handwerkerResult.rows
    });
  } catch (err) {
    console.error('Failed to fetch users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Admin: Handwerker löschen
app.delete('/api/admin/handwerker/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await query('BEGIN');
    
    // Zuerst contract_negotiations löschen (verweisen auf offers)
    await query(`
      DELETE FROM contract_negotiations 
      WHERE offer_id IN (SELECT id FROM offers WHERE handwerker_id = $1)
    `, [id]);
    
    // Alle Tabellen löschen, die direkt auf handwerker verweisen
    await query('DELETE FROM handwerker_insurances WHERE handwerker_id = $1', [id]);
    await query('DELETE FROM handwerker_certifications WHERE handwerker_id = $1', [id]);
    await query('DELETE FROM handwerker_references WHERE handwerker_id = $1', [id]);
    await query('DELETE FROM email_logs WHERE handwerker_id = $1', [id]);
    await query('DELETE FROM login_attempts WHERE handwerker_id = $1', [id]);
    await query('DELETE FROM tender_handwerker WHERE handwerker_id = $1', [id]);
    await query('DELETE FROM tender_tracking WHERE handwerker_id = $1', [id]);
    await query('DELETE FROM tender_handwerker_status WHERE handwerker_id = $1', [id]);
    await query('DELETE FROM offers WHERE handwerker_id = $1', [id]);
    await query('DELETE FROM handwerker_trades WHERE handwerker_id = $1', [id]);
    await query('DELETE FROM handwerker_documents WHERE handwerker_id = $1', [id]);
    await query('DELETE FROM orders WHERE handwerker_id = $1', [id]);
    
    // Zum Schluss Handwerker löschen
    await query('DELETE FROM handwerker WHERE id = $1', [id]);
    
    await query('COMMIT');
    
    res.json({ success: true, message: 'Handwerker gelöscht' });
    
  } catch (error) {
    await query('ROLLBACK');
    console.error('Error deleting handwerker:', error);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// Admin: Bauherr löschen
app.delete('/api/admin/bauherren/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await query('BEGIN');
    
    // Hole alle Projekte des Bauherrn
    const projects = await query('SELECT id FROM projects WHERE bauherr_id = $1', [id]);
    
    for (const project of projects.rows) {
      const projectId = project.id;
      
      // Lösche alle tenders und deren abhängige Daten
      const tenders = await query('SELECT id FROM tenders WHERE project_id = $1', [projectId]);
      
      for (const tender of tenders.rows) {
        const tenderId = tender.id;
        
        // Lösche offers für diesen tender
        const offers = await query('SELECT id FROM offers WHERE tender_id = $1', [tenderId]);
        
        for (const offer of offers.rows) {
          // Lösche contract_negotiations für dieses offer
          await query('DELETE FROM contract_negotiations WHERE offer_id = $1', [offer.id]);
        }
        
        // Lösche offers
        await query('DELETE FROM offers WHERE tender_id = $1', [tenderId]);
        
        // Lösche tender_handwerker und tender_handwerker_status
        await query('DELETE FROM tender_handwerker WHERE tender_id = $1', [tenderId]);
        await query('DELETE FROM tender_handwerker_status WHERE tender_id = $1', [tenderId]);
        await query('DELETE FROM tender_tracking WHERE tender_id = $1', [tenderId]);
      }
      
      // WICHTIG: questions ZUERST löschen (vor project_trades!)
      await query('DELETE FROM questions WHERE project_id = $1', [projectId]);
      
      // Dann alle anderen project-abhängigen Daten
      await query('DELETE FROM answers WHERE project_id = $1', [projectId]);
      await query('DELETE FROM bundle_projects WHERE project_id = $1', [projectId]);
      await query('DELETE FROM intake_responses WHERE project_id = $1', [projectId]);
      await query('DELETE FROM lv_items WHERE project_id = $1', [projectId]);
      await query('DELETE FROM lv_snapshots WHERE project_id = $1', [projectId]);
      await query('DELETE FROM lvs WHERE project_id = $1', [projectId]);
      await query('DELETE FROM orders WHERE project_id = $1', [projectId]);
      await query('DELETE FROM payments WHERE project_id = $1', [projectId]);
      await query('DELETE FROM project_answers WHERE project_id = $1', [projectId]);
      await query('DELETE FROM project_logs WHERE project_id = $1', [projectId]);
      await query('DELETE FROM project_optimizations WHERE project_id = $1', [projectId]);
      await query('DELETE FROM project_trades WHERE project_id = $1', [projectId]);
      await query('DELETE FROM schedules WHERE project_id = $1', [projectId]);
      await query('DELETE FROM tenders WHERE project_id = $1', [projectId]);
      await query('DELETE FROM trade_optimizations WHERE project_id = $1', [projectId]);
      await query('DELETE FROM trade_progress WHERE project_id = $1', [projectId]);
    }
    
    // Lösche alle Projekte
    await query('DELETE FROM projects WHERE bauherr_id = $1', [id]);
    
    // Lösche email_logs
    await query('DELETE FROM email_logs WHERE bauherr_id = $1', [id]);
    
    // Lösche Bauherr
    await query('DELETE FROM bauherren WHERE id = $1', [id]);
    
    await query('COMMIT');
    
    res.json({ success: true, message: 'Bauherr gelöscht' });
    
  } catch (error) {
    await query('ROLLBACK');
    console.error('Error deleting bauherr:', error);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// ===========================================================================
// PROJECT MANAGEMENT
// ===========================================================================

app.get('/api/admin/projects', requireAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        p.id,
        p.category,
        p.sub_category,
        p.description,
        p.budget,
        p.timeframe,
        p.created_at,
        p.metadata,  -- Enthält vermutlich die Adressdaten
        b.name as bauherr_name,
        COUNT(DISTINCT pt.trade_id) as trade_count
      FROM projects p
      LEFT JOIN bauherren b ON b.id = p.bauherr_id
      LEFT JOIN project_trades pt ON pt.project_id = p.id
      GROUP BY p.id, b.name
      ORDER BY p.created_at DESC
    `);
    
    res.json({ projects: result.rows });
  } catch (err) {
    console.error('Failed to fetch projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// ===========================================================================
// PAYMENT MANAGEMENT
// ===========================================================================

app.get('/api/admin/payments', requireAdmin, async (req, res) => {
  try {
    // payments hat: id, project_id, amount, payment_type, status, stripe_payment_id, created_at
    const result = await query(`
      SELECT 
        p.id,
        p.project_id,
        p.amount,
        p.payment_type,
        p.status,
        p.stripe_payment_id,
        p.created_at,
        pr.description as project_description,
        pr.category as project_category,
        b.name as bauherr_name,
        b.email as bauherr_email
      FROM payments p
      LEFT JOIN projects pr ON pr.id = p.project_id
      LEFT JOIN bauherren b ON b.id = pr.bauherr_id
      ORDER BY p.created_at DESC
    `);
    
    res.json({ payments: result.rows });
  } catch (err) {
    console.error('Failed to fetch payments:', err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

app.put('/api/admin/payments/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const result = await query(
      `UPDATE payments 
       SET status = $1  -- KEIN updated_at, da Spalte nicht existiert
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    
    res.json({ payment: result.rows[0] });
  } catch (err) {
    console.error('Failed to update payment:', err);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// ===========================================================================
// VERIFICATION MANAGEMENT
// ===========================================================================

app.get('/api/admin/verifications', requireAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        h.id,
        h.company_name,
        h.email,
        h.phone,
        h.street,
        h.house_number,
        h.zip_code,
        h.city,
        h.verified,
        h.created_at,
        STRING_AGG(t.name, ', ' ORDER BY t.name) as trades,
        ARRAY_AGG(
          json_build_object(
            'type', 'Gewerbeschein',
            'url', h.gewerbeschein_url
          )
        ) as documents
      FROM handwerker h
      LEFT JOIN handwerker_trades ht ON ht.handwerker_id = h.id
      LEFT JOIN trades t ON t.id = ht.trade_id
      WHERE h.verified = false
      GROUP BY h.id
      ORDER BY h.created_at DESC
    `);
    
    res.json({ verifications: result.rows });
  } catch (err) {
    console.error('Failed to fetch verifications:', err);
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
});

app.put('/api/admin/verifications/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    
    const result = await query(
      `UPDATE handwerker 
       SET verified = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [approved, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Handwerker not found' });
    }
    
    res.json({ handwerker: result.rows[0] });
  } catch (err) {
    console.error('Failed to update verification:', err);
    res.status(500).json({ error: 'Failed to update verification' });
  }
});

// ===========================================================================
// ORDER MANAGEMENT
// ===========================================================================

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    // orders hat: id, offer_id, project_id, handwerker_id, status, progress, is_bundle, created_at, trade_id
    const result = await query(`
      SELECT 
        o.id,
        o.offer_id,
        o.project_id,
        o.handwerker_id,
        o.status,
        o.progress,
        o.is_bundle,
        o.created_at,
        o.trade_id,
        pr.description as project_description,
        h.company_name as handwerker_name,
        t.name as trade_name,
        of.amount as total  -- Hole amount aus offers Tabelle
      FROM orders o
      LEFT JOIN projects pr ON pr.id = o.project_id
      LEFT JOIN handwerker h ON h.id = o.handwerker_id
      LEFT JOIN trades t ON t.id = o.trade_id
      LEFT JOIN offers of ON of.id = o.offer_id
      ORDER BY o.created_at DESC
    `);
    
    res.json({ orders: result.rows });
  } catch (err) {
    console.error('Failed to fetch orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ===========================================================================
// TENDER MANAGEMENT
// ===========================================================================

app.get('/api/admin/tenders', requireAdmin, async (req, res) => {
  try {
    // Da tenders nicht in der Liste war, prüfen wir ob sie existiert
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tenders'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      // Erstelle tenders Tabelle
      await query(`
        CREATE TABLE tenders (
          id SERIAL PRIMARY KEY,
          project_id INTEGER REFERENCES projects(id),
          trade_id INTEGER REFERENCES trades(id),
          trade_code VARCHAR(10),
          status VARCHAR(50) DEFAULT 'open',
          deadline TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Created tenders table');
    }
    
    // Hole tenders mit offers count
    const result = await query(`
      SELECT 
        t.id,
        t.project_id,
        t.trade_id,
        t.trade_code,
        t.status,
        t.deadline,
        t.created_at,
        pr.description as project_description,
        tr.name as trade_name,
        COUNT(o.id) as offer_count
      FROM tenders t
      LEFT JOIN projects pr ON pr.id = t.project_id
      LEFT JOIN trades tr ON tr.id = t.trade_id OR tr.code = t.trade_code
      LEFT JOIN offers o ON o.tender_id = t.id
      GROUP BY t.id, pr.description, tr.name
      ORDER BY t.created_at DESC
    `);
    
    res.json({ tenders: result.rows });
  } catch (err) {
    console.error('Failed to fetch tenders:', err);
    res.status(500).json({ error: 'Failed to fetch tenders' });
  }
});

// ===========================================================================
// SUPPLEMENT MANAGEMENT
// ===========================================================================

app.get('/api/admin/supplements', requireAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        s.id,
        s.order_id,
        s.reason,
        s.amount,
        s.status,
        s.created_at
      FROM supplements s
      ORDER BY s.created_at DESC
    `);
    
    res.json({ supplements: result.rows });
  } catch (err) {
    console.error('Failed to fetch supplements:', err);
    res.status(500).json({ error: 'Failed to fetch supplements' });
  }
});

// Pending Handwerker abrufen
app.get('/api/admin/pending-handwerker', requireAdmin, async (req, res) => {
  try {
    // Nutze verification_status oder verified=false
    const result = await query(`
      SELECT 
        h.id,
        h.company_name,
        h.company_id,
        h.contact_person,
        h.email,
        h.phone,
        h.street,
        h.house_number,
        h.zip_code,
        h.city,
        h.created_at,
        h.verified,
        h.verification_status,
        array_agg(DISTINCT ht.trade_code) as trades,
        array_agg(DISTINCT ht.trade_name) as trade_names
      FROM handwerker h
      LEFT JOIN handwerker_trades ht ON h.id = ht.handwerker_id
      WHERE h.verified = false OR h.verification_status = 'pending'
      GROUP BY h.id
      ORDER BY h.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending handwerker:', err);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// Handwerker verifizieren, ablehnen oder löschen
// Diese Route ersetzt die komplette app.post('/api/admin/verify-handwerker/:id' Route in server.js
app.post('/api/admin/verify-handwerker/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // action: 'approve', 'reject', 'delete'
    
    // Hole Handwerker-Details
    const handwerkerResult = await query(
      `SELECT company_name, contact_person, email, company_id 
       FROM handwerker 
       WHERE id = $1`,
      [id]
    );
    
    if (handwerkerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Handwerker nicht gefunden' });
    }
    
    const handwerker = handwerkerResult.rows[0];
    
    switch(action) {
      case 'approve':
        // === GENEHMIGUNG ===
        let finalId = handwerker.company_id;
        
        if (!finalId || finalId === 'PENDING') {
          const year = new Date().getFullYear();
          const random = Math.floor(Math.random() * 9000) + 1000;
          finalId = `HW-${year}-${random}`;
        }
        
        await query(
          `UPDATE handwerker 
           SET verified = true,
               verification_status = 'verified',
               company_id = $2,
               verified_at = NOW(),
               rejection_reason = NULL
           WHERE id = $1`,
          [id, finalId]
        );
        
        // Bestätigungs-E-Mail
        if (transporter) {
          try {
            await transporter.sendMail({
              to: handwerker.email,
              subject: 'Ihre Registrierung bei byndl wurde bestätigt',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px;">
                  <h2 style="color: #14b8a6;">Willkommen bei byndl!</h2>
                  <p>Sehr geehrte/r ${handwerker.contact_person},</p>
                  <p>Ihre Registrierung für <strong>${handwerker.company_name}</strong> wurde erfolgreich verifiziert.</p>
                  <p><strong>Ihre Handwerker-ID:</strong> ${finalId}</p>
                  <p>Sie können sich nun in Ihr Dashboard einloggen und auf Ausschreibungen zugreifen.</p>
                  <a href="https://byndl.de/handwerker/login" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #14b8a6; color: white; text-decoration: none; border-radius: 6px;">Zum Dashboard</a>
                </div>
              `
            });
            console.log(`Bestätigungs-E-Mail gesendet an: ${handwerker.email}`);
          } catch (emailError) {
            console.log('E-Mail-Versand fehlgeschlagen:', emailError.message);
          }
        }
        
        console.log(`Handwerker ${id} (${handwerker.company_name}) genehmigt mit ID: ${finalId}`);
        res.json({ 
          success: true, 
          message: 'Handwerker erfolgreich verifiziert',
          handwerkerId: finalId
        });
        break;
        
      case 'reject':
        // === ABLEHNUNG MIT BEGRÜNDUNG (NICHT LÖSCHEN) ===
        if (!reason || reason.trim() === '') {
          return res.status(400).json({ error: 'Begründung für Ablehnung erforderlich' });
        }
        
        await query(
          `UPDATE handwerker 
           SET verified = false,
               verification_status = 'rejected',
               rejection_reason = $2
           WHERE id = $1`,
          [id, reason]
        );
        
        // Ablehnungs-E-Mail mit Begründung
        if (transporter) {
          try {
            await transporter.sendMail({
              to: handwerker.email,
              subject: 'Ihre Registrierung bei byndl - Nachbesserung erforderlich',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px;">
                  <h2 style="color: #dc2626;">Nachbesserung erforderlich</h2>
                  <p>Sehr geehrte/r ${handwerker.contact_person},</p>
                  <p>Ihre Registrierung für <strong>${handwerker.company_name}</strong> konnte noch nicht genehmigt werden.</p>
                  
                  <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Grund:</strong></p>
                    <p>${reason}</p>
                  </div>
                  
                  <h3>Was können Sie tun?</h3>
                  <p>Bitte beheben Sie die genannten Punkte und ergänzen Sie Ihre Unterlagen entsprechend. 
                     Sie können die fehlenden Dokumente in Ihrem Dashboard hochladen.</p>
                  
                  <a href="https://byndl.de/handwerker/login" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #14b8a6; color: white; text-decoration: none; border-radius: 6px;">Zum Dashboard</a>
                  
                  <p style="margin-top: 30px; color: #666;">Bei Fragen wenden Sie sich an: verifizierung@byndl.de</p>
                </div>
              `
            });
            console.log(`Ablehnungs-E-Mail gesendet an: ${handwerker.email}`);
          } catch (emailError) {
            console.log('E-Mail-Versand fehlgeschlagen:', emailError.message);
          }
        }
        
        console.log(`Handwerker ${id} (${handwerker.company_name}) abgelehnt. Grund: ${reason}`);
        res.json({ 
          success: true, 
          message: 'Handwerker wurde zur Nachbesserung aufgefordert',
          reason: reason
        });
        break;
        
      case 'delete':
        // === VOLLSTÄNDIGE LÖSCHUNG (NUR BEI VÖLLIG UNGEEIGNET) ===
        console.log(`LÖSCHE Handwerker ${id} (${handwerker.company_name}) vollständig...`);
        
        // Lösche alle abhängigen Einträge
        await query('DELETE FROM handwerker_trades WHERE handwerker_id = $1', [id])
          .catch(() => {});
        await query('DELETE FROM handwerker_documents WHERE handwerker_id = $1', [id])
          .catch(() => {});
        await query('DELETE FROM handwerker_certifications WHERE handwerker_id = $1', [id])
          .catch(() => {});
        await query('DELETE FROM handwerker_insurances WHERE handwerker_id = $1', [id])
          .catch(() => {});
        await query('DELETE FROM offers WHERE handwerker_id = $1', [id])
          .catch(() => {});
        await query('DELETE FROM orders WHERE handwerker_id = $1', [id])
          .catch(() => {});
        
        // Lösche den Handwerker selbst
        await query('DELETE FROM handwerker WHERE id = $1', [id]);
        
        // Lösch-E-Mail
        if (transporter) {
          try {
            await transporter.sendMail({
              to: handwerker.email,
              subject: 'Ihre Registrierung bei byndl wurde abgelehnt',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px;">
                  <h2 style="color: #dc2626;">Registrierung abgelehnt</h2>
                  <p>Sehr geehrte/r ${handwerker.contact_person},</p>
                  <p>Ihre Registrierung für <strong>${handwerker.company_name}</strong> wurde abgelehnt.</p>
                  ${reason ? `
                    <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <p><strong>Grund:</strong> ${reason}</p>
                    </div>
                  ` : ''}
                  <p>Ihre Daten wurden aus unserem System entfernt.</p>
                  <p style="margin-top: 30px; color: #666;">Bei Fragen wenden Sie sich an: support@byndl.de</p>
                </div>
              `
            });
          } catch (emailError) {
            console.log('E-Mail-Versand fehlgeschlagen:', emailError.message);
          }
        }
        
        console.log(`✓ Handwerker ${handwerker.company_name} vollständig gelöscht`);
        res.json({ 
          success: true, 
          message: 'Handwerker vollständig aus dem System entfernt',
          deletedCompany: handwerker.company_name
        });
        break;
        
      default:
        return res.status(400).json({ error: 'Ungültige Aktion. Verwende: approve, reject oder delete' });
    }
    
  } catch (err) {
    console.error('Fehler bei Handwerker-Verifizierung:', err);
    res.status(500).json({ 
      error: 'Verifizierung fehlgeschlagen',
      details: err.message 
    });
  }
});

// Einzelnen Handwerker abrufen
app.get('/api/admin/handwerker/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Hauptdaten
    const handwerkerResult = await query(
      `SELECT * FROM handwerker WHERE id = $1`,
      [id]
    );
    
    if (handwerkerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Handwerker nicht gefunden' });
    }
    
    // Gewerke
    const tradesResult = await query(
      `SELECT * FROM handwerker_trades WHERE handwerker_id = $1`,
      [id]
    );
    
    // Dokumente
    const documentsResult = await query(
      `SELECT * FROM handwerker_documents WHERE handwerker_id = $1`,
      [id]
    );
    
    // Zertifikate
    const certificationsResult = await query(
      `SELECT * FROM handwerker_certifications WHERE handwerker_id = $1`,
      [id]
    );
    
    // Versicherungen
    const insurancesResult = await query(
      `SELECT * FROM handwerker_insurances WHERE handwerker_id = $1`,
      [id]
    );
    
    res.json({
      handwerker: handwerkerResult.rows[0],
      trades: tradesResult.rows,
      documents: documentsResult.rows,
      certifications: certificationsResult.rows,
      insurances: insurancesResult.rows
    });
  } catch (err) {
    console.error('Failed to fetch handwerker details:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Details' });
  }
});

// Handwerker aktualisieren
app.put('/api/admin/handwerker/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Dynamisch UPDATE Query bauen
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }
    
    values.push(id);
    
    const updateQuery = `
      UPDATE handwerker 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await query(updateQuery, values);
    
    res.json({ handwerker: result.rows[0] });
  } catch (err) {
    console.error('Failed to update handwerker:', err);
    res.status(500).json({ error: 'Update fehlgeschlagen' });
  }
});

// Einzelnen Bauherr abrufen
app.get('/api/admin/bauherren/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const bauherrResult = await query(
      `SELECT b.*, 
        COUNT(DISTINCT p.id) as project_count,
        SUM(p.budget) as total_budget
       FROM bauherren b
       LEFT JOIN projects p ON p.bauherr_id = b.id
       WHERE b.id = $1
       GROUP BY b.id`,
      [id]
    );
    
    if (bauherrResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bauherr nicht gefunden' });
    }
    
    // Projekte des Bauherrn
    const projectsResult = await query(
      `SELECT * FROM projects WHERE bauherr_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    
    res.json({
      bauherr: bauherrResult.rows[0],
      projects: projectsResult.rows
    });
  } catch (err) {
    console.error('Failed to fetch bauherr details:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Details' });
  }
});

// Bauherr aktualisieren
app.put('/api/admin/bauherren/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    for (const [key, value] of Object.entries(updates)) {
  // Filtere berechnete Felder und schreibgeschützte Felder aus
  if (key !== 'id' && 
      key !== 'created_at' && 
      key !== 'project_count' && 
      key !== 'total_budget') {
    fields.push(`${key} = $${paramCount}`);
    values.push(value);
    paramCount++;
  }
}
    
    values.push(id);
    
    const updateQuery = `
      UPDATE bauherren 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await query(updateQuery, values);
    
    res.json({ bauherr: result.rows[0] });
  } catch (err) {
    console.error('Failed to update bauherr:', err);
    res.status(500).json({ error: 'Update fehlgeschlagen' });
  }
});

// ===========================================================================
// EXISTING ROUTES (from your original code)
// ===========================================================================

// Get all prompts with full content for editing
app.get('/api/admin/prompts/full', requireAdmin, async (req, res) => {
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
app.put('/api/admin/prompts/:id', requireAdmin, async (req, res) => {
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

// Get all LVs with quality metrics - FIXED CAST
app.get('/api/admin/lvs', requireAdmin, async (req, res) => {
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
app.put('/api/admin/lvs/:projectId/:tradeId', requireAdmin, async (req, res) => {
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
app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
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
app.get('/api/admin/projects/detailed', requireAdmin, async (req, res) => {
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
app.get('/api/admin/projects/:id/full', requireAdmin, async (req, res) => {
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
       ORDER BY
         CASE WHEN COALESCE(pt.is_manual, false) THEN 1 ELSE 0 END,
         t.sort_order,
         t.id`,
      [id]
    );

    // Get all questions and answers
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

    // Get Intake-Fragen aus intake_responses
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

    // Get Gewerke-Antworten mit Fragen aus der questions Tabelle
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
      questionsAnswers: qaResult.rows,
      intakeQuestions: intakeResult.rows,
      tradeAnswers: answersResult.rows,
      totalQuestions: intakeResult.rows.length + answersResult.rows.length,
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

// Admin: Projekt löschen - FINALE VERSION
app.delete('/api/admin/projects/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Starte Löschvorgang für Projekt ${id}`);
    
    await query('BEGIN');
    
    try {
      // Test ob Projekt existiert
      const projectCheck = await query('SELECT id FROM projects WHERE id = $1', [id]);
      if (projectCheck.rows.length === 0) {
        throw new Error('Projekt nicht gefunden');
      }
      
      // 1. Direkte Projekt-Abhängigkeiten löschen
      await query('DELETE FROM intake_responses WHERE project_id = $1', [id]);
      await query('DELETE FROM questions WHERE project_id = $1', [id]);
      await query('DELETE FROM answers WHERE project_id = $1', [id]);
      await query('DELETE FROM project_trades WHERE project_id = $1', [id]);
      await query('DELETE FROM lvs WHERE project_id = $1', [id]);
      await query('DELETE FROM trade_progress WHERE project_id = $1', [id]);
      await query('DELETE FROM payments WHERE project_id = $1', [id]);
      
      // 2. Offers über tenders finden und löschen
      // Zuerst alle tender IDs für dieses Projekt holen
      const tenders = await query('SELECT id FROM tenders WHERE project_id = $1', [id]);
      
      for (const tender of tenders.rows) {
        // Alle offers für diesen tender
        const offers = await query('SELECT id FROM offers WHERE tender_id = $1', [tender.id]);
        
        for (const offer of offers.rows) {
          // Contract negotiations löschen
          await query('DELETE FROM contract_negotiations WHERE offer_id = $1', [offer.id]);
          
          // Orders und supplements
          const orders = await query('SELECT id FROM orders WHERE offer_id = $1', [offer.id]);
          for (const order of orders.rows) {
            await query('DELETE FROM supplements WHERE order_id = $1', [order.id]);
          }
          
          // Orders löschen
          await query('DELETE FROM orders WHERE offer_id = $1', [offer.id]);
          
          // Offer selbst löschen
          await query('DELETE FROM offers WHERE id = $1', [offer.id]);
        }
      }
      
      // 3. Jetzt tenders löschen (nachdem offers gelöscht wurden)
      await query('DELETE FROM tenders WHERE project_id = $1', [id]);
      
      // 4. Falls orders auch direkt project_id haben (prüfen)
      const ordersCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'project_id'
      `);
      
      if (ordersCheck.rows.length > 0) {
        await query('DELETE FROM orders WHERE project_id = $1', [id]);
      }
      
      // 5. Projekt selbst löschen
      await query('DELETE FROM projects WHERE id = $1', [id]);
      
      await query('COMMIT');
      
      console.log(`Projekt ${id} erfolgreich gelöscht`);
      res.json({ success: true, message: 'Projekt erfolgreich gelöscht' });
      
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ 
      error: 'Fehler beim Löschen des Projekts', 
      details: error.message 
    });
  }
});

// Create new prompt
app.post('/api/admin/prompts', requireAdmin, async (req, res) => {
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
app.delete('/api/admin/prompts/:id', requireAdmin, async (req, res) => {
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

// Health check endpoint
app.get('/api/admin/health', requireAdmin, async (req, res) => {
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

// ===========================================================================
// PUBLIC PROMPT ROUTES
// ===========================================================================

// Get all prompts with details
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
// TEST & DEBUG ENDPOINTS
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

// Test beide Anthropic Modelle
app.get('/api/test/anthropic/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const testModel = type === 'lv' 
      ? MODEL_ANTHROPIC_LV 
      : MODEL_ANTHROPIC_QUESTIONS;
      
    const response = await anthropic.messages.create({
      model: testModel,
      max_tokens: 20,
      messages: [{ role: 'user', content: `Say "Model ${testModel} works"` }]
    });
    
    res.json({ 
      status: 'ok',
      type: type,
      model: testModel,
      response: response.content[0].text 
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'error',
      model: testModel,
      error: err.message 
    });
  }
});

// Debug: Project trade details
app.get('/api/debug/project/:projectId/trades', async (req, res) => {
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
app.get('/__info', (req, res) => {
  res.json({
    node: process.version,
    version: "4.0",
    env: {
      OPENAI_MODEL: MODEL_OPENAI,
      ANTHROPIC_QUESTIONS: MODEL_ANTHROPIC_QUESTIONS,  // NEU
      ANTHROPIC_LV: MODEL_ANTHROPIC_LV,  // NEU
      DATABASE_URL: process.env.DATABASE_URL ? "✔️ gesetzt" : "❌ fehlt",
      JWT_SECRET: process.env.JWT_SECRET ? "✔️ gesetzt" : "❌ fehlt"
    },
    limits: {
      detect: "3000 tokens",
      questions: "8000 tokens",
      lv: "16000 tokens",
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
║     BYNDL Backend v4.0                 ║
║     Intelligente LV-Erstellung         ║
║                                        ║
║     Port: ${PORT}                        ║
║     Environment: ${process.env.NODE_ENV || 'development'}          ║
║                                        ║
║     Features:                          ║
║     ✓ Adaptive Fragenanzahl           ║
║       (8-40 Fragen je nach Gewerk)    ║
║     ✓ Detaillierte Mengenerfassung    ║
║     ✓ Laienverständliche Fragen       ║
║     ✓ Intelligente Schätzlogik        ║
║     ✓ Realistische Preiskalkulation   ║
║     ✓ Datenqualitäts-Tracking         ║
║                                        ║
║     Gewerke-Komplexität:               ║
║     • Sehr hoch: DACH, ELEKT, SAN     ║
║     • Hoch: TIS, FEN, FASS            ║
║     • Mittel: FLI, ESTR, TRO          ║
║     • Einfach: MAL, GER, ABBR         ║
║                                        ║
╚════════════════════════════════════════╝
    `);
});
