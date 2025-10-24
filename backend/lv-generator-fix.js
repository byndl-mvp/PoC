// ═══════════════════════════════════════════════════════════════════════
// LLM-BASIERTE LV-VALIDIERUNG
// Nutzt KI zur intelligenten Validierung statt komplexer Hardcode-Regeln
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
// LLM-VALIDIERUNG
// ═══════════════════════════════════════════════════════════════════════

async function validateLVWithLLM(generatedLV, enrichedAnswers, anthropic) {
  console.log('🤖 Starte LLM-basierte LV-Validierung...');
  
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
  
  const validationPrompt = `Du bist ein LV-Korrektur-Experte. Du sollst NUR OFFENSICHTLICHE FEHLER bei der Übernahme von Nutzerantworten korrigieren.

NUTZERANTWORTEN:
═══════════════
${answersText}

AKTUELLES LV:
═════════════
${positionsText}

WICHTIG - NUR DIESE FEHLER KORRIGIEREN:
════════════════════════════════════════
1. EXPLIZITE NEIN-Antworten wurden ignoriert (z.B. "Fensterbänke? NEIN" aber trotzdem Fensterbänke im LV)
2. FALSCHES MATERIAL (z.B. Nutzer sagt "Holz" aber im LV steht "Kunststoff")
3. FALSCHE MENGEN (z.B. Nutzer sagt "24 Rollläden" aber im LV stehen "36")
4. ABSURDE PREISE (z.B. 800€/lfd.m für Leibungsverputz, 8000€ für eine Innentür)
5. Positionen für Dinge die explizit mit "behalte alte" oder "nicht erneuern" beantwortet wurden

NICHT ÄNDERN:
═════════════
- Sinnvolle Ergänzungen die das LV vollständig machen
- Standard-Positionen die üblich sind (z.B. Demontage, Entsorgung)
- Nebenarbeiten die technisch notwendig sind
- Positionen ohne direkte Frage (außer sie widersprechen einer NEIN-Antwort)

JSON-FORMAT für deine Antwort:
{
  "positionen_zu_entfernen": [
    {
      "position_nummer": 1,
      "grund": "Konkrete NEIN-Antwort oder absurder Preis"
    }
  ],
  "positionen_zu_korrigieren": [
    {
      "position_nummer": 2,
      "korrektur": {
        "material": "Holz statt Kunststoff",
        "menge": "24 statt 36",
        "preis": "80 statt 800"
      },
      "grund": "Widerspricht direkter Nutzerantwort"
    }
  ],
  "preiskorrekturen": [
    {
      "position_nummer": 3,
      "alter_preis": 800,
      "neuer_preis": 45,
      "grund": "Absurd hoher Preis für Leibungsverputz"
    }
  ],
  "zusammenfassung": "Nur Hauptfehler nennen"
}

BEISPIEL was zu korrigieren ist:
- Nutzer: "Fensterbänke außen? NEIN" → Fensterbank-Position ENTFERNEN
- Nutzer: "Material? Holz" → Kunststoff-Positionen zu Holz ÄNDERN
- Preis: 800€/m für Verputz → auf ~45€/m KORRIGIEREN

BEISPIEL was NICHT zu ändern ist:
- Demontage alte Fenster (auch wenn nicht explizit gefragt)
- Abdichtungsarbeiten (technisch notwendig)
- Reinigung (übliche Schlussleistung)

Antworte NUR mit dem JSON-Objekt.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      temperature: 0,
      system: 'Du bist ein präziser LV-Validator. Antworte nur mit validem JSON.',
      messages: [{
        role: 'user',
        content: validationPrompt
      }]
    });
    
    const validationResult = JSON.parse(response.content[0].text);
    
    // ═══════════════════════════════════════════
    // ANWENDUNG DER VALIDIERUNGSERGEBNISSE
    // ═══════════════════════════════════════════
    
    console.log('📋 LLM-Validierung abgeschlossen:');
    console.log(`- ${validationResult.positionen_zu_entfernen?.length || 0} zu entfernen`);
    console.log(`- ${validationResult.positionen_zu_korrigieren?.length || 0} zu korrigieren`);
    console.log(`- ${validationResult.fehlende_positionen?.length || 0} hinzuzufügen`);
    
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
            const [von, zu] = korrektur.korrektur.material.split(' statt ');
            pos.title = pos.title.replace(new RegExp(von, 'gi'), zu);
            pos.description = pos.description.replace(new RegExp(von, 'gi'), zu);
            console.log(`✏️ Material korrigiert: ${von} → ${zu}`);
          }
          
          if (korrektur.korrektur.menge) {
            const [neu] = korrektur.korrektur.menge.split(' statt ');
            pos.quantity = parseInt(neu);
            console.log(`✏️ Menge korrigiert: → ${neu}`);
          }
          
          if (korrektur.korrektur.preis) {
            const [neu] = korrektur.korrektur.preis.split(' statt ');
            pos.unitPrice = parseFloat(neu);
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
    
    console.log('\n📊 Zusammenfassung:', validationResult.zusammenfassung);
    
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
  
  enrichedAnswers.forEach(item => {
    const answer = (item.answer || '').toLowerCase();
    const question = (item.question || '').toLowerCase();
    
    if (answer.includes('nein') || answer.includes('keine')) {
      if (question.includes('fensterbank')) neinAntworten.add('fensterbank');
      if (question.includes('leibung')) neinAntworten.add('leibung');
      if (question.includes('rollladen')) neinAntworten.add('rollladen');
    }
    
    if (question.includes('material')) {
      if (answer.includes('holz')) material.type = 'holz';
      else if (answer.includes('kunststoff')) material.type = 'kunststoff';
      else if (answer.includes('alu')) material.type = 'aluminium';
    }
  });
  
  // Filtere Positionen
  generatedLV.positions = generatedLV.positions.filter(pos => {
    const text = `${pos.title} ${pos.description}`.toLowerCase();
    
    for (const verboten of neinAntworten) {
      if (text.includes(verboten)) {
        console.log(`🗑️ Entfernt: ${pos.title}`);
        return false;
      }
    }
    return true;
  });
  
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
  
  return validatedLV;
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
  CRITICAL_PROMPT_ADDITIONS,
  validateAndCleanLVComplete,
  validateLVWithLLM,
  simpleValidation
};
