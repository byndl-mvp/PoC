// ═══════════════════════════════════════════════════════════════════════
// UNIVERSELLE LV-GENERATOR VALIDIERUNG FÜR ALLE GEWERKE
// ═══════════════════════════════════════════════════════════════════════

const CRITICAL_PROMPT_ADDITIONS = `

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  🚨 KRITISCHE VALIDIERUNGSREGELN - ABSOLUTE PRIORITÄT 🚨              ║
// ╚═══════════════════════════════════════════════════════════════════════╝

WARNUNG: Diese Regeln haben ABSOLUTE PRIORITÄT über alle anderen Anweisungen!
Sie gelten für ALLE 21 GEWERKE: ELEKT, HEI, KLIMA, TRO, FLI, MAL, BOD, ROH, SAN, 
FEN, TIS, DACH, FASS, GER, ZIMM, ESTR, SCHL, AUSS, PV, ABBR

═══════════════════════════════════════════════════════════════════════════
GRUNDPRINZIP: Die enrichedAnswers sind die EINZIGE WAHRHEITQUELLE!
═══════════════════════════════════════════════════════════════════════════

1. UNIVERSELLE NEIN-REGEL (HÖCHSTE PRIORITÄT):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Für JEDES Gewerk und JEDE Leistung gilt:
❌ Wenn Antwort = "NEIN", "Nein", "nein", "false", "nicht", "keine", "ohne"
   → NIEMALS eine Position dafür erstellen
❌ Wenn Antwort = "vorhanden bleiben", "bestehende bleiben", "nicht erneuern"
   → KEINE Erneuerungsposition erstellen

Konkrete Beispiele nach Gewerk:
- ELEKT_schalter_erneuern: "NEIN" → KEINE Schalter-Positionen
- ELEKT_zusaetzliche_steckdosen: "NEIN" → KEINE zusätzlichen Steckdosen
- HEI_heizkoerper_tauschen: "NEIN" → KEINE Heizkörper-Austausch
- HEI_thermostat_erneuern: "NEIN" → KEINE neuen Thermostate
- KLIMA_klimaanlage: "NEIN" → KEINE Klimaanlagen-Position
- TRO_abgehängte_decke: "NEIN" → KEINE Decken-Positionen
- FLI_bodenfliesen_erneuern: "NEIN" → KEINE neuen Bodenfliesen
- MAL_waende_streichen: "NEIN" → KEINE Malerarbeiten
- BOD_parkett_schleifen: "NEIN" → KEIN Parkett schleifen
- ROH_wanddurchbruch: "NEIN" → KEINE Durchbrüche
- SAN_armaturen_erneuern: "NEIN" → KEINE neuen Armaturen
- SAN_wc_austauschen: "NEIN" → KEIN WC-Austausch
- FEN_rolladen_neu: "NEIN" → KEINE Rollläden
- FEN_fensterbanke_erneuern: "NEIN" → KEINE neuen Fensterbänke
- TIS_innentüren_erneuern: "NEIN" → KEINE neuen Türen
- DACH_neueindeckung: "NEIN" → KEINE Dacheindeckung
- FASS_daemmung: "NEIN" → KEINE Fassadendämmung
- GER_geruest: "NEIN" → KEIN Gerüst
- ZIMM_dachstuhl_erneuern: "NEIN" → KEIN neuer Dachstuhl
- ESTR_neuer_estrich: "NEIN" → KEIN neuer Estrich
- SCHL_gelaender_erneuern: "NEIN" → KEINE neuen Geländer
- AUSS_pflasterarbeiten: "NEIN" → KEINE Pflasterarbeiten
- PV_solaranlage: "NEIN" → KEINE Solaranlage
- ABBR_entkernung: "NEIN" → KEINE Entkernung

2. UNIVERSELLE JA-REGEL:
━━━━━━━━━━━━━━━━━━━━━━
Für JEDES Gewerk und JEDE Leistung gilt:
✅ Wenn Antwort = "JA", "Ja", "ja", "true", oder enthält konkrete Angaben
   → Position MUSS erstellt werden

Beispiele mit konkreten Angaben:
- "JA, 24 Steckdosen" → 24 Steckdosen-Positionen MÜSSEN rein
- "Ja, in allen 8 Räumen" → Positionen für 8 Räume MÜSSEN rein
- "5 neue Heizkörper" → 5 Heizkörper MÜSSEN rein (auch ohne "Ja")
- "Parkett in 120m²" → Parkett-Position mit 120m² MUSS rein

3. MATERIAL-/AUSFÜHRUNGS-TREUE REGEL:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Material/Ausführung EXAKT wie in Antworten angegeben
❌ NIEMALS eigenmächtig ändern oder "Erfahrungswerte" nutzen

Beispiele:
- FEN_material: "Holz" → NUR Holzfenster, NICHT Kunststoff
- TIS_material: "Eiche massiv" → NUR Eiche massiv, NICHT Buche oder Furnier
- BOD_bodenbelag: "Vinyl" → NUR Vinyl, NICHT Laminat
- FLI_fliesenformat: "30x60cm" → GENAU dieses Format, NICHT 60x60
- ELEKT_schalter: "Jung LS990" → GENAU diese Serie, NICHT Gira
- HEI_heizung: "Fußbodenheizung" → NUR Fußbodenheizung, NICHT Heizkörper
- SAN_armatur: "Grohe" → NUR Grohe, NICHT Hansgrohe

4. MENGEN-/MASSE-GENAUIGKEIT:
━━━━━━━━━━━━━━━━━━━━━━━━━
Bei Upload-Daten (Excel/PDF) oder konkreten Angaben:
✅ ECHTE Werte verwenden, keine Typisierung
❌ KEINE erfundenen "Typ A/B/C" wenn Einzeldaten vorliegen

Beispiele:
- Excel mit 36 Fenstern mit Einzelmaßen → 36 Einzelpositionen ODER gruppiert nach identischen Maßen
- "WC im EG, OG und DG" → 3 WC-Positionen, NICHT "3x Standard-WC"
- "8 Räume mit unterschiedlichen Größen" → Nach echten Größen, NICHT "8x Standardraum"

5. VOLLSTÄNDIGKEITS-REGEL:
━━━━━━━━━━━━━━━━━━━━━━━━
✅ JEDES Gewerk mit "JA"-Antworten MUSS Positionen haben
✅ ALLE bestätigten Leistungen MÜSSEN abgebildet werden
❌ KEINE Leistungen weglassen, nur weil sie "klein" erscheinen

6. KEINE STANDARD-ANNAHMEN:
━━━━━━━━━━━━━━━━━━━━━━━━━
❌ NIEMALS Positionen aus "Erfahrung" hinzufügen ohne Bestätigung
❌ KEINE "üblichen Nebenleistungen" ohne explizite Antwort
❌ KEINE "Das gehört normalerweise dazu" Positionen

Beispiele verbotener Annahmen:
- "Bei Fenstern gehören Fensterbänke dazu" → FALSCH, nur wenn bestätigt
- "Sanitär braucht immer Vorwandinstallation" → FALSCH, nur wenn bestätigt
- "Bei Elektro sind FI-Schalter Pflicht" → FALSCH, nur wenn bestätigt

7. VALIDIERUNG VOR AUSGABE:
━━━━━━━━━━━━━━━━━━━━━━━━
Prüfe JEDE Position gegen die enrichedAnswers:
1. Hat diese Leistung eine Bestätigung in den Antworten?
2. Wenn JA → Stimmen Material/Ausführung/Menge überein?
3. Wenn NEIN → Position LÖSCHEN
4. Gibt es JA-Antworten ohne Position? → Position ERGÄNZEN

KRITISCH: Verwende NUR Informationen aus:
- enrichedAnswers (alle Gewerk-spezifischen Antworten)
- uploadContext (Excel/PDF Uploads mit Detaildaten)
- KEINE anderen Quellen oder Annahmen!
`;

