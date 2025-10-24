// ═══════════════════════════════════════════════════════════════════════
// UNIVERSELLE LV-GENERATOR VALIDIERUNG FÜR ALLE 21 GEWERKE
// Funktioniert ohne Gewerk-spezifische Hardcode-Regeln
// ═══════════════════════════════════════════════════════════════════════

const CRITICAL_PROMPT_ADDITIONS = `

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  🚨 UNIVERSELLE VALIDIERUNGSREGELN FÜR ALLE GEWERKE 🚨               ║
// ╚═══════════════════════════════════════════════════════════════════════╝

DIESE REGELN GELTEN FÜR ALLE 21 GEWERKE GLEICHERMASSEN:

1. UNIVERSELLE NEIN-REGEL:
   Wenn eine Antwort "nein", "keine", "nicht", "behalte alte", "übersprungen" enthält:
   → KEINE Position dafür erstellen, egal welches Gewerk!
   
2. UNIVERSELLE JA-REGEL:
   Wenn eine Antwort "ja" oder konkrete Angaben (Zahlen, Mengen) enthält:
   → Position MUSS erstellt werden
   
3. MATERIAL-REGEL:
   Das in der Antwort genannte Material MUSS 1:1 übernommen werden
   Niemals eigenmächtig ändern!
   
4. MENGEN-REGEL:
   Zahlen in Antworten sind EXAKT zu übernehmen
   
5. KEINE ERFINDUNGEN:
   NUR Positionen für explizit bestätigte Leistungen
`;

// ═══════════════════════════════════════════════════════════════════════
// UNIVERSELLE KEYWORD-EXTRAKTION
// ═══════════════════════════════════════════════════════════════════════

function extractKeywordsFromQuestion(question) {
  // Extrahiere Haupt-Keywords aus der Frage für universelle Anwendung
  const keywords = [];
  const q = question.toLowerCase();
  
  // Substantive die oft in Fragen vorkommen (gewerk-unabhängig)
  const patterns = [
    // Allgemeine Bauteile
    /(\w*fenster\w*)/g, /(\w*tür\w*)/g, /(\w*wand\w*)/g, /(\w*decke\w*)/g, /(\w*boden\w*)/g,
    /(\w*dach\w*)/g, /(\w*fassade\w*)/g, /(\w*treppe\w*)/g, /(\w*geländer\w*)/g,
    
    // Installationen
    /(\w*heizung\w*)/g, /(\w*heizk\w*)/g, /(\w*rohr\w*)/g, /(\w*leitung\w*)/g,
    /(\w*steckdose\w*)/g, /(\w*schalter\w*)/g, /(\w*lampe\w*)/g, /(\w*armatur\w*)/g,
    
    // Materialien/Beläge
    /(\w*fliese\w*)/g, /(\w*parkett\w*)/g, /(\w*laminat\w*)/g, /(\w*teppich\w*)/g,
    /(\w*putz\w*)/g, /(\w*farbe\w*)/g, /(\w*tapete\w*)/g, /(\w*estrich\w*)/g,
    
    // Zusatzausstattung
    /(\w*rolladen\w*)/g, /(\w*rollladen\w*)/g, /(\w*jalousie\w*)/g, /(\w*markise\w*)/g,
    /(\w*bank\w*)/g, /(\w*leiste\w*)/g, /(\w*profil\w*)/g, /(\w*abdichtung\w*)/g,
    
    // Arbeiten
    /(\w*montage\w*)/g, /(\w*demontage\w*)/g, /(\w*austausch\w*)/g, /(\w*erneuer\w*)/g,
    /(\w*sanier\w*)/g, /(\w*renovier\w*)/g, /(\w*dämmung\w*)/g, /(\w*isolier\w*)/g,
    
    // Sonstiges
    /(\w*gerüst\w*)/g, /(\w*reinigung\w*)/g, /(\w*entsorgung\w*)/g, /(\w*container\w*)/g,
    /(\w*leibung\w*)/g, /(\w*laibung\w*)/g, /(\w*sturz\w*)/g, /(\w*sockel\w*)/g
  ];
  
  patterns.forEach(pattern => {
    const matches = q.match(pattern);
    if (matches) {
      matches.forEach(match => {
        if (match.length > 2) keywords.push(match);
      });
    }
  });
  
  return [...new Set(keywords)]; // Duplikate entfernen
}

// ═══════════════════════════════════════════════════════════════════════
// UNIVERSELLE VALIDIERUNG
// ═══════════════════════════════════════════════════════════════════════

