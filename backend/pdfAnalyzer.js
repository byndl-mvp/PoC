const pdf = require('pdf-parse');
const Anthropic = require('@anthropic-ai/sdk');

/**
 * Intelligenter PDF-Analyzer mit Dokumenttyp-Erkennung
 * Unterstützt alle Gewerke und verschiedene PDF-Typen
 */
async function analyzePdfWithClaude(pdfBuffer, questionContext, tradeCode, questionId) {
  try {
    // Parse PDF
    const pdfData = await pdf(pdfBuffer);
    const fullText = pdfData.text;
    const pageCount = pdfData.numpages;
    
    console.log(`[PDF-ANALYZER] Analyzing PDF: ${pageCount} pages, ${fullText.length} chars`);
    
    // Erkenne Dokumenttyp
    const docType = detectDocumentType(fullText, tradeCode);
    console.log(`[PDF-ANALYZER] Detected document type: ${docType.type}`);
    
    // Intelligentes Chunking basierend auf Dokumenttyp
    const relevantText = extractRelevantContent(fullText, questionContext, docType, tradeCode);
    
    // Claude-Analyse mit spezialisiertem Prompt
    const analysis = await analyzeWithClaude(relevantText, questionContext, tradeCode, docType);
    
    return {
      text: analysis.answer,
      structured: analysis.structured,
      metadata: {
        documentType: docType.type,
        confidence: docType.confidence,
        pageCount: pageCount,
        originalLength: fullText.length,
        analyzedLength: relevantText.length,
        tradeCode: tradeCode
      }
    };
    
  } catch (error) {
    console.error('[PDF-ANALYZER] Error:', error.message);
    throw new Error(`PDF-Analyse fehlgeschlagen: ${error.message}`);
  }
}

/**
 * Erkenne Dokumenttyp basierend auf Inhalt und Struktur
 */