// ═══════════════════════════════════════════════════════════════════════
// GEWERK-DEFINITIONEN UND KEYWORD-MAPPING
// ═══════════════════════════════════════════════════════════════════════

const GEWERK_KEYWORDS = {
  'ELEKT': ['schalter', 'steckdose', 'leuchte', 'lampe', 'sicherung', 'verteiler', 'fi-schalter', 'kabel', 'elektro'],
  'HEI': ['heizung', 'heizkörper', 'thermostat', 'warmwasser', 'kessel', 'brenner', 'radiator', 'fußbodenheizung'],
  'KLIMA': ['klima', 'klimaanlage', 'lüftung', 'luftwechsel', 'abluft', 'zuluft', 'wärmerückgewinnung'],
  'TRO': ['rigips', 'trockenbau', 'ständerwerk', 'vorwand', 'gipskarton', 'abgehängt'],
  'FLI': ['fliese', 'verfugen', 'mosaik', 'naturstein', 'feinsteinzeug', 'bodenfliesen', 'wandfliesen'],
  'MAL': ['streichen', 'maler', 'farbe', 'anstrich', 'putz', 'tapezier', 'verputz', 'spachtel', 'lackier', 'grundierung'],
  'BOD': ['parkett', 'laminat', 'vinyl', 'teppich', 'linoleum', 'kork', 'designboden', 'boden'],
  'ROH': ['maurer', 'durchbruch', 'beton', 'wand', 'decke', 'sturz', 'kalksandstein', 'rohbau'],
  'SAN': ['wc', 'toilette', 'waschbecken', 'waschtisch', 'dusche', 'badewanne', 'abfluss', 'wasserhahn', 'armatur', 'sanitär'],
  'FEN': ['fenster', 'verglasung', 'rolladen', 'rollladen', 'jalousie', 'fensterbank', 'leibung'],
  'TIS': ['tür', 'innentür', 'zarge', 'türblatt', 'drücker', 'schloss', 'tischler'],
  'DACH': ['dach', 'ziegel', 'dachrinne', 'schneefang', 'gaube', 'eindeckung', 'dampfbremse', 'unterspannbahn'],
  'FASS': ['fassade', 'wdvs', 'dämmung', 'außenputz', 'verblendung', 'klinker', 'fassadenfarbe'],
  'GER': ['gerüst', 'baugerüst', 'arbeitsgerüst', 'fassadengerüst', 'rollgerüst', 'dachgerüst'],
  'ZIMM': ['holzbau', 'zimmerer', 'dachstuhl', 'gaube', 'carport', 'holzkonstruktion', 'fachwerk'],
  'ESTR': ['estrich', 'fließestrich', 'zementestrich', 'anhydritestrich', 'trockenestrich', 'ausgleichsmasse'],
  'SCHL': ['geländer', 'metallbau', 'schlosser', 'stahltreppe', 'metallarbeiten'],
  'AUSS': ['pflaster', 'einfahrt', 'außenanlage', 'randstein', 'gartenzaun', 'zaun', 'rasen'],
  'PV': ['solar', 'photovoltaik', 'solaranlage', 'wechselrichter', 'batterie', 'einspeisung'],
  'ABBR': ['abriss', 'abbruch', 'entkernung', 'rückbau', 'demontage']
};

