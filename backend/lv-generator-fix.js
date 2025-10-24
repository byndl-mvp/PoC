// ═══════════════════════════════════════════════════════════════════════
// LLM-BASIERTE LV-VALIDIERUNG
// Nutzt KI zur intelligenten Validierung statt komplexer Hardcode-Regeln
// Optimiert für Claude Haiku - schnell und präzise
// ═══════════════════════════════════════════════════════════════════════

const CRITICAL_PROMPT_ADDITIONS = `
// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  🚨 ABSOLUTE PRIORITÄT: ANTWORTEN 1:1 UMSETZEN 🚨                    ║
// ╚═══════════════════════════════════════════════════════════════════════╝

KRITISCHE REGELN:
1. NEIN-Antworten = KEINE Position dafür erstellen
2. Material EXAKT wie angegeben verwenden
3. Mengen EXAKT übernehmen
4. NUR Positionen für JA-Antworten oder konkret genannte Leistungen
`;

// ═══════════════════════════════════════════════════════════════════════
// LLM-VALIDIERUNG MIT HAIKU
// ═══════════════════════════════════════════════════════════════════════

async function validateLVWithLLM(generatedLV, enrichedAnswers, anthropic) {
  console.log('🤖 Starte LLM-basierte LV-Validierung mit Haiku...');
  
  // Bereite Antworten für LLM auf
  const answersText = enrichedAnswers.map(item => {
    const question = item.question || item.question_text || '';
    const answer = item.answer || item.answer_text || '';
    return `FRAGE: ${question}\nANTWORT: ${answer}`;
  }).join('\n\n');
  
  // Bereite LV-Positionen für LLM auf
  const positionsText = generatedLV.positions.map((pos, idx) => 
    `Position ${idx + 1}: ${pos.title}\nBeschreibung: ${pos.description}\nMenge: ${pos.quantity} ${pos.unit}\nPreis: ${pos.unitPrice}€`
  ).join('\n\n');
  
  const validationPrompt = `Du bist ein LV-Korrektur-Experte. Korrigiere NUR offensichtliche Fehler bei der Übernahme von Nutzerantworten.

NUTZERANTWORTEN:
═══════════════
${answersText}

AKTUELLES LV:
═════════════
${positionsText}

PRÜFSCHEMA - SCHRITT FÜR SCHRITT:
═════════════════════════════════

⚠️ WICHTIG: Nur EINDEUTIGE Fehler korrigieren! Im Zweifel NICHTS ändern!
Wenn das LV plausibel aussieht → KEINE Änderungen vornehmen!

1. NEIN-ANTWORTEN PRÜFEN:
   Nur wenn EXPLIZIT "nein", "keine", "behalte alte" in der Antwort steht
   → Prüfe ob trotzdem Positionen dafür im LV sind → ENTFERNEN
   
   ABER: "Gut - keine Schäden" bedeutet NICHT "keine Leibungen"!
   ABER: Fehlende Frage bedeutet NICHT automatisch NEIN!

2. MATERIAL-ABGLEICH:
   NUR wenn Material EXPLIZIT genannt und ANDERS im LV
   
   EINDEUTIG FALSCH:
   - Antwort: "Holz" → LV: "Kunststofffenster" ✗
   - Antwort: "Laminat" → LV: "Parkettboden" ✗
   
   NICHT ÄNDERN:
   - Antwort nennt kein Material → LV hat Material ✓
   - Antwort: "Standard" → LV hat spezifisches Material ✓

3. MENGEN-ABGLEICH:
   NUR bei EINDEUTIGER Diskrepanz
   - Antwort: "24 Rollläden" → LV: "36 Rollläden" = KORRIGIEREN
   - Antwort: "ca. 20-25" → LV: "24" = OK, NICHT ändern

4. PREIS-PLAUSIBILITÄT - NUR ABSURDE AUSREISSER:
   Suche Antworten mit: "nein", "keine", "nicht", "behalte alte", "übersprungen", "entfällt"
   → Prüfe ob trotzdem Positionen dafür im LV sind → ENTFERNEN
   
   Typische NEIN-Positionen:
   - Fensterbänke, Leibungen, Rollläden, Jalousien (Fenster)
   - Armaturen, Duschkabinen (Sanitär)
   - Steckdosen, Schalter (Elektro)
   - Sockelleisten, Übergangsprofile (Boden)
   - Tapeten, Anstrich (Maler)

2. MATERIAL-ABGLEICH:
   Vergleiche Material in Antwort vs. LV-Position
   
   Fenster/Türen: Holz ≠ Kunststoff ≠ Aluminium ≠ Holz-Alu
   Böden: Parkett ≠ Laminat ≠ Vinyl ≠ Fliesen
   Sanitär: Keramik ≠ Acryl ≠ Stahl-Email
   Wände: Tapete ≠ Putz ≠ Anstrich

3. MENGEN-ABGLEICH:
   Zahl in Antwort muss mit Menge im LV übereinstimmen
   - "24 Rollläden" → LV muss 24 haben, nicht 36
   - "120 m²" → LV muss 120 haben, nicht 150
   - "6 Fenster" → LV muss 6 haben, nicht 10

4. PREIS-PLAUSIBILITÄT - NUR ABSURDE AUSREISSER:
   
   OFFENSICHTLICH ZU HOCH:
   - Leibungsverputz > 100€/lfm (normal: 30-60€)
   - Fensterreinigung > 100€/Stk (normal: 15-40€)
   - Abdichtung > 100€/lfm (normal: 20-50€)
   - Aufmaß/Vermessung > 200€ pauschal (normal: 50-100€)
   - Innentür > 2000€ (normal: 300-900€)
   - Steckdose > 200€ (normal: 30-80€)
   - Anstrich > 100€/m² (normal: 8-30€)
   - Sockelleiste > 50€/lfm (normal: 10-25€)
   
   FAUSTREGEL: Wenn der Preis mehr als 3x über dem Normalwert liegt → KORRIGIEREN
   
   NICHT ÄNDERN:
   - Hauptpositionen (Fenster, Türen, Sanitärobjekte) - diese sind meist OK
   - Demontage/Entsorgung - Preise variieren stark
   - Komplettleistungen - schwer zu beurteilen

5. WAS NICHT ÄNDERN:
   ✓ Demontage/Entsorgung (immer notwendig)
   ✓ Abdichtung/Anschlussarbeiten (technisch erforderlich)
   ✓ Reinigung/Endreinigung (Standard)
   ✓ Grundierung/Vorarbeiten (fachlich korrekt)
   ✓ Untergrund vorbereiten (notwendig)

JSON-ANTWORT (NUR DIES, NICHTS ANDERES):

WENN KEINE FEHLER GEFUNDEN:
{
  "positionen_zu_entfernen": [],
  "positionen_zu_korrigieren": [],
  "preiskorrekturen": [],
  "zusammenfassung": "LV ist korrekt, keine Änderungen notwendig"
}

WENN FEHLER GEFUNDEN:
{
  "positionen_zu_entfernen": [
    {
      "position_nummer": X,
      "grund": "Kurzer EINDEUTIGER Grund"
    }
  ],
  "positionen_zu_korrigieren": [
    {
      "position_nummer": Y,
      "korrektur": {
        "material": "Neu statt Alt",
        "menge": "Richtig statt Falsch",
        "preis": "Realistisch statt Absurd"
      },
      "grund": "Kurzer EINDEUTIGER Grund"
    }
  ],
  "preiskorrekturen": [
    {
      "position_nummer": Z,
      "alter_preis": XXX,
      "neuer_preis": YY,
      "grund": "Zu hoch/niedrig für [Position]"
    }
  ],
  "zusammenfassung": "Nur die TATSÄCHLICHEN Hauptfehler"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',  // Haiku für Speed
      max_tokens: 2000,
      temperature: 0,
      messages: [{
        role: 'user',
        content: validationPrompt
      }]
    });
    
    // Parse JSON Response
    let validationResult;
    try {
      // Extrahiere JSON aus der Antwort (falls Text drumherum)
      const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        validationResult = JSON.parse(jsonMatch[0]);
      } else {
        validationResult = JSON.parse(response.content[0].text);
      }
    } catch (parseError) {
      console.error('❌ JSON Parse Fehler:', parseError.message);
      console.log('Raw Response:', response.content[0].text);
      // Fallback auf einfache Validierung
      return simpleValidation(generatedLV, enrichedAnswers);
    }
    
    // ═══════════════════════════════════════════
    // ANWENDUNG DER VALIDIERUNGSERGEBNISSE
    // ═══════════════════════════════════════════
    
    console.log('📋 LLM-Validierung abgeschlossen:');
    console.log(`- ${validationResult.positionen_zu_entfernen?.length || 0} zu entfernen`);
    console.log(`- ${validationResult.positionen_zu_korrigieren?.length || 0} zu korrigieren`);
    console.log(`- ${validationResult.preiskorrekturen?.length || 0} Preise zu korrigieren`);
    
    // 1. Positionen entfernen
    if (validationResult.positionen_zu_entfernen?.length > 0) {
      const zuEntfernen = new Set(validationResult.positionen_zu_entfernen.map(p => p.position_nummer - 1));
      generatedLV.positions = generatedLV.positions.filter((pos, idx) => {
        if (zuEntfernen.has(idx)) {
          console.log(`🗑️ Entferne: ${pos.title} - ${validationResult.positionen_zu_entfernen.find(p => p.position_nummer === idx + 1)?.grund}`);
          return false;
        }
        return true;
      });
    }
    
    // 2. Positionen korrigieren
    if (validationResult.positionen_zu_korrigieren?.length > 0) {
      validationResult.positionen_zu_korrigieren.forEach(korrektur => {
        const idx = korrektur.position_nummer - 1;
        if (generatedLV.positions[idx]) {
          const pos = generatedLV.positions[idx];
          
          if (korrektur.korrektur.material) {
            const parts = korrektur.korrektur.material.split(' statt ');
            if (parts.length === 2) {
              const [zu, von] = parts;
              pos.title = pos.title.replace(new RegExp(von, 'gi'), zu);
              pos.description = pos.description.replace(new RegExp(von, 'gi'), zu);
              console.log(`✏️ Material korrigiert: ${von} → ${zu}`);
            }
          }
          
          if (korrektur.korrektur.menge) {
            const [neu] = korrektur.korrektur.menge.split(' statt ');
            pos.quantity = parseInt(neu) || pos.quantity;
            console.log(`✏️ Menge korrigiert: → ${neu}`);
          }
          
          if (korrektur.korrektur.preis) {
            const [neu] = korrektur.korrektur.preis.split(' statt ');
            pos.unitPrice = parseFloat(neu) || pos.unitPrice;
            console.log(`✏️ Preis korrigiert: → ${neu}€`);
          }
        }
      });
    }
    
    // 3. Preiskorrekturen anwenden
    if (validationResult.preiskorrekturen?.length > 0) {
      validationResult.preiskorrekturen.forEach(korrektur => {
        const idx = korrektur.position_nummer - 1;
        if (generatedLV.positions[idx]) {
          const pos = generatedLV.positions[idx];
          console.log(`💰 Preis korrigiert: ${pos.title} - ${korrektur.alter_preis}€ → ${korrektur.neuer_preis}€ (${korrektur.grund})`);
          pos.unitPrice = korrektur.neuer_preis;
          
          // Gesamtpreis neu berechnen
          if (pos.quantity) {
            pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
          }
        }
      });
    }
    
    if (validationResult.zusammenfassung) {
      console.log('\n📊 Zusammenfassung:', validationResult.zusammenfassung);
    }
    
  } catch (error) {
    console.error('❌ LLM-Validierung fehlgeschlagen:', error.message);
    // Fallback auf einfache Validierung
    return simpleValidation(generatedLV, enrichedAnswers);
  }
  
  return generatedLV;
}

// ═══════════════════════════════════════════════════════════════════════
// EINFACHE FALLBACK-VALIDIERUNG
// ═══════════════════════════════════════════════════════════════════════

function simpleValidation(generatedLV, enrichedAnswers) {
  console.log('📋 Fallback auf einfache Validierung...');
  
  const neinAntworten = new Set();
  const material = {};
  const mengen = {};
  
  enrichedAnswers.forEach(item => {
    const answer = (item.answer || '').toLowerCase();
    const question = (item.question || '').toLowerCase();
    
    // NEIN-Antworten sammeln
    if (answer.includes('nein') || answer.includes('keine') || answer.includes('behalte alte')) {
      if (question.includes('fensterbank')) neinAntworten.add('fensterbank');
      if (question.includes('leibung') || question.includes('laibung')) {
        neinAntworten.add('leibung');
        neinAntworten.add('laibung');
      }
      if (question.includes('rollladen') || question.includes('rolladen')) {
        neinAntworten.add('rollladen');
        neinAntworten.add('rolladen');
      }
      if (question.includes('gerüst')) neinAntworten.add('gerüst');
      if (question.includes('stundenlohn')) neinAntworten.add('stundenlohn');
    }
    
    // Material extrahieren
    if (question.includes('material')) {
      if (answer.includes('holz') && !answer.includes('alu')) material.type = 'holz';
      else if (answer.includes('kunststoff') || answer.includes('pvc')) material.type = 'kunststoff';
      else if (answer.includes('aluminium') || answer.includes('alu')) material.type = 'aluminium';
    }
    
    // Mengen extrahieren
    const zahlenMatch = answer.match(/(\d+)/);
    if (zahlenMatch) {
      const zahl = parseInt(zahlenMatch[1]);
      if (question.includes('rollläden')) mengen.rolllaeden = zahl;
      if (question.includes('fenster') && question.includes('wie viele')) mengen.fenster = zahl;
    }
  });
  
  // Filtere Positionen
  let removed = 0;
  generatedLV.positions = generatedLV.positions.filter(pos => {
    const text = `${pos.title} ${pos.description}`.toLowerCase();
    
    // Prüfe gegen NEIN-Antworten
    for (const verboten of neinAntworten) {
      if (text.includes(verboten)) {
        console.log(`🗑️ Entfernt: ${pos.title} (${verboten} war NEIN)`);
        removed++;
        return false;
      }
    }
    
    // Korrigiere Mengen
    if (mengen.rolllaeden && text.includes('rollladen')) {
      if (pos.quantity > mengen.rolllaeden) {
        console.log(`✏️ Rollläden-Menge korrigiert: ${pos.quantity} → ${mengen.rolllaeden}`);
        pos.quantity = mengen.rolllaeden;
      }
    }
    
    return true;
  });
  
  console.log(`📊 Einfache Validierung: ${removed} Positionen entfernt`);
  
  return generatedLV;
}

// ═══════════════════════════════════════════════════════════════════════
// HAUPT-VALIDIERUNGSFUNKTION
// ═══════════════════════════════════════════════════════════════════════

async function validateAndCleanLVComplete(generatedLV, enrichedAnswers, uploadContext, anthropic) {
  // Erst LLM-Validierung versuchen
  let validatedLV = generatedLV;
  
  if (anthropic) {
    validatedLV = await validateLVWithLLM(generatedLV, enrichedAnswers, anthropic);
  } else {
    console.log('⚠️ Kein Anthropic Client verfügbar, nutze einfache Validierung');
    validatedLV = simpleValidation(generatedLV, enrichedAnswers);
  }
  
  // Dann Upload-Enforcement (falls vorhanden)
  try {
    const { enforceUploadData } = require('./upload-data-enforcement');
    if (typeof enforceUploadData === 'function') {
      validatedLV = enforceUploadData(validatedLV, uploadContext, enrichedAnswers);
    }
  } catch (e) {
    // Upload-Enforcement nicht verfügbar
  }
  
  // Gesamtpreise neu berechnen
  validatedLV.positions.forEach(pos => {
    if (pos.quantity && pos.unitPrice) {
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
    }
  });
  
  return validatedLV;
}

// Sync-Version für Kompatibilität (ruft intern async auf)
function validateAndCleanLV(generatedLV, enrichedAnswers, uploadContext) {
  return simpleValidation(generatedLV, enrichedAnswers);
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
  CRITICAL_PROMPT_ADDITIONS,
  validateAndCleanLVComplete,
  validateAndCleanLV,
  validateLVWithLLM,
  simpleValidation
};