function validateAndCleanLV(generatedLV, enrichedAnswers, uploadContext) {
  console.log('🔍 Starting UNIVERSAL LV validation...');
  
  if (!generatedLV || !generatedLV.positions) {
    console.error('❌ Invalid LV structure');
    return generatedLV;
  }
  
  // ═══════════════════════════════════════════
  // SCHRITT 1: Antworten analysieren (universell)
  // ═══════════════════════════════════════════
  
  const forbiddenKeywords = new Set();
  const requiredItems = [];
  const specifications = {};
  
  // Konvertiere Antworten in einheitliches Format
  const answerList = [];
  
  if (Array.isArray(enrichedAnswers)) {
    enrichedAnswers.forEach(item => {
      answerList.push({
        question: (item.question || item.question_text || '').toLowerCase(),
        answer: (item.answer || item.answer_text || '').toLowerCase()
      });
    });
  } else if (typeof enrichedAnswers === 'object') {
    Object.entries(enrichedAnswers).forEach(([key, value]) => {
      answerList.push({
        question: key.toLowerCase(),
        answer: String(value).toLowerCase()
      });
    });
  }
  
  console.log(`📊 Processing ${answerList.length} answers`);
  
  // ═══════════════════════════════════════════
  // SCHRITT 2: NEIN-Antworten → Verbotene Keywords
  // ═══════════════════════════════════════════
  
  answerList.forEach(({question, answer}) => {
    const isNo = answer.includes('nein') || 
                 answer.includes('keine') || 
                 answer.includes('nicht') ||
                 answer.includes('behalte') ||
                 answer.includes('behalten') ||
                 answer.includes('übersprungen') ||
                 answer === 'false' ||
                 answer === 'no';
    
    const isYes = answer.includes('ja') ||
                  answer === 'true' ||
                  answer === 'yes' ||
                  /\d+/.test(answer); // Enthält Zahlen
    
    if (isNo) {
      // Extrahiere Keywords aus der FRAGE und blockiere sie
      const keywords = extractKeywordsFromQuestion(question);
      keywords.forEach(kw => {
        forbiddenKeywords.add(kw);
        // Füge auch Varianten hinzu
        if (kw.includes('fenster')) {
          forbiddenKeywords.add('fensterbank');
          forbiddenKeywords.add('fensterbänke');
        }
        if (kw.includes('roll')) {
          forbiddenKeywords.add('rollladen');
          forbiddenKeywords.add('rolladen');
          forbiddenKeywords.add('rollläden');
        }
        if (kw.includes('leibung') || kw.includes('laibung')) {
          forbiddenKeywords.add('leibung');
          forbiddenKeywords.add('laibung');
          forbiddenKeywords.add('leibungsverputz');
          forbiddenKeywords.add('laibungsverputz');
        }
      });
      console.log(`❌ NEIN für: ${keywords.join(', ')}`);
      
    } else if (isYes) {
      // Bei JA-Antworten: Merke was gefordert ist
      const keywords = extractKeywordsFromQuestion(question);
      if (keywords.length > 0) {
        requiredItems.push({
          keywords: keywords,
          answer: answer
        });
        console.log(`✅ JA für: ${keywords.join(', ')}`);
      }
    }
    
    // Material/Spezifikationen extrahieren (universell)
    if (question.includes('material') || question.includes('ausführung') || 
        question.includes('typ') || question.includes('farbe')) {
      // Speichere die Antwort als Spezifikation
      const key = question.split(' ')[0]; // Erstes Wort als Key
      specifications[key] = answer;
    }
    
    // Mengen extrahieren (universell)
    const mengenMatch = answer.match(/(\d+)\s*(\w+)?/);
    if (mengenMatch && !isNo) {
      const anzahl = parseInt(mengenMatch[1]);
      const einheit = mengenMatch[2] || '';
      
      // Finde zugehöriges Keyword aus der Frage
      const keywords = extractKeywordsFromQuestion(question);
      if (keywords.length > 0) {
        specifications[keywords[0] + '_menge'] = anzahl;
        console.log(`📋 Menge: ${keywords[0]} = ${anzahl}`);
      }
    }
  });
  
  // Spezialfall: "Zustand gut" bedeutet keine Arbeiten
  answerList.forEach(({question, answer}) => {
    if (question.includes('zustand') && (answer.includes('gut') || answer.includes('ok'))) {
      const keywords = extractKeywordsFromQuestion(question);
      keywords.forEach(kw => {
        forbiddenKeywords.add(kw);
        forbiddenKeywords.add(kw + 'arbeiten');
        forbiddenKeywords.add(kw + 'erneuerung');
      });
      console.log(`❌ Zustand GUT: keine Arbeiten für ${keywords.join(', ')}`);
    }
  });
  
  // ═══════════════════════════════════════════
  // SCHRITT 3: LV-Positionen validieren
  // ═══════════════════════════════════════════
  
  let removedCount = 0;
  let correctedCount = 0;
  const originalCount = generatedLV.positions.length;
  
  generatedLV.positions = generatedLV.positions.filter(pos => {
    const posText = `${pos.title || ''} ${pos.description || ''}`.toLowerCase();
    
    // Prüfe gegen verbotene Keywords
    for (const forbidden of forbiddenKeywords) {
      if (forbidden.length > 2 && posText.includes(forbidden)) {
        console.log(`🗑️ ENTFERNT: "${pos.title}" (verboten: ${forbidden})`);
        removedCount++;
        return false;
      }
    }
    
    // Mengen-Korrektur basierend auf specifications
    Object.entries(specifications).forEach(([key, value]) => {
      if (key.endsWith('_menge') && typeof value === 'number') {
        const itemType = key.replace('_menge', '');
        if (posText.includes(itemType) && pos.quantity > value) {
          console.log(`✏️ Menge korrigiert: ${pos.quantity} → ${value}`);
          pos.quantity = value;
          correctedCount++;
        }
      }
    });
    
    return true;
  });
  
  // ═══════════════════════════════════════════
  // SCHRITT 4: Absurde Preise korrigieren (universell)
  // ═══════════════════════════════════════════
  
  generatedLV.positions.forEach(pos => {
    const posText = `${pos.title || ''} ${pos.description || ''}`.toLowerCase();
    
    // Universelle Preis-Plausibilität
    const priceChecks = [
      { keywords: ['leibung', 'laibung'], unit: 'm', maxPrice: 100, newPrice: 45 },
      { keywords: ['reinigung', 'endreinigung'], unit: null, maxPrice: 100, newPrice: 35 },
      { keywords: ['aufmaß', 'vermessung'], unit: null, maxPrice: 200, newPrice: 75 },
      { keywords: ['abdichtung', 'verfugung'], unit: 'm', maxPrice: 80, newPrice: 35 },
      { keywords: ['grundierung'], unit: 'm²', maxPrice: 30, newPrice: 12 },
      { keywords: ['sockelleiste'], unit: 'm', maxPrice: 50, newPrice: 20 },
      { keywords: ['übergang', 'profil'], unit: 'm', maxPrice: 60, newPrice: 25 }
    ];
    
    priceChecks.forEach(check => {
      if (check.keywords.some(kw => posText.includes(kw))) {
        if (!check.unit || pos.unit === check.unit || pos.unit === 'lfm') {
          if (pos.unitPrice > check.maxPrice) {
            console.log(`💰 PREIS: ${pos.title} ${pos.unitPrice}€ → ${check.newPrice}€`);
            pos.unitPrice = check.newPrice;
            correctedCount++;
          }
        }
      }
    });
    
    // Gesamtpreis neu berechnen
    if (pos.quantity && pos.unitPrice) {
      pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
    }
  });
  
  // ═══════════════════════════════════════════
  // ZUSAMMENFASSUNG
  // ═══════════════════════════════════════════
  
  console.log('═══════════════════════════════════════════');
  console.log('📊 UNIVERSELLE VALIDIERUNG ABGESCHLOSSEN:');
  console.log(`📄 Gewerk: ${generatedLV.tradeCode || 'Unbekannt'}`);
  console.log(`✅ Positionen behalten: ${generatedLV.positions.length}`);
  console.log(`🗑️ Positionen entfernt: ${removedCount}`);
  console.log(`✏️ Positionen korrigiert: ${correctedCount}`);
  
  if (forbiddenKeywords.size > 0) {
    console.log('\nBlockierte Keywords:', Array.from(forbiddenKeywords).slice(0, 10).join(', '));
  }
  
  console.log('═══════════════════════════════════════════');
  
  return generatedLV;
}

