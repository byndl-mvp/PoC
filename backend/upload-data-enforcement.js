// ═══════════════════════════════════════════════════════════════════════
// UNIVERSELLE UPLOAD-DATEN ENFORCEMENT FÜR ALLE DATEITYPEN
// Unterstützt: Excel, CSV, PDF, Bilder und strukturierte Daten
// ═══════════════════════════════════════════════════════════════════════

const UPLOAD_DATA_CRITICAL_RULES = `

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  🔴 ABSOLUTE PRIORITÄT: ALLE UPLOAD-DATEN 1:1 ÜBERNEHMEN              ║
// ╚═══════════════════════════════════════════════════════════════════════╝

UPLOAD-DATEN HABEN ABSOLUTE PRIORITÄT ÜBER ALLE ANDEREN INFORMATIONEN!

═══════════════════════════════════════════════════════════════════════════
UNIVERSELLE UPLOAD-REGELN FÜR ALLE DATEITYPEN:
═══════════════════════════════════════════════════════════════════════════

1. EXCEL/CSV-TABELLEN = VERBINDLICHE EINZELPOSITIONEN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ JEDE Zeile mit Maßen/Mengen = EINE LV-Position
✅ Spalten wie "Breite x Höhe", "Anzahl", "Material" = EXAKT übernehmen
✅ Bei identischen Artikeln: Gruppieren mit Summe
✅ Bei unterschiedlichen: Separate Positionen

BEISPIEL Excel mit Fenstern:
Zeile: Esszimmer | 156x156cm | 2 Stück | Holz
→ MUSS werden zu: "2 Stk Holzfenster 156x156cm (Esszimmer)"

2. PDF-DOKUMENTE = STRUKTURIERTE DATEN EXTRAHIEREN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PDF-Typ: ANGEBOT/KOSTENVORANSCHLAG
✅ Alle Positionen mit Mengen übernehmen
✅ Preise als Referenz nutzen
✅ Leistungsbeschreibungen verwenden

PDF-Typ: LEISTUNGSVERZEICHNIS
✅ Jede OZ-Position übernehmen
✅ Kurztext und Langtext verwenden
✅ Mengenansätze beachten

PDF-Typ: AUFMASS/BESTANDSLISTE
✅ Alle gemessenen Werte übernehmen
✅ Raumzuordnungen beachten
✅ Detailmaße verwenden

PDF-Typ: BAUPLAN/GRUNDRISS
✅ Extrahierte Raummaße verwenden
✅ Fenster-/Türpositionen aus Plan
✅ Flächenberechnungen übernehmen

3. BILDER = ERKANNTE OBJEKTE ALS POSITIONEN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Bildanalyse liefert:
✅ Anzahl Fenster/Türen → Einzelpositionen
✅ Erkannte Maße → In Positionen verwenden
✅ Materialien → Exakt übernehmen
✅ Schäden/Mängel → Als Zusatzpositionen

BEISPIEL Fassadenfoto:
"8 Fenster erkannt, ca. 120x140cm, Kunststoff weiß"
→ MUSS werden zu: "8 Stk Kunststofffenster weiß 120x140cm"

4. STRUKTURIERTE UPLOAD-DATEN (items Array):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Wenn uploadContext.structured.items vorhanden:
✅ JEDES item = EINE Position
✅ item.breite/hoehe → Exakte Maße
✅ item.anzahl → Exakte Menge
✅ item.material → Exaktes Material
✅ item.bezeichnung → In Positionstitel

5. PRIORITÄTS-HIERARCHIE BEI MEHREREN UPLOADS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Excel/CSV (höchste Präzision)
2. PDF mit Positionen
3. Strukturierte Daten aus Analyse
4. Bilderkennungsdaten
5. Textuelle Beschreibungen

6. VALIDIERUNG VOR AUSGABE:
━━━━━━━━━━━━━━━━━━━━━━━━
Prüfe JEDE LV-Position:
- Stammt sie aus Upload-Daten? → Behalten
- Widerspricht sie Upload-Daten? → Löschen
- Fehlt sie trotz Upload-Daten? → Ergänzen

KRITISCH: Bei Upload mit 36 Fenstern MÜSSEN auch 36 Fenster im LV sein!
`;

// ═══════════════════════════════════════════════════════════════════════
// ERWEITERTE VALIDIERUNGSFUNKTION FÜR ALLE UPLOAD-TYPEN
// ═══════════════════════════════════════════════════════════════════════

