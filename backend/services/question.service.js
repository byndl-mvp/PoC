const { TRADE_COMPLEXITY, DEFAULT_COMPLEXITY } = require('../config/constants');
const { llmWithPolicy } = require('./llm.service');
const db = require('./database.service');

class QuestionService {
  
  /**
   * Intelligente, dynamische Fragenanzahl-Ermittlung
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
   * Intelligente Fragengenerierung mit Mengenerfassung
   */
  async generateQuestions(tradeId, projectContext = {}) {
    // KOPIEREN SIE DIE KOMPLETTE FUNKTION aus server.js (sehr lang!)
  }
  
  /**
   * Generiert adaptive Folgefragen basierend auf Kontext-Antwort
   */
  async generateContextBasedQuestions(tradeId, projectId, contextAnswer) {
    // KOPIEREN SIE DIE KOMPLETTE FUNKTION aus server.js
  }
}

module.exports = new QuestionService();