function detectDocumentType(text, tradeCode) {
  const lowerText = text.toLowerCase();
  const types = [];
  
  // ANGEBOT / KOSTENVORANSCHLAG
  if (lowerText.match(/angebot|kostenvoranschlag|kva|offerte|angebotsnummer/)) {
    const hasPositions = lowerText.match(/position|pos\.|leistung|menge|ep|gp/);
    const hasPrices = lowerText.match(/€|eur|euro|\d+[,\.]\d{2}/);
    const confidence = (hasPositions ? 0.4 : 0) + (hasPrices ? 0.4 : 0) + 0.2;
    types.push({ type: 'ANGEBOT', confidence });
  }
  
  // RECHNUNG
  if (lowerText.match(/rechnung|invoice|rechnungsnummer|rechnungsdatum/)) {
    const hasPrices = lowerText.match(/€|eur|euro|gesamt|netto|brutto|mwst/);
    const hasDate = lowerText.match(/\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2}/);
    const confidence = (hasPrices ? 0.5 : 0) + (hasDate ? 0.3 : 0) + 0.2;
    types.push({ type: 'RECHNUNG', confidence });
  }
  
  // LEISTUNGSVERZEICHNIS
  if (lowerText.match(/leistungsverzeichnis|lv|ausschreibung|vob|oz|teilleistung/)) {
    const hasStructure = lowerText.match(/ordnungszahl|oz|titel|kurztext|langtext/);
    const confidence = hasStructure ? 0.9 : 0.7;
    types.push({ type: 'LEISTUNGSVERZEICHNIS', confidence });
  }
  
  // BAUPLAN / GRUNDRISS
  if (lowerText.match(/grundriss|bauplan|schnitt|ansicht|maßstab|m\s*1:|scale/)) {
    const hasDimensions = lowerText.match(/\d+[,\.]\d*\s*(?:m|cm|mm)/);
    const hasRooms = lowerText.match(/wohn|schlaf|bad|küche|flur|zimmer|raum/);
    const confidence = (hasDimensions ? 0.4 : 0) + (hasRooms ? 0.3 : 0) + 0.3;
    types.push({ type: 'BAUPLAN', confidence });
  }
  
  // GUTACHTEN
  if (lowerText.match(/gutachten|sachverständige|beurteilung|begutachtung|feststellung/)) {
    const hasDamage = lowerText.match(/schaden|mangel|defekt|beschädigung|riss/);
    const hasRecommendation = lowerText.match(/empfehlung|maßnahme|sanierung|instandsetzung/);
    const confidence = (hasDamage ? 0.4 : 0) + (hasRecommendation ? 0.4 : 0) + 0.2;
    types.push({ type: 'GUTACHTEN', confidence });
  }
  
  // TECHNISCHES DATENBLATT
  if (lowerText.match(/datenblatt|technische daten|spezifikation|specification|technical data/)) {
    const hasSpecs = lowerText.match(/abmessung|material|leistung|kapazität|gewicht|dimension/);
    const confidence = hasSpecs ? 0.8 : 0.6;
    types.push({ type: 'DATENBLATT', confidence });
  }
  
  // AUFMASS / VERMESSUNG
  if (lowerText.match(/aufmaß|vermessung|bestandsaufnahme|measurement/)) {
    const hasMeasurements = lowerText.match(/länge|breite|höhe|fläche|volumen|\d+[,\.]\d*\s*m²/);
    const confidence = hasMeasurements ? 0.9 : 0.6;
    types.push({ type: 'AUFMASS', confidence });
  }
  
  // ENERGIEAUSWEIS
  if (lowerText.match(/energieausweis|energiebedarfsausweis|energieverbrauchsausweis/)) {
    const hasEnergy = lowerText.match(/kwh|energiebedarf|primärenergie|endenergie/);
    const confidence = hasEnergy ? 0.95 : 0.7;
    types.push({ type: 'ENERGIEAUSWEIS', confidence });
  }
  
  // HEIZLASTBERECHNUNG
  if (lowerText.match(/heizlast|wärmebedarf|heizleistung|norm-heizlast|din.*12831/)) {
    const hasRooms = lowerText.match(/raum|zimmer|wohn|bad/);
    const hasWatt = lowerText.match(/watt|w|kw|heizlast/);
    const confidence = (hasRooms ? 0.4 : 0) + (hasWatt ? 0.4 : 0) + 0.2;
    types.push({ type: 'HEIZLASTBERECHNUNG', confidence });
  }
  
  // STATISCHES GUTACHTEN
  if (lowerText.match(/statik|tragfähigkeit|statische berechnung|standsicherheit/)) {
    const hasStructural = lowerText.match(/last|beton|stahl|träger|stütze|decke/);
    const confidence = hasStructural ? 0.9 : 0.7;
    types.push({ type: 'STATIK', confidence });
  }
  
  // BAUBESCHREIBUNG
  if (lowerText.match(/baubeschreibung|leistungsbeschreibung|ausstattung|ausführung/)) {
    const hasDetails = lowerText.match(/material|ausführung|qualität|standard|oberfläche/);
    const confidence = hasDetails ? 0.8 : 0.6;
    types.push({ type: 'BAUBESCHREIBUNG', confidence });
  }
  
  // PROTOKOLL / BEGEHUNG
  if (lowerText.match(/protokoll|begehung|bautagebuch|besprechung|meeting/)) {
    const hasDate = lowerText.match(/datum|date|\d{2}\.\d{2}\.\d{4}/);
    const confidence = hasDate ? 0.7 : 0.5;
    types.push({ type: 'PROTOKOLL', confidence });
  }
  
  // Sortiere nach Confidence und wähle besten Match
  types.sort((a, b) => b.confidence - a.confidence);
  
  if (types.length === 0) {
    return { type: 'UNKNOWN', confidence: 0, description: 'Dokumenttyp nicht erkennbar' };
  }
  
  const bestMatch = types[0];
  
  // Dokumenttyp-Beschreibungen
  const descriptions = {
    'ANGEBOT': 'Angebot/Kostenvoranschlag mit Positionen und Preisen',
    'RECHNUNG': 'Rechnung über ausgeführte Leistungen',
    'LEISTUNGSVERZEICHNIS': 'Leistungsverzeichnis nach VOB',
    'BAUPLAN': 'Bauplan/Grundriss mit Maßen',
    'GUTACHTEN': 'Gutachten mit Schadensanalyse',
    'DATENBLATT': 'Technisches Datenblatt',
    'AUFMASS': 'Aufmaß/Vermessung',
    'ENERGIEAUSWEIS': 'Energieausweis',
    'HEIZLASTBERECHNUNG': 'Heizlastberechnung nach DIN 12831',
    'STATIK': 'Statisches Gutachten',
    'BAUBESCHREIBUNG': 'Baubeschreibung',
    'PROTOKOLL': 'Protokoll/Begehung'
  };
  
  return {
    type: bestMatch.type,
    confidence: bestMatch.confidence,
    description: descriptions[bestMatch.type] || bestMatch.type,
    alternativeTypes: types.slice(1, 3).map(t => t.type)
  };
}