// ═══════════════════════════════════════════════════════════════════════
// ERWEITERTE VALIDIERUNG MIT UPLOAD-ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════════

function validateAndCleanLVComplete(generatedLV, enrichedAnswers, uploadContext) {
  // Basis-Validierung
  let validatedLV = validateAndCleanLV(generatedLV, enrichedAnswers, uploadContext);
  
  // Upload-Enforcement wenn verfügbar
  try {
    const { enforceUploadData } = require('./upload-data-enforcement');
    if (typeof enforceUploadData === 'function') {
      validatedLV = enforceUploadData(validatedLV, uploadContext, enrichedAnswers);
    }
  } catch (e) {
    // Upload-Enforcement nicht verfügbar
  }
  
  // Fenster/Türen-Preiskorrektur wenn verfügbar
  try {
    const { applyWindowPriceCorrection } = require('./fenster-preis-korrektur');
    if (typeof applyWindowPriceCorrection === 'function') {
      if (validatedLV.tradeCode === 'FEN' || validatedLV.tradeCode === 'TIS') {
        validatedLV = applyWindowPriceCorrection(validatedLV, validatedLV.tradeCode);
      }
    }
  } catch (e) {
    // Preiskorrektur nicht verfügbar
  }
  
  return validatedLV;
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
  CRITICAL_PROMPT_ADDITIONS,
  validateAndCleanLV,
  validateAndCleanLVComplete
};
