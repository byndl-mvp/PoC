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

const OpenAI = require("openai");
const Anthropic = require("@anthropic-ai/sdk");

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
const MODEL_OPENAI = process.env.MODEL_OPENAI || 'gpt-4o-mini';
const MODEL_ANTHROPIC = process.env.MODEL_ANTHROPIC || 'claude-3-5-sonnet-latest';

// ===========================================================================
// GEWERKE-KOMPLEXITÄT DEFINITIONEN (KORREKTE CODES)
// ===========================================================================

const TRADE_COMPLEXITY = {
  // Sehr komplexe Gewerke (25-40 Fragen)
  DACH:  { complexity: 'SEHR_HOCH', minQuestions: 18, maxQuestions: 28, targetPositionsRatio: 0.8 },
  ELEKT: { complexity: 'SEHR_HOCH', minQuestions: 16, maxQuestions: 25, targetPositionsRatio: 0.7 },
  SAN:   { complexity: 'SEHR_HOCH', minQuestions: 17, maxQuestions: 25, targetPositionsRatio: 0.8 },
  HEI:   { complexity: 'SEHR_HOCH', minQuestions: 16, maxQuestions: 26, targetPositionsRatio: 0.7 },
  KLIMA: { complexity: 'SEHR_HOCH', minQuestions: 15, maxQuestions: 25, targetPositionsRatio: 0.7 },
  ROH:   { complexity: 'HOCH',      minQuestions: 18, maxQuestions: 28, targetPositionsRatio: 0.8 },

  // Komplexe Gewerke (20-30 Fragen)
  TIS:   { complexity: 'HOCH', minQuestions: 15, maxQuestions: 20, targetPositionsRatio: 1.0 }, // Türen: oft 1:1
  FEN:   { complexity: 'HOCH', minQuestions: 18, maxQuestions: 22, targetPositionsRatio: 1.0 }, // Fenster: oft 1:1
  FASS:  { complexity: 'HOCH', minQuestions: 18, maxQuestions: 22, targetPositionsRatio: 0.8 },
  SCHL:  { complexity: 'HOCH', minQuestions: 15, maxQuestions: 20, targetPositionsRatio: 0.75 },
  PV:    { complexity: 'HOCH', minQuestions: 15, maxQuestions: 22, targetPositionsRatio: 0.75 },
  ZIMM:  { complexity: 'HOCH', minQuestions: 15, maxQuestions: 22, targetPositionsRatio: 0.85 },

  // Mittlere Komplexität (15-20 Fragen)
  FLI:   { complexity: 'MITTEL', minQuestions: 16, maxQuestions: 20, targetPositionsRatio: 0.8 },
  ESTR:  { complexity: 'MITTEL', minQuestions: 12, maxQuestions: 17, targetPositionsRatio: 0.7 },
  TRO:   { complexity: 'MITTEL', minQuestions: 15, maxQuestions: 20, targetPositionsRatio: 0.75 },
  BOD:   { complexity: 'MITTEL', minQuestions: 15, maxQuestions: 20, targetPositionsRatio: 0.8 },
  AUSS:  { complexity: 'MITTEL', minQuestions: 15, maxQuestions: 20, targetPositionsRatio: 0.75 },

  // Einfache Gewerke (8-15 Fragen)
  MAL:   { complexity: 'EINFACH', minQuestions: 8,  maxQuestions: 15, targetPositionsRatio: 0.8 },
  GER:   { complexity: 'EINFACH', minQuestions: 8,  maxQuestions: 12, targetPositionsRatio: 0.7 },
  ABBR:  { complexity: 'EINFACH', minQuestions: 10, maxQuestions: 15, targetPositionsRatio: 0.7 },

  // Intake ist speziell (16-24 Fragen)
  INT:   { complexity: 'INTAKE', minQuestions: 16, maxQuestions: 24, targetPositionsRatio: 0.0 }
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
    'questions': 6000,   
    'lv': 10000,         
    'intake': 4000,      
    'summary': 3000,
    'validation': 3000   
  };
  
  const maxTokens = options.maxTokens || defaultMaxTokens[task] || 4000;
  const temperature = options.temperature !== undefined ? options.temperature : 0.4;
  
  // LV IMMER mit OpenAI (wegen JSON-Mode), Rest bevorzugt Anthropic
  const primaryProvider = task === 'lv' 
    ? 'openai'  // LV immer OpenAI
    : ['detect', 'questions', 'intake', 'validation'].includes(task) 
      ? 'anthropic' 
      : 'openai';
  
  const callOpenAI = async () => {
  try {
    // JSON-Mode ohne Token-Limit-Beschränkung verwenden
    const useJsonMode = options.jsonMode;
    
    const response = await openai.chat.completions.create({
      model: MODEL_OPENAI,
      messages,
      temperature,
      max_tokens: Math.min(maxTokens, 16384),  // HIER: max_tokens statt max_completion_tokens!
      response_format: useJsonMode ? { type: "json_object" } : undefined
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('[LLM] OpenAI error:', error.status || error.message);
    throw error;
  }
};
  
  const callClaude = async () => {
    try {
      let systemMessage = messages.find(m => m.role === "system")?.content || "";
      
      // Für Claude: JSON-Instruktion in System-Prompt einbauen
      if (options.jsonMode) {
        systemMessage = `KRITISCH: Antworte AUSSCHLIESSLICH mit validem JSON!
- Beginne direkt mit {
- Ende mit }
- KEIN Markdown (keine \`\`\`)
- KEINE Erklärungen außerhalb des JSON
- KEINE Kommentare

${systemMessage}

ERINNERUNG: NUR valides JSON ausgeben!`;
      }
      
      const otherMessages = messages.filter(m => m.role !== "system");

      const response = await anthropic.messages.create({
        model: MODEL_ANTHROPIC,
        max_tokens: Math.min(maxTokens, 8192),
        temperature,
        system: systemMessage,
        messages: otherMessages,
      });

      return response.content[0].text;
    } catch (error) {
      console.error('[LLM] Anthropic error:', error.status || error.message);
      throw error;
    }
  };
  
  // Rest der Funktion bleibt gleich...
  let result = null;
  let lastError = null;
  
  // Try primary provider
  try {
    console.log(`[LLM] Task: ${task} | Trying primary: ${primaryProvider} | Tokens: ${maxTokens}`);
    
    if (primaryProvider === 'anthropic') {
      result = await callClaude();
    } else {
      result = await callOpenAI();
    }
    
    console.log(`[LLM] Success with primary ${primaryProvider}`);
    return result;
    
  } catch (primaryError) {
    lastError = primaryError;
    console.warn(`[LLM] Primary ${primaryProvider} failed with status ${primaryError.status || 'unknown'}`);
    
    // Try fallback provider
    const fallbackProvider = primaryProvider === 'anthropic' ? 'openai' : 'anthropic';
    
    try {
      console.log(`[LLM] Trying fallback: ${fallbackProvider}`);
      
      if (fallbackProvider === 'openai') {
        result = await callOpenAI();
      } else {
        result = await callClaude();
      }
      
      console.log(`[LLM] Success with fallback ${fallbackProvider}`);
      return result;
      
    } catch (fallbackError) {
      console.error(`[LLM] Fallback ${fallbackProvider} also failed with status ${fallbackError.status || 'unknown'}`);
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
  
  extractedData.impliedTrades.push({
    code: 'SCHL',
    reason: 'Blecharbeiten, Dachrinnen',
    confidence: 70
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
  
  // Basis-Range für das Gewerk
  const baseRange = {
    min: tradeConfig.minQuestions,
    max: tradeConfig.maxQuestions,
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
          informationCompleteness += 40; // Fläche ist kritisch!
        } else {
          missingCriticalInfo.push('Flächenangabe');
        }
        if (desc.includes('zimmer') || desc.includes('raum') || desc.includes('wohnung')) {
          informationCompleteness += 20;
        }
        if (desc.includes('weiß') || desc.includes('farbe') || desc.includes('farbton')) {
          informationCompleteness += 20;
        }
        // Bei "Zimmer streichen" ist oft schon genug Info da
        if (desc.includes('zimmer') && desc.includes('streichen')) {
          informationCompleteness += 30;
        }
        break;
        
      case 'DACH':
        if (!desc.match(/\d+\s*(m²|qm)/)) missingCriticalInfo.push('Dachfläche');
        else informationCompleteness += 30;
        if (!desc.includes('dachform') && !desc.includes('sattel') && !desc.includes('flach')) {
          missingCriticalInfo.push('Dachform');
        } else {
          informationCompleteness += 20;
        }
        break;
        
      case 'ELEKT':
        if (!desc.match(/\d+\s*(steckdose|schalter|dose)/)) missingCriticalInfo.push('Anzahl Elektropunkte');
        else informationCompleteness += 25;
        if (!desc.includes('verteiler') && !desc.includes('sicherung')) missingCriticalInfo.push('Verteilerinfo');
        else informationCompleteness += 15;
        break;
        
      case 'FLI': // Fliesenarbeiten
        if (desc.match(/\d+\s*(m²|qm)/)) informationCompleteness += 35;
        else missingCriticalInfo.push('Fliesenfläche');
        if (desc.includes('bad') || desc.includes('küche')) informationCompleteness += 20;
        break;
        
      case 'SAN': // Sanitär
        if (desc.includes('bad') || desc.includes('wc') || desc.includes('dusche')) {
          informationCompleteness += 25;
        }
        if (!desc.includes('austausch') && !desc.includes('erneuer') && !desc.includes('neu')) {
          missingCriticalInfo.push('Umfang der Arbeiten');
        }
        break;
        
      case 'GER': // Gerüstbau
        if (desc.match(/\d+\s*(m|meter)/)) informationCompleteness += 40;
        else missingCriticalInfo.push('Gebäudehöhe');
        if (desc.includes('einfamilienhaus') || desc.includes('efh')) informationCompleteness += 30;
        break;

      case 'FASS':
  if (!desc.match(/\d+\s*(m²|qm)/)) missingCriticalInfo.push('Fassadenfläche');
  else informationCompleteness += 30;
  if (!desc.includes('fassade') && !desc.includes('putz') && !desc.includes('dämmung')) {
    missingCriticalInfo.push('Art der Fassadenarbeiten');
  } else {
    informationCompleteness += 20;
  }
  break;

case 'ABBR':
  if (!desc.match(/\d+\s*(m²|m³|tonnen)/)) missingCriticalInfo.push('Abbruchmenge');
  else informationCompleteness += 30;
  if (!desc.includes('entkernung') && !desc.includes('teilabbruch') && !desc.includes('komplettabbruch')) {
    missingCriticalInfo.push('Art des Abbruchs');
  } else {
    informationCompleteness += 20;
  }
  break;

case 'BOD':
  if (!desc.match(/\d+\s*(m²|qm)/)) missingCriticalInfo.push('Bodenfläche');
  else informationCompleteness += 30;
  if (!desc.includes('parkett') && !desc.includes('laminat') && !desc.includes('vinyl')) {
    missingCriticalInfo.push('Bodenbelagsart');
  } else {
    informationCompleteness += 20;
  }
  break;

case 'HEI':
  if (!desc.match(/\d+\s*(kw|heizkörper|räume)/)) missingCriticalInfo.push('Heizleistung/Umfang');
  else informationCompleteness += 30;
  if (!desc.includes('gastherme') && !desc.includes('wärmepumpe') && !desc.includes('ölheizung')) {
    missingCriticalInfo.push('Heizungstyp');
  } else {
    informationCompleteness += 20;
  }
  break;

case 'KLIMA': // Lüftung- und Klimatechnik
    if (!desc.match(/\d+\s*(m²|qm)/)) missingCriticalInfo.push('Raumflächen');
    else informationCompleteness += 30;
    if (!desc.includes('raumhöhe') && !desc.includes('geschoss')) missingCriticalInfo.push('Raumhöhen');
    else informationCompleteness += 15;
    if (desc.includes('lüftung') || desc.includes('klima') || desc.includes('luftwechsel')) {
        informationCompleteness += 25;
    }
    if (desc.includes('kühlung') || desc.includes('heizung')) informationCompleteness += 20;
    break;

case 'PV': // Photovoltaik
  if (!desc.match(/\d+\s*(kwp|kw)/i)) missingCriticalInfo.push('Anlagengröße');
  else informationCompleteness += 35;
  if (!desc.match(/\d+\s*(m²|qm)/)) missingCriticalInfo.push('Dachfläche');
  else informationCompleteness += 25;
  if (desc.includes('speicher') || desc.includes('batterie')) informationCompleteness += 20;
  break;
        
case 'FEN':
  if (!desc.match(/\d+\s*(fenster|türen|stück)/)) missingCriticalInfo.push('Anzahl Fenster/Türen');
  else informationCompleteness += 30;
  if (!desc.includes('kunststoff') && !desc.includes('holz') && !desc.includes('aluminium')) {
    missingCriticalInfo.push('Material Fenster/Türen');
  } else {
    informationCompleteness += 20;
  }
  break;

case 'TIS':
  if (!desc.match(/\d+\s*(m|schrank|element)/)) missingCriticalInfo.push('Umfang Tischlerarbeiten');
  else informationCompleteness += 30;
  if (!desc.includes('einbauschrank') && !desc.includes('küche') && !desc.includes('möbel')) {
    missingCriticalInfo.push('Art der Tischlerarbeiten');
  } else {
    informationCompleteness += 20;
  }
  break;

case 'ROH':
  if (!desc.match(/\d+\s*(m²|m³|qm)/)) missingCriticalInfo.push('Rohbaufläche/Volumen');
  else informationCompleteness += 30;
  if (!desc.includes('bodenplatte') && !desc.includes('wand') && !desc.includes('decke')) {
    missingCriticalInfo.push('Art der Rohbauarbeiten');
  } else {
    informationCompleteness += 20;
  }
  break;

case 'ZIMM': // Zimmererarbeiten
  if (!desc.match(/\d+\s*(m²|qm)/)) missingCriticalInfo.push('Holzkonstruktionsfläche');
  else informationCompleteness += 30;
  if (!desc.includes('dachstuhl') && !desc.includes('holzbau') && !desc.includes('carport')) {
    missingCriticalInfo.push('Art der Zimmererarbeiten');
  } else {
    informationCompleteness += 20;
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
  else informationCompleteness += 30;
  if (!desc.includes('rigips') && !desc.includes('gipskarton') && !desc.includes('ständerwerk')) {
    missingCriticalInfo.push('Art der Trockenbauarbeiten');
  } else {
    informationCompleteness += 20;
  }
  break;

case 'SCHL':
  if (!desc.match(/\d+\s*(m|meter|stück)/)) missingCriticalInfo.push('Umfang Schlosserarbeiten');
  else informationCompleteness += 30;
  if (!desc.includes('geländer') && !desc.includes('zaun') && !desc.includes('tor')) {
    missingCriticalInfo.push('Art der Schlosserarbeiten');
  } else {
    informationCompleteness += 20;
  }
  break;

case 'AUSS':
  if (!desc.match(/\d+\s*(m²|qm)/)) missingCriticalInfo.push('Außenbereichsfläche');
  else informationCompleteness += 30;
  if (!desc.includes('pflaster') && !desc.includes('rasen') && !desc.includes('bepflanzung')) {
    missingCriticalInfo.push('Art der Außenarbeiten');
  } else {
    informationCompleteness += 20;
  }
  break;

case 'INT':
  // Spezialfall INT - weniger strenge Anforderungen
  if (!desc.match(/\d+/)) missingCriticalInfo.push('Projektumfang');
  else informationCompleteness += 30;
  informationCompleteness += 20; // Bonus für INT
  break;
    
    }
    
    // Allgemeine hilfreiche Informationen
    if (desc.match(/\d+\s*(zimmer|räume)/)) informationCompleteness += 15;
    if (desc.includes('altbau') || desc.includes('neubau')) informationCompleteness += 10;
    if (desc.includes('komplett') || desc.includes('gesamt')) informationCompleteness += 10;
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
    if (informationCompleteness >= 70) {
      targetCount = baseRange.min; // Minimum
    } else if (informationCompleteness >= 50) {
      targetCount = Math.round(baseRange.min + 2);
    } else if (informationCompleteness >= 30) {
      targetCount = Math.round((baseRange.min + baseRange.max) / 2);
    } else {
      targetCount = baseRange.max - 2;
    }
  } else if (baseRange.complexity === 'SEHR_HOCH' || baseRange.complexity === 'HOCH') {
    // Komplexe Gewerke brauchen mehr Details
    if (informationCompleteness >= 80) {
      targetCount = Math.round(baseRange.min + 5);
    } else if (informationCompleteness >= 60) {
      targetCount = Math.round((baseRange.min + baseRange.max) / 2);
    } else if (informationCompleteness >= 40) {
      targetCount = Math.round(baseRange.max - 5);
    } else {
      targetCount = baseRange.max;
    }
  } else {
    // Mittlere Komplexität
    if (informationCompleteness >= 70) {
      targetCount = baseRange.min + 2;
    } else if (informationCompleteness >= 40) {
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
  if (projectContext.description) {
    const desc = projectContext.description.toLowerCase();
    // "Zimmer streichen" oder ähnlich einfache Aufgaben
    if ((desc.includes('zimmer') || desc.includes('raum')) && 
        (desc.includes('streichen') || desc.includes('malen')) &&
        tradeCode === 'MAL') {
      targetCount = Math.min(targetCount, 8); // Maximal 8 Fragen
      if (desc.match(/\d+\s*(m²|qm)/)) {
        targetCount = Math.min(targetCount, 5); // Mit Flächenangabe nur 5 Fragen
      }
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
function getPositionOrientation(tradeCode, questionCount) {
  const tradeConfig = TRADE_COMPLEXITY[tradeCode] || DEFAULT_COMPLEXITY;
  
  // Basis-Orientierung
  const ratio = tradeConfig.targetPositionsRatio;
  const baseOrientation = Math.round(questionCount * ratio);
  
  // Orientierungs-Range (flexibler Bereich)
  const orientationMin = Math.max(1, Math.round(questionCount * (ratio - 0.2)));
  const orientationMax = Math.round(questionCount * (ratio + 0.3));
  
  console.log(`[LV-ORIENTATION] ${tradeCode}: ${orientationMin}-${orientationMax} positions from ${questionCount} questions (ratio: ${ratio})`);
  
  return {
    min: orientationMin,
    max: orientationMax,
    base: baseOrientation,
    ratio: ratio
  };
}

/**
 * Projektkomplexität bestimmen
 */
function determineProjectComplexity(projectContext, intakeAnswers = []) {
  let complexityScore = 0;
  
  // Budget-basierte Komplexität
  if (projectContext.budget) {
    const budgetStr = projectContext.budget.toLowerCase();
    if (budgetStr.includes('500000') || budgetStr.includes('500k')) complexityScore += 5;
    else if (budgetStr.includes('200000') || budgetStr.includes('200k')) complexityScore += 4;
    else if (budgetStr.includes('100000') || budgetStr.includes('100k')) complexityScore += 3;
    else if (budgetStr.includes('50000') || budgetStr.includes('50k')) complexityScore += 2;
    else if (budgetStr.includes('20000') || budgetStr.includes('20k')) complexityScore += 1;
  }
  
  // Beschreibungslänge und Komplexität
  if (projectContext.description) {
    const wordCount = projectContext.description.split(' ').length;
    if (wordCount > 150) complexityScore += 3;
    else if (wordCount > 100) complexityScore += 2;
    else if (wordCount > 50) complexityScore += 1;
    
    // Spezielle Keywords
    const complexKeywords = ['kernsanierung', 'denkmalschutz', 'komplett', 'statik', 'energetisch'];
    const description = projectContext.description.toLowerCase();
    complexKeywords.forEach(keyword => {
      if (description.includes(keyword)) complexityScore += 1;
    });
  }
  
  // Kategorie-basierte Komplexität
  if (projectContext.category) {
    const category = projectContext.category.toLowerCase();
    if (category.includes('neubau') || category.includes('kernsanierung')) complexityScore += 3;
    else if (category.includes('umbau') || category.includes('anbau')) complexityScore += 2;
    else if (category.includes('renovierung') || category.includes('modernisierung')) complexityScore += 1;
  }
  
  // Intake-Antworten Komplexität
  if (intakeAnswers.length > 15) complexityScore += 2;
  else if (intakeAnswers.length > 10) complexityScore += 1;
  
  // Klassifizierung
  if (complexityScore >= 10) return 'SEHR_HOCH';
  if (complexityScore >= 7) return 'HOCH';
  if (complexityScore >= 4) return 'MITTEL';
  if (complexityScore >= 2) return 'NIEDRIG';
  return 'EINFACH';
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

  // NEU: Lade extrahierte Projektdaten
  let extractedData = null;
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
      `SELECT question_text, answer_text 
       FROM intake_responses
       WHERE project_id = $1`,
      [projectContext.projectId]
    );
    
    if (intakeResponses.rows.length > 0) {
      allAnsweredInfo.fromIntake = intakeResponses.rows;
      projectContext.intakeData = intakeResponses.rows;
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
`WICHTIG: Dies sind ALLGEMEINE PROJEKTFRAGEN zur Erfassung der Baustellenbedingungen.

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
   - Gibt es einen Balkon/Fenster für Kranarbeiten (bei höheren Etagen)?

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
- Kleines Projekt (1-2 Gewerke): 10-15 Fragen
- Mittleres Projekt (3-5 Gewerke): 15-20 Fragen  
- Großes Projekt (>5 Gewerke): 20-25 Fragen

BEISPIELE INTELLIGENTER ANPASSUNG:
- Nur ELEKT: Keine Bauwasser-Frage
- Nur Badsanierung: Kein Denkmalschutz
- Nur MAL innen: Keine Gebäudehöhe
- DACH+FASS: Alle Außen-relevanten Fragen

KEINE FRAGEN ZU:
- Technischen Details (Dämmstärke, Verglasungsart, U-Werte)
- Spezifischen Materialien oder Produkten
- Detaillierten Maßen (außer grobe Gebäudegröße)
- Gewerkespezifischen Themen
- Anzahl Fenster/Türen (wenn bereits in Beschreibung)

KRITISCH: Stelle NUR relevante Fragen für die erkannten Gewerke!

Diese Informationen werden für die Vorbemerkungen aller LVs verwendet.` : 
`Erstelle einen GEZIELTEN Fragenkatalog für ${tradeName}. 
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
   - Frage nach Haustüren NUR wenn in Projektbeschreibung erwähnt
   - Projektbeschreibung enthält "Haustür"? ${projectContext.description?.toLowerCase().includes('haustür') ? 'JA ✓ - Bitte nach Haustür fragen!' : 'NEIN ✗ - KEINE Haustür-Fragen!'}
   - Bei "Fenster und Haustür" → Frage nach beidem
   - Bei nur "Fenster" → NUR Fenster-Fragen

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

${tradeCode === 'ZIMM' ? `
18. SPEZIELLE ZIMMERER-REGELN:
   WICHTIG: Zimmerer macht NUR Holzkonstruktionen!
   
   KEINE FRAGEN ZU (gehört zum Dachdecker):
   - Dachdämmung
   - Dampfbremse/Dampfsperre
   - Dacheindeckung/Ziegel
   - Unterspannbahn
   - Dachrinnen
   
   KLARE ABGRENZUNG:
   - Zimmerer = Holztragwerk
   - Dachdecker = Dämmung + Abdichtung + Eindeckung
   - Bei Dachprojekten arbeiten beide Gewerke nacheinander
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
      maxTokens: 6000,
      temperature: 0.5,
      jsonMode: false 
    });
    
    // Robuste Bereinigung für Claude's Output
let cleanedResponse = response
  .replace(/```json\s*/gi, '')
  .replace(/```\s*/g, '')
  .trim();

// HIER KOMMT DER NEUE CODE:
// Parse die Fragen
let questions;
try {
  questions = JSON.parse(cleanedResponse);
} catch (parseError) {
  console.error('[QUESTIONS] Failed to parse response:', parseError);
  console.log('[QUESTIONS] Raw response:', cleanedResponse.substring(0, 500));
  throw new Error('Fehler beim Verarbeiten der generierten Fragen');
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

// Zähle Fragen vor Duplikat-Filter
const beforeDuplicates = questions.length;
    
// NEU: Post-Processing Filter anwenden
console.log(`[DEBUG] tradeCode: "${tradeCode}", questions before filter: ${questions.length}`);
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
    console.error('[QUESTIONS] Generation failed:', err);
    console.log('[QUESTIONS] Using fallback questions due to error');
    throw new Error('Fehler bei der Fragengenerierung - bitte versuchen Sie es erneut');
  }
}

/**
 * Filtert duplizierte Fragen basierend auf Intake-Antworten
 */
function filterDuplicateQuestions(questions, intakeAnswers) {
  if (!intakeAnswers || intakeAnswers.length === 0) return questions;
  
  const forbiddenPatterns = [];
  
  intakeAnswers.forEach(item => {
    const q = item.question_text?.toLowerCase() || '';
    const a = item.answer_text?.toLowerCase() || '';
    
    // Badfläche beantwortet -> keine Badflächen-Fragen mehr
    if (q.includes('bad') && a.match(/\d+\s*(m²|qm)/)) {
      forbiddenPatterns.push(
        /bad.*fläche/i,
        /fläche.*bad/i,
        /groß.*bad/i,
        /bad.*groß/i,
        /sanitär.*fläche/i
      );
    }
    
    // Stockwerk beantwortet -> keine Stockwerk-Fragen mehr
    if (q.includes('stock') || q.includes('geschoss')) {
      forbiddenPatterns.push(
        /stock/i,
        /geschoss/i,
        /etage/i,
        /welche.*ebene/i
      );
    }
  });
  
  return questions.filter(q => {
    const questionText = q.question || q.text || '';
    const isDuplicate = forbiddenPatterns.some(pattern => pattern.test(questionText));
    
    if (isDuplicate) {
      console.log(`[FILTER] Removing duplicate: ${questionText}`);
    }
    return !isDuplicate;
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
    'tür': ['TIS', 'MAL', 'FEN'],                   // Türbereiche betrifft mehrere
    'fläche': ['FLI', 'MAL', 'BOD', 'FASS', 'ESTR'], // Flächen allgemein
    'material': ['ALLE'],                            // Material kann jedes Gewerk fragen
    'farbe': ['MAL', 'FASS', 'TIS', 'FEN'],         // Farben betrifft mehrere
    'montage': ['ALLE'],                             // Montage betrifft alle
    'demontage': ['ALLE'],                           // Demontage betrifft alle
  };

  // NUR EXKLUSIVE Begriffe - nur DIESES Gewerk darf fragen
  const STRICTLY_EXCLUSIVE = {
    'ELEKT': ['steckdose', 'schalter', 'lampe', 'elektro', 'kabel', 'sicherung', 'strom', 'leitung', 'verteiler', 'fi-schalter'],
    'HEI': ['heizung', 'heizkörper', 'thermostat', 'warmwasser', 'kessel', 'brenner', 'fußbodenheizung', 'radiator'],
    'KLIMA': ['lüftung', 'klima', 'luftwechsel', 'abluft', 'zuluft', 'klimaanlage', 'wärmerückgewinnung'],
    'TRO': ['rigips', 'trockenbau', 'ständerwerk', 'vorwand', 'gipskarton', 'abgehängte decke'],
    'FLI': ['fliesen', 'verfugen', 'mosaik', 'naturstein', 'feinsteinzeug', 'bodenfliesen', 'wandfliesen'],
    'MAL': ['streichen', 'innenputz', 'tapezieren', 'verputzen', 'spachteln', 'anstrich', 'farbe', 'lackieren', 'grundierung'],
    'BOD': ['parkett', 'laminat', 'vinyl', 'teppich', 'linoleum', 'kork', 'designboden', 'bodenbelag'],
    'ROH': ['mauerwerk', 'durchbruch', 'beton', 'maurerarbeiten', 'sturz'],
    'SAN': ['bad', 'wc', 'waschbecken', 'dusche', 'badewanne', 'sanitär', 'abfluss', 'wasserhahn', 'armatur'],
    'FEN': ['fenster','verglasung', 'haustür', 'rolladen', 'jalousie', 'außentür', 'terrassentür', 'isolierglas'],
    'TIS': ['tür', 'innentür', 'zarge', 'möbel', 'einbauschrank', 'küche', 'wohnungseingangstür', 'arbeitsplatte'],
    'DACH': ['dachfenster', 'ziegel', 'dachrinne', 'schneefang', 'gauben', 'eindeckung', 'dampfbremse', 'dämmung', 'unterspannbahn'],
    'FASS': ['fassade', 'wdvs', 'außenputz', 'verblendung', 'klinker', 'fassadenfarbe'],
    'GER': ['gerüst', 'baugerüst', 'arbeitsgerüst', 'fassadengerüst', 'rollgerüst', 'dachgerüst'],
    'ZIMM': ['holzbau', 'dachstuhl', 'balken', 'carport', 'pergola', 'holzkonstruktion', 'fachwerk', 'sparren', 'pfetten'],
    'ESTR': ['estrich', 'fließestrich', 'zementestrich', 'anhydritestrich', 'trockenestrich', 'ausgleichsmasse'],
    'SCHL': ['geländer', 'zaun', 'tor', 'metallbau', 'stahltreppe', 'gitter', 'schlosserarbeiten'],
    'AUSS': ['pflaster', 'terrasse', 'einfahrt', 'garten', 'außenanlage', 'randstein', 'rasen'],
    'PV': ['solar', 'photovoltaik', 'solaranlage', 'wechselrichter', 'speicher', 'batterie', 'einspeisung'],
    'ABBR': ['abriss', 'abbruch', 'entkernung', 'rückbau', 'demontage', 'entsorgung', 'schutt']
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
  
  // NEU: Orientierungswerte für Positionsanzahl berechnen (nur als Richtwert!)
const answeredQuestionCount = tradeAnswers.length;
const orientation = getPositionOrientation(trade.code, answeredQuestionCount);
console.log(`[LV] Orientation for ${trade.code}: ${orientation.min}-${orientation.max} positions from ${answeredQuestionCount} questions`);
  
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

  const systemPrompt = `Du bist ein Experte für VOB-konforme Leistungsverzeichnisse mit 25+ Jahren Erfahrung.
Erstelle ein PRÄZISES und REALISTISCHES Leistungsverzeichnis für ${trade.name}.

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
KRITISCH FÜR GERÜSTBAU - MINDESTENS 5 POSITIONEN:
- Gerüstfläche MUSS aus Antworten übernommen werden
- Wenn Fläche nicht vorhanden: Länge x Höhe berechnen

PFLICHT-POSITIONEN:
1. Auf- und Abbau Arbeitsgerüst (m²) - NUR EINE Position
2. Standzeit erste 4 Wochen (m²) - NUR EINE Position
3. Standzeit jede weitere Woche (m²)
4. An- und Abtransport (pauschal)
5. Schutznetz/Plane (m²) - bei Bedarf

REALISTISCHE PREISE:
- Auf-/Abbau: 8-12 €/m²
- Standzeit erste 4 Wochen: 4-6 €/m²
- Jede weitere Woche: 1-2 €/m²
- Transport: 300-500 € pauschal
- NIEMALS über 12 €/m² für Auf-/Abbau!
` : ''}

${trade.code === 'DACH' ? `
KRITISCH FÜR DACHARBEITEN:
- NUR Dachfenster wenn EXPLIZIT "Dachfenster" erwähnt
- Bei "Fenster" im Projekt → Das sind NORMALE Fenster (Gewerk FEN)
- KEINE Annahmen über nicht erwähnte Leistungen
- Fokus auf: Dämmung, Eindeckung, Abdichtung, Rinnen
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
    maxTokens: 10000,
    temperature: 0.3,
    jsonMode: true,  // Nutzt jetzt den korrigierten JSON-Mode
    timeout: 60000
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
  
  // MINIMALE Bereinigung - nur Whitespace und eventuelles Markdown
  let cleanedResponse = response.trim();
  
  // Nur falls trotz JSON-Mode Markdown zurückkommt (sollte bei OpenAI nicht passieren)
  if (cleanedResponse.includes('```')) {
    console.warn('[LV] Unexpected markdown wrapper despite JSON mode active');
    const match = cleanedResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      cleanedResponse = match[1].trim();
    }
  }
  
  // Direkt parsen - mit aktivem JSON-Mode sollte das funktionieren
let lv;
try {
  lv = JSON.parse(cleanedResponse);
  console.log(`[LV] Successfully parsed JSON for ${trade.code} (JSON mode was active)`);
  
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
- Maßangaben erfinden die nicht in den Antworten stehen`;
    
    const retryResponse = await llmWithPolicy('lv', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: enhancedPrompt }
    ], { 
      maxTokens: 10000, 
      temperature: 0.3,
      jsonMode: true
    });
    
    lv = JSON.parse(retryResponse.trim());
    console.log(`[LV] ${dimensionConfig.itemName}-LV erfolgreich regeneriert mit Maßangaben aus Antworten`);
  }
}
  
} catch (parseError) {
    // Das sollte mit aktivem JSON-Mode eigentlich nicht passieren
    console.error('[LV] CRITICAL: Parse error despite JSON mode active!');
    console.error('[LV] Error message:', parseError.message);
    
    // Detailliertes Error-Logging
    const errorMatch = parseError.message.match(/position (\d+)/);
    if (errorMatch) {
      const pos = parseInt(errorMatch[1]);
      console.error('[LV] Error at position:', pos);
      console.error('[LV] Context before:', cleanedResponse.substring(Math.max(0, pos - 100), pos));
      console.error('[LV] >>> ERROR HERE <<<');
      console.error('[LV] Context after:', cleanedResponse.substring(pos, Math.min(cleanedResponse.length, pos + 100)));
      console.error('[LV] Character at position:', {
        char: cleanedResponse.charAt(pos),
        charCode: cleanedResponse.charCodeAt(pos),
        hex: '0x' + cleanedResponse.charCodeAt(pos).toString(16)
      });
    }
    
    // Zeige vollständige Response-Struktur für Debugging
    console.error('[LV] Full response first 500 chars:', cleanedResponse.substring(0, 500));
    console.error('[LV] Full response last 500 chars:', cleanedResponse.substring(cleanedResponse.length - 500));
    
    // Klare Fehlermeldung ohne Reparaturversuche
    throw new Error(`LV-Generierung für ${trade.name} fehlgeschlagen - OpenAI lieferte trotz JSON-Mode ungültiges JSON`);
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
    // Skip Stundenlohn und Kleinmaterial
    if (pos.title?.includes('Stundenlohn') || 
        pos.title?.toLowerCase().includes('kleinmaterial')) {
      return pos;
    }
    
    const titleLower = pos.title?.toLowerCase() || '';
    const descLower = pos.description?.toLowerCase() || '';
    
    // NEUE REGEL: "Lieferung und Demontage" ist VERBOTEN
    if (titleLower.includes('lieferung und demontage')) {
      console.error(`[KRITISCH] Verbotene Kombination "Lieferung und Demontage" in ${tradeCode}`);
      
      // Korrigiere nur den Titel
      pos.title = pos.title.replace('Lieferung und Demontage', 'Lieferung und Montage');
      warnings.push(`"Lieferung und Demontage" korrigiert zu "Lieferung und Montage"`);
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
        pos.unitPrice = 40; // Realistisch für Fenster/Tür-Entsorgung
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
    
    // 3. BESTEHENDE REGEL: Nebenleistungen
    const isNebenleistung = 
      titleLower.includes('anschluss') ||
      titleLower.includes('abdichtung') ||
      titleLower.includes('laibung') ||
      titleLower.includes('befestigung') ||
      titleLower.includes('dämmstreifen') ||
      titleLower.includes('anarbeiten');
    
    if (isNebenleistung && pos.unitPrice > 200 && pos.unit !== 'psch') {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = pos.unit === 'm' ? 50 : 80;
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Nebenleistung korrigiert: "${pos.title}": €${oldPrice} → €${pos.unitPrice}`);
      fixedCount++;
    }
    
    // 4. BESTEHENDE REGEL: Hauptpositionen Mindestpreise
    const isMainPosition = 
      titleLower.includes('fenster') && !titleLower.includes('entsorg') ||
      titleLower.includes('tür') && !titleLower.includes('entsorg') ||
      titleLower.includes('heizung') ||
      titleLower.includes('sanitär');
    
    if (isMainPosition && pos.unitPrice < 50) {
      const oldPrice = pos.unitPrice;
      
      if (titleLower.includes('fenster')) {
        const sizeMatch = (pos.title || pos.description || '').match(/(\d+)\s*x\s*(\d+)/);
        if (sizeMatch) {
          const width = parseInt(sizeMatch[1]);
          const height = parseInt(sizeMatch[2]);
          const area = (width * height) / 10000;
          pos.unitPrice = Math.round(600 + (area * 500));
        } else {
          pos.unitPrice = 900;
        }
        warnings.push(`Fenster korrigiert: €${oldPrice} → €${pos.unitPrice}`);
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
    
    // Berechne Aufpreis für Sondermaße
    // Breiten-Aufpreis
    if (width > 120) {
      priceMultiplier *= 2;      // Extreme Überbreite = Sonderanfertigung
    } else if (width > 100) {
      priceMultiplier *= 1.5;    // Überbreite
    } else if (width > 94) {
      priceMultiplier *= 1.3;     // Leichte Überbreite
    }
    
    // Höhen-Aufpreis
    if (height > 250) {
      priceMultiplier *= 2;      // Extreme Überhöhe = Sonderanfertigung
    } else if (height > 230) {
      priceMultiplier *= 1.5;    // Überhöhe
    } else if (height > 210) {
      priceMultiplier *= 1.3;     // Leichte Überhöhe
    }
  }
  
  if (titleLower.includes('innentür') || titleLower.includes('tür')) {
    // Unterscheide zwischen verschiedenen Türtypen
    if (descLower.includes('massivholz') || titleLower.includes('massivholz')) {
      const minPrice = Math.round(550 * priceMultiplier);
      if (pos.unitPrice < minPrice) {
        const oldPrice = pos.unitPrice;
        pos.unitPrice = minPrice; // Massivholztür mit Sondermaß-Aufschlag
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
        warnings.push(`Massivholztür ${sizeMatch ? `(${sizeMatch[1]}x${sizeMatch[2]}cm)` : ''} korrigiert: €${oldPrice} → €${pos.unitPrice}`);
        fixedCount++;
      }
    } else if (descLower.includes('wohnungseingangstür') || titleLower.includes('wohnungseingang')) {
      const minPrice = Math.round(950 * priceMultiplier);
      if (pos.unitPrice < minPrice) {
        const oldPrice = pos.unitPrice;
        pos.unitPrice = minPrice; // Wohnungseingangstür mit Sondermaß-Aufschlag
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
        warnings.push(`Wohnungseingangstür ${sizeMatch ? `(${sizeMatch[1]}x${sizeMatch[2]}cm)` : ''} korrigiert: €${oldPrice} → €${pos.unitPrice}`);
        fixedCount++;
      }
    } else {
      // Standard Innentür
      const minPrice = Math.round(420 * priceMultiplier);
      if (pos.unitPrice < minPrice) {
        const oldPrice = pos.unitPrice;
        pos.unitPrice = minPrice; // Standard Innentür mit Sondermaß-Aufschlag
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
        
        // Spezielle Warnung bei extremen Sondermaßen
        if (priceMultiplier >= 2) {
          warnings.push(`SONDERANFERTIGUNG Tür ${sizeMatch[1]}x${sizeMatch[2]}cm korrigiert: €${oldPrice} → €${pos.unitPrice}`);
        } else if (priceMultiplier > 1) {
          warnings.push(`Sondermaß Tür ${sizeMatch ? `(${sizeMatch[1]}x${sizeMatch[2]}cm)` : ''} korrigiert: €${oldPrice} → €${pos.unitPrice}`);
        } else {
          warnings.push(`Innentür korrigiert: €${oldPrice} → €${pos.unitPrice}`);
        }
        fixedCount++;
      }
    }
  }
  
  // Zargen separat prüfen (auch mit Sondermaß-Aufschlag)
  if (titleLower.includes('zarge')) {
    const minPrice = Math.round(150 * priceMultiplier);
    if (pos.unitPrice < minPrice) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = minPrice; // Zarge mit Sondermaß-Aufschlag
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Zarge ${sizeMatch ? `(Sondermaß ${sizeMatch[1]}x${sizeMatch[2]}cm)` : ''} korrigiert: €${oldPrice} → €${pos.unitPrice}`);
      fixedCount++;
    }
  }
  
  // Türdrücker/Beschläge (unabhängig von Sondermaß)
  if (titleLower.includes('drücker') || titleLower.includes('beschlag')) {
    if (pos.unitPrice < 30) {
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 45; // Drücker mindestens 45€
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Türdrücker korrigiert: €${oldPrice} → €${pos.unitPrice}`);
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
      except: ['revisionsklappen', 'installationsschächte']
    },
    'TIS': {
      forbidden: ['fenster', 'elektro installation', 'sanitär', 'heizung', 'rigips', 'gipskarton', 'sockelleisten'],
      except: ['fensterbank innen', 'möbelanschluss']
    },
    'ROH': {
      forbidden: ['fenster einbau', 'gaube', 'elektro feininstallation', 'sanitär objekte', 'fliesen', 'parkett', 'rigips'],
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
    
    // Übergebe extrahierte Daten an detectTrades
    const detectedTrades = await detectTrades({
      category,
      subCategory,
      description,
      timeframe,
      budget,
      extractedData // NEU: Weitergabe der extrahierten Daten
    });
    
    // Nur erkannte Trades hinzufügen
    console.log(`[PROJECT] Creating project ${project.id} with ${detectedTrades.length} detected trades`);
    console.log(`[PROJECT] Extracted quantities:`, extractedData.quantities);
    console.log(`[PROJECT] Extracted measures:`, extractedData.measures);
    
    for (const trade of detectedTrades) {
      await ensureProjectTrade(project.id, trade.id, 'detection');
    }
    
    res.json({
      project: {
        ...project,
        trades: detectedTrades,
        complexity: determineProjectComplexity(project),
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
    
    // NEU: Parse metadata falls vorhanden
    if (project.metadata && typeof project.metadata === 'string') {
      try {
        project.metadata = JSON.parse(project.metadata);
      } catch (e) {
        console.error('[PROJECT] Failed to parse metadata:', e);
        project.metadata = {};
      }
    }
    
    // NEU: Extrahiere Daten falls in metadata vorhanden
    const extractedData = project.metadata?.extracted || null;
    
    project.trades = trades;
    project.complexity = determineProjectComplexity(project);
    project.extractedData = extractedData; // NEU: Füge extrahierte Daten hinzu
    
    console.log(`[PROJECT] Retrieved project ${projectId} with ${trades.length} trades, complexity: ${project.complexity}`);
    if (extractedData) {
      console.log(`[PROJECT] Has extracted data:`, extractedData.quantities);
    }
    
    res.json(project);
    
  } catch (err) {
    console.error('Failed to fetch project:', err);
    res.status(500).json({ error: err.message });
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
    
    // NEU: Lade erkannte Gewerke für intelligente Intake-Fragen
const detectedTrades = await query(
  `SELECT t.code, t.name 
   FROM trades t 
   JOIN project_trades pt ON t.id = pt.trade_id 
   WHERE pt.project_id = $1 AND t.code != 'INT'`,
  [projectId]
);

let questions;
try {
  questions = await generateQuestions(tradeId, {
    category: project.category,
    subCategory: project.sub_category,
    description: project.description,
    timeframe: project.timeframe,
    budget: project.budget,
    detectedTrades: detectedTrades.rows // NEU: Übergebe erkannte Gewerke für intelligente Fragenauswahl
  });
} catch (err) {
  
  console.error('[INTAKE] generateQuestions error:', err);
  // Nicht leeres Array zurückgeben, sondern Fehler werfen!
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
    
    // Berechne die intelligente Fragenanzahl für die Response
    const intelligentCount = getIntelligentQuestionCount('INT', {
      category: project.category,
      description: project.description,
      budget: project.budget
    }, []);

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
  questions: questionsWithIds,  // <-- HIER: questionsWithIds statt questions
  saved,
  targetCount: intelligentCount.count,
  completeness: intelligentCount.completeness
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
  'TRO': ['rigips', 'trockenbau', 'ständerwerk', 'vorwand', 'gipskarton', 'abgehängte decke', 'schallschutz'],
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
  'ABBR': ['abriss', 'abbruch', 'entkernung', 'rückbau', 'demontage', 'entsorgung', 'schutt']
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
    // Hole die Daten aus dem Request Body
    const {
      includeIntakeContext,
      isManuallyAdded: manualFromBody,
      projectDescription: descriptionFromBody,
      projectCategory: categoryFromBody,
      projectBudget: budgetFromBody
    } = req.body;
    // Prüfe Trade-Status (manuell, KI-empfohlen oder automatisch)
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
                                 req.body.isAiRecommended; // NEU: Auch KI-empfohlene berücksichtigen
    
    console.log('[QUESTIONS] Trade status:', {
      manual: tradeStatus.is_manual,
      aiRecommended: tradeStatus.is_ai_recommended,
      needsContext: needsContextQuestion
    });
    
    console.log('[DEBUG] Trade needs context question:', needsContextQuestion);
    
    const isAssigned = await isTradeAssignedToProject(projectId, tradeId);
    const tradeInfo = await query('SELECT code, name FROM trades WHERE id = $1', [tradeId]);
    const tradeCode = tradeInfo.rows[0]?.code;
    const tradeName = tradeInfo.rows[0]?.name;
    
    if (!isAssigned && tradeCode !== 'INT') {
      console.log(`[QUESTIONS] Trade ${tradeId} not assigned to project ${projectId}, adding it now`);
      await ensureProjectTrade(projectId, tradeId, 'questions_request');
    }
    
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = projectResult.rows[0];

    // Hole Intake-Antworten für Kontext (für ALLE Gewerke)
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
    
    // Erstelle erweiterten Projektkontext mit BEIDEN Quellen
    const projectContext = {
  category: req.body.projectCategory || project.category,
  subCategory: project.sub_category,
  description: req.body.projectDescription || project.description,
  timeframe: project.timeframe,
  budget: req.body.projectBudget || project.budget,
  projectId: projectId,
  isManuallyAdded: tradeStatus.is_manual || req.body.isManuallyAdded,
  isAiRecommended: tradeStatus.is_ai_recommended || req.body.isAiRecommended,
  intakeContext: intakeContext,  // NEU: Füge Intake-Kontext hinzu
  hasIntakeAnswers: intakeContext.length > 0  // NEU: Flag ob Intake vorhanden
};
    
    console.log('[DEBUG] projectContext.isManuallyAdded:', projectContext.isManuallyAdded);
    // Lade alle Projekt-Trades für Cross-Check
const projectTrades = await query(
  `SELECT t.code, t.name FROM trades t 
   JOIN project_trades pt ON t.id = pt.trade_id 
   WHERE pt.project_id = $1`,
  [projectId]
);

projectContext.trades = projectTrades.rows; // <-- FÜGE TRADES HINZU!

const questions = await generateQuestions(tradeId, projectContext);
    
// NEU - SCHRITT 4: Filter anwenden um Duplikate zu entfernen
const filteredQuestions = filterDuplicateQuestions(questions, projectContext.intakeData || []);

console.log(`[QUESTIONS] Filtered ${questions.length - filteredQuestions.length} duplicate questions`);

// WICHTIG: Verwende jetzt filteredQuestions statt questions
for (const question of filteredQuestions) {  // <- GEÄNDERT von "questions" zu "filteredQuestions"
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
      question.dependsOn || null,  // NEU: Abhängigkeit von vorheriger Frage
      question.showIf || null       // NEU: Bedingung für Anzeige
    ]
  );
}
    
    const intelligentCount = getIntelligentQuestionCount(tradeCode, project, []);
    
    res.json({ 
      questions: filteredQuestions,  // <- GEÄNDERT von "questions" zu "filteredQuestions"
      targetCount: intelligentCount.count,
      actualCount: questions.length,
      completeness: intelligentCount.completeness,
      missingInfo: intelligentCount.missingInfo,
      tradeName: tradeName,
      needsContextQuestion // NEU: Sende Info an Frontend
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
    
    // Berechne Gesamtstatistiken
    const totalSum = lvs.reduce((sum, lv) => sum + (lv.content.totalSum || 0), 0);
    const totalPositions = lvs.reduce((sum, lv) => sum + (lv.content.positions?.length || 0), 0);
    
    res.json({ 
      ok: true, 
      lvs,
      summary: {
        totalTrades: lvs.length,
        totalPositions,
        totalSum,
        vat: totalSum * 0.19,
        grandTotal: totalSum * 1.19
      }
    });
  } catch (err) {
    console.error('aggregate LV failed:', err);
    res.status(500).json({ ok: false, error: err.message });
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

KONKRETE ARBEITEN IM PROJEKT (aus LV):
${lvPositions.rows.slice(0, 30).map(p => {
  try {
    const content = JSON.parse(p.content);
    return content.positions?.slice(0, 3).map(pos => 
      `- ${p.trade_name}: ${pos.title}`
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

ERSTELLE 5-7 KONKRETE SPARVORSCHLÄGE aus diesen Kategorien:

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

BEISPIELE GUTER VORSCHLÄGE:
✓ "Standard-Armaturen statt Designermodelle im Bad (spart 1.200€)"
✓ "Malervorarbeiten in Eigenleistung (spart 600€)"
✓ "Fliesen nur in Nassbereichen (spart 2.000€)"

EXTREM WICHTIG: 
Das "trade" Feld MUSS EXAKT einer dieser Codes sein: ${lvBreakdown.map(lv => lv.tradeCode).join(', ')}
KEINE ANDEREN CODES! Nicht KLIMA wenn KLIMA nicht in der Liste ist!

OUTPUT als JSON:
{
  "optimizations": [
    {
      "trade": "${lvBreakdown[0]?.tradeCode || 'DACH'}",
      "tradeName": "${lvBreakdown[0]?.tradeName || 'Dachdeckerarbeiten'}",
      "measure": "Konkrete Maßnahme für ${lvBreakdown[0]?.tradeName || 'dieses Gewerk'}",
      "savingAmount": 2500,
      "savingPercent": 15,
      "difficulty": "mittel",
      "type": "material",
      "impact": "Auswirkung auf Qualität"
    }${lvBreakdown[1] ? `,
    {
      "trade": "${lvBreakdown[1].tradeCode}",
      "tradeName": "${lvBreakdown[1].tradeName}",
      "measure": "Weitere Optimierung für ${lvBreakdown[1].tradeName}",
      "savingAmount": 1500,
      "savingPercent": 10,
      "difficulty": "einfach",
      "type": "eigenleistung",
      "impact": "Keine Funktionseinschränkung"
    }` : ''}
  ],
  "totalPossibleSaving": 12500,
  "summary": "Durch gezielte Optimierungen können die Kosten reduziert werden"
}`;

    const userPrompt = `Budget: ${formatCurrency(targetBudget)}
Aktuelle Kosten: ${formatCurrency(currentTotal)}
Überschreitung: ${formatCurrency(overspend)} (${percentOver}%)

GEWERKE MIT CODES UND KOSTEN:
${lvBreakdown.map(lv => `${lv.tradeCode}: ${lv.tradeName} = ${formatCurrency(lv.total)}`).join('\n')}

WICHTIGSTE LV-POSITIONEN:
${lvPositions.rows.slice(0, 10).map(p => {
  try {
    const content = JSON.parse(p.content);
    return content.positions?.slice(0, 2).map(pos => 
      `- ${p.trade_name}: ${pos.title}`
    ).join('\n');
  } catch {
    return '';
  }
}).filter(Boolean).join('\n')}

Analysiere JEDES Gewerk und finde konkrete Einsparmöglichkeiten.
Verwende im "trade" Feld NUR die Codes aus der obigen Liste!`;

const response = await llmWithPolicy('optimization', [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userPrompt }
], { 
  maxTokens: 3000,
  temperature: 0.3,
  jsonMode: true
});

console.log('[OPTIMIZATION] Raw LLM response:', response.substring(0, 500));
const optimizations = JSON.parse(response);
// HIER NEU: Sofort nach dem Parsen alle Beträge runden
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

// NEU: Runde alle Beträge und korrigiere die Gesamtsumme
if (optimizations.optimizations && optimizations.optimizations.length > 0) {
  // Runde alle savingAmount Werte
  optimizations.optimizations = optimizations.optimizations.map(opt => ({
    ...opt,
    savingAmount: Math.round(parseFloat(opt.savingAmount) || 0)
  }));
  
  // Berechne Gesamtsumme aus den gerundeten Werten
  optimizations.totalPossibleSaving = optimizations.optimizations.reduce(
    (sum, opt) => sum + opt.savingAmount, 
    0
  );
}  
// Validierung: Filtere ungültige und unrealistische Optimierungen
const validTradeCodes = lvBreakdown.map(lv => lv.tradeCode);
if (optimizations.optimizations) {
  optimizations.optimizations = optimizations.optimizations.filter(opt => {
    // Prüfe ob trade überhaupt existiert
    if (!opt.trade || opt.trade === 'undefined') {
      console.log('[OPTIMIZATION] Skipping optimization with undefined trade');
      return false;
    }
    
    // Prüfe ob Trade im Projekt vorhanden
    const isValid = validTradeCodes.includes(opt.trade);
    if (!isValid) {
      console.log(`[OPTIMIZATION] Filtered invalid trade: ${opt.trade}`);
      return false;
    }
    
    // NEU: Prüfe realistische Einsparungen (mindestens 200€)
    if (opt.savingAmount < 200) {
      console.log(`[OPTIMIZATION] Filtered unrealistic low amount: ${opt.savingAmount}€`);
      return false;
    }
    
    // NEU: Prüfe ob Einsparung nicht über 50% des Gewerks liegt
    const tradeLv = lvBreakdown.find(lv => lv.tradeCode === opt.trade);
    if (tradeLv && opt.savingAmount > tradeLv.total * 0.5) {
      console.log(`[OPTIMIZATION] Capped high amount: ${opt.savingAmount}€ to 30% of ${tradeLv.total}€`);
      opt.savingAmount = Math.floor(tradeLv.total * 0.3);
      opt.savingPercent = 30;
    }
    
    return true;
  });
  
  // Stelle sicher dass tradeName korrekt ist
  optimizations.optimizations = optimizations.optimizations.map(opt => {
    const matchingTrade = lvBreakdown.find(lv => lv.tradeCode === opt.trade);
    if (matchingTrade) {
      opt.tradeName = matchingTrade.tradeName;
    }
    return opt;
  });
}

// Fallback mit realistischem Mindestbetrag
if (!optimizations.optimizations || optimizations.optimizations.length === 0) {
  console.log('[OPTIMIZATION] No valid optimizations found, generating fallback');
  optimizations.optimizations = [{
    trade: lvBreakdown[0]?.tradeCode || 'GENERAL',
    tradeName: lvBreakdown[0]?.tradeName || 'Allgemein',
    measure: 'Materialqualität leicht reduzieren ohne Funktionseinbußen',
    savingAmount: Math.max(500, overspend * 0.1), // Mindestens 500€
    savingPercent: 10,
    difficulty: 'einfach',
    type: 'material',
    impact: 'Geringe optische Einschränkungen'
  }];
}

    // Fallback wenn keine gültigen Optimierungen
    if (!optimizations.optimizations || optimizations.optimizations.length === 0) {
      console.log('[OPTIMIZATION] No valid optimizations found, generating fallback');
      optimizations.optimizations = [{
        trade: lvBreakdown[0]?.tradeCode || 'GENERAL',
        tradeName: lvBreakdown[0]?.tradeName || 'Allgemein',
        measure: 'Materialqualität leicht reduzieren ohne Funktionseinbußen',
        savingAmount: overspend * 0.1,
        savingPercent: 10,
        difficulty: 'einfach',
        type: 'material',
        impact: 'Geringe optische Einschränkungen'
      }];
    }

    // Debug: Zeige alle finalen Beträge
console.log('[OPTIMIZATION] Final amounts before response:', 
  optimizations.optimizations.map(opt => opt.savingAmount));

// Stelle sicher, dass die Summe korrekt ist
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

// ADMIN ROUTES - SIMPLIFIED WITH BASIC TOKEN (FIXED SQL CASTS)
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
