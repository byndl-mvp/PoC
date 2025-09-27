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
const bcrypt = require('bcryptjs');
const PDFDocument = require('pdfkit');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const multer = require('multer');
const nodemailer = require('nodemailer');

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
    'questions': 8000,   
    'lv': 16000,         
    'intake': 6000,      
    'summary': 3000,
    'validation': 3000   
  };
  
  const maxTokens = options.maxTokens || defaultMaxTokens[task] || 4000;

  // GENERELLES TIMEOUT ERHÖHEN für alle Tasks die länger brauchen können
  const defaultTimeouts = {
    'questions': 90000,  // 90 Sekunden
    'lv': 120000,        // 120 Sekunden (LV ist komplexer)
    'intake': 90000,     // 90 Sekunden
    'optimization': 60000, // 60 Sekunden
    'default': 45000     // 45 Sekunden für alles andere
  };
  
  if (!options.timeout) {
    options.timeout = defaultTimeouts[task] || defaultTimeouts.default;
    console.log(`[LLM] Setting timeout for ${task}: ${options.timeout}ms`);
  }
  
  // NEU: Für Optimization-Task direkt OpenAI verwenden
  if (task === 'optimization') {
    console.log('[LLM] Optimization task - using OpenAI directly');
    try {
      const response = await openai.chat.completions.create({
        model: MODEL_OPENAI,  // sollte 'gpt-4o-mini' sein
        messages,
        temperature: options.temperature || 0.3,
        max_tokens: options.maxTokens || 4000,
        response_format: { type: "json_object" }
      });
      return response.choices[0].message.content;
    } catch (error) {
      console.error('[LLM] OpenAI error for optimization:', error.status || error.message);
      throw error;
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
      return MODEL_ANTHROPIC_LV || MODEL_ANTHROPIC || 'claude-opus-4-1-20250805';
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
    if (tradeCount <= 6 && !combinedText.includes('mehrere')) {
      complexityScore = Math.min(complexityScore, 14); // Max "hoch"
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
  
  // NEU: Bei manuellen Gewerken NUR Kontextfrage zurückgeben
  if (projectContext.isManuallyAdded === true || projectContext.isAiRecommended === true) {
    console.log(`[QUESTIONS] Manual/AI-recommended trade ${tradeCode} - returning context question only`);
    
    // Erstelle kontextbezogene Frage basierend auf Projektbeschreibung
    const contextQuestion = `Sie haben ${tradeName} als ${projectContext.isAiRecommended ? 'empfohlenes' : 'zusätzliches'} Gewerk ausgewählt. 
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
   - KRITISCHE ZUORDNUNGEN (IMMER EINHALTEN):
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
   
   GEWERK-SPEZIFISCHE REGELN:
   - FLI (Fliesenarbeiten): Fliesen, Mosaikarbeiten, Natursteinbeläge in Bad/Küche
   - BOD (Bodenbelagsarbeiten): Parkett, Laminat, Vinyl, Teppich, PVC - KEINE Fliesen!
   - TIS (Tischlerarbeiten): Türen, Zargen, Einbaumöbel, Holzarbeiten
   - TRO (Trockenbau): Rigipswände, Gipskarton, Metallständerwerk, abgehängte Decken
   - ROH (Rohbau): Mauerwerk, Beton, Stahlbeton - KEINE Leichtbauwände!
   - MAL (Malerarbeiten): Innenputz mit Q1-Q3, Anstriche, Tapeten
   - FASS (Fassade): Außenputz mit Struktur/Körnung, WDVS - KEINE Q-Stufen!
   
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
    "explanation": "PFLICHT bei Fachbegriffen! Erkläre was gemeint ist und wie gemessen wird",
    "type": "text|number|select",
    "required": boolean,
    "unit": null,
    "options": ["unsicher/weiß nicht"] bei schwierigen Fragen,
    "multiSelect": false,
    "defaultAssumption": "Falls 'unsicher': Diese Annahme wird getroffen",
    "dependsOn": "ID der Vorfrage oder null",
    "showIf": "Antwort die gegeben sein muss oder null"
  }
]

${projectContext.intakeContext && !isIntake ? `
WICHTIGER KONTEXT aus der Vorbefragung:
${projectContext.intakeContext}
Berücksichtige diese Informationen bei der Fragenerstellung.` : ''}

${projectContext.isAiRecommended && !isIntake ? `
HINWEIS: Dieses Gewerk wurde aufgrund der Vorbefragung empfohlen. 
Stelle spezifische Fragen zu den relevanten Punkten aus der Vorbefragung.` : ''}`;  // Ende des GESAMTEN Template-Strings

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
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { 
      maxTokens: targetQuestionCount > 30 ? 8000 : 6000,  // Erhöhe Limit für viele Fragen
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
    
    if (istTechnisch) {
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
    
    if (projectContext.answeredValues.material && 
        qText.includes('material')) {
      console.log('[FILTER] Removed material question - already answered');
      return false;
    }
    
    return true;
  });
  
  console.log(`[FILTER] Removed ${questions.length - afterAnswerFilter.length} answered questions`);
  questions = afterAnswerFilter; // WICHTIG: Zurückschreiben!
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
    'MAL': ['streichen', 'innenputz', 'tapezieren', 'verputzen', 'spachteln', 'farbe', 'lackieren', 'grundierung'],
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
  
  const systemPrompt = `Du bist ein Experte für ${trade.rows[0].name}.
Der Nutzer hat angegeben: "${contextAnswer}"

Erstelle 10-15 spezifische Folgefragen basierend auf dieser Antwort.

OUTPUT als JSON-Array:
[
  {
    "id": "string",
    "question": "Spezifische Frage",
    "type": "text|number|select",
    "required": true/false,
    "unit": null oder "m²/m/Stk"
  }
]`;
  
  try {
    const response = await llmWithPolicy('questions', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Erstelle Folgefragen für diese Arbeiten: ${contextAnswer}` }
    ], { maxTokens: 3000, temperature: 0.5 });
    
    const cleaned = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const questions = JSON.parse(cleaned);
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
    
    // Suche nach Dämmstärke in cm
    if (question.includes('dämmstärke') || question.includes('dämmung') || 
        question.includes('wärmedämmung') || question.includes('stärke')) {
      const daemmMatch = answerText.match(/(\d+)\s*(cm|mm)/i);
      if (daemmMatch) {
        let daemmstaerke = parseInt(daemmMatch[1]);
        
        // Konvertiere mm in cm falls nötig
        if (daemmMatch[2].toLowerCase() === 'mm') {
          daemmstaerke = Math.round(daemmstaerke / 10);
        }
        
        // Runde auf gerade Zahl (handelsübliche Stärken)
        if (daemmstaerke % 2 !== 0) {
          daemmstaerke = daemmstaerke + 1; // Aufrunden auf nächste gerade Zahl
          console.log(`[FASS] Dämmstärke von ${parseInt(daemmMatch[1])}cm auf ${daemmstaerke}cm (gerade Zahl) korrigiert`);
        }
        
        criticalMeasurements.daemmstaerke = {
          value: daemmstaerke,
          unit: 'cm',
          original: answerText,
          source: 'trade_answers'
        };
        
        console.log(`[FASS] Dämmstärke erfasst: ${daemmstaerke}cm`);
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

REIHENFOLGE:
1. Rohinstallation (vor Fliesen)
2. Fliesenleger macht Fliesen
3. Endmontage (nach Fliesen)
` : ''}

${trade.code === 'ELEKT' ? `
KRITISCH FÜR ELEKTRO:

HAUPTREGEL:
- Schlitze in Wänden → IMMER Elektroinstallation selbst, nie Rohbau (ROH)
- Endmontage → IMMER nach Malerarbeiten
- FI-Schutzschalter Bad → PFLICHT

SCHNITTSTELLEN:
- PV: Elektro macht AC-Seite, PV macht DC-Seite
- Heizung: Elektro macht Stromanschluss für Kessel/Wärmepumpe
- Bad: FI-Schutzschalter + Potentialausgleich
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

  // FASS-spezifisch: Korrigiere falsche Dämmstärken
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
    pos.description = pos.description.replace(alleZahlenRegex, (match, offset, fullString) => {
      // Prüfe Kontext - nur Dämmstärken ersetzen, nicht z.B. Sockelhöhe
      const vorher = fullString.substring(Math.max(0, offset - 20), offset).toLowerCase();
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
    
    // Korrigiere alle falschen Werte
    lv.positions = lv.positions.map(pos => {
      if (pos.title?.toLowerCase().includes('dämm') || 
          pos.title?.toLowerCase().includes('wdvs')) {
        // Ersetze 0cm und alle ungeraden/falschen Werte
        pos.title = pos.title?.replace(/\b[0-9]\s*cm\b/gi, `${notfallDaemmstaerke} cm`); // 0-9 cm
        pos.title = pos.title?.replace(/\b\d*[13579]\s*cm\b/gi, `${notfallDaemmstaerke} cm`); // ungerade
        
        pos.description = pos.description?.replace(/\b[0-9]\s*cm\b/gi, `${notfallDaemmstaerke} cm`);
        pos.description = pos.description?.replace(/\b\d*[13579]\s*cm\b/gi, `${notfallDaemmstaerke} cm`);
      }
      return pos;
    });
  }
}

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

// UNIVERSELLE REGEL: Kleber/Klebstoff-Preise
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
    warnings.push(`Kleber-Preis korrigiert: ${oldPrice}€/m² → ${neuerPreis}€/m²`);
    fixedCount++;
  }
  
  // Kleber pro kg
  if (pos.unit === 'kg' && pos.unitPrice > 25) {
    const oldPrice = pos.unitPrice;
    pos.unitPrice = 8; // Max 8€/kg für Spezialkleber
    pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
    warnings.push(`Kleber/kg korrigiert: ${oldPrice}€ → 8€`);
    fixedCount++;
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
    titleLower.includes('spachtel') ||
    titleLower.includes('glätten') ||
    titleLower.includes('ausbesser')) {
  
  // Für laufende Meter (z.B. Laibungen)
  if (pos.unit === 'm' && pos.unitPrice > 80) {
    const oldPrice = pos.unitPrice;
    pos.unitPrice = 45;
    pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
    warnings.push(`Putzarbeit/m korrigiert: "${pos.title}": €${oldPrice}/m → €${pos.unitPrice}/m`);
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
    
    // 3. VERBESSERTE REGEL: Nebenleistungen mit Ausnahmen für Spezialleistungen
    // Keywords die TEURE Spezialleistungen kennzeichnen
    const EXPENSIVE_EQUIPMENT_KEYWORDS = [
      'kran',
      'gerüst',
      'bagger',
      'aufzug',
      'hebebühne',
      'spezialgerät',
      'schwerlast',
      'transport'
    ];
    
    // Prüfe ob es eine Spezialleistung ist
    const isSpecialEquipment = EXPENSIVE_EQUIPMENT_KEYWORDS.some(keyword => 
      titleLower.includes(keyword)
    );
    
    // Normale Nebenleistungen
    const isNebenleistung = 
      titleLower.includes('anschluss') ||
      titleLower.includes('abdichtung') ||
      titleLower.includes('laibung') ||
      titleLower.includes('befestigung') ||
      titleLower.includes('dämmstreifen') ||
      titleLower.includes('anarbeiten');
    
    // NUR korrigieren wenn:
    // 1. Es ist eine Nebenleistung UND
    // 2. Es ist KEINE Spezialausrüstung UND
    // 3. Der Preis ist ungewöhnlich hoch
    if (isNebenleistung && !isSpecialEquipment && pos.unitPrice > 200 && pos.unit !== 'psch') {
      const oldPrice = pos.unitPrice;
      
      // Differenzierte Preiskorrektur nach Art der Nebenleistung
      let newPrice;
      if (titleLower.includes('abdichtung') || titleLower.includes('anschluss')) {
        // Abdichtungen/Anschlüsse können teurer sein
        newPrice = pos.unit === 'm' ? 80 : 120;
      } else {
        // Einfache Nebenleistungen
        newPrice = pos.unit === 'm' ? 50 : 80;
      }
      
      pos.unitPrice = newPrice;
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Nebenleistung korrigiert: "${pos.title}": €${oldPrice} → €${pos.unitPrice}`);
      fixedCount++;
    }
    
    // NEUE REGEL: Warnung bei teuren Spezialleistungen (ohne Korrektur)
    if (isSpecialEquipment && pos.unitPrice > 1000) {
      console.log(`[PRICE-CHECK] Spezialleistung erkannt: "${pos.title}" - €${pos.unitPrice} (keine Korrektur)`);
      // Optional: Warnung für Review hinzufügen
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

// SPEZIAL-REGEL FÜR ZIMMERER
if (tradeCode === 'ZIMM') {
  if (titleLower.includes('dachstuhl')) {
    if (pos.unit === 'm²' && pos.unitPrice > 250) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 180; // Realistischer Wert für Dachstuhl
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Dachstuhl korrigiert: €${oldPrice}/m² → €${pos.unitPrice}/m²`);
      fixedCount++;
    }
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
      forbidden: ['fenster einbau', 'fenster lieferung', 'tür montage', 'dachziegel', 'dachrinne', 'heizung', 'sanitär', 'elektro', 'parkett', 'fliesen'],
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
      forbidden: ['fliesen', 'parkett', 'oberbelag', 'elektro', 'sanitär', 'fenster'],
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
    const { category, subCategory, description, timeframe, budget } = req.body;
    
    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }
    
    // NEU: Extrahiere Schlüsseldaten aus der Beschreibung
    const extractedData = extractProjectKeyData(description, category);
    
    // Speichere Projekt MIT extrahierten Daten
    const projectResult = await query(
      `INSERT INTO projects (category, sub_category, description, timeframe, budget, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        category || null, 
        subCategory || null, 
        description, 
        timeframe || null, 
        budget || null,
        JSON.stringify({ extracted: extractedData }) // NEU: Speichere extrahierte Daten
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

// NEU: Analysiere Intake-Antworten für zusätzliche Gewerke
const additionalTrades = [];
const processedCodes = new Set(); // Verhindere Duplikate

// Keyword-basierte Analyse
const tradeKeywords = {
  'ELEKT': ['steckdose', 'schalter', 'lampe', 'elektro', 'kabel', 'sicherung', 'strom', 'leitung', 'verteiler', 'fi-schalter'],
  'HEI': ['heizung', 'heizkörper', 'thermostat', 'warmwasser', 'kessel', 'brenner', 'fußbodenheizung', 'radiator'],
  'KLIMA': ['lüftung', 'klima', 'luftwechsel', 'abluft', 'zuluft', 'klimaanlage', 'wärmerückgewinnung'],
  'TRO': ['rigips', 'trockenbau', 'ständerwerk', 'vorwand', 'gipskarton', 'türöffnung', 'dämmung', 'abgehängte decke', 'schallschutz'],
  'FLI': ['fliesen', 'verfugen', 'bad', 'mosaik', 'naturstein', 'feinsteinzeug', 'bodenfliesen', 'wandfliesen'],
  'MAL': [ 'streichen', 'innenputz', 'tapezieren','verputzen', 'spachteln', 'anstrich', 'farbe', 'lackieren', 'grundierung', 'malerarbeiten'],
  'BOD': ['parkett', 'laminat', 'vinyl', 'teppich', 'linoleum', 'kork', 'designboden', 'bodenbelag'],
  'ROH': ['mauerwerk', 'durchbruch', 'beton', 'wand', 'decke', 'maurerarbeiten'],
  'SAN': ['bad', 'wc', 'waschbecken', 'dusche', 'badewanne', 'sanitär', 'abfluss', 'wasserhahn', 'armatur'],
  'FEN': ['fenster', 'verglasung', 'rolladen', 'jalousie', 'fensterbank', 'glasbruch', 'isolierglas'],
  'TIS': ['tür', 'innentür', 'zarge', 'möbel', 'einbauschrank', 'holzarbeiten', 'küche', 'arbeitsplatte'],
  'DACH': ['dach', 'ziegel', 'dachrinne', 'schneefang', 'dachfenster', 'gauben', 'dachstuhl', 'eindeckung'],
  'FASS': ['fassade', 'wdvs', 'außenputz', 'dämmung', 'verblendung', 'klinker', 'fassadenfarbe'],
  'GER': ['gerüst', 'baugerüst', 'arbeitsgerüst', 'fassadengerüst', 'rollgerüst'],
  'ZIMM': ['holzbau', 'dachstuhl', 'gaube', 'balken', 'carport', 'pergola', 'holzkonstruktion', 'fachwerk'],
  'ESTR': ['estrich', 'fließestrich', 'zementestrich', 'anhydritestrich', 'trockenestrich', 'ausgleichsmasse'],
  'SCHL': ['geländer', 'zaun', 'tor', 'metallbau', 'stahltreppe', 'gitter', 'schlosserarbeiten'],
  'AUSS': ['pflaster', 'terrasse', 'einfahrt', 'garten', 'außenanlage', 'randstein', 'rasen'],
  'PV': ['solar', 'photovoltaik', 'solaranlage', 'wechselrichter', 'speicher', 'batterie', 'einspeisung'],
  'ABBR': ['abriss', 'abbruch', 'entkernung', 'rückbau', 'schutt']
};
    
// Analysiere alle Intake-Antworten
const allAnswersText = answers
  .map(a => `${a.question} ${a.answer}`.toLowerCase())
  .join(' ');

// DEFINIERE relevantAnswers HIER
const relevantAnswers = answers
  .filter(a => a.answer.length > 15 && !['ja', 'nein', 'keine', 'vorhanden'].includes(a.answer.toLowerCase().trim()))
  .map(a => ({ question: a.question, answer: a.answer }));

const userAnswerText = relevantAnswers.map(a => a.answer.toLowerCase()).join(' ');

// Keyword-Analyse
for (const [code, keywords] of Object.entries(tradeKeywords)) {
  const matchedKeywords = keywords.filter(kw => userAnswerText.includes(kw));
  
  if (matchedKeywords.length > 0 && !processedCodes.has(code)) {
    const alreadyExists = await query(
      `SELECT 1 FROM project_trades pt 
       JOIN trades t ON pt.trade_id = t.id 
       WHERE pt.project_id = $1 
       AND t.code = $2 
       AND (pt.is_ai_recommended = false OR pt.is_ai_recommended IS NULL)`,
      [projectId, code]
    );
    
    if (alreadyExists.rows.length === 0) {
      additionalTrades.push({
        code,
        matchedKeywords,
        confidence: Math.min(95, 70 + (matchedKeywords.length * 5)),
        reason: '' // Wird vom LLM gefüllt
      });
      processedCodes.add(code);
    }
  }
}

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

Gib für jedes Gewerk eine Begründung (max 12 Wörter) die sich DIREKT auf die Nutzerangaben bezieht.

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

// 5. Erstelle Response
const groupedTrades = {
  required: requiredTrades.rows.map(trade => ({
    ...trade,
    reason: 'Direkt aus Ihrer Projektbeschreibung erkannt'
  })),
  recommended: allRecommendedTrades
};

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
}); // <- Diese schließenden Klammern fehlen

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
    const needsContextQuestion = tradeStatus.is_manual || 
                                 tradeStatus.is_ai_recommended || 
                                 req.body.isManuallyAdded ||
                                 req.body.isAiRecommended;
    
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

// Generate adaptive follow-up questions based on context answer
app.post('/api/projects/:projectId/trades/:tradeId/context-questions', async (req, res) => {
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

// Budget-Optimierung generieren
app.post('/api/projects/:projectId/budget-optimization', async (req, res) => {
  console.log('[BUDGET-OPT] Route called for project:', req.params.projectId);
  try {
    const { projectId } = req.params;
    const { currentTotal, targetBudget, lvBreakdown } = req.body;

    // Lade zusätzliche Kontextdaten
    const lvPositions = await query(
      `SELECT t.name as trade_name, l.content 
       FROM lvs l 
       JOIN trades t ON t.id = l.trade_id 
       WHERE l.project_id = $1`,
      [projectId]
    );

    const intakeData = await query(
      `SELECT question_text, answer_text 
       FROM intake_responses 
       WHERE project_id = $1`,
      [projectId]
    );

    const projectData = await query(
      'SELECT description, category FROM projects WHERE id = $1',
      [projectId]
    );
    
    const overspend = currentTotal - targetBudget;
    const percentOver = ((overspend / targetBudget) * 100).toFixed(1);
    
    const systemPrompt = `Du bist ein Baukostenoptimierer mit 20 Jahren Erfahrung.

PROJEKTKONTEXT:
${projectData.rows[0]?.description || 'Keine Beschreibung'}
Kategorie: ${projectData.rows[0]?.category || 'Nicht angegeben'}

KONKRETE LV-POSITIONEN MIT PREISEN (BASIS FÜR EINSPARUNGEN):
${lvPositions.rows.slice(0, 40).map(p => {
  try {
    const content = JSON.parse(p.content);
    return content.positions?.slice(0, 5).map(pos => 
      `- ${p.trade_name}: ${pos.title} = ${formatCurrency(pos.total || 0)}`
    ).join('\n');
  } catch {
    return `- ${p.trade_name}: [Positionen nicht lesbar]`;
  }
}).join('\n')}

ERFASSTE PROJEKTDETAILS:
${intakeData.rows.slice(0, 20).map(r => `- ${r.question_text}: ${r.answer_text}`).join('\n')}

VERFÜGBARE GEWERKE-CODES (NUR DIESE VERWENDEN!):
${lvBreakdown.map(lv => `${lv.tradeCode} = ${lv.tradeName} (Typisch: ${getTradeDescription(lv.tradeCode)})`).join('\n')}

KRITISCH: Im "trade" Feld MÜSSEN EXAKT diese Codes verwendet werden:
[${lvBreakdown.map(lv => lv.tradeCode).join(', ')}]

Beispiel korrekte/falsche Ausgaben:
✓ trade: "KLIMA" (wenn KLIMA in der Liste ist)
✓ trade: "SAN" (wenn SAN in der Liste ist)
✗ trade: "TGA" (FALSCH - kein gültiger Code)
✗ trade: "LEISTUNGSREDUZIERUNG" (FALSCH - das ist eine Kategorie, kein Trade-Code)

ANALYSIERE NUR was tatsächlich im Projekt enthalten ist!
- Bei Dachprojekt: KEINE Vorschläge zu Innenräumen
- Bei Badprojekt: KEINE Vorschläge zur Fassade

KRITISCHE REGELN FÜR REALISTISCHE EINSPARUNGEN:

1. BEZIEHE EINSPARUNGEN AUF KONKRETE LV-POSITIONEN:
   - Die Einsparung muss sich auf eine spezifische Position beziehen
   - Beispiel: Wenn "Tonziegel verlegen" = 5.750€, dann ist 10% Einsparung = 575€
   - NICHT: 10% vom gesamten Dachgewerk!

2. REALISTISCHE PROZENTSÄTZE PRO POSITION:
   - Materialwechsel bei einer Position: 8-15% dieser Position
   - Eigenleistung bei Vorarbeiten: 60-80% der Arbeitskosten dieser Position
   - Weglassen einer verzichtbaren Position: 100% dieser Position
   - Reduzierung einer Position: 20-40% dieser Position

3. ABSOLUTE GRENZEN:
   - NIEMALS mehr als 15% eines Gewerks insgesamt einsparen
   - Mindestens 200€ pro Vorschlag
   - Maximal 20% der Gesamtüberschreitung pro Einzelmaßnahme
   - Die Summe aller Einsparungen darf nicht über 30% der Gesamtkosten liegen

4. KONKRETE BERECHNUNG für jedes Gewerk (MAXIMALGRENZEN):
${lvBreakdown.map(lv => `   ${lv.tradeCode} (${formatCurrency(lv.total)}):
   - Maximale Gesamteinsparung für dieses Gewerk: ${formatCurrency(Math.round(lv.total * 0.15))}`).join('\n')}

ERSTELLE 4-5 KONKRETE SPARVORSCHLÄGE aus diesen Kategorien:

1. MATERIALOPTIMIERUNG:
- Standardprodukte statt Premium
- Alternative Materialien gleicher Funktion
- Reduzierte Ausstattung

2. EIGENLEISTUNG (nur bei einfachen Arbeiten):
- Malervorarbeiten, Tapeten entfernen
- Bodenbeläge entfernen
- NICHT: Elektro, Sanitär, Statik, Dach

3. MENGENOPTIMIERUNG:
- Teilbereiche weglassen
- Reduzierte Flächen
- Bestand erhalten wo möglich

BEISPIELE MIT KONKRETEN POSITIONEN:
Wenn Position "Tonziegel liefern und verlegen" = 5.750€:
✓ "Standard-Tonziegel statt Premium": 575€ (10% der Position)
✓ "Betonziegel statt Tonziegel": 860€ (15% der Position)
✗ "Günstigere Ziegel": 4.500€ (78% der Position) - UNREALISTISCH!

Wenn Position "Sanitärarmaturen montieren" = 3.200€:
✓ "Standard-Armaturen statt Design": 480€ (15% der Position)
✗ "Billigere Armaturen": 2.000€ (62% der Position) - UNREALISTISCH!

EXTREM WICHTIG: 
Das "trade" Feld MUSS EXAKT einer dieser Codes sein: ${lvBreakdown.map(lv => lv.tradeCode).join(', ')}
KEINE ANDEREN CODES! Nicht KLIMA wenn KLIMA nicht in der Liste ist!

OUTPUT als JSON:
{
  "optimizations": [
    {
      "trade": "${lvBreakdown[0]?.tradeCode || 'DACH'}",
      "tradeName": "${lvBreakdown[0]?.tradeName || 'Dachdeckerarbeiten'}",
      "measure": "Standard-Material statt Premium bei konkreter Position",
      "affectedPosition": "[Name der betroffenen LV-Position]",
      "positionValue": [Wert der Position in Euro],
      "savingAmount": [10-15% der positionValue],
      "savingPercent": [Prozent bezogen auf positionValue],
      "difficulty": "mittel",
      "type": "material",
      "impact": "Auswirkung auf Qualität"
    }${lvBreakdown[1] ? `,
    {
      "trade": "${lvBreakdown[1].tradeCode}",
      "tradeName": "${lvBreakdown[1].tradeName}",
      "measure": "Weitere konkrete Optimierung",
      "affectedPosition": "[Name der betroffenen LV-Position]",
      "positionValue": [Wert der Position],
      "savingAmount": [Realistische Einsparung basierend auf Position],
      "savingPercent": [Prozent der Position],
      "difficulty": "einfach",
      "type": "eigenleistung",
      "impact": "Keine Funktionseinschränkung"
    }` : ''}
  ],
  "totalPossibleSaving": [Summe aller savingAmount Werte],
  "summary": "Einsparungen durch gezielte Optimierung einzelner Positionen"
}

WICHTIG: Antworte NUR mit validem JSON, KEINE Markdown-Formatierung wie \`\`\`json!`;

const userPrompt = `Budget: ${formatCurrency(targetBudget)}
Aktuelle Kosten: ${formatCurrency(currentTotal)}
Überschreitung: ${formatCurrency(overspend)} (${percentOver}%)

GEWERKE MIT GESAMTSUMMEN:
${lvBreakdown.map(lv => `${lv.tradeCode}: ${lv.tradeName} = ${formatCurrency(lv.total)}`).join('\n')}

WICHTIGSTE LV-POSITIONEN MIT BETRÄGEN (Basis für deine Berechnungen):
${lvPositions.rows.slice(0, 25).map(p => {
  try {
    const content = JSON.parse(p.content);
    return content.positions?.slice(0, 4).map(pos => 
      `- ${p.trade_name}: "${pos.title}" = ${formatCurrency(pos.total || 0)}`
    ).join('\n');
  } catch {
    return '';
  }
}).filter(Boolean).join('\n')}

KRITISCH: 
- Beziehe JEDE Einsparung auf eine konkrete Position mit deren Betrag!
- Berechne Einsparungen als Prozentsatz der POSITION, nicht des Gewerks!
- Nenne die betroffene Position und deren Wert im JSON!
- Verwende im "trade" Feld NUR die Codes aus der obigen Liste!`;

    // DIREKT OpenAI verwenden
    console.log('[OPTIMIZATION] Calling OpenAI directly with gpt-4.1-mini');
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 4000,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0].message.content;
    console.log('[OPTIMIZATION] Raw OpenAI response:', response.substring(0, 500));
    
    const optimizations = JSON.parse(response);
    
    // Sofort nach dem Parsen alle Beträge runden
    if (optimizations.optimizations && Array.isArray(optimizations.optimizations)) {
      optimizations.optimizations = optimizations.optimizations.map(opt => ({
        ...opt,
        savingAmount: Math.round(parseFloat(opt.savingAmount) || 0)
      }));
    }    
    console.log('[OPTIMIZATION] Parsed optimizations:', JSON.stringify(optimizations.optimizations?.slice(0, 2)));

    // Speichere Optimierungsvorschläge
    await query(
      `INSERT INTO project_optimizations (project_id, suggestions, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (project_id) 
       DO UPDATE SET suggestions = $2, created_at = NOW()`,
      [projectId, JSON.stringify(optimizations)]
    );

    // Runde alle Beträge und korrigiere die Gesamtsumme
    if (optimizations.optimizations && optimizations.optimizations.length > 0) {
      optimizations.optimizations = optimizations.optimizations.map(opt => ({
        ...opt,
        savingAmount: Math.round(parseFloat(opt.savingAmount) || 0)
      }));
      
      optimizations.totalPossibleSaving = optimizations.optimizations.reduce(
        (sum, opt) => sum + opt.savingAmount, 
        0
      );
    }
    
    // Validierung: Filtere ungültige und unrealistische Optimierungen
    const validTradeCodes = lvBreakdown.map(lv => lv.tradeCode);
    if (optimizations.optimizations) {
      optimizations.optimizations = optimizations.optimizations.filter(opt => {
        if (!opt.trade || opt.trade === 'undefined') {
          console.log('[OPTIMIZATION] Skipping optimization with undefined trade');
          return false;
        }
        
        const isValid = validTradeCodes.includes(opt.trade);
        if (!isValid) {
          console.log(`[OPTIMIZATION] Filtered invalid trade: ${opt.trade}`);
          return false;
        }
        
        if (opt.savingAmount < 200) {
          console.log(`[OPTIMIZATION] Filtered unrealistic low amount: ${opt.savingAmount}€`);
          return false;
        }
        
        const tradeLv = lvBreakdown.find(lv => lv.tradeCode === opt.trade);
        if (tradeLv && opt.savingAmount > tradeLv.total * 0.5) {
          console.log(`[OPTIMIZATION] Capped high amount: ${opt.savingAmount}€ to 30% of ${tradeLv.total}€`);
          opt.savingAmount = Math.floor(tradeLv.total * 0.3);
          opt.savingPercent = 30;
        }
        
        return true;
      });
      
      optimizations.optimizations = optimizations.optimizations.map(opt => {
        const matchingTrade = lvBreakdown.find(lv => lv.tradeCode === opt.trade);
        if (matchingTrade) {
          opt.tradeName = matchingTrade.tradeName;
        }
        return opt;
      });
    }

    console.log('[OPTIMIZATION] Final amounts before response:', 
      optimizations.optimizations.map(opt => opt.savingAmount));

    optimizations.totalPossibleSaving = optimizations.optimizations.reduce(
      (sum, opt) => sum + opt.savingAmount, 
      0
    );

    console.log('[OPTIMIZATION] Final total:', optimizations.totalPossibleSaving);
    
    res.json(optimizations);
    
  } catch (err) {
    console.error('Optimization generation failed:', err);
    res.status(500).json({ error: 'Fehler bei der Optimierung' });
  }
});

// ============================================================================
// NEUE ROUTEN FÜR DIE ERWEITERTE PLATTFORM
// ============================================================================

// 1. AUTH ROUTES - Registrierung & Login für Bauherren/Handwerker
// ----------------------------------------------------------------------------

// Bauherr Registrierung
app.post('/api/auth/register/bauherr', async (req, res) => {
  try {
    const { email, password, name, phone, street, house_number, zip, city } = req.body;
    
    // Check if user exists
    const userCheck = await query('SELECT * FROM bauherren WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email bereits registriert' });
    }
    
    // Hash password with bcrypt
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert bauherr
    const result = await query(
      `INSERT INTO bauherren (email, password, name, phone, street, house_number, zip, city, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING id, email, name`,
      [email, hashedPassword, name, phone, street, house_number, zip, city]
    );
    
    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: result.rows[0].id, type: 'bauherr' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      success: true,
      token,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Bauherr registration error:', error);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
  }
});

// Handwerker Registrierung
app.post('/api/handwerker/register', async (req, res) => {
  try {
    const {
      companyName, email, phone, contactPerson,
      street, houseNumber, zipCode, city,  // Frontend sendet: zipCode
      trades, actionRadius, maxProjectVolume,
      availableFrom, employees, insurances, certifications
    } = req.body;
    
    // Check if already exists
    const existingCheck = await query('SELECT * FROM handwerker WHERE email = $1', [email]);
    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email bereits registriert' });
    }
    
    // Generate company ID
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 9000) + 1000;
    const companyId = `HW-${year}-${random}`;
    
    await query('BEGIN');
    
    try {
      // Insert handwerker - WICHTIG: zip_code statt zip!
      const result = await query(
        `INSERT INTO handwerker (
          company_id, email, company_name, contact_person, phone,
          street, house_number, zip_code, city, action_radius,
          max_project_volume, available_from, employee_count, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        RETURNING id, company_id, company_name, email`,
        [companyId, email, companyName, contactPerson, phone,
         street, houseNumber, zipCode, city, actionRadius,  // zipCode wird zu zip_code gemappt
         maxProjectVolume, availableFrom, employees]
      );
      
      const handwerkerId = result.rows[0].id;
      
      // Insert trades
if (trades && trades.length > 0) {
  for (const tradeCode of trades) {
    // Hole den trade_name aus der trades Tabelle
    const tradeInfo = await query(
      'SELECT name FROM trades WHERE code = $1',
      [tradeCode]
    );
    
    if (tradeInfo.rows.length > 0) {
      const tradeName = tradeInfo.rows[0].name;
      
      await query(
        'INSERT INTO handwerker_trades (handwerker_id, trade_code, trade_name) VALUES ($1, $2, $3)',
        [handwerkerId, tradeCode, tradeName]
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
      
      await query('COMMIT');
      
      res.status(201).json({
        success: true,
        companyId,
        message: 'Registrierung erfolgreich'
      });
      
    } catch (innerErr) {
      await query('ROLLBACK');
      throw innerErr;
    }
    
  } catch (error) {
    console.error('Handwerker registration error:', error);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
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

// Bauherr Login/Verify
app.get('/api/users/verify', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email erforderlich' });
    }
    
    // Check if bauherr exists with projects
    const result = await query(
      `SELECT b.*, COUNT(p.id) as project_count
       FROM bauherren b
       LEFT JOIN projects p ON p.bauherr_id = b.id
       WHERE b.email = $1
       GROUP BY b.id`,
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nutzer nicht gefunden' });
    }
    
    const user = result.rows[0];
    
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      projectCount: user.project_count
    });
    
  } catch (error) {
    console.error('User verification error:', error);
    res.status(500).json({ error: 'Verifizierung fehlgeschlagen' });
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

// 3. TENDER & OFFER ROUTES
// ----------------------------------------------------------------------------

// Start tender for project
app.post('/api/projects/:projectId/tender/start', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { trades } = req.body;
    
    await query('BEGIN');
    
    try {
      // Create tenders for each trade
      for (const tradeId of trades) {
        const tradeInfo = await query('SELECT code, name FROM trades WHERE id = $1', [tradeId]);
        
        await query(
          `INSERT INTO tenders (project_id, trade_code, status, created_at, deadline)
           VALUES ($1, $2, 'open', NOW(), NOW() + INTERVAL '14 days')`,
          [projectId, tradeInfo.rows[0].code]
        );
      }
      
      // Update project status
      await query(
        'UPDATE projects SET tender_started = true, tender_started_at = NOW() WHERE id = $1',
        [projectId]
      );
      
      await query('COMMIT');
      
      res.json({ success: true, message: 'Ausschreibung gestartet' });
      
    } catch (innerErr) {
      await query('ROLLBACK');
      throw innerErr;
    }
    
  } catch (error) {
    console.error('Error starting tender:', error);
    res.status(500).json({ error: 'Fehler beim Starten der Ausschreibung' });
  }
});

// Get project tenders
app.get('/api/projects/:projectId/tenders', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const result = await query(
      `SELECT t.*, tr.name as trade_name
       FROM tenders t
       JOIN trades tr ON t.trade_code = tr.code
       WHERE t.project_id = $1
       ORDER BY t.created_at DESC`,
      [projectId]
    );
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching tenders:', error);
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
       JOIN trades t ON tn.trade_code = t.code
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

// Update the /api/offers/create endpoint:
app.post('/api/offers/create', async (req, res) => {
  try {
    const { tenderId, handwerkerId: companyIdOrId, amount, executionTime, notes, bundleDiscount, includeMaterial, includeAnfahrt } = req.body;
    
    // Handle both company_id and direct id
    let actualHandwerkerId = companyIdOrId;
    if (typeof companyIdOrId === 'string' && companyIdOrId.startsWith('HW-')) {
      actualHandwerkerId = await getHandwerkerIdFromCompanyId(companyIdOrId);
      if (!actualHandwerkerId) {
        return res.status(404).json({ error: 'Handwerker nicht gefunden' });
      }
    }
    
    const result = await query(
      `INSERT INTO offers (
        tender_id, handwerker_id, amount, execution_time, notes,
        bundle_discount, include_material, include_anfahrt, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
      RETURNING id`,
      [tenderId, actualHandwerkerId, amount, executionTime, notes, bundleDiscount, includeMaterial, includeAnfahrt]
    );
    
    res.json({ success: true, offerId: result.rows[0].id });
    
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Angebots' });
  }
});

// 4. ORDER ROUTES - Zweistufige Vergabe
// ----------------------------------------------------------------------------

// Preliminary order (Stufe 1)
app.post('/api/offers/:offerId/preliminary-order', async (req, res) => {
  try {
    const { offerId } = req.params;
    const { projectId } = req.body;
    
    await query('BEGIN');
    
    try {
      // Update offer status
      await query(
        `UPDATE offers SET 
         status = 'preliminary',
         preliminary_date = NOW()
         WHERE id = $1`,
        [offerId]
      );
      
      // Get offer details
      const offerResult = await query(
        `SELECT o.*, h.id as handwerker_id, tn.trade_code
         FROM offers o
         JOIN handwerker h ON o.handwerker_id = h.id
         JOIN tenders tn ON o.tender_id = tn.id
         WHERE o.id = $1`,
        [offerId]
      );
      
      const offer = offerResult.rows[0];
      
      // Create order entry
      await query(
        `INSERT INTO orders (
          project_id, handwerker_id, offer_id, trade_code,
          amount, status, stage, created_at
        ) VALUES ($1, $2, $3, $4, $5, 'preliminary', 1, NOW())`,
        [projectId, offer.handwerker_id, offerId, offer.trade_code, offer.amount]
      );
      
      await query('COMMIT');
      
      res.json({ success: true, message: 'Vorläufige Beauftragung erfolgreich' });
      
    } catch (innerErr) {
      await query('ROLLBACK');
      throw innerErr;
    }
    
  } catch (error) {
    console.error('Error creating preliminary order:', error);
    res.status(500).json({ error: 'Fehler bei vorläufiger Beauftragung' });
  }
});

// Final order (Stufe 2)
app.post('/api/offers/:offerId/final-order', async (req, res) => {
  try {
    const { offerId } = req.params;
    
    await query('BEGIN');
    
    try {
      // Update offer status
      await query(
        `UPDATE offers SET 
         status = 'accepted',
         accepted_date = NOW()
         WHERE id = $1`,
        [offerId]
      );
      
      // Update order to final
      await query(
        `UPDATE orders SET 
         status = 'active',
         stage = 2,
         finalized_at = NOW()
         WHERE offer_id = $1`,
        [offerId]
      );
      
      await query('COMMIT');
      
      res.json({ success: true, message: 'Verbindliche Beauftragung erfolgreich' });
      
    } catch (innerErr) {
      await query('ROLLBACK');
      throw innerErr;
    }
    
  } catch (error) {
    console.error('Error creating final order:', error);
    res.status(500).json({ error: 'Fehler bei verbindlicher Beauftragung' });
  }
});

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

// 5. HANDWERKER DASHBOARD ROUTES
// ----------------------------------------------------------------------------

// Get matching tenders for handwerker
app.get('/api/handwerker/:companyId/tenders', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Get handwerker details with trades
    const handwerkerResult = await query(
      `SELECT h.*, array_agg(ht.trade_code) as trades
       FROM handwerker h
       LEFT JOIN handwerker_trades ht ON ht.handwerker_id = h.id
       WHERE h.company_id = $1
       GROUP BY h.id`,
      [companyId]
    );
    
    if (handwerkerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Handwerker nicht gefunden' });
    }
    
    const handwerker = handwerkerResult.rows[0];
    const trades = handwerker.trades || [];
    
    // Get matching tenders - auch hier zip_code verwenden
    const result = await query(
      `SELECT DISTINCT t.*, p.description, p.budget, p.zip_code, p.city,
              tr.name as trade,
              CASE WHEN t.created_at > NOW() - INTERVAL '3 days' THEN true ELSE false END as "isNew"
       FROM tenders t
       JOIN projects p ON t.project_id = p.id
       JOIN trades tr ON t.trade_code = tr.code
       WHERE t.trade_code = ANY($1::text[])
       AND t.status = 'open'
       AND t.deadline > NOW()
       ORDER BY t.created_at DESC`,
      [trades]
    );
    
    // Calculate distance and filter by radius (simplified)
    const tenders = result.rows.map(tender => ({
      ...tender,
      projectType: tender.description?.substring(0, 50),
      location: `${tender.zip} ${tender.city}`,
      distance: Math.round(Math.random() * handwerker.action_radius), // Simplified
      estimatedVolume: tender.budget || Math.round(Math.random() * 50000 + 10000),
      executionDate: 'KW ' + (15 + Math.round(Math.random() * 10)) + '/2025',
      deadline: tender.deadline
    }));
    
    res.json(tenders);
    
  } catch (error) {
    console.error('Error fetching handwerker tenders:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Ausschreibungen' });
  }
});

// Get handwerker bundles
app.get('/api/handwerker/:companyId/bundles', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Simplified bundle response - in real implementation would check for actual bundles
    const bundles = [];
    
    res.json(bundles);
    
  } catch (error) {
    console.error('Error fetching bundles:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Bündel' });
  }
});

// Get handwerker offers
app.get('/api/handwerker/:companyId/offers', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    const result = await query(
      `SELECT o.*, t.name as trade, p.description as "projectType", 
              p.zip || ' ' || p.city as location,
              o.created_at as "submittedDate"
       FROM offers o
       JOIN handwerker h ON o.handwerker_id = h.id
       JOIN tenders tn ON o.tender_id = tn.id
       JOIN trades t ON tn.trade_code = t.code
       JOIN projects p ON tn.project_id = p.id
       WHERE h.company_id = $1
       ORDER BY o.created_at DESC`,
      [companyId]
    );
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching handwerker offers:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Angebote' });
  }
});

