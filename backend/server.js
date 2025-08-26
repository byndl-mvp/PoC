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

// Modellnamen aus Umgebungsvariablen
const MODEL_OPENAI = process.env.MODEL_OPENAI || 'gpt-4o-mini';
const MODEL_ANTHROPIC = process.env.MODEL_ANTHROPIC || 'claude-3-5-sonnet-latest';

// ===========================================================================
// GEWERKE-KOMPLEXITÄT DEFINITIONEN (KORREKTE CODES)
// ===========================================================================

const TRADE_COMPLEXITY = {
  // Sehr komplexe Gewerke (25-40 Fragen)
  'DACH': { complexity: 'SEHR_HOCH', minQuestions: 25, maxQuestions: 40 },
  'ELEKT': { complexity: 'SEHR_HOCH', minQuestions: 25, maxQuestions: 40 },
  'SAN': { complexity: 'SEHR_HOCH', minQuestions: 25, maxQuestions: 40 },
  'HEI': { complexity: 'SEHR_HOCH', minQuestions: 25, maxQuestions: 35 },
  'ROH': { complexity: 'HOCH', minQuestions: 20, maxQuestions: 35 },
  
  // Komplexe Gewerke (20-30 Fragen)
  'TIS': { complexity: 'HOCH', minQuestions: 20, maxQuestions: 30 },
  'FEN': { complexity: 'HOCH', minQuestions: 20, maxQuestions: 30 },
  'FASS': { complexity: 'HOCH', minQuestions: 20, maxQuestions: 30 },
  'SCHL': { complexity: 'HOCH', minQuestions: 18, maxQuestions: 28 },
  
  // Mittlere Komplexität (15-25 Fragen)
  'FLI': { complexity: 'MITTEL', minQuestions: 15, maxQuestions: 25 },
  'ESTR': { complexity: 'MITTEL', minQuestions: 15, maxQuestions: 25 },
  'TRO': { complexity: 'MITTEL', minQuestions: 15, maxQuestions: 25 },
  'BOD': { complexity: 'MITTEL', minQuestions: 15, maxQuestions: 25 },
  'AUSS': { complexity: 'MITTEL', minQuestions: 15, maxQuestions: 25 },
  
  // Einfache Gewerke (8-15 Fragen)
  'MAL': { complexity: 'EINFACH', minQuestions: 8, maxQuestions: 15 },
  'GER': { complexity: 'EINFACH', minQuestions: 8, maxQuestions: 12 },
  'ABBR': { complexity: 'EINFACH', minQuestions: 10, maxQuestions: 15 },
  
  // Intake ist speziell (15-20 Fragen)
  'INT': { complexity: 'INTAKE', minQuestions: 15, maxQuestions: 20 }
};

