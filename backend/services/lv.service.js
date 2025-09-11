const { llmWithPolicy } = require('./llm.service');
const db = require('./database.service');
const { formatCurrency, parseFensterMaße } = require('../utils/helpers');

class LVService {
  
  /**
   * Generiert detailliertes LV mit Mengenberechnung
   */
  async function generateDetailedLV(projectId, tradeId) {
  const project = (await query('SELECT * FROM projects WHERE id=$1', [projectId])).rows[0];
  if (!project) throw new Error('Project not found');

  const trade = (await query('SELECT id, name, code FROM trades WHERE id=$1', [tradeId])).rows[0];
  if (!trade) throw new Error('Trade not found');

  // DIESE ZEILE HINZUFÜGEN:
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

4. VOLLSTÄNDIGKEIT:
   - Anzahl Positionen abhängig von Projektumfang
   - Kleine Projekte: 8-15 Positionen
   - Mittlere Projekte: 16-25 Positionen
   - Große Projekte: 25-35 Positionen

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
4. Dokumentiere alle Annahmen transparent`;
  
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
  
  // HIER die erweiterte Fenster-Validierung mit Auto-Korrektur:
if (trade.code === 'FEN') {
  const hasInvalidPositions = lv.positions.some(pos => 
    pos.description.toLowerCase().includes('fenster') &&
    !pos.description.match(/\d+\s*x\s*\d+\s*(cm|mm)/)
  );
  
  if (hasInvalidPositions) {
    console.error('[LV] WARNUNG: Fenster-LV ohne detaillierte Maßangaben erkannt! Regeneriere...');
    
    // Erweitere den User-Prompt mit expliziter Anweisung
    const enhancedPrompt = userPrompt + `\n\nKRITISCH: Die vorherige Generierung hatte Fenster OHNE Maßangaben!
    
ABSOLUT VERPFLICHTEND für JEDE Fensterposition:
- Format: "Fenster [Material], [BREITE] x [HÖHE] cm, [Öffnungsart]"
- Beispiel: "Fenster Kunststoff weiß, 120 x 140 cm, Dreh-Kipp"

Die Fenstermaße MÜSSEN aus den erfassten Antworten stammen!
Verwende die EXAKTEN Maße die der Nutzer angegeben hat.
KEINE erfundenen Standardmaße!
Wenn keine Maße in den Antworten vorhanden sind, kennzeichne dies deutlich als "Maße fehlen - vor Ort aufzunehmen".`;
    
    // KORRIGIERT: Verwende llmWithPolicy statt callLLM
    const retryResponse = await llmWithPolicy('lv', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: enhancedPrompt }
    ], { 
      maxTokens: 10000, 
      temperature: 0.3,
      jsonMode: true
    });
    
    // KORRIGIERT: Parse direkt ohne .content
    lv = JSON.parse(retryResponse.trim());
    console.log('[LV] Fenster-LV erfolgreich regeneriert mit Maßangaben aus Antworten');
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
   * Validiert und korrigiert Preise im LV
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
    
    // 2. BESTEHENDE REGEL: Putzarbeiten
    if ((titleLower.includes('putz') || 
         titleLower.includes('laibung') || 
         titleLower.includes('spachtel') ||
         titleLower.includes('glätten')) && 
        pos.unit === 'm' && pos.unitPrice > 100) {
      
      const oldPrice = pos.unitPrice;
      pos.unitPrice = 45;
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      warnings.push(`Putzarbeit korrigiert: "${pos.title}": €${oldPrice}/m → €${pos.unitPrice}/m`);
      fixedCount++;
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
  });
  
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
   * Finale LV-Validierung
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
      forbidden: ['fenster außen', 'elektro installation', 'sanitär', 'heizung', 'rigips', 'gipskarton'],
      except: ['fensterbank innen', 'möbelanschluss']
    },
    'ROH': {
      forbidden: ['fenster einbau', 'elektro feininstallation', 'sanitär objekte', 'fliesen', 'parkett', 'rigips'],
      except: ['kernbohrung', 'durchbruch']
    },
    'ABBR': {
      forbidden: ['neubau', 'neue fenster', 'neue elektro', 'neue sanitär', 'aufbau'],
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
   * Prüft auf doppelte Positionen
   */
  checkForDuplicatePositions(lv) {
    // KOPIEREN SIE aus server.js
    // Die KOMPLETTE checkForDuplicatePositions Funktion
  }
  
  /**
   * Berechnet LV-Summen
   */
  calculateLVSummary(lv) {
    // KOPIEREN SIE aus server.js
    // Die KOMPLETTE calculateLVSummary Funktion
  }
}

module.exports = new LVService();