/**
 * Extrahiere relevanten Content basierend auf Frage und Dokumenttyp
 */
function extractRelevantContent(fullText, questionContext, docType, tradeCode) {
  const maxLength = 15000; // Claude-optimierte Länge
  
  // Wenn Text kurz genug, verwende alles
  if (fullText.length <= maxLength) {
    return fullText;
  }
  
  // Intelligentes Chunking basierend auf Dokumenttyp
  const relevantSections = [];
  const questionLower = questionContext.toLowerCase();
  const textLines = fullText.split('\n');
  
  // Definiere Suchbegriffe basierend auf Frage
  const searchTerms = extractSearchTerms(questionContext, tradeCode);
  
  // Durchsuche Text nach relevanten Abschnitten
  for (let i = 0; i < textLines.length; i++) {
    const line = textLines[i];
    const lineLower = line.toLowerCase();
    
    // Prüfe ob Zeile relevante Begriffe enthält
    const isRelevant = searchTerms.some(term => lineLower.includes(term));
    
    if (isRelevant) {
      // Füge Kontext hinzu (10 Zeilen vor und nach)
      const contextStart = Math.max(0, i - 10);
      const contextEnd = Math.min(textLines.length, i + 10);
      const section = textLines.slice(contextStart, contextEnd).join('\n');
      relevantSections.push(section);
    }
  }
  
  // Kombiniere relevante Abschnitte
  let combinedText = relevantSections.join('\n---\n');
  
  // Falls immer noch zu lang, kürze intelligent
  if (combinedText.length > maxLength) {
    // Bei Angeboten: Fokus auf Positionen
    if (docType.type === 'ANGEBOT' || docType.type === 'LEISTUNGSVERZEICHNIS') {
      combinedText = extractPositions(combinedText, maxLength);
    } else {
      // Sonst: Erste relevante Abschnitte
      combinedText = combinedText.substring(0, maxLength);
    }
  }
  
  // Falls keine relevanten Abschnitte gefunden, nehme Anfang
  if (combinedText.length < 500) {
    combinedText = fullText.substring(0, maxLength);
  }
  
  return combinedText;
}

/**
 * Extrahiere Suchbegriffe aus Frage und Trade
 */
function extractSearchTerms(questionContext, tradeCode) {
  const terms = [];
  const questionLower = questionContext.toLowerCase();
  
  // Allgemeine Begriffe aus Frage
  const keywords = questionLower.match(/\b\w{4,}\b/g) || [];
  terms.push(...keywords);
  
  // Trade-spezifische Begriffe
  const tradeKeywords = {
  'FEN': ['fenster', 'verglasung', 'rahmen', 'öffnung', 'maß', 'breite', 'höhe'],
  'TIS': ['tür', 'türen', 'zarge', 'türblatt', 'anschlag', 'maß'],
  'SAN': ['sanitär', 'wc', 'waschbecken', 'dusche', 'badewanne', 'armatur'],
  'HEI': ['heizung', 'heizkörper', 'kessel', 'watt', 'leistung', 'heizlast'],
  'KLIMA': ['klima', 'klimaanlage', 'klimagerät', 'lüftung', 'belüftung', 'ventilation', 'rlt', 'split', 'multisplit', 'kältemittel', 'kühlung', 'klimatisierung', 'außengerät', 'innengerät', 'kälteleistung', 'btu'],
  'ELEKT': ['verteilerkasten', 'elektro', 'steckdose', 'schalter', 'leuchte', 'installation'],
  'FLI': ['fliese', 'fliesen', 'format', 'fläche', 'm²'],
  'BOD': ['boden', 'bodenbelag', 'parkett', 'laminat', 'vinyl'],
  'MAL': ['farbe', 'anstrich', 'tapete', 'putz', 'spachtel'],
  'DACH': ['dach', 'ziegel', 'eindeckung', 'dämmung', 'dachfenster'],
  'FASS': ['fassade', 'wdvs', 'dämmung', 'putz', 'außenwand'],
  'GER': ['gerüst', 'fläche', 'höhe', 'standzeit'],
  'TRO': ['trockenbau', 'rigips', 'gipskarton', 'wand', 'decke'],
  'ESTR': ['estrich', 'zement', 'anhydrit', 'fläche'],
  'ROH': ['mauerwerk', 'beton', 'wand', 'decke', 'durchbruch'],
  'ZIMM': ['holz', 'balken', 'sparren', 'dachstuhl'],
  'SCHL': ['geländer', 'treppe', 'metall', 'edelstahl'],
  'ABBR': ['abbruch', 'demontage', 'entkernung', 'entsorgung'],
  'PV': ['photovoltaik', 'solar', 'modul', 'kwp', 'wechselrichter']
};
  
  if (tradeKeywords[tradeCode]) {
    terms.push(...tradeKeywords[tradeCode]);
  }
  
  // Entferne Duplikate
  return [...new Set(terms)];
}