// Fallback für nicht definierte Gewerke
const DEFAULT_COMPLEXITY = { complexity: 'MITTEL', minQuestions: 15, maxQuestions: 25 };

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
    'lv': 10000,         
    'intake': 6000,      
    'summary': 4000,
    'validation': 3000   
  };
  
  const maxTokens = options.maxTokens || defaultMaxTokens[task] || 4000;
  const temperature = options.temperature !== undefined ? options.temperature : 0.4;
  
  const primaryProvider = ['detect', 'questions', 'intake', 'validation'].includes(task) 
    ? 'anthropic' 
    : 'openai';
  
  const callOpenAI = async () => {
    try {
      const useJsonMode = options.jsonMode && maxTokens <= 4096;
      
      const response = await openai.chat.completions.create({
        model: MODEL_OPENAI,
        messages,
        temperature,
        max_completion_tokens: Math.min(maxTokens, 16384),
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
    } catch (error) {
      console.error('[LLM] Anthropic error:', error.status || error.message);
      throw error;
    }
  };
  
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
    return '[]'; // Will trigger fallback questions
  }
  
  throw new Error(`All LLM providers unavailable. Last error: ${lastError?.message || 'Unknown error'}`);
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
      targetCount = Math.min(targetCount, 12); // Maximal 12 Fragen
      if (desc.match(/\d+\s*(m²|qm)/)) {
        targetCount = Math.min(targetCount, 8); // Mit Flächenangabe nur 8 Fragen
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
       ON CONFLICT DO NOTHING`,
      [projectId, tradeId]
    );
  }
}

/**
 * Alle Trades eines Projekts abrufen
 */
async function getProjectTrades(projectId) {
  const result = await query(
    `SELECT t.* FROM trades t
     JOIN project_trades pt ON pt.trade_id = t.id
     WHERE pt.project_id = $1
     ORDER BY t.name`,
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
  
  const masterPrompt = await getPromptByName('master');
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

WICHTIGE REGELN:
1. Wähle NUR Gewerke die WIRKLICH benötigt werden
2. Bei Dachsanierung: NUR "DACH" (Dachdecker macht Rückbau selbst)
3. Bei Badsanierung: Typisch sind SAN, FLI, ELEKT (nicht automatisch alle)
4. Qualität vor Quantität - lieber weniger aber die richtigen Gewerke
5. NIEMALS "INT" zurückgeben - das wird separat behandelt!

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
  
  const questionPrompt = await getPromptForTrade(tradeId, 'questions');
  
  if (!questionPrompt) {
    console.warn(`[QUESTIONS] No prompt found for ${tradeName}, using default template`);
    // Fallback auf Standard-Template
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
  const targetQuestionCount = intelligentCount.count;
  
  const systemPrompt = `Du bist ein erfahrener Experte für ${tradeName} mit 20+ Jahren Berufserfahrung.
${isIntake ? 
'Erstelle einen INTELLIGENTEN Intake-Fragenkatalog.' : 
`Erstelle einen GEZIELTEN Fragenkatalog für ${tradeName}.`}

${intakeContext}

WICHTIG - INTELLIGENTE FRAGENANZAHL:
- Ziel: ${targetQuestionCount} Fragen (basierend auf ${intelligentCount.completeness}% Informationsvollständigkeit)
- Fehlende kritische Infos: ${intelligentCount.missingInfo.join(', ') || 'keine'}
- Stelle NUR Fragen zu FEHLENDEN Informationen
- Wenn bereits viele Details vorhanden sind, stelle WENIGER Fragen
- Fokussiere auf KALKULATIONSRELEVANTE Lücken

ANFORDERUNGEN:
1. INTELLIGENZ: Stelle ${targetQuestionCount} GEZIELTE Fragen
   - Keine redundanten Fragen zu bereits bekannten Informationen
   - Fokus auf fehlende kritische Daten

2. MENGENERFASSUNG mit EINHEITEN:
   - Bei type:"number" MUSS die Einheit IN DER FRAGE stehen!
   - Beispiel: "Wie groß ist die zu streichende Fläche in m²?"
   - NICHT: "Wie groß ist die zu streichende Fläche?" mit unit:"m²" separat
   - Bei Unsicherheit: "unsicher" als Option in options Array

3. LAIENVERSTÄNDLICH:
   - 1-2 erklärende Sätze pro Frage
   - Klare Einheiten-Angaben

OUTPUT (NUR valides JSON-Array):
[
  {
    "id": "string",
    "category": "string",
    "question": "Frage MIT EINHEIT bei Zahlen (z.B. 'Wie viele m² sollen gestrichen werden?')",
    "explanation": "Erklärung für Laien",
    "type": "text|number|select",
    "required": boolean,
    "unit": null,
    "options": ["unsicher"] bei kritischen Maßen,
    "priority": "hoch|mittel|niedrig"
  }
]

WICHTIG BEI NUMBER-TYPE:
- Einheit IMMER in die Frage integrieren
- unit-Feld auf null setzen (wird nicht von UI angezeigt)
- options: ["unsicher"] für Ausweichmöglichkeit`;

  const userPrompt = `Erstelle ${targetQuestionCount} INTELLIGENTE Fragen für ${tradeName}.

BEREITS VORHANDENE INFORMATIONEN:
- Projektbeschreibung: ${projectContext.description || 'Keine'}
- Informationsvollständigkeit: ${intelligentCount.completeness}%
- Bereits beantwortet: ${answeredQuestions.length} Intake-Fragen

FEHLENDE KRITISCHE INFORMATIONEN:
${intelligentCount.missingInfo.length > 0 ? 
  intelligentCount.missingInfo.map(info => `- ${info}`).join('\n') : 
  '- Keine kritischen Lücken identifiziert'}

${questionPrompt ? `Basis-Template:\n${questionPrompt.substring(0, 500)}...\n` : ''}

WICHTIG: 
- Frage NUR nach dem, was noch FEHLT für eine präzise Kalkulation
- Wenn genug Info vorhanden ist, stelle nur die WICHTIGSTEN ${targetQuestionCount} Fragen
- Priorisiere kalkulationsrelevante Informationen`;

  try {
    console.log(`[QUESTIONS] Generating ${targetQuestionCount} questions for ${tradeName}`);
    
    const response = await llmWithPolicy(isIntake ? 'intake' : 'questions', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { 
      maxTokens: 8000,
      temperature: 0.5,
      jsonMode: false // Wichtig: jsonMode kann problematisch sein
    });
    
    // Aggressivere Bereinigung
    let cleanedResponse = response
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/^[^[]*(\[[\s\S]*\])[^]]*$/, '$1') // Extrahiere nur das Array
      .trim();
    
    // Debug-Ausgabe
    console.log(`[QUESTIONS] Raw response length: ${response.length}`);
    console.log(`[QUESTIONS] Cleaned response starts with: ${cleanedResponse.substring(0, 100)}`);
    
    let questions;
    try {
      questions = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('[QUESTIONS] Parse error, attempting recovery:', parseError.message);
      
      // Versuche das JSON zu reparieren
      try {
        // Entferne alles vor dem ersten [ und nach dem letzten ]
        const match = cleanedResponse.match(/\[[\s\S]*\]/);
        if (match) {
          questions = JSON.parse(match[0]);
        } else {
          throw new Error('No valid JSON array found in response');
        }
      } catch (recoveryError) {
        console.error('[QUESTIONS] Recovery failed:', recoveryError);
        // Fallback: Erstelle minimale Fragen
        console.log('[QUESTIONS] Using fallback questions');
        questions = generateFallbackQuestions(tradeCode, tradeName, targetQuestionCount);
      }
    }
    
    if (!Array.isArray(questions)) {
      console.error('[QUESTIONS] Response is not an array, using fallback');
      questions = generateFallbackQuestions(tradeCode, tradeName, targetQuestionCount);
    }
    
    if (questions.length === 0) {
      console.error('[QUESTIONS] Empty questions array, using fallback');
      questions = generateFallbackQuestions(tradeCode, tradeName, targetQuestionCount);
    }
    
    // Post-Processing der Fragen
    const processedQuestions = questions.slice(0, targetQuestionCount).map((q, idx) => ({
      id: q.id || `${tradeCode}-${String(idx + 1).padStart(2, '0')}`,
      category: q.category || 'Allgemein',
      question: q.question || q.text || q.q || `Frage ${idx + 1}`,
      explanation: q.explanation || q.hint || '',
      type: q.type || 'text',
      required: q.required !== undefined ? q.required : true,
      unit: q.unit || null,
      options: Array.isArray(q.options) ? q.options : null,
      defaultValue: q.defaultValue || null,
      validationRule: q.validationRule || null,
      tradeId,
      tradeName
    }));
    
    console.log(`[QUESTIONS] Successfully generated ${processedQuestions.length} questions for ${tradeName}`);
    
    return processedQuestions;
    
  } catch (err) {
    console.error('[QUESTIONS] Generation failed:', err);
    console.log('[QUESTIONS] Using fallback questions due to error');
    return generateFallbackQuestions(tradeCode, tradeName, targetQuestionCount);
  }
}

/**
 * Fallback-Fragen wenn LLM versagt
 */
function generateFallbackQuestions(tradeCode, tradeName, count) {
  const baseQuestions = {
    'INT': [
      {
        id: 'INT-01',
        category: 'Projektumfang',
        question: 'Was ist der Umfang Ihres Projekts?',
        explanation: 'Beschreiben Sie kurz, was Sie renovieren oder bauen möchten.',
        type: 'text',
        required: true
      },
      {
        id: 'INT-02',
        category: 'Maße',
        question: 'Wie groß ist die Gesamtfläche?',
        explanation: 'Geben Sie die Quadratmeter an oder wählen Sie "unsicher".',
        type: 'number',
        unit: 'm²',
        required: true,
        options: ['unsicher']
      },
      {
        id: 'INT-03',
        category: 'Zeitrahmen',
        question: 'Wann soll das Projekt starten?',
        explanation: 'Geben Sie einen gewünschten Starttermin an.',
        type: 'text',
        required: false
      }
    ],
    'DEFAULT': [
      {
        id: `${tradeCode}-01`,
        category: 'Arbeitsumfang',
        question: `Welche ${tradeName}-Arbeiten sind erforderlich?`,
        explanation: 'Beschreiben Sie die gewünschten Arbeiten.',
        type: 'text',
        required: true
      },
      {
        id: `${tradeCode}-02`,
        category: 'Fläche',
        question: 'Wie groß ist die zu bearbeitende Fläche?',
        explanation: 'Geben Sie die Quadratmeter an oder wählen Sie "unsicher".',
        type: 'number',
        unit: 'm²',
        required: true,
        options: ['unsicher']
      },
      {
        id: `${tradeCode}-03`,
        category: 'Material',
        question: 'Haben Sie Materialwünsche?',
        explanation: 'Falls ja, beschreiben Sie diese bitte.',
        type: 'text',
        required: false
      }
    ]
  };
  
  const questions = baseQuestions[tradeCode] || baseQuestions['DEFAULT'];
  
  // Erweitere auf gewünschte Anzahl
  while (questions.length < count) {
    questions.push({
      id: `${tradeCode}-${String(questions.length + 1).padStart(2, '0')}`,
      category: 'Details',
      question: `Zusätzliche Information ${questions.length - 2}`,
      explanation: 'Gibt es weitere wichtige Details?',
      type: 'text',
      required: false
    });
  }
  
  return questions.slice(0, count).map(q => ({
    ...q,
    tradeId: null,
    tradeName
  }));
}

/**
 * Realistische LV-Generierung basierend auf erfassten Daten
 */
async function generateDetailedLV(projectId, tradeId) {
  const project = (await query('SELECT * FROM projects WHERE id=$1', [projectId])).rows[0];
  if (!project) throw new Error('Project not found');

  const trade = (await query('SELECT id, name, code FROM trades WHERE id=$1', [tradeId])).rows[0];
  if (!trade) throw new Error('Trade not found');

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

  const systemPrompt = `Du bist ein Experte für VOB-konforme Leistungsverzeichnisse mit 25+ Jahren Erfahrung.
Erstelle ein PRÄZISES und REALISTISCHES Leistungsverzeichnis für ${trade.name}.

KRITISCHE ANFORDERUNGEN:

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

4. VOLLSTÄNDIGKEIT:
   - Anzahl Positionen abhängig von Projektumfang
   - Kleine Projekte: 5-10 Positionen
   - Mittlere Projekte: 10-20 Positionen
   - Große Projekte: 20-40 Positionen

OUTPUT FORMAT (NUR valides JSON):
{
  "trade": "${trade.name}",
  "tradeCode": "${trade.code}",
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

  const userPrompt = `GEWERK: ${trade.name} (${trade.code})

LV-TEMPLATE:
${lvPrompt}

PROJEKTDATEN:
${JSON.stringify(project, null, 2)}

INTAKE-ANTWORTEN (${intakeAnswers.length} Antworten):
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
4. Dokumentiere alle Annahmen transparent`;

  try {
    const response = await llmWithPolicy('lv', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { 
      maxTokens: 10000,
      temperature: 0.3,
      jsonMode: true 
    });

    const cleanedResponse = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const lv = JSON.parse(cleanedResponse);
    
    // Post-Processing
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
      
      // Statistiken
      lv.statistics = {
        positionCount: lv.positions.length,
        averagePositionValue: Math.round((lv.totalSum / lv.positions.length) * 100) / 100,
        minPosition: Math.min(...lv.positions.map(p => p.totalPrice || 0)),
        maxPosition: Math.max(...lv.positions.map(p => p.totalPrice || 0)),
        measuredPositions: lv.positions.filter(p => p.dataSource === 'measured').length,
        estimatedPositions: lv.positions.filter(p => p.dataSource === 'estimated').length
      };
    }
    
    // Metadaten
    const lvWithMeta = {
      ...lv,
      metadata: {
        generatedAt: new Date().toISOString(),
        projectId,
        tradeId,
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
        const tradeTotal = lv.totalSum || 0;
        grandTotal += tradeTotal;
        tradeSummaries.push({
          code: row.trade_code,
          name: row.trade_name,
          total: tradeTotal
        });
        
        doc.text(`• ${row.trade_code} - ${row.trade_name}: ${withPrices ? formatCurrency(tradeTotal) : '________'}`, { indent: 20 });
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
        let tradeSum = 0;
        
        doc.font('Helvetica')
           .fontSize(9);
        
        if (lv.positions && Array.isArray(lv.positions)) {
          for (const pos of lv.positions) {
            if (yPosition > 700) {
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
            
            doc.text(pos.pos || '-', col1, yPosition, { width: 30 });
            
            const titleHeight = doc.heightOfString(pos.title || '', { width: 150 });
            doc.text(pos.title || 'Keine Bezeichnung', col2, yPosition, { width: 150 });
            
            doc.text(pos.quantity?.toString() || '-', col3, yPosition, { width: 50, align: 'right' });
            doc.text(pos.unit || '-', col4, yPosition, { width: 50 });
            
            if (withPrices && pos.unitPrice) {
              doc.text(formatCurrency(pos.unitPrice), col5, yPosition, { width: 70, align: 'right' });
              doc.text(formatCurrency(pos.totalPrice || 0), col6, yPosition, { width: 70, align: 'right' });
              tradeSum += pos.totalPrice || 0;
            } else {
              doc.text('________', col5, yPosition, { width: 70, align: 'right' });
              doc.text('________', col6, yPosition, { width: 70, align: 'right' });
            }
            
            yPosition += Math.max(titleHeight, 15) + 5;
          }
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
           .text(withPrices ? formatCurrency(tradeSum) : '________', col6, yPosition, { width: 70, align: 'right' });
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
          } else {
            doc.text('________', col6, yPosition, { width: 70, align: 'right' });
          }
          
          if (pos.description) {
            yPosition += Math.max(titleHeight, 15);
            doc.fontSize(8)
               .fillColor('#666666')
               .text(pos.description, col2, yPosition, { width: 400 });
            
            // Datenquelle anzeigen
            if (pos.dataSource && pos.dataSource !== 'measured') {
              const sourceText = pos.dataSource === 'estimated' ? '(geschätzt)' : '(angenommen)';
              doc.fontSize(7)
                 .fillColor('#FF6600')
                 .text(sourceText, col2 + 350, yPosition);
            }
            
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
    
    // Nur erkannte Trades hinzufügen
    console.log(`[PROJECT] Creating project ${project.id} with ${detectedTrades.length} detected trades`);
    
    for (const trade of detectedTrades) {
      await ensureProjectTrade(project.id, trade.id, 'detection');
    }
    
    res.json({
      project: {
        ...project,
        trades: detectedTrades,
        complexity: determineProjectComplexity(project)
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
    
    project.trades = trades;
    project.complexity = determineProjectComplexity(project);
    
    console.log(`[PROJECT] Retrieved project ${projectId} with ${trades.length} trades, complexity: ${project.complexity}`);
    
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
    
    const questions = await generateQuestions(tradeId, {
      category: project.category,
      subCategory: project.sub_category,
      description: project.description,
      timeframe: project.timeframe,
      budget: project.budget
    });

    // Speichere Fragen mit erweiterten Feldern
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
    
    // Berechne die intelligente Fragenanzahl für die Response
    const intelligentCount = getIntelligentQuestionCount('INT', {
      category: project.category,
      description: project.description,
      budget: project.budget
    }, []);

    res.json({ 
      ok: true, 
      tradeCode: 'INT', 
      questions, 
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

    res.json({ ok: true, summary });
  } catch (err) {
    console.error('intake/summary failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Confirm trades for project
app.post('/api/projects/:projectId/trades/confirm', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { confirmedTrades } = req.body;
    
    if (!Array.isArray(confirmedTrades) || confirmedTrades.length === 0) {
      return res.status(400).json({ error: 'Keine Gewerke ausgewählt' });
    }
    
    // Start transaction for data consistency
    await query('BEGIN');
    
    try {
      // Erst die abhängigen Daten löschen (Fragen und Antworten der zu entfernenden Trades)
      await query(
        `DELETE FROM answers 
         WHERE project_id = $1 
         AND trade_id NOT IN (SELECT id FROM trades WHERE code = 'INT')
         AND trade_id NOT IN (SELECT unnest($2::int[]))`,
        [projectId, confirmedTrades]
      );
      
      await query(
        `DELETE FROM questions 
         WHERE project_id = $1 
         AND trade_id NOT IN (SELECT id FROM trades WHERE code = 'INT')
         AND trade_id NOT IN (SELECT unnest($2::int[]))`,
        [projectId, confirmedTrades]
      );
      
      await query(
        `DELETE FROM lvs 
         WHERE project_id = $1 
         AND trade_id NOT IN (SELECT id FROM trades WHERE code = 'INT')
         AND trade_id NOT IN (SELECT unnest($2::int[]))`,
        [projectId, confirmedTrades]
      );
      
      // Jetzt die Trade-Zuordnungen löschen
      await query(
        `DELETE FROM project_trades 
         WHERE project_id = $1 
         AND trade_id NOT IN (SELECT id FROM trades WHERE code = 'INT')`,
        [projectId]
      );
      
      // Füge die bestätigten Trades hinzu
      for (const tradeId of confirmedTrades) {
        await query(
          `INSERT INTO project_trades (project_id, trade_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [projectId, tradeId]
        );
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

// Generate adaptive questions for a specific trade
app.post('/api/projects/:projectId/trades/:tradeId/questions', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    
    const isAssigned = await isTradeAssignedToProject(projectId, tradeId);
    
    const tradeInfo = await query('SELECT code FROM trades WHERE id = $1', [tradeId]);
    const tradeCode = tradeInfo.rows[0]?.code;
    
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
    
    const questions = await generateQuestions(tradeId, {
      category: project.category,
      subCategory: project.sub_category,
      description: project.description,
      timeframe: project.timeframe,
      budget: project.budget,
      projectId: projectId
    });
    
    // Speichere erweiterte Fragen
    for (const question of questions) {
      // Speichere nur die existierenden Basis-Spalten
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
    
    const intelligentCount = getIntelligentQuestionCount(tradeCode, project, []);
    
    res.json({ 
      questions,
      targetCount: intelligentCount.count,
      actualCount: questions.length,
      completeness: intelligentCount.completeness,
      missingInfo: intelligentCount.missingInfo
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
    const lv = await generateDetailedLV(projectId, tradeId);
    
    // Speichere LV in DB
    await query(
      `INSERT INTO lvs (project_id, trade_id, content)
       VALUES ($1,$2,$3)
       ON CONFLICT (project_id, trade_id)
       DO UPDATE SET content=$3, updated_at=NOW()`,
      [projectId, tradeId, lv]
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
      
      const tradeCost = lv.totalSum || 
        (lv.positions || []).reduce((sum, pos) => 
          sum + (pos.totalPrice || 0), 0
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
        cost: tradeCost,
        hasPrice: tradeCost > 0,
        positionCount: lv.positions?.length || 0,
        confidence: lv.dataQuality?.confidence || 0.5
      });
      
      summary.totalCost += tradeCost;
      
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

// Admin: Get all projects with statistics
app.get('/api/admin/projects', requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, 
        COUNT(DISTINCT pt.trade_id) as trade_count,
        COUNT(DISTINCT l.id) as lv_count,
        COUNT(DISTINCT q.question_id) as question_count,
        COUNT(DISTINCT a.question_id) as answer_count
       FROM projects p
       LEFT JOIN project_trades pt ON pt.project_id = p.id
       LEFT JOIN lvs l ON l.project_id = p.id
       LEFT JOIN questions q ON q.project_id = p.id
       LEFT JOIN answers a ON a.project_id = p.id
       GROUP BY p.id
       ORDER BY p.created_at DESC`
    );
    
    const projects = result.rows.map(p => ({
      ...p,
      complexity: determineProjectComplexity(p),
      completeness: p.question_count > 0 
        ? Math.round((p.answer_count / p.question_count) * 100)
        : 0
    }));
    
    res.json({ projects });
    
  } catch (err) {
    console.error('Failed to fetch projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Admin: Get project statistics
app.get('/api/admin/statistics', requireAdmin, async (req, res) => {
  try {
    const stats = {};
    
    // Projekt-Statistiken
    const projectStats = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as last_week,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as last_month
      FROM projects
    `);
    stats.projects = projectStats.rows[0];
    
    // LV-Statistiken
    const lvStats = await query(`
      SELECT 
        COUNT(*) as total,
        AVG((content->>'totalSum')::numeric) as avg_value,
        SUM((content->>'totalSum')::numeric) as total_value
      FROM lvs
    `);
    stats.lvs = lvStats.rows[0];
    
    // Gewerke-Statistiken
    const tradeStats = await query(`
      SELECT t.code, t.name, COUNT(pt.project_id) as usage_count
      FROM trades t
      LEFT JOIN project_trades pt ON pt.trade_id = t.id
      GROUP BY t.id, t.code, t.name
      ORDER BY usage_count DESC
    `);
    stats.tradeUsage = tradeStats.rows;
    
    // Fragen-Statistiken
    const questionStats = await query(`
      SELECT 
        COUNT(DISTINCT q.question_id) as total_questions,
        COUNT(DISTINCT a.question_id) as answered_questions,
        AVG(q_count.count) as avg_questions_per_project
      FROM questions q
      LEFT JOIN answers a ON a.project_id = q.project_id 
        AND a.trade_id = q.trade_id 
        AND a.question_id = q.question_id
      CROSS JOIN (
        SELECT project_id, COUNT(*) as count 
        FROM questions 
        GROUP BY project_id
      ) q_count
    `);
    stats.questions = questionStats.rows[0];
    
    res.json({ stats });
    
  } catch (err) {
    console.error('Failed to fetch statistics:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
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
