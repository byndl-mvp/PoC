const xlsx = require('xlsx');
const Anthropic = require('@anthropic-ai/sdk');

/**
 * Hauptfunktion: Analysiert Excel-Datei mit LLM
 */
async function parseSpreadsheetContent(workbook, tradeCode, questionText) {
  try {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    
    if (!data || data.length === 0) {
      console.log('[EXCEL-LLM] Empty spreadsheet');
      return {
        text: 'Leere Tabelle - keine auswertbaren Daten gefunden',
        structured: { 
          type: 'empty',
          items: [],
          error: 'Keine Daten in Tabelle'
        }
      };
    }
    
    console.log(`[EXCEL-LLM] Analyzing ${data.length} rows for trade ${tradeCode}`);
    
    // LLM-basierte Analyse
    const result = await analyzeSpreadsheetWithLLM(data, tradeCode, questionText);
    
    console.log(`[EXCEL-LLM] ✓ Success: ${result.items?.length || 0} items parsed`);
    
    // Erstelle strukturierte Antwort
    const summary = generateSummary(result, tradeCode);
    
    return {
      text: summary,
      structured: {
        type: result.type || 'generic',
        items: result.items || [],
        hasQuantities: result.items && result.items.length > 0,
        summary: result.summary
      },
      metadata: {
        method: 'llm-based',
        model: 'claude-3-5-sonnet-20241022',
        rowCount: data.length,
        columnCount: Object.keys(data[0] || {}).length,
        itemCount: result.items?.length || 0,
        tradeCode: tradeCode
      }
    };
    
  } catch (error) {
    console.error('[EXCEL-LLM] Error:', error);
    
    return {
      text: 'Excel-Analyse fehlgeschlagen: ' + error.message,
      structured: {
        type: 'error',
        items: [],
        error: error.message
      }
    };
  }
}

/**
 * LLM-basierte Analyse - Das Herzstück
 */