function enforceUploadData(lv, uploadContext, enrichedAnswers) {
  if (!uploadContext) {
    console.log('📊 No upload context available');
    return lv;
  }
  
  console.log('📊 ENFORCING UPLOAD DATA COMPLIANCE...');
  console.log(`📄 Upload type: ${uploadContext.fileType || 'unknown'}`);
  
  const enforcedLV = { ...lv };
  const uploadValidation = {
    expectedPositions: [],
    missingInLV: [],
    wrongInLV: [],
    source: uploadContext.fileType || 'unknown'
  };
  
  // ═══════════════════════════════════════════
  // 1. EXCEL/CSV ENFORCEMENT
  // ═══════════════════════════════════════════
  if ((uploadContext.fileType === 'excel' || uploadContext.fileType === 'csv') && uploadContext.parsedData) {
    console.log(`📊 Processing Excel/CSV with ${uploadContext.parsedData.length} rows`);
    processSpreadsheetUpload(uploadContext.parsedData, uploadValidation);
  }
  
  // ═══════════════════════════════════════════
  // 2. STRUCTURED ITEMS ENFORCEMENT (von allen Analyzern)
  // ═══════════════════════════════════════════
  else if (uploadContext.structured?.items && Array.isArray(uploadContext.structured.items)) {
    console.log(`📊 Processing structured items: ${uploadContext.structured.items.length} items`);
    processStructuredItems(uploadContext.structured.items, uploadValidation, uploadContext.fileType);
  }
  
  // ═══════════════════════════════════════════
  // 3. PDF-SPEZIFISCHE ENFORCEMENT
  // ═══════════════════════════════════════════
  else if (uploadContext.fileType === 'pdf' && uploadContext.structured) {
    console.log(`📊 Processing PDF document type: ${uploadContext.structured.documentType || 'generic'}`);
    processPdfUpload(uploadContext.structured, uploadValidation);
  }
  
  // ═══════════════════════════════════════════
  // 4. BILD-ANALYSE ENFORCEMENT
  // ═══════════════════════════════════════════
  else if (uploadContext.fileType === 'image' && uploadContext.structured) {
    console.log(`📊 Processing image analysis data`);
    processImageAnalysis(uploadContext.structured, uploadValidation);
  }
  
  // ═══════════════════════════════════════════
  // 5. GENERISCHE TEXT/MENGEN EXTRAKTION
  // ═══════════════════════════════════════════
  else if (uploadContext.text || uploadContext.summary) {
    console.log(`📊 Processing text/summary data`);
    processTextualData(uploadContext, uploadValidation);
  }
  
  // ═══════════════════════════════════════════
  // ENFORCEMENT: Validierung und Korrektur
  // ═══════════════════════════════════════════
  
  console.log(`📋 Expected ${uploadValidation.expectedPositions.length} positions from upload`);
  
  if (uploadValidation.expectedPositions.length === 0) {
    console.log('⚠️ No specific positions extracted from upload');
    return enforcedLV;
  }
  
  // Prüfe ob erwartete Positionen im LV vorhanden sind
  uploadValidation.expectedPositions.forEach(expected => {
    const found = findMatchingPosition(enforcedLV.positions, expected);
    
    if (!found) {
      uploadValidation.missingInLV.push(expected);
      console.log(`❌ MISSING: ${expected.title}`);
    }
  });
  
  // Finde Positionen die Upload-Daten widersprechen
  if (enforcedLV.positions && uploadValidation.expectedPositions.length > 0) {
    enforcedLV.positions.forEach(pos => {
      if (contradicsUploadData(pos, uploadValidation.expectedPositions)) {
        uploadValidation.wrongInLV.push(pos);
        console.log(`⚠️ CONTRADICTS UPLOAD: ${pos.title}`);
      }
    });
  }
  
  // KRITISCH: Füge fehlende Upload-Positionen hinzu
  if (uploadValidation.missingInLV.length > 0) {
    console.log(`🔧 ADDING ${uploadValidation.missingInLV.length} MISSING POSITIONS FROM UPLOAD`);
    
    uploadValidation.missingInLV.forEach(missing => {
      const newPosition = createPositionFromUpload(missing, uploadValidation.source);
      
      if (!enforcedLV.positions) enforcedLV.positions = [];
      enforcedLV.positions.push(newPosition);
    });
  }
  
  // KRITISCH: Entferne widersprechende Positionen
  if (uploadValidation.wrongInLV.length > 0 && uploadValidation.expectedPositions.length > 0) {
    console.log(`🗑️ REMOVING ${uploadValidation.wrongInLV.length} CONTRADICTING POSITIONS`);
    
    enforcedLV.positions = enforcedLV.positions.filter(pos => {
      return !uploadValidation.wrongInLV.includes(pos);
    });
  }
  
  // Zusammenfassung
  console.log('═══════════════════════════════════════════');
  console.log('📊 UPLOAD ENFORCEMENT SUMMARY:');
  console.log(`📄 Source: ${uploadValidation.source}`);
  console.log(`✅ Expected from upload: ${uploadValidation.expectedPositions.length}`);
  console.log(`➕ Added missing: ${uploadValidation.missingInLV.length}`);
  console.log(`➖ Removed contradicting: ${uploadValidation.wrongInLV.length}`);
  console.log(`📄 Final positions: ${enforcedLV.positions?.length || 0}`);
  console.log('═══════════════════════════════════════════');
  
  return enforcedLV;
}