// ═══════════════════════════════════════════════════════════════════════
// UNIVERSELLE VALIDIERUNGSFUNKTION
// ═══════════════════════════════════════════════════════════════════════

function validateAndCleanLV(generatedLV, enrichedAnswers, uploadContext) {
  console.log('🔍 Starting universal LV validation against user answers...');
  console.log(`📊 Processing ${Object.keys(enrichedAnswers).length} answer fields`);
  
  // Helper: Normalisiere Antwort für Vergleich
  const normalizeAnswer = (answer) => {
    if (!answer) return '';
    return String(answer).toLowerCase().trim();
  };
  
  // Helper: Check if answer means NO
  const isNoAnswer = (answer) => {
    if (!answer) return false;
    const normalized = normalizeAnswer(answer);
    
    // Explizite NEIN-Varianten
    const noVariants = [
      'nein', 'no', 'false', 'nicht', 'keine', 'kein', 'ohne',
      'nicht erforderlich', 'nicht notwendig', 'nicht nötig',
      'entfällt', 'negativ', 'nicht gewünscht'
    ];
    
    // Check für direkte Matches
    if (noVariants.includes(normalized)) return true;
    
    // Check für Teilstrings am Anfang
    const noStarts = ['nein', 'nicht', 'kein', 'ohne'];
    if (noStarts.some(start => normalized.startsWith(start))) return true;
    
    // Check für "bleiben" Formulierungen (keine Erneuerung)
    const keepPhrases = [
      'bleiben', 'vorhanden bleiben', 'bestehende bleiben', 
      'behalten', 'nicht erneuern', 'nicht austauschen',
      'vorhandene nutzen', 'bestehende nutzen'
    ];
    if (keepPhrases.some(phrase => normalized.includes(phrase))) return true;
    
    return false;
  };
  
  // Helper: Check if answer means YES
  const isYesAnswer = (answer) => {
    if (!answer) return false;
    const normalized = normalizeAnswer(answer);
    
    const yesVariants = ['ja', 'yes', 'true', 'jawohl', 'positiv', 'gewünscht'];
    
    // Direkte JA-Antworten
    if (yesVariants.some(yes => normalized.startsWith(yes))) return true;
    
    // Enthält konkrete Angaben (Zahlen, Mengen)
    if (/\d+/.test(normalized)) return true; // Enthält Zahlen
    if (normalized.includes('stück') || normalized.includes('stk')) return true;
    if (normalized.includes('m²') || normalized.includes('qm')) return true;
    if (normalized.includes('lfm') || normalized.includes('meter')) return true;
    
    return false;
  };
  
  // Helper: Extrahiere Gewerk aus Answer-Key
  const extractGewerk = (key) => {
    const upperKey = key.toUpperCase();
    for (const gewerk of Object.keys(GEWERK_KEYWORDS)) {
      if (upperKey.startsWith(gewerk + '_')) {
        return gewerk;
      }
    }
    return null;
  };
  
  // Helper: Extract material/type from answer
  const extractSpecification = (answer) => {
    if (!answer) return null;
    const normalized = normalizeAnswer(answer);
    
    // Material-Extraktion für verschiedene Gewerke
    const specifications = {
      // Fenster/Türen
      'holz': ['holz', 'massivholz', 'eiche', 'buche', 'kiefer'],
      'kunststoff': ['kunststoff', 'pvc', 'plastic'],
      'alu': ['alu', 'aluminium', 'aluminum'],
      'holz-alu': ['holz-alu', 'holz-aluminium'],
      'stahl': ['stahl', 'steel', 'metall', 'eisen'],
      // Böden
      'parkett': ['parkett', 'echtholz'],
      'laminat': ['laminat'],
      'vinyl': ['vinyl', 'pvc-boden'],
      'fliesen': ['fliese', 'keramik', 'feinsteinzeug'],
      // Sanitär
      'keramik': ['keramik', 'keramisch'],
      'edelstahl': ['edelstahl', 'v2a', 'v4a'],
      // Elektro
      'unterputz': ['unterputz', 'up'],
      'aufputz': ['aufputz', 'ap']
    };
    
    for (const [key, variants] of Object.entries(specifications)) {
      if (variants.some(v => normalized.includes(v))) {
        return key;
      }
    }
    
    return normalized; // Return as-is if no mapping found
  };
  
  // ═══════════════════════════════════════════
  // HAUPTVALIDIERUNG: Analyse der Antworten
  // ═══════════════════════════════════════════
  
  const validationRules = {
    forbidden: [],      // Positionen die NICHT erstellt werden dürfen
    required: [],       // Positionen die erstellt werden MÜSSEN
    specifications: {}  // Material/Ausführungs-Vorgaben
  };
  
  // Durchlaufe alle Antworten und baue Regeln auf
  for (const [key, value] of Object.entries(enrichedAnswers)) {
    const gewerk = extractGewerk(key);
    const keyLower = key.toLowerCase();
    
    // Skip wenn kein Gewerk zugeordnet werden kann
    if (!gewerk) {
      console.log(`⚠️ Skipping non-gewerk answer: ${key}`);
      continue;
    }
    
    // Regel 1: NEIN-Antworten → Forbidden Keywords
    if (isNoAnswer(value)) {
      console.log(`❌ [${gewerk}] ${key} = NEIN → Blocking related positions`);
      
      // Extrahiere relevante Keywords aus dem Key
      const keywordParts = keyLower.replace(gewerk.toLowerCase() + '_', '').split('_');
      
      // Füge spezifische Keywords zur Blacklist hinzu
      keywordParts.forEach(part => {
        if (part.length > 2) { // Ignoriere sehr kurze Wörter
          validationRules.forbidden.push({
            gewerk: gewerk,
            keyword: part,
            reason: `${key} = "${value}"`
          });
        }
      });
      
      // Füge auch verwandte Keywords hinzu basierend auf Gewerk
      if (gewerk === 'FEN') {
        if (keyLower.includes('fensterbank')) {
          validationRules.forbidden.push(
            { gewerk: 'FEN', keyword: 'fensterbank', reason: key },
            { gewerk: 'FEN', keyword: 'fensterbänke', reason: key },
            { gewerk: 'FEN', keyword: 'außenfensterbank', reason: key },
            { gewerk: 'FEN', keyword: 'innenfensterbank', reason: key }
          );
        }
        if (keyLower.includes('rolladen') || keyLower.includes('rollladen')) {
          validationRules.forbidden.push(
            { gewerk: 'FEN', keyword: 'rolladen', reason: key },
            { gewerk: 'FEN', keyword: 'rollladen', reason: key },
            { gewerk: 'FEN', keyword: 'rollläden', reason: key },
            { gewerk: 'FEN', keyword: 'jalousie', reason: key }
          );
        }
        if (keyLower.includes('leibung')) {
          validationRules.forbidden.push(
            { gewerk: 'FEN', keyword: 'leibung', reason: key },
            { gewerk: 'FEN', keyword: 'laibung', reason: key },
            { gewerk: 'FEN', keyword: 'leibungsverputz', reason: key }
          );
        }
      }
      
      // Weitere gewerk-spezifische Forbidden-Rules
      if (gewerk === 'SAN' && keyLower.includes('armatur')) {
        validationRules.forbidden.push(
          { gewerk: 'SAN', keyword: 'armatur', reason: key },
          { gewerk: 'SAN', keyword: 'wasserhahn', reason: key },
          { gewerk: 'SAN', keyword: 'mischbatterie', reason: key }
        );
      }
      
      if (gewerk === 'ELEKT' && keyLower.includes('steckdose')) {
        validationRules.forbidden.push(
          { gewerk: 'ELEKT', keyword: 'steckdose', reason: key },
          { gewerk: 'ELEKT', keyword: 'schuko', reason: key }
        );
      }
    }
    
    // Regel 2: JA-Antworten → Required Positions
    else if (isYesAnswer(value)) {
      console.log(`✅ [${gewerk}] ${key} = JA → Must have positions`);
      
      validationRules.required.push({
        gewerk: gewerk,
        requirement: key,
        details: value,
        keywords: keyLower.replace(gewerk.toLowerCase() + '_', '').split('_')
      });
      
      // Extrahiere Mengenangaben aus der Antwort
      const mengenMatch = value.match(/(\d+)\s*(stück|stk|m²|qm|lfm|meter)/i);
      if (mengenMatch) {
        validationRules.required[validationRules.required.length - 1].quantity = {
          amount: parseInt(mengenMatch[1]),
          unit: mengenMatch[2]
        };
      }
    }
    
    // Regel 3: Material/Spezifikation
    if (keyLower.includes('material') || keyLower.includes('ausführung') || keyLower.includes('typ')) {
      const spec = extractSpecification(value);
      if (spec && spec !== 'nein' && spec !== 'keine') {
        const category = keyLower.replace(gewerk.toLowerCase() + '_', '').split('_')[0];
        
        if (!validationRules.specifications[gewerk]) {
          validationRules.specifications[gewerk] = {};
        }
        
        validationRules.specifications[gewerk][category] = spec;
        console.log(`📋 [${gewerk}] Material/Type for ${category} = ${spec}`);
      }
    }
  }
  
  // ═══════════════════════════════════════════
  // Upload-Daten verarbeiten
  // ═══════════════════════════════════════════
  
  let uploadedData = null;
  if (uploadContext && uploadContext.parsedData) {
    console.log(`📄 Processing upload data: ${uploadContext.fileType}`);
    
    if (uploadContext.fileType === 'excel' && Array.isArray(uploadContext.parsedData)) {
      uploadedData = {
        type: 'measurements',
        items: uploadContext.parsedData,
        count: uploadContext.parsedData.length
      };
      console.log(`📏 Found ${uploadedData.count} items in upload`);
    }
  }
  
  // ═══════════════════════════════════════════
  // LV VALIDIERUNG UND BEREINIGUNG
  // ═══════════════════════════════════════════
  
  const cleanedLV = { ...generatedLV };
  const statistics = {
    removed: 0,
    corrected: 0,
    warnings: []
  };
  
  if (cleanedLV.positions && Array.isArray(cleanedLV.positions)) {
    // Filtere ungültige Positionen
    cleanedLV.positions = cleanedLV.positions.filter(position => {
      const posText = `${position.title} ${position.description}`.toLowerCase();
      
      // Check 1: Verbotene Keywords
      for (const forbidden of validationRules.forbidden) {
        if (posText.includes(forbidden.keyword)) {
          console.log(`🗑️ Removing: "${position.title}" (forbidden: ${forbidden.keyword}, reason: ${forbidden.reason})`);
          statistics.removed++;
          return false;
        }
      }
      
      // Check 2: Material-Korrektur
      for (const [gewerk, specs] of Object.entries(validationRules.specifications)) {
        // Prüfe ob Position zu diesem Gewerk gehört
        const gewerkKeywords = GEWERK_KEYWORDS[gewerk];
        if (!gewerkKeywords) continue;
        
        const isGewerkPosition = gewerkKeywords.some(kw => posText.includes(kw));
        
        if (isGewerkPosition) {
          for (const [category, correctSpec] of Object.entries(specs)) {
            // Liste falscher Materialien basierend auf Gewerk
            let wrongSpecs = [];
            
            if (gewerk === 'FEN' || gewerk === 'TIS') {
              wrongSpecs = ['kunststoff', 'pvc', 'alu', 'holz', 'stahl', 'holz-alu'];
            } else if (gewerk === 'BOD') {
              wrongSpecs = ['vinyl', 'laminat', 'parkett', 'teppich', 'linoleum', 'kork'];
            } else if (gewerk === 'FLI') {
              wrongSpecs = ['keramik', 'naturstein', 'feinsteinzeug', 'mosaik'];
            }
            
            for (const wrongSpec of wrongSpecs) {
              if (wrongSpec !== correctSpec && posText.includes(wrongSpec)) {
                // Korrigiere das Material
                const oldTitle = position.title;
                position.title = position.title.replace(new RegExp(wrongSpec, 'gi'), correctSpec);
                position.description = position.description.replace(new RegExp(wrongSpec, 'gi'), correctSpec);
                
                if (oldTitle !== position.title) {
                  console.log(`✏️ Corrected [${gewerk}]: "${oldTitle}" → "${position.title}"`);
                  statistics.corrected++;
                }
              }
            }
          }
        }
      }
      
      // Check 3: Warnung bei generischen Typen wenn Upload-Daten existieren
      if (uploadedData && uploadedData.type === 'measurements') {
        if (posText.match(/typ [a-z]/i) || posText.includes('standardmaß')) {
          statistics.warnings.push(`⚠️ Generic type used: "${position.title}" (${uploadedData.count} real measurements available)`);
        }
      }
      
      return true; // Position behalten
    });
    
    // ═══════════════════════════════════════════
    // Check für fehlende Required Positions
    // ═══════════════════════════════════════════
    
    for (const required of validationRules.required) {
      // Prüfe ob mindestens eine Position für diese Anforderung existiert
      const hasPosition = cleanedLV.positions.some(pos => {
        const posText = `${pos.title} ${pos.description}`.toLowerCase();
        return required.keywords.some(kw => kw.length > 2 && posText.includes(kw));
      });
      
      if (!hasPosition) {
        let warningMsg = `⚠️ MISSING [${required.gewerk}]: No position for "${required.requirement}"`;
        if (required.quantity) {
          warningMsg += ` (Required: ${required.quantity.amount} ${required.quantity.unit})`;
        } else {
          warningMsg += ` (Answer: "${required.details}")`;
        }
        statistics.warnings.push(warningMsg);
      }
    }
  }
  
  // ═══════════════════════════════════════════
  // Zusammenfassung ausgeben
  // ═══════════════════════════════════════════
  
  console.log('═══════════════════════════════════════════');
  console.log('📊 VALIDATION SUMMARY:');
  console.log(`✅ Positions kept: ${cleanedLV.positions ? cleanedLV.positions.length : 0}`);
  console.log(`🗑️ Positions removed: ${statistics.removed}`);
  console.log(`✏️ Positions corrected: ${statistics.corrected}`);
  
  if (statistics.warnings.length > 0) {
    console.log('\n⚠️ WARNINGS:');
    statistics.warnings.forEach(warning => console.log(warning));
  }
  
  console.log('═══════════════════════════════════════════');
  
  return cleanedLV;
}