/**
 * Extrahiere Positionen aus Angebot/LV
 */
function extractPositions(text, maxLength) {
  const lines = text.split('\n');
  const positions = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Erkenne Positionen (verschiedene Formate)
    if (line.match(/^\s*\d+[\.:]|^pos|^position/i)) {
      // Füge Position mit 5 Zeilen Kontext hinzu
      const context = lines.slice(i, Math.min(i + 5, lines.length)).join('\n');
      positions.push(context);
    }
  }
  
  let result = positions.join('\n---\n');
  
  if (result.length > maxLength) {
    result = result.substring(0, maxLength);
  }
  
  return result || text.substring(0, maxLength);
}

/**
 * Analysiere mit Claude basierend auf Dokumenttyp
 */
async function analyzeWithClaude(text, questionContext, tradeCode, docType) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  
  // Dokumenttyp-spezifischer System-Prompt
  const systemPrompt = getSystemPromptForDocType(docType, tradeCode);
  
  const userPrompt = `DOKUMENTTYP: ${docType.type} (Confidence: ${(docType.confidence * 100).toFixed(0)}%)

PDF-INHALT:
${text}

FRAGE ZU BEANTWORTEN:
${questionContext}

ANWEISUNGEN:
1. Analysiere das Dokument im Kontext der Frage
2. Extrahiere die relevanten Informationen
3. Gib eine DIREKTE, KONKRETE Antwort
4. Format: Genau so, dass die Antwort direkt ins Eingabefeld übernommen werden kann
5. Bei Mengen/Maßen: Gib konkrete Zahlen mit Einheiten
6. Bei Listen: Strukturiere übersichtlich

BEISPIELE FÜR GUTE ANTWORTEN:
- Fenster: "12 Fenster: 6x 120x140cm Kunststoff weiß, 4x 80x100cm Kunststoff weiß, 2x 60x80cm Kippfenster"
- Fläche: "145 m² Wohnfläche"
- Material: "EPS 035 Dämmplatten, 16 cm Stärke"
- Anzahl: "8 Heizkörper: 3x 1400W, 5x 800W"

Antworte NUR mit der direkten Antwort, KEINE Erklärungen oder Einleitungen!`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-4-5-sonnet-20250929",
      max_tokens: 3000,
      temperature: 0.2,
      messages: [{
        role: "user",
        content: userPrompt
      }],
      system: systemPrompt
    });
    
    const answer = response.content[0].text.trim();
    
    // Versuche strukturierte Daten zu extrahieren
    const structured = extractStructuredData(answer, text, docType, tradeCode);
    
    return {
      answer: answer,
      structured: structured
    };
    
  } catch (error) {
    console.error('[PDF-ANALYZER] Claude API error:', error.message);
    throw new Error('Fehler bei der PDF-Analyse durch Claude');
  }
}

/**
 * Dokumenttyp-spezifische System-Prompts
 */