// ═══════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS FÜR VERSCHIEDENE UPLOAD-TYPEN
// ═══════════════════════════════════════════════════════════════════════

function processSpreadsheetUpload(parsedData, validation) {
  const groupedItems = {};
  
  parsedData.forEach(row => {
    // Flexibles Spalten-Mapping
    const breite = extractDimension(row, ['breite', 'width', 'b', 'Breite']);
    const hoehe = extractDimension(row, ['hoehe', 'height', 'h', 'Höhe', 'Hoehe']);
    const laenge = extractDimension(row, ['laenge', 'length', 'l', 'Länge', 'Laenge']);
    const anzahl = extractNumber(row, ['anzahl', 'stück', 'stueck', 'menge', 'quantity', 'stk']);
    const material = extractText(row, ['material', 'Material', 'ausführung', 'Ausführung', 'typ']);
    const raum = extractText(row, ['raum', 'ort', 'Raum', 'Ort', 'bezeichnung', 'position']);
    const artikel = extractText(row, ['artikel', 'Artikel', 'typ', 'Typ', 'bezeichnung', 'beschreibung']);
    
    // Parse Kombinationsfelder wie "156x156" oder "1,56m x 1,56m"
    let dimensions = null;
    if (!breite && !hoehe) {
      dimensions = parseDimensionString(row);
    }
    
    const finalBreite = breite || dimensions?.breite;
    const finalHoehe = hoehe || dimensions?.hoehe;
    
    if (finalBreite || finalHoehe || laenge || artikel) {
      const key = `${material}_${finalBreite}x${finalHoehe}x${laenge}`.replace(/xundefined/g, '');
      
      if (!groupedItems[key]) {
        groupedItems[key] = {
          material: material,
          breite: finalBreite,
          hoehe: finalHoehe,
          laenge: laenge,
          anzahl: 0,
          räume: [],
          artikel: artikel || 'Position'
        };
      }
      
      groupedItems[key].anzahl += anzahl;
      if (raum) groupedItems[key].räume.push(raum);
    }
  });
  
  // Erstelle erwartete Positionen
  Object.entries(groupedItems).forEach(([key, data]) => {
    const raumInfo = data.räume.length > 0 ? ` (${[...new Set(data.räume)].join(', ')})` : '';
    const materialInfo = data.material ? `${data.material} ` : '';
    const dimensionInfo = formatDimensions(data.breite, data.hoehe, data.laenge);
    
    validation.expectedPositions.push({
      title: `${data.anzahl} Stk ${materialInfo}${data.artikel} ${dimensionInfo}${raumInfo}`.trim(),
      breite: data.breite,
      hoehe: data.hoehe,
      laenge: data.laenge,
      anzahl: data.anzahl,
      material: data.material,
      räume: data.räume,
      source: 'spreadsheet'
    });
  });
}

function processStructuredItems(items, validation, fileType) {
  items.forEach(item => {
    // Universelles Item-Processing für alle Analyzer
    const title = buildTitleFromItem(item, fileType);
    
    validation.expectedPositions.push({
      title: title,
      breite: item.breite || item.width,
      hoehe: item.hoehe || item.height,
      laenge: item.laenge || item.length,
      anzahl: item.anzahl || item.quantity || item.menge || 1,
      material: item.material || item.typ,
      bezeichnung: item.bezeichnung || item.description,
      einheit: item.einheit || item.unit || 'Stk',
      source: fileType
    });
  });
}