// ═══════════════════════════════════════════════════════════════════════
// HILFSFUNKTION: Automatische Position-Erstellung für fehlende Required
// ═══════════════════════════════════════════════════════════════════════

function createMissingPositions(validationRules, uploadedData) {
  // Diese Funktion könnte automatisch fehlende Positionen erstellen
  // basierend auf den required Rules und Upload-Daten
  const missingPositions = [];
  
  // Implementierung für automatische Position-Erstellung
  for (const required of validationRules.required) {
    // Template für neue Position basierend auf Gewerk
    const positionTemplate = {
      ELEKT: {
        title: `Lieferung und Montage ${required.keywords.join(' ')}`,
        unit: 'Stk',
        defaultPrice: 150
      },
      SAN: {
        title: `Lieferung und Montage ${required.keywords.join(' ')}`,
        unit: 'Stk',
        defaultPrice: 500
      },
      FEN: {
        title: `Lieferung und Montage ${required.keywords.join(' ')}`,
        unit: 'Stk',
        defaultPrice: 800
      },
      // ... weitere Gewerke
    };
    
    if (positionTemplate[required.gewerk]) {
      const template = positionTemplate[required.gewerk];
      missingPositions.push({
        title: template.title,
        quantity: required.quantity?.amount || 1,
        unit: required.quantity?.unit || template.unit,
        unitPrice: template.defaultPrice,
        description: `Automatisch erstellt basierend auf: ${required.requirement}`
      });
    }
  }
  
  return missingPositions;
}

// Import der Upload-Enforcement Funktionen
const { enforceUploadData, UPLOAD_DATA_CRITICAL_RULES } = require('./upload-data-enforcement');

// Erweiterte Validierungsfunktion die ALLES kombiniert
function validateAndCleanLVComplete(generatedLV, enrichedAnswers, uploadContext) {
  // Schritt 1: Normale Validierung (NEIN/JA, Material, etc.)
  let validatedLV = validateAndCleanLV(generatedLV, enrichedAnswers, uploadContext);
  
  // Schritt 2: Upload-Daten Enforcement
  validatedLV = enforceUploadData(validatedLV, uploadContext, enrichedAnswers);
  
  return validatedLV;
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORT FÜR SERVER.JS
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
  CRITICAL_PROMPT_ADDITIONS,
  validateAndCleanLV,
  validateAndCleanLVComplete,
  createMissingPositions,
  GEWERK_KEYWORDS
};
