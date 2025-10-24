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
    
    // Erstelle strukturierte Antwort mit formatierten Items
    const formattedResult = formatResultForLV(result, tradeCode);
    
    // Generiere detaillierte Zusammenfassung
    const summary = generateDetailedSummary(formattedResult, tradeCode);
    
    return {
      text: summary,
      structured: formattedResult,
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
  
  const systemPrompt = `Du bist ein Experte für die Analyse von Bauprojekt-Daten aus Excel-Tabellen für Leistungsverzeichnisse (LV).

DEINE AUFGABE:
Analysiere die Excel-Tabelle und extrahiere ALLE relevanten Informationen strukturiert für das LV.

KONTEXT:
- Gewerk: ${tradeName} (Code: ${tradeCode})
- Frage/Kontext: ${questionText || 'Nicht angegeben'}

WICHTIGE REGELN:

1. INTELLIGENTE SPALTEN-ERKENNUNG:
   - Spalten können BELIEBIGE Namen haben
   - Erkenne intelligent was gemeint ist:
     * "BxH", "B x H", "Maße", "Größe" → Breite x Höhe
     * "Anzahl", "Stk", "Menge", "Qty", "Fenster Anzahl" → Anzahl
     * "Raum", "Position", "Ort" → Bezeichnung/Raum
     * "Stockwerk", "Etage", "OG", "EG", "KG" → Stockwerk
     * "Rolladen", "Rollladen" → Rolladen (ja/nein)
     * "Sicherheitsstandard", "RC", "Sicherheit" → Sicherheitsstandard (z.B. RC2, RC3)
     * "Verglasung", "Glas" → Verglasung (2-fach, 3-fach, etc.)
     * "Kommentar", "Bemerkung", "Notiz" → Kommentar

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
   - ALLE Spalten müssen erfasst werden

4. ZUSATZINFORMATIONEN:
   - Erfasse ALLE Spalten die relevant sein könnten
   - Rolladen, Sicherheitsstandard, Verglasung, Stockwerk, Kommentare etc.
   - Diese Informationen sind KRITISCH für das LV!

5. SUMMIERUNG:
   - Wenn "Anzahl" Spalte vorhanden: verwende diese Werte
   - Sonst: Anzahl = 1 pro Zeile

OUTPUT FORMAT (NUR valides JSON, keine Erklärungen):
{
  "items": [
    {
      "nr": 1,
      "bezeichnung": "Esszimmer",
      "breite": 156,           // IMMER in cm!
      "hoehe": 156,            // IMMER in cm!
      "anzahl": 2,             // Anzahl dieser Items
      "stockwerk": "EG",       // Stockwerk
      "rolladen": "ja",        // ja/nein
      "sicherheitsstandard": "RC2",  // z.B. RC2, RC3
      "verglasung": "3-fach",  // Art der Verglasung
      "kommentar": "...",      // Kommentare/Bemerkungen
      "zusatzinfo": {          // weitere relevante Spalten
        "material": "Kunststoff",
        "farbe": "weiß",
        "sonstige": "..."
      }
    }
  ],
  "summary": "Detaillierte Zusammenfassung aller Fenster mit Zusatzinformationen",
  "type": "fenster_liste"
}`;

  const userPrompt = `Analysiere diese Excel-Tabelle und extrahiere ALLE Einträge mit ALLEN Zusatzinformationen für das LV:

${excelText}

WICHTIG: Extrahiere ALLE Spalten und Informationen! Besonders:
- Rolladen (ja/nein)
- Sicherheitsstandard (RC2, RC3, etc.)
- Verglasung
- Stockwerk
- Kommentare

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

  console.log('[EXCEL-LLM] Raw response:', content.substring(0, 500));
  
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
 * Formatiert das Ergebnis für die LV-Ausgabe
 */
function formatResultForLV(result, tradeCode) {
  const formattedItems = result.items.map(item => {
    // Erstelle strukturiertes Item-Objekt
    const formattedItem = {
      nr: item.nr,
      bezeichnung: item.bezeichnung || item.raum || 'Nicht angegeben',
      breite: item.breite,
      hoehe: item.hoehe,
      anzahl: item.anzahl || 1,
      // Alle wichtigen Zusatzfelder auf oberster Ebene
      stockwerk: item.stockwerk || null,
      rolladen: item.rolladen || null,
      sicherheitsstandard: item.sicherheitsstandard || null,
      verglasung: item.verglasung || null,
      kommentar: item.kommentar || null
    };
    
    // Füge zusätzliche Informationen hinzu, falls vorhanden
    if (item.zusatzinfo && Object.keys(item.zusatzinfo).length > 0) {
      formattedItem.zusatzinfo = item.zusatzinfo;
    }
    
    return formattedItem;
  });
  
  return {
    type: result.type || `${tradeCode.toLowerCase()}_liste`,
    items: formattedItems,
    hasQuantities: formattedItems.length > 0,
    summary: result.summary,
    totalItems: formattedItems.reduce((sum, item) => sum + item.anzahl, 0)
  };
}

/**
 * Generiert detaillierte Zusammenfassung für LV
 */
function generateDetailedSummary(result, tradeCode) {
  const items = result.items || [];
  
  if (items.length === 0) {
    return 'Keine Einträge in der Excel-Tabelle gefunden';
  }
  
  // Erstelle detaillierte Aufstellung
  let summary = `📊 **${getTradeNameGerman(tradeCode)} - Detailauswertung für LV**\n\n`;
  summary += `Gesamt: ${result.totalItems} Stück in ${items.length} Positionen\n\n`;
  
  // Gruppiere nach Stockwerk
  const byStockwerk = {};
  items.forEach(item => {
    const stockwerk = item.stockwerk || 'Nicht angegeben';
    if (!byStockwerk[stockwerk]) {
      byStockwerk[stockwerk] = [];
    }
    byStockwerk[stockwerk].push(item);
  });
  
  // Ausgabe nach Stockwerk
  Object.keys(byStockwerk).sort().forEach(stockwerk => {
    summary += `**${stockwerk}:**\n`;
    byStockwerk[stockwerk].forEach(item => {
      summary += `• ${item.anzahl}x ${item.breite}x${item.hoehe}cm - ${item.bezeichnung}`;
      
      // Füge wichtige Zusatzinfos hinzu
      const extras = [];
      if (item.rolladen === 'ja') extras.push('mit Rolladen');
      if (item.sicherheitsstandard) extras.push(`${item.sicherheitsstandard}`);
      if (item.verglasung) extras.push(`${item.verglasung}`);
      if (item.kommentar) extras.push(`(${item.kommentar})`);
      
      if (extras.length > 0) {
        summary += ` [${extras.join(', ')}]`;
      }
      summary += '\n';
    });
    summary += '\n';
  });
  
  // Zusätzliche Statistiken
  const mitRolladen = items.filter(i => i.rolladen === 'ja').reduce((sum, i) => sum + i.anzahl, 0);
  const rc2Items = items.filter(i => i.sicherheitsstandard === 'RC2').reduce((sum, i) => sum + i.anzahl, 0);
  const rc3Items = items.filter(i => i.sicherheitsstandard === 'RC3').reduce((sum, i) => sum + i.anzahl, 0);
  
  summary += '**Zusammenfassung:**\n';
  summary += `• ${mitRolladen} Stück mit Rolladen\n`;
  if (rc2Items > 0) summary += `• ${rc2Items} Stück mit Sicherheitsstandard RC2\n`;
  if (rc3Items > 0) summary += `• ${rc3Items} Stück mit Sicherheitsstandard RC3\n`;
  
  return summary;
}

/**
 * Generiert strukturierte Ausgabe für Debug/Logging
 */
function generateDebugOutput(items) {
  return items.map((item, index) => {
    const parts = [`${index + 1}.`];
    
    // Füge alle Felder hinzu
    Object.entries(item).forEach(([key, value]) => {
      if (value !== null && value !== undefined && key !== 'zusatzinfo') {
        if (typeof value === 'object') {
          parts.push(`${key}: ${JSON.stringify(value)}`);
        } else {
          parts.push(`${key}: ${value}`);
        }
      }
    });
    
    // Zusatzinfo separat
    if (item.zusatzinfo) {
      parts.push(`zusatzinfo: ${JSON.stringify(item.zusatzinfo)}`);
    }
    
    return parts.join(' | ');
  }).join(' ');
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

// ╔═══════════════════════════════════════════════════════════════════════════╗
// EXPORTS
// ╚═══════════════════════════════════════════════════════════════════════════╝

module.exports = {
  parseSpreadsheetContent,
  analyzeSpreadsheetWithLLM,
  convertExcelToText,
  formatResultForLV,
  generateDetailedSummary,
  generateDebugOutput
};