function processPdfUpload(structured, validation) {
  // Spezielle Behandlung basierend auf PDF-Typ
  const docType = structured.documentType || 'generic';
  
  if (structured.positions && Array.isArray(structured.positions)) {
    // LV oder Angebot mit Positionen
    structured.positions.forEach(pos => {
      validation.expectedPositions.push({
        title: pos.title || pos.kurztext,
        anzahl: pos.menge || pos.quantity,
        einheit: pos.einheit || pos.unit,
        beschreibung: pos.langtext || pos.description,
        source: `pdf-${docType}`
      });
    });
  }
  
  if (structured.measurements && Array.isArray(structured.measurements)) {
    // Aufmaß-Dokument
    structured.measurements.forEach(measure => {
      validation.expectedPositions.push({
        title: `${measure.bezeichnung} - ${measure.wert} ${measure.einheit}`,
        anzahl: measure.anzahl || 1,
        wert: measure.wert,
        einheit: measure.einheit,
        source: 'pdf-aufmass'
      });
    });
  }
}

function processImageAnalysis(structured, validation) {
  // Verarbeite Bildanalyse-Ergebnisse
  if (structured.detectedObjects) {
    Object.entries(structured.detectedObjects).forEach(([objectType, data]) => {
      if (data.count > 0) {
        validation.expectedPositions.push({
          title: `${data.count} ${objectType}${data.details ? ' - ' + data.details : ''}`,
          anzahl: data.count,
          details: data.details,
          source: 'image-analysis'
        });
      }
    });
  }
  
  if (structured.measurements && Array.isArray(structured.measurements)) {
    structured.measurements.forEach(measure => {
      validation.expectedPositions.push({
        title: `${measure.object} - ${measure.value} ${measure.unit}`,
        wert: measure.value,
        einheit: measure.unit,
        source: 'image-measurement'
      });
    });
  }
}