// Get handwerker contracts
app.get('/api/handwerker/:companyId/contracts', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    const result = await query(
      `SELECT o.*, p.description as "projectType", b.name as "clientName",
              b.email as "clientEmail", b.phone as "clientPhone",
              p.street || ' ' || p.house_number || ', ' || p.zip || ' ' || p.city as "projectAddress",
              of.amount, of.preliminary_date as "preliminaryDate", t.name as trade
       FROM orders o
       JOIN handwerker h ON o.handwerker_id = h.id
       JOIN projects p ON o.project_id = p.id
       JOIN bauherren b ON p.bauherr_id = b.id
       JOIN offers of ON o.offer_id = of.id
       JOIN trades t ON o.trade_id = t.id
       WHERE h.company_id = $1
       AND o.status = 'preliminary'
       ORDER BY o.created_at DESC`,
      [companyId]
    );
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Verträge' });
  }
});

// Get handwerker orders
app.get('/api/handwerker/:companyId/orders', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    const result = await query(
      `SELECT o.*, p.description as "projectType", b.name as "clientName",
              p.street || ' ' || p.house_number || ', ' || p.zip || ' ' || p.city as "projectAddress",
              o.created_at as "orderDate", t.name as trade,
              EXTRACT(WEEK FROM o.created_at) + 2 as "executionWeek"
       FROM orders o
       JOIN handwerker h ON o.handwerker_id = h.id
       JOIN projects p ON o.project_id = p.id
       JOIN bauherren b ON p.bauherr_id = b.id
       JOIN trades t ON o.trade_id = t.id
       WHERE h.company_id = $1
       AND o.status = 'active'
       ORDER BY o.created_at DESC`,
      [companyId]
    );
    
    res.json(result.rows.map(order => ({
      ...order,
      status: order.status === 'active' ? 'aktiv' : order.status,
      progress: Math.round(Math.random() * 100)
    })));
    
  } catch (error) {
    console.error('Error fetching handwerker orders:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Aufträge' });
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