function getSystemPromptForDocType(docType, tradeCode) {
  const basePrompt = `Du bist ein Experte für ${tradeCode}-Arbeiten und analysierst Bau-Dokumente.`;
  
  const typePrompts = {
    'ANGEBOT': `${basePrompt}
Das Dokument ist ein ANGEBOT/KOSTENVORANSCHLAG.
Fokussiere auf:
- Positionsnummern und -beschreibungen
- Mengenangaben (Anzahl, m², lfm, etc.)
- Materialspezifikationen
- Preise als Referenz
Extrahiere KONKRETE Mengen und Spezifikationen.`,

    'RECHNUNG': `${basePrompt}
Das Dokument ist eine RECHNUNG.
Fokussiere auf:
- Tatsächlich ausgeführte Leistungen
- Abgerechnete Mengen
- Materialien die verwendet wurden
Nutze dies als Referenz für ähnliche Projekte.`,

    'LEISTUNGSVERZEICHNIS': `${basePrompt}
Das Dokument ist ein LEISTUNGSVERZEICHNIS nach VOB.
Fokussiere auf:
- Ordnungszahlen und Titel
- Detaillierte Leistungsbeschreibungen
- Mengenansätze
- Qualitätsangaben und Normen
Extrahiere präzise Mengen und Spezifikationen.`,

    'BAUPLAN': `${basePrompt}
Das Dokument ist ein BAUPLAN/GRUNDRISS.
Fokussiere auf:
- Raummaße (Länge, Breite, Höhe)
- Wandstärken
- Öffnungen (Türen, Fenster mit Maßen)
- Flächenangaben
Berechne wenn möglich fehlende Maße.`,

    'GUTACHTEN': `${basePrompt}
Das Dokument ist ein GUTACHTEN.
Fokussiere auf:
- Festgestellte Mängel/Schäden
- Empfohlene Maßnahmen
- Umfang der Arbeiten
- Dringlichkeit
Extrahiere handlungsrelevante Informationen.`,

    'DATENBLATT': `${basePrompt}
Das Dokument ist ein TECHNISCHES DATENBLATT.
Fokussiere auf:
- Produktbezeichnung und Modell
- Technische Spezifikationen
- Abmessungen
- Material und Eigenschaften
- Leistungsdaten
Extrahiere alle relevanten technischen Details.`,

    'AUFMASS': `${basePrompt}
Das Dokument ist ein AUFMASS/VERMESSUNG.
Fokussiere auf:
- Gemessene Längen, Breiten, Höhen
- Flächen und Volumen
- Anzahlen (Stück)
- Raumbezeichnungen
Übernehme die Maße EXAKT wie gemessen.`,

    'HEIZLASTBERECHNUNG': `${basePrompt}
Das Dokument ist eine HEIZLASTBERECHNUNG.
Fokussiere auf:
- Raumweise Heizlasten in Watt
- Empfohlene Heizkörpergrößen
- Vorlauftemperaturen
- Gesamtheizlast des Gebäudes
Extrahiere Heizleistungen pro Raum.`,

    'ENERGIEAUSWEIS': `${basePrompt}
Das Dokument ist ein ENERGIEAUSWEIS.
Fokussiere auf:
- Energiebedarfskennwerte
- Energieeffizienzklasse
- Empfohlene Modernisierungsmaßnahmen
- Gebäudedaten (Fläche, Baujahr)
Extrahiere relevante Energiekennwerte.`,

    'STATIK': `${basePrompt}
Das Dokument ist ein STATISCHES GUTACHTEN.
Fokussiere auf:
- Tragende Elemente
- Lastannahmen
- Erforderliche Verstärkungen
- Zulässige Durchbrüche
Extrahiere sicherheitsrelevante Vorgaben.`,

    'BAUBESCHREIBUNG': `${basePrompt}
Das Dokument ist eine BAUBESCHREIBUNG.
Fokussiere auf:
- Geplante Ausführungen
- Materialqualitäten
- Ausstattungsstandards
- Technische Details
Extrahiere Ausführungsdetails.`,

    'PROTOKOLL': `${basePrompt}
Das Dokument ist ein PROTOKOLL/BEGEHUNG.
Fokussiere auf:
- Vereinbarte Leistungen
- Festgestellte Punkte
- Zu erledigende Aufgaben
- Fristen und Termine
Extrahiere handlungsrelevante Vereinbarungen.`
  };
  
  return typePrompts[docType.type] || `${basePrompt}
Analysiere das Dokument und extrahiere alle relevanten Informationen zur Beantwortung der Frage.`;
}

/**
 * Extrahiere strukturierte Daten aus Antwort
 */