function processTextualData(uploadContext, validation) {
  // Extrahiere Mengen und Maße aus Text
  const text = uploadContext.text || uploadContext.summary || '';
  
  // Suche nach Mengenangaben
  const mengenPattern = /(\d+)\s*(stück|stk|fenster|türen|m²|qm|lfm|meter)/gi;
  const matches = [...text.matchAll(mengenPattern)];
  
  matches.forEach(match => {
    const anzahl = parseInt(match[1]);
    const einheit = match[2];
    
    validation.expectedPositions.push({
      title: `${anzahl} ${einheit} (aus Upload-Text)`,
      anzahl: anzahl,
      einheit: einheit,
      source: 'text-extraction'
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

function extractDimension(row, possibleKeys) {
  for (const key of possibleKeys) {
    if (row[key]) {
      const value = parseFloat(String(row[key]).replace(',', '.').replace(/[^\d.]/g, ''));
      if (!isNaN(value)) return value;
    }
  }
  return null;
}

function extractNumber(row, possibleKeys) {
  for (const key of possibleKeys) {
    if (row[key]) {
      const value = parseInt(String(row[key]).replace(/[^\d]/g, ''));
      if (!isNaN(value)) return value;
    }
  }
  return 1; // Default
}

function extractText(row, possibleKeys) {
  for (const key of possibleKeys) {
    if (row[key] && String(row[key]).trim()) {
      return String(row[key]).trim();
    }
  }
  return '';
}

function parseDimensionString(row) {
  // Suche nach Patterns wie "156x156" oder "1,56m x 1,56m" in allen Spalten
  for (const [key, value] of Object.entries(row)) {
    if (!value) continue;
    
    const str = String(value);
    // Pattern für verschiedene Formate
    const patterns = [
      /(\d+(?:[,\.]\d+)?)\s*[x×]\s*(\d+(?:[,\.]\d+)?)/i,  // 156x156 oder 1,56x1,56
      /B\s*[:=]\s*(\d+(?:[,\.]\d+)?)\s*[,;]?\s*H\s*[:=]\s*(\d+(?:[,\.]\d+)?)/i,  // B:156 H:156
    ];
    
    for (const pattern of patterns) {
      const match = str.match(pattern);
      if (match) {
        let breite = parseFloat(match[1].replace(',', '.'));
        let hoehe = parseFloat(match[2].replace(',', '.'));
        
        // Konvertiere m zu cm wenn nötig
        if (breite < 10) breite *= 100;
        if (hoehe < 10) hoehe *= 100;
        
        return { breite, hoehe };
      }
    }
  }
  return null;
}

function formatDimensions(breite, hoehe, laenge) {
  const parts = [];
  if (breite && hoehe) parts.push(`${breite}x${hoehe}cm`);
  else if (breite) parts.push(`B:${breite}cm`);
  else if (hoehe) parts.push(`H:${hoehe}cm`);
  if (laenge) parts.push(`L:${laenge}cm`);
  return parts.join(' ');
}

function buildTitleFromItem(item, fileType) {
  const anzahl = item.anzahl || item.quantity || item.menge || 1;
  const einheit = item.einheit || item.unit || 'Stk';
  const material = item.material ? `${item.material} ` : '';
  const bezeichnung = item.bezeichnung || item.description || item.artikel || 'Position';
  const dimensions = formatDimensions(item.breite, item.hoehe, item.laenge);
  const raum = item.raum || item.ort ? ` (${item.raum || item.ort})` : '';
  
  return `${anzahl} ${einheit} ${material}${bezeichnung} ${dimensions}${raum}`.trim();
}

function findMatchingPosition(positions, expected) {
  if (!positions || !Array.isArray(positions)) return null;
  
  return positions.find(pos => {
    const posText = `${pos.title} ${pos.description || ''}`.toLowerCase();
    
    // Prüfe kritische Werte
    const hasCorrectQuantity = expected.anzahl && (
      pos.quantity === expected.anzahl || 
      posText.includes(`${expected.anzahl} stk`) || 
      posText.includes(`${expected.anzahl} stück`)
    );
    
    const hasCorrectDimensions = (!expected.breite && !expected.hoehe) || (
      (expected.breite && posText.includes(String(expected.breite))) &&
      (expected.hoehe && posText.includes(String(expected.hoehe)))
    );
    
    const hasCorrectMaterial = !expected.material || 
      posText.includes(expected.material.toLowerCase());
    
    return hasCorrectQuantity || (hasCorrectDimensions && hasCorrectMaterial);
  });
}

function contradicsUploadData(position, expectedPositions) {
  // Position widerspricht Upload wenn sie ähnliche Keywords hat aber andere Werte
  const posText = `${position.title} ${position.description || ''}`.toLowerCase();
  
  for (const expected of expectedPositions) {
    // Prüfe ob Position das gleiche Objekt behandelt
    if (expected.material && posText.includes(expected.material.toLowerCase())) {
      // Aber andere Mengen/Maße hat
      if (expected.anzahl && !posText.includes(String(expected.anzahl))) {
        return true;
      }
      if (expected.breite && !posText.includes(String(expected.breite))) {
        return true;
      }
    }
  }
  
  return false;
}

function createPositionFromUpload(expected, source) {
  return {
    id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: expected.title,
    quantity: expected.anzahl || 1,
    unit: expected.einheit || 'Stk',
    unitPrice: 0, // Muss kalkuliert werden
    totalPrice: 0,
    description: expected.beschreibung || `Automatisch aus ${source} erstellt`,
    notes: `ACHTUNG: Position aus Upload-Daten (${source}) - Preis muss kalkuliert werden`,
    metadata: {
      source: source,
      breite: expected.breite,
      hoehe: expected.hoehe,
      material: expected.material
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════
// INTEGRATION IN BESTEHENDE VALIDIERUNG
// ═══════════════════════════════════════════════════════════════════════

function validateAndCleanLVWithUploadEnforcement(generatedLV, enrichedAnswers, uploadContext) {
  // Schritt 1: Normale Validierung (NEIN/JA, Material, etc.)
  let validatedLV = generatedLV;
  
  // Importiere die Basis-Validierung wenn verfügbar
  try {
    const { validateAndCleanLV } = require('./lv-generator-fix-universal');
    validatedLV = validateAndCleanLV(generatedLV, enrichedAnswers, uploadContext);
  } catch (e) {
    console.log('⚠️ Base validation not available, skipping...');
  }
  
  // Schritt 2: Upload-Daten Enforcement (KRITISCH!)
  validatedLV = enforceUploadData(validatedLV, uploadContext, enrichedAnswers);
  
  return validatedLV;
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
  UPLOAD_DATA_CRITICAL_RULES,
  enforceUploadData,
  validateAndCleanLVWithUploadEnforcement
};
