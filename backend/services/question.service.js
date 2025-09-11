const { TRADE_COMPLEXITY, DEFAULT_COMPLEXITY } = require('../config/constants');
const { llmWithPolicy } = require('./llm.service');
const db = require('./database.service');

class QuestionService {
  
  /**
   * Intelligente, dynamische Fragenanzahl-Ermittlung
   */
  getIntelligentQuestionCount(tradeCode, projectContext, intakeAnswers = []) {
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
   * Intelligente Antwort-Validierung und Schätzung
   */
  async validateAndEstimateAnswers(answers, tradeCode, projectContext) {
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
   * Intelligente Fragengenerierung mit Mengenerfassung
   */
  async generateQuestions(tradeId, projectContext = {}) {
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
]`; // Der Template-String muss hier geschlossen werden

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
    
    let questions;
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
   * Generiert adaptive Folgefragen basierend auf Kontext-Antwort
   */
  async generateContextBasedQuestions(tradeId, projectId, contextAnswer) {
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
} // Klasse endet hier

module.exports = QuestionService;