// Accept preliminary contract
app.post('/api/contracts/:contractId/accept-preliminary', async (req, res) => {
  try {
    const { contractId } = req.params;
    
    await query(
      `UPDATE orders SET 
       handwerker_accepted = true,
       handwerker_accepted_at = NOW()
       WHERE id = $1`,
      [contractId]
    );
    
    res.json({ success: true, message: 'Vorläufige Beauftragung angenommen' });
    
  } catch (error) {
    console.error('Error accepting preliminary:', error);
    res.status(500).json({ error: 'Fehler bei der Annahme' });
  }
});

// Confirm offer after inspection
app.post('/api/contracts/:contractId/confirm-offer', async (req, res) => {
  try {
    const { contractId } = req.params;
    
    await query(
      `UPDATE orders SET 
       offer_confirmed = true,
       offer_confirmed_at = NOW()
       WHERE id = $1`,
      [contractId]
    );
    
    res.json({ success: true, message: 'Angebot bestätigt' });
    
  } catch (error) {
    console.error('Error confirming offer:', error);
    res.status(500).json({ error: 'Fehler bei der Bestätigung' });
  }
});

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

// Passwort ändern
app.put('/api/handwerker/:id/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Hier würde normalerweise das alte Passwort verifiziert werden
    // Für POC vereinfacht
    
    await query(
      `UPDATE handwerker SET password = $2 WHERE id = $1`,
      [req.params.id, newPassword] // In Produktion: Hash verwenden!
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Passwort-Update fehlgeschlagen' });
  }
});

// Zwei-Faktor-Auth updaten
app.put('/api/handwerker/:id/two-factor', async (req, res) => {
  try {
    const { twoFactorEnabled } = req.body;
    
    await query(
      `UPDATE handwerker SET two_factor_enabled = $2 WHERE id = $1`,
      [req.params.id, twoFactorEnabled]
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Update fehlgeschlagen' });
  }
});

// Account löschen
app.delete('/api/handwerker/:id/account', async (req, res) => {
  try {
    await query('DELETE FROM handwerker WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Account gelöscht' });
  } catch (err) {
    res.status(500).json({ error: 'Löschen fehlgeschlagen' });
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
      if (key !== 'id' && key !== 'created_at') {
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