async function analyzeSpreadsheetWithLLM(data, tradeCode, questionText) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  
  // Konvertiere Excel zu Text
  const excelText = convertExcelToText(data);
  const tradeName = getTradeNameGerman(tradeCode);
  
  const systemPrompt = `Du bist ein Experte für die Analyse von Bauprojekt-Daten aus Excel-Tabellen.

DEINE AUFGABE:
Analysiere die Excel-Tabelle und extrahiere ALLE relevanten Informationen strukturiert.

KONTEXT:
- Gewerk: ${tradeName} (Code: ${tradeCode})
- Frage/Kontext: ${questionText || 'Nicht angegeben'}

WICHTIGE REGELN:

1. INTELLIGENTE SPALTEN-ERKENNUNG:
   - Spalten können BELIEBIGE Namen haben
   - Erkenne intelligent was gemeint ist:
     * "BxH", "B x H", "Maße", "Größe" → Breite x Höhe
     * "Anzahl", "Stk", "Menge", "Qty" → Anzahl
     * "Raum", "Position", "Ort" → Bezeichnung/Raum
     * usw.

2. MASS-PARSING:
   - Parse verschiedene Formate:
     * "156x156" → breite: 156, hoehe: 156
     * "156 x 156" → breite: 156, hoehe: 156
     * "1,56m x 1,56m" → breite: 156, hoehe: 156 (in cm!)
     * "156x156 zzgl. Rolladen" → breite: 156, hoehe: 156 (Text ignorieren)
   - ALLE Maße in CM ausgeben!

3. DATEN-EXTRAKTION:
   - Extrahiere JEDE Zeile als separates Item
   - Leere Zeilen überspringen
   - Bei fehlenden Werten: null verwenden

4. ZUSATZINFORMATIONEN:
   - Erfasse ALLE Spalten die relevant sein könnten
   - Material, Farbe, Typ, Kommentare etc.

5. SUMMIERUNG:
   - Wenn "Anzahl" Spalte vorhanden: verwende diese Werte
   - Sonst: Anzahl = 1 pro Zeile

OUTPUT FORMAT (NUR valides JSON, keine Erklärungen):
{
  "items": [
    {
      "nr": 1,
      "bezeichnung": "Esszimmer" oder "Fenster 1" falls kein Raum,
      "breite": 156,           // IMMER in cm!
      "hoehe": 156,            // IMMER in cm!
      "anzahl": 2,             // Anzahl dieser Items
      "material": "Kunststoff", // optional
      "zusatzinfo": {          // optional: weitere Spalten
        "rolladen": "ja",
        "verglasung": "3-fach",
        "kommentar": "..."
      }
    }
  ],
  "summary": "2x Fenster 156x156cm in Esszimmer, 1x Fenster 120x150cm in Küche, ...",
  "type": "fenster_liste"  // oder "tueren_liste", "fliesen_liste", "generic" etc.
}`;

  const userPrompt = `Analysiere diese Excel-Tabelle und extrahiere ALLE Einträge:

${excelText}

Gib das Ergebnis als JSON zurück.`;

  console.log('[EXCEL-LLM] Calling Claude API...');
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 6000,
    temperature: 0.2,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: userPrompt
    }]
  });

  const content = response.content[0].text;
  
  // Parse JSON
  let cleanedContent = content.trim();
  
  // Entferne Markdown-Wrapper falls vorhanden
  if (cleanedContent.includes('```json')) {
    cleanedContent = cleanedContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
  } else if (cleanedContent.includes('```')) {
    cleanedContent = cleanedContent.replace(/```\s*/g, '');
  }
  
  const result = JSON.parse(cleanedContent);
  
  // Validierung
  if (!result.items || !Array.isArray(result.items)) {
    throw new Error('LLM returned invalid format: missing items array');
  }
  
  console.log(`[EXCEL-LLM] ✓ Parsed ${result.items.length} items`);
  
  return result;
}

/**
 * Konvertiert Excel-Daten zu lesebarem Text für LLM
 */
function convertExcelToText(data) {
  if (!data || data.length === 0) return 'Leere Tabelle';
  
  const columns = Object.keys(data[0]);
  
  let text = '=== EXCEL-TABELLE ===\n\n';
  
  // Header
  text += 'SPALTEN:\n';
  text += columns.join(' | ') + '\n';
  text += '='.repeat(columns.length * 15) + '\n\n';
  
  // Daten (max 100 Zeilen für LLM)
  text += 'DATEN:\n';
  const maxRows = Math.min(data.length, 100);
  
  for (let i = 0; i < maxRows; i++) {
    const row = data[i];
    
    // Prüfe ob Zeile komplett leer
    const isEmpty = columns.every(col => {
      const val = row[col];
      return val === null || val === undefined || val === '';
    });
    
    if (isEmpty) continue; // Überspringe leere Zeilen
    
    text += `\nZeile ${i + 1}:\n`;
    columns.forEach(col => {
      const val = row[col];
      if (val !== null && val !== undefined && val !== '') {
        text += `  ${col}: ${val}\n`;
      }
    });
  }
  
  if (data.length > maxRows) {
    text += `\n... und ${data.length - maxRows} weitere Zeilen`;
  }
  
  text += `\n\nGESAMT: ${data.length} Zeilen`;
  
  return text;
}

/**
 * Generiert lesbare Zusammenfassung
 */
function generateSummary(result, tradeCode) {
  const items = result.items || [];
  
  if (items.length === 0) {
    return 'Keine Einträge in der Excel-Tabelle gefunden';
  }
  
  // Gewerk-spezifische Zusammenfassung
  switch (tradeCode) {
    case 'FEN':
      return generateFensterSummary(items);
    case 'TIS':
      return generateTuerenSummary(items);
    case 'FLI':
      return generateFliesenSummary(items);
    case 'BOD':
      return generateBodenSummary(items);
    default:
      return generateGenericSummary(items, tradeCode);
  }
}

function generateFensterSummary(items) {
  const total = items.reduce((sum, item) => sum + (item.anzahl || 1), 0);
  const uniqueSizes = [...new Set(items.map(i => `${i.breite}x${i.hoehe}`))];
  
  if (items.length <= 3) {
    // Detailliert für wenige Fenster
    return items.map(item => 
      `${item.anzahl || 1}x Fenster ${item.breite}x${item.hoehe}cm${item.bezeichnung ? ` (${item.bezeichnung})` : ''}`
    ).join(', ');
  } else {
    // Zusammengefasst für viele
    return `${total} Fenster in ${uniqueSizes.length} verschiedenen Größen analysiert`;
  }
}

function generateTuerenSummary(items) {
  const total = items.reduce((sum, item) => sum + (item.anzahl || 1), 0);
  return `${total} Türen aus Excel extrahiert`;
}

function generateFliesenSummary(items) {
  const totalArea = items.reduce((sum, item) => {
    const area = (item.breite / 100) * (item.hoehe / 100) * (item.anzahl || 1);
    return sum + area;
  }, 0);
  return `${items.length} Fliesenformate, ca. ${Math.round(totalArea)} m² Gesamtfläche`;
}

function generateBodenSummary(items) {
  const totalArea = items.reduce((sum, item) => {
    const area = item.flaeche || ((item.breite / 100) * (item.hoehe / 100));
    return sum + area;
  }, 0);
  return `${items.length} Bodenbereiche, ca. ${Math.round(totalArea)} m² Gesamtfläche`;
}

function generateGenericSummary(items, tradeCode) {
  return `${items.length} Einträge aus Excel analysiert (${getTradeNameGerman(tradeCode)})`;
}

/**
 * Trade-Code zu deutschem Namen
 */
function getTradeNameGerman(tradeCode) {
  const names = {
    'FEN': 'Fenster',
    'TIS': 'Türen',
    'FLI': 'Fliesen',
    'BOD': 'Bodenbeläge',
    'SAN': 'Sanitär',
    'HEI': 'Heizung',
    'ELEKT': 'Elektro',
    'MAL': 'Malerarbeiten',
    'DACH': 'Dacharbeiten',
    'FASS': 'Fassadenarbeiten',
    'TRO': 'Trockenbau',
    'ESTR': 'Estrich',
    'ROH': 'Rohbau',
    'ZIMM': 'Zimmerer',
    'GER': 'Gerüstbau',
    'SCHL': 'Schlosser',
    'ABBR': 'Abbruch',
    'PV': 'Photovoltaik',
    'KLI': 'Klimatechnik'
  };
  return names[tradeCode] || tradeCode;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  parseSpreadsheetContent,
  analyzeSpreadsheetWithLLM,
  convertExcelToText
};
