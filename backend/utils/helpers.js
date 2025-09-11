/**
 * Formatiert Beträge als Euro-Währung
 */
function formatCurrency(amount) {
  if (!amount && amount !== 0) return '0 €';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

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
  
  // Spezifische Details extrahieren
  if (desc.includes('altbau')) extractedData.specificDetails.buildingType = 'Altbau';
  if (desc.includes('neubau')) extractedData.specificDetails.buildingType = 'Neubau';
  if (desc.includes('einfamilienhaus') || desc.includes('efh')) {
    extractedData.specificDetails.buildingType = 'Einfamilienhaus';
  }
  if (desc.includes('mehrfamilienhaus') || desc.includes('mfh')) {
    extractedData.specificDetails.buildingType = 'Mehrfamilienhaus';
  }
  
  extractedData.specificDetails.needsScaffolding = 
    desc.includes('dach') || desc.includes('fassade') || 
    desc.includes('fenster') && (desc.includes('obergeschoss') || desc.includes('2. stock'));
  
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
 * Parst Fenster-Maßangaben aus Nutzer-Antwort
 */
function parseFensterMaße(antwortText) {
  const fensterTypen = [];
  
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
  
  if (fensterTypen.length === 0) {
    console.log('[LV] Keine Fenstermaße in Antwort gefunden:', antwortText);
  }
  
  return fensterTypen;
}

/**
 * Projekt-Komplexität bestimmen
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
 * Helper für Gewerke-Beschreibungen
 */
function getTradeDescription(tradeCode) {
  const descriptions = {
    'ABBR': 'Abbruch, Entkernung, Rückbau, Entsorgung',
    'ROH': 'Rohbau, Mauerarbeiten, Betonarbeiten, Fundamente',
    'GER': 'Gerüstbau, Arbeitsplattformen, Absturzsicherung',
    'DACH': 'Dachdeckerarbeiten, Abdichtungen, Terrassen, Flachdach',
    'FEN': 'Fenster, Außentüren, Montage, Rollläden',
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
    'TIS': 'Innentüren, Innenausbau, Einbaumöbel, Holzarbeiten',
    'BOD': 'Bodenbeläge, Parkett, Laminat, Teppich, PVC',
    'MAL': 'Malerarbeiten, Lackieren, Tapezieren, Spachteln',
    'SCHL': 'Schlosserarbeiten, Metallbau, Geländer, Stahlkonstruktionen',
    'INT': 'Allgemeine Projektaufnahme, Bestandserfassung'
  };
  return descriptions[tradeCode] || 'Allgemeine Bauarbeiten';
}

/**
 * Intelligente Fragenanzahl basierend auf Gewerke-Komplexität
 */
function getIntelligentQuestionCount(tradeCode, projectInfo, intakeAnswers = []) {
  const { TRADE_COMPLEXITY, DEFAULT_COMPLEXITY } = require('../config/constants');
  
  const tradeConfig = TRADE_COMPLEXITY[tradeCode] || DEFAULT_COMPLEXITY;
  let baseCount = tradeConfig.minQuestions;
  
  // Anpassungen basierend auf Projektkontext
  const projectComplexity = determineProjectComplexity(projectInfo, intakeAnswers);
  
  if (projectComplexity === 'SEHR_HOCH') {
    baseCount = Math.min(tradeConfig.maxQuestions, baseCount + 5);
  } else if (projectComplexity === 'HOCH') {
    baseCount = Math.min(tradeConfig.maxQuestions, baseCount + 3);
  }
  
  return {
    count: baseCount,
    completeness: 1.0,
    missingInfo: []
  };
}

/**
 * Verfügbare Gewerke aus DB laden
 */
async function getAvailableTrades() {
  const { query } = require('../db');
  const result = await query(
    `SELECT id, code, name 
     FROM trades 
     ORDER BY sort_order, name`
  );
  return result.rows;
}

/**
 * Prompt aus DB laden
 */
async function getPromptByName(name) {
  const { query } = require('../db');
  const result = await query(
    'SELECT content FROM prompts WHERE name = $1 AND is_active = true LIMIT 1',
    [name]
  );
  return result.rows[0]?.content || '';
}

/**
 * Trade-Fragenanzahl berechnen
 */
function getTradeQuestionCount(tradeCode, complexity = 'MITTEL') {
  const { TRADE_COMPLEXITY, DEFAULT_COMPLEXITY } = require('../config/constants');
  const tradeConfig = TRADE_COMPLEXITY[tradeCode] || DEFAULT_COMPLEXITY;
  
  const complexityMultiplier = {
    'SEHR_HOCH': 1.3,
    'HOCH': 1.15,
    'MITTEL': 1.0,
    'NIEDRIG': 0.85,
    'EINFACH': 0.7
  };
  
  const multiplier = complexityMultiplier[complexity] || 1.0;
  return Math.round(tradeConfig.minQuestions * multiplier);
}

/**
 * Trade zu Projekt hinzufügen
 */
async function ensureProjectTrade(projectId, tradeId, category = 'other') {
  const { query } = require('../db');
  const result = await query(
    `INSERT INTO project_trades (project_id, trade_id, category)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id, trade_id) DO UPDATE SET category = $3
     RETURNING *`,
    [projectId, tradeId, category]
  );
  return result.rows[0];
}

/**
 * Prüfen ob Trade zum Projekt gehört
 */
async function isTradeAssignedToProject(projectId, tradeId) {
  const { query } = require('../db');
  const result = await query(
    'SELECT * FROM project_trades WHERE project_id = $1 AND trade_id = $2',
    [projectId, tradeId]
  );
  return result.rows.length > 0;
}

// Am Ende der Datei - erweitere die exports:
module.exports = {
  formatCurrency,
  extractProjectKeyData,
  parseFensterMaße,
  determineProjectComplexity,
  getTradeDescription,
  getIntelligentQuestionCount,
  getAvailableTrades,
  getPromptByName,
  getTradeQuestionCount,
  ensureProjectTrade,
  isTradeAssignedToProject
};