function extractStructuredData(answer, fullText, docType, tradeCode) {
  const structured = {
    type: docType.type,
    extracted: {}
  };
  
  // Extrahiere Zahlen mit Einheiten
  const measurements = answer.match(/(\d+[,.]?\d*)\s*(m²|m|cm|mm|kW|W|Stk|Stück|lfm)/gi);
  if (measurements) {
    structured.extracted.measurements = measurements;
  }
  
  // Extrahiere Materialien
  const materials = extractMaterials(answer);
  if (materials.length > 0) {
    structured.extracted.materials = materials;
  }
  
  // Extrahiere Anzahlen
  const counts = answer.match(/(\d+)\s*(?:x|Stück|Stk)/gi);
  if (counts) {
    structured.extracted.counts = counts;
  }
  
  // Dokumenttyp-spezifische Extraktion
  switch (docType.type) {
    case 'ANGEBOT':
    case 'LEISTUNGSVERZEICHNIS':
      structured.extracted.positions = extractPositionsFromText(fullText);
      break;
      
    case 'HEIZLASTBERECHNUNG':
      structured.extracted.rooms = extractRoomsWithHeating(fullText);
      break;
      
    case 'BAUPLAN':
      structured.extracted.rooms = extractRoomDimensions(fullText);
      break;
  }
  
  return structured;
}

/**
 * Hilfsfunktionen für Extraktion
 */
function extractMaterials(text) {
  const materialKeywords = [
    'Kunststoff', 'Holz', 'Aluminium', 'Edelstahl', 'Beton', 'Ziegel',
    'EPS', 'Mineralwolle', 'Glaswolle', 'Fichte', 'Eiche', 'Lärche',
    'Gipskarton', 'Rigips', 'Fermacell', 'Porenbeton', 'Kalksandstein'
  ];
  
  const found = [];
  materialKeywords.forEach(keyword => {
    const regex = new RegExp(keyword, 'gi');
    if (text.match(regex)) {
      found.push(keyword);
    }
  });
  
  return [...new Set(found)];
}

function extractPositionsFromText(text) {
  const positions = [];
  const lines = text.split('\n');
  
  lines.forEach(line => {
    // Erkenne Positionszeilen
    const posMatch = line.match(/^\s*(\d+\.?\d*)[\.:\s]+(.+?)(?:\s+(\d+[,.]?\d*)\s*(m²|m|Stk|lfm))?/);
    if (posMatch) {
      positions.push({
        nr: posMatch[1],
        description: posMatch[2].trim(),
        quantity: posMatch[3] || null,
        unit: posMatch[4] || null
      });
    }
  });
  
  return positions;
}

function extractRoomsWithHeating(text) {
  const rooms = [];
  const lines = text.split('\n');
  
  lines.forEach(line => {
    // Erkenne Raum mit Heizlast
    const roomMatch = line.match(/(.+?)\s+(\d+[,.]?\d*)\s*(?:W|Watt|kW)/i);
    if (roomMatch) {
      rooms.push({
        name: roomMatch[1].trim(),
        heatingLoad: roomMatch[2],
        unit: roomMatch[3] || 'W'
      });
    }
  });
  
  return rooms;
}

function extractRoomDimensions(text) {
  const rooms = [];
  const lines = text.split('\n');
  
  lines.forEach(line => {
    // Erkenne Raummaße
    const dimMatch = line.match(/(.+?)\s+(\d+[,.]?\d*)\s*[xX×]\s*(\d+[,.]?\d*)\s*(?:m|meter)?/i);
    if (dimMatch) {
      rooms.push({
        name: dimMatch[1].trim(),
        length: parseFloat(dimMatch[2].replace(',', '.')),
        width: parseFloat(dimMatch[3].replace(',', '.')),
        area: parseFloat(dimMatch[2].replace(',', '.')) * parseFloat(dimMatch[3].replace(',', '.'))
      });
    }
  });
  
  return rooms;
}

/**
 * Exportiere für LV-Integration
 */
function exportForLV(analyzedData) {
  if (!analyzedData || !analyzedData.structured) {
    return null;
  }
  
  return {
    documentType: analyzedData.metadata.documentType,
    answer: analyzedData.text,
    extracted: analyzedData.structured.extracted,
    confidence: analyzedData.metadata.confidence
  };
}

module.exports = { 
  analyzePdfWithClaude,
  detectDocumentType,
  exportForLV
};
