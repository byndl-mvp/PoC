// ═══════════════════════════════════════════════════════════════════════
// FENSTER & TÜREN PREISKORREKTUR - REALISTISCHE MARKTPREISE 2024/2025
// Unterstützt Gewerke: FEN (Fenster) und TIS (Türen/Tischler)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Korrigiert Fenster- und Türenpreise basierend auf Material, Größe und Ausstattung
 * Marktpreise Stand 2024/2025 inkl. Montage
 */
function correctWindowAndDoorPrices(positions, tradeCode) {
  if (tradeCode !== 'FEN' && tradeCode !== 'TIS') return { positions, warnings: [] };
  
  const warnings = [];
  let correctedCount = 0;
  
  positions.forEach(pos => {
    const titleLower = (pos.title || '').toLowerCase();
    const descLower = (pos.description || '').toLowerCase();
    const fullText = titleLower + ' ' + descLower;
    
    if (tradeCode === 'FEN') {
      correctWindowPosition(pos, fullText, warnings);
    } else if (tradeCode === 'TIS') {
      correctDoorPosition(pos, fullText, warnings);
    }
  });
  
  return { positions, warnings };
}

// ═══════════════════════════════════════════════════════════════════════
// FENSTER-PREISKORREKTUR (GEWERK FEN)
// ═══════════════════════════════════════════════════════════════════════

function correctWindowPosition(pos, fullText, warnings) {
  const oldPrice = pos.unitPrice || 0;
  
  // Skip non-window items
  if (!fullText.includes('fenster') && 
      !fullText.includes('rolladen') && 
      !fullText.includes('rollladen') &&
      !fullText.includes('fensterbank') &&
      !fullText.includes('jalousie') &&
      !fullText.includes('verglasung')) {
    return;
  }
  
  // ═══════════════════════════════════════════
  // 1. DEMONTAGE & ENTSORGUNG FENSTER
  // ═══════════════════════════════════════════
  if (fullText.includes('demontage') || fullText.includes('ausbau')) {
    if (fullText.includes('entsorgung')) {
      // Demontage + Entsorgung
      pos.unitPrice = 120;
      if (Math.abs(oldPrice - 120) > 20) {
        warnings.push(`✏️ Fenster Demontage+Entsorgung: €${oldPrice} → €120`);
      }
    } else {
      // Nur Demontage
      pos.unitPrice = 80;
      if (Math.abs(oldPrice - 80) > 20) {
        warnings.push(`✏️ Fenster Demontage: €${oldPrice} → €80`);
      }
    }
    return;
  }
  
  // ═══════════════════════════════════════════
  // 2. NEUE FENSTER - HAUPTPOSITIONEN
  // ═══════════════════════════════════════════
  if ((fullText.includes('lieferung') || fullText.includes('montage') || 
       fullText.includes('einbau') || fullText.includes('stk')) &&
      fullText.includes('fenster')) {
    
    const sizeMatch = fullText.match(/(\d+)\s*[x×]\s*(\d+)/);
    
    if (sizeMatch) {
      const width = parseInt(sizeMatch[1]);
      const height = parseInt(sizeMatch[2]);
      const widthCm = width > 300 ? width / 10 : width;
      const heightCm = height > 300 ? height / 10 : height;
      const area = (widthCm * heightCm) / 10000;
      
      let basePrice = 0;
      let areaPrice = 0;
      let materialName = '';
      
      // ═══════════════════════════════════════════
      // MATERIAL-BASIERTE GRUNDPREISE
      // ═══════════════════════════════════════════
      if (fullText.includes('holz-alu') || fullText.includes('holz-aluminium')) {
        basePrice = 600;
        areaPrice = 700;
        materialName = 'Holz-Alu';
      } else if (fullText.includes('aluminium') || fullText.includes('alu')) {
        basePrice = 500;
        areaPrice = 600;
        materialName = 'Aluminium';
      } else if (fullText.includes('holz')) {
        // Differenzierung nach Holzart
        if (fullText.includes('eiche') || fullText.includes('lärche') || fullText.includes('meranti')) {
          basePrice = 500;
          areaPrice = 600;
          materialName = 'Hartholz';
        } else {
          basePrice = 450;
          areaPrice = 550;
          materialName = 'Holz';
        }
      } else if (fullText.includes('kunststoff') || fullText.includes('pvc')) {
        // Differenzierung nach Kammern
        if (fullText.includes('7-kammer') || fullText.includes('8-kammer')) {
          basePrice = 380;
          areaPrice = 450;
          materialName = 'Kunststoff Premium';
        } else if (fullText.includes('5-kammer') || fullText.includes('6-kammer')) {
          basePrice = 350;
          areaPrice = 400;
          materialName = 'Kunststoff Standard';
        } else {
          basePrice = 350;
          areaPrice = 400;
          materialName = 'Kunststoff';
        }
      } else {
        basePrice = 400;
        areaPrice = 450;
        materialName = 'Standard';
      }
      
      // ═══════════════════════════════════════════
      // DETAILLIERTE EIGENSCHAFTS-FAKTOREN
      // ═══════════════════════════════════════════
      let priceFactor = 1.0;
      const properties = [];
      
      // 1. VERGLASUNG
      if (fullText.includes('4-fach') || fullText.includes('vierfach')) {
        priceFactor *= 1.35;
        properties.push('4-fach');
      } else if (fullText.includes('3-fach') || fullText.includes('dreifach')) {
        // Differenzierung nach Ug-Wert
        if (fullText.includes('ug 0.5') || fullText.includes('ug 0,5')) {
          priceFactor *= 1.25;
          properties.push('3-fach Ug 0.5');
        } else if (fullText.includes('ug 0.6') || fullText.includes('ug 0,6')) {
          priceFactor *= 1.18;
          properties.push('3-fach Ug 0.6');
        } else {
          priceFactor *= 1.15;
          properties.push('3-fach');
        }
      } else if (fullText.includes('2-fach') || fullText.includes('zweifach')) {
        priceFactor *= 1.0; // Basis
        properties.push('2-fach');
      } else {
        // Standard ist 2-fach
        priceFactor *= 1.0;
      }
      
      // 2. SICHERHEIT (Einbruchschutz)
      if (fullText.includes('rc3') || fullText.includes('wk3')) {
        priceFactor *= 1.45;
        properties.push('RC3');
      } else if (fullText.includes('rc2n')) {
        priceFactor *= 1.25;
        properties.push('RC2N');
      } else if (fullText.includes('rc2') || fullText.includes('wk2')) {
        priceFactor *= 1.35;
        properties.push('RC2');
      } else if (fullText.includes('rc1')) {
        priceFactor *= 1.15;
        properties.push('RC1');
      }
      
      // VSG (Verbundsicherheitsglas)
      if (fullText.includes('vsg') && !properties.some(p => p.includes('RC'))) {
        if (fullText.includes('p4a')) {
          priceFactor *= 1.20;
          properties.push('VSG P4A');
        } else if (fullText.includes('p2a')) {
          priceFactor *= 1.15;
          properties.push('VSG P2A');
        } else {
          priceFactor *= 1.12;
          properties.push('VSG');
        }
      }
      
      // 3. SCHALLSCHUTZ
      if (fullText.includes('schallschutzklasse')) {
        if (fullText.includes('klasse 5') || fullText.includes('sk5') || fullText.includes('rw 45')) {
          priceFactor *= 1.30;
          properties.push('Schallschutz Klasse 5');
        } else if (fullText.includes('klasse 4') || fullText.includes('sk4') || fullText.includes('rw 42')) {
          priceFactor *= 1.22;
          properties.push('Schallschutz Klasse 4');
        } else if (fullText.includes('klasse 3') || fullText.includes('sk3') || fullText.includes('rw 38')) {
          priceFactor *= 1.15;
          properties.push('Schallschutz Klasse 3');
        } else if (fullText.includes('klasse 2') || fullText.includes('sk2') || fullText.includes('rw 32')) {
          priceFactor *= 1.08;
          properties.push('Schallschutz Klasse 2');
        }
      } else if (fullText.includes('schallschutz')) {
        priceFactor *= 1.10;
        properties.push('Schallschutz');
      }
      
      // 4. WÄRMESCHUTZ (U-Wert)
      if (fullText.includes('passivhaus')) {
        priceFactor *= 1.35;
        properties.push('Passivhaus');
      } else if (fullText.includes('uw 0.8') || fullText.includes('uw 0,8')) {
        priceFactor *= 1.25;
        properties.push('Uw 0.8');
      } else if (fullText.includes('uw 0.9') || fullText.includes('uw 0,9')) {
        priceFactor *= 1.18;
        properties.push('Uw 0.9');
      } else if (fullText.includes('uw 1.0') || fullText.includes('uw 1,0')) {
        priceFactor *= 1.10;
        properties.push('Uw 1.0');
      }
      
      // 5. SPEZIALGLAS
      if (fullText.includes('sonnenschutz') || fullText.includes('sun')) {
        priceFactor *= 1.12;
        properties.push('Sonnenschutz');
      }
      if (fullText.includes('ornament') || fullText.includes('struktur')) {
        priceFactor *= 1.15;
        properties.push('Ornamentglas');
      }
      if (fullText.includes('milchglas') || fullText.includes('satiniert')) {
        priceFactor *= 1.10;
        properties.push('Satiniert');
      }
      if (fullText.includes('selbstreinigend') || fullText.includes('lotuseffekt')) {
        priceFactor *= 1.20;
        properties.push('Selbstreinigend');
      }
      
      // 6. KONSTRUKTIONSMERKMALE
      if (fullText.includes('bodentief') || heightCm > 200) {
        priceFactor *= 1.15;
        properties.push('Bodentief');
      }
      if (fullText.includes('festverglasung') || fullText.includes('festverglast')) {
        priceFactor *= 0.85; // Günstiger da keine Beschläge
        properties.push('Festverglasung');
      }
      if (fullText.includes('oberlicht')) {
        priceFactor *= 0.9;
        properties.push('Oberlicht');
      }
      
      // 7. ÖFFNUNGSARTEN
      if (fullText.includes('schiebe')) {
        if (fullText.includes('hebe-schiebe') || fullText.includes('hebeschiebe')) {
          priceFactor *= 1.60;
          properties.push('Hebe-Schiebe');
        } else if (fullText.includes('parallel-schiebe')) {
          priceFactor *= 1.40;
          properties.push('Parallel-Schiebe');
        } else {
          priceFactor *= 1.30;
          properties.push('Schiebe');
        }
      } else if (fullText.includes('schwing')) {
        priceFactor *= 1.20;
        properties.push('Schwingflügel');
      } else if (fullText.includes('klapp')) {
        priceFactor *= 1.25;
        properties.push('Klappflügel');
      } else if (fullText.includes('dreh-kipp') || fullText.includes('drehkipp') || fullText.includes('dk')) {
        priceFactor *= 1.05;
        properties.push('Dreh-Kipp');
      }
      
      // 8. SONDERFORMEN
      if (fullText.includes('rundbogen') || fullText.includes('segmentbogen')) {
        priceFactor *= 1.35;
        properties.push('Rundbogen');
      } else if (fullText.includes('dreieck') || fullText.includes('giebelfen')) {
        priceFactor *= 1.30;
        properties.push('Dreieck');
      } else if (fullText.includes('schräg') || fullText.includes('trapez')) {
        priceFactor *= 1.25;
        properties.push('Schräg');
      } else if (fullText.includes('rund') || fullText.includes('kreis')) {
        priceFactor *= 1.40;
        properties.push('Rund');
      }
      
      // 9. SPROSSEN
      if (fullText.includes('sprosse')) {
        if (fullText.includes('glasteilend') || fullText.includes('echt')) {
          priceFactor *= 1.25;
          properties.push('Echte Sprossen');
        } else if (fullText.includes('helima') || fullText.includes('zwischenraum')) {
          priceFactor *= 1.12;
          properties.push('Helima-Sprossen');
        } else if (fullText.includes('aufgesetzt') || fullText.includes('aufgeklebt')) {
          priceFactor *= 1.08;
          properties.push('Aufgesetzte Sprossen');
        } else {
          priceFactor *= 1.10;
          properties.push('Sprossen');
        }
      }
      
      // 10. BESCHICHTUNGEN & FARBEN
      if (fullText.includes('ral') || fullText.includes('sonderfarbe')) {
        if (fullText.includes('zweifarbig') || fullText.includes('bicolor')) {
          priceFactor *= 1.15;
          properties.push('Zweifarbig');
        } else {
          priceFactor *= 1.08;
          properties.push('RAL-Farbe');
        }
      }
      if (fullText.includes('foliert') || fullText.includes('dekorfolie')) {
        priceFactor *= 1.10;
        properties.push('Foliert');
      }
      
      // ═══════════════════════════════════════════
      // FINALE PREISBERECHNUNG
      // ═══════════════════════════════════════════
      
      // Grundformel: (Basispreis + (Fläche × Flächenpreis)) × Faktoren
      let calculatedPrice = (basePrice + (area * areaPrice)) * priceFactor;
      
      // Größenbasierte Anpassungen
      if (area < 0.5) {
        // Kleine Fenster haben Mindestpreis
        calculatedPrice = Math.max(calculatedPrice, 380 * priceFactor);
      } else if (area > 3.0) {
        // Sehr große Fenster: Transport/Montage-Aufschlag
        calculatedPrice *= 1.08;
      } else if (area > 4.0) {
        // Übergroße Fenster: Spezialtransport
        calculatedPrice *= 1.15;
      }
      
      // Mengenrabatt (wenn quantity > 10)
      if (pos.quantity && pos.quantity > 10) {
        calculatedPrice *= 0.95; // 5% Mengenrabatt
      } else if (pos.quantity && pos.quantity > 20) {
        calculatedPrice *= 0.92; // 8% Mengenrabatt
      }
      
      // Runde auf 10€
      calculatedPrice = Math.round(calculatedPrice / 10) * 10;
      
      // Setze neuen Preis wenn Abweichung signifikant
      if (Math.abs(oldPrice - calculatedPrice) > oldPrice * 0.15 || oldPrice === 0) {
        pos.unitPrice = calculatedPrice;
        
        const propsInfo = properties.length > 0 ? ` [${properties.join(', ')}]` : '';
        warnings.push(
          `✏️ ${materialName}-Fenster ${widthCm}x${heightCm}cm (${area.toFixed(2)}m²)${propsInfo}: €${oldPrice} → €${calculatedPrice}`
        );
      }
    } else {
      // ═══════════════════════════════════════════
      // FENSTER OHNE MAßE - STANDARDPREISE
      // ═══════════════════════════════════════════
      
      let standardPrice = 800;
      
      // Material
      if (fullText.includes('holz-alu')) {
        standardPrice = 1200;
      } else if (fullText.includes('alu')) {
        standardPrice = 1000;
      } else if (fullText.includes('holz')) {
        standardPrice = 900;
      } else if (fullText.includes('kunststoff')) {
        standardPrice = 700;
      }
      
      // Eigenschaften auch bei Standardpreisen berücksichtigen
      if (fullText.includes('3-fach')) standardPrice *= 1.15;
      if (fullText.includes('rc2')) standardPrice *= 1.25;
      if (fullText.includes('schallschutz')) standardPrice *= 1.10;
      
      standardPrice = Math.round(standardPrice / 10) * 10;
      
      if (Math.abs(oldPrice - standardPrice) > 100) {
        pos.unitPrice = standardPrice;
        warnings.push(`✏️ Standard-Fenster (ohne Maße): €${oldPrice} → €${standardPrice}`);
      }
    }
    return;
  }
  
  // ═══════════════════════════════════════════
  // 3. ROLLLÄDEN
  // ═══════════════════════════════════════════
  if (fullText.includes('rollladen') || fullText.includes('rolladen')) {
    let rollladenPrice = 350; // Manuell
    
    if (fullText.includes('elektrisch') || fullText.includes('motor')) {
      rollladenPrice = 550;
    }
    if (fullText.includes('aufsatz')) {
      rollladenPrice += 150;
    }
    if (fullText.includes('solar')) {
      rollladenPrice += 200;
    }
    
    if (Math.abs(oldPrice - rollladenPrice) > 50) {
      pos.unitPrice = rollladenPrice;
      warnings.push(`✏️ Rollladen: €${oldPrice} → €${rollladenPrice}`);
    }
    return;
  }
  
  // ═══════════════════════════════════════════
  // 4. JALOUSIEN
  // ═══════════════════════════════════════════
  if (fullText.includes('jalousie') || fullText.includes('raffstore')) {
    let jalousiePrice = 250;
    
    if (fullText.includes('elektrisch')) {
      jalousiePrice = 450;
    }
    if (fullText.includes('raffstore')) {
      jalousiePrice += 150;
    }
    
    if (Math.abs(oldPrice - jalousiePrice) > 50) {
      pos.unitPrice = jalousiePrice;
      warnings.push(`✏️ Jalousie: €${oldPrice} → €${jalousiePrice}`);
    }
    return;
  }
  
  // ═══════════════════════════════════════════
  // 5. FENSTERBÄNKE
  // ═══════════════════════════════════════════
  if (fullText.includes('fensterbank') || fullText.includes('fensterbänke')) {
    let bankPrice = 150; // Standard pro Stück
    
    // Material-spezifisch
    if (fullText.includes('naturstein') || fullText.includes('granit') || fullText.includes('marmor')) {
      bankPrice = 250;
    } else if (fullText.includes('kunststein') || fullText.includes('agglo')) {
      bankPrice = 180;
    } else if (fullText.includes('alu')) {
      bankPrice = 120;
    } else if (fullText.includes('kunststoff') || fullText.includes('pvc')) {
      bankPrice = 80;
    } else if (fullText.includes('holz')) {
      bankPrice = 160;
    }
    
    // Innen vs Außen
    if (fullText.includes('außen') || fullText.includes('aussen')) {
      bankPrice *= 0.8; // Außen meist günstiger
    } else if (fullText.includes('innen')) {
      bankPrice *= 1.2; // Innen meist teurer (schönere Materialien)
    }
    
    // Pro Meter statt pro Stück?
    if (pos.unit === 'm' || pos.unit === 'lfm') {
      bankPrice = bankPrice / 2; // Ungefähr halber Preis pro Meter
    }
    
    if (Math.abs(oldPrice - bankPrice) > 30) {
      pos.unitPrice = Math.round(bankPrice);
      warnings.push(`✏️ Fensterbank: €${oldPrice} → €${pos.unitPrice}`);
    }
    return;
  }
  
  // ═══════════════════════════════════════════
  // 6. FENSTER-NEBENLEISTUNGEN
  // ═══════════════════════════════════════════
  
  // Abdichtung
  if (fullText.includes('abdichtung') || fullText.includes('anschlussband')) {
    const abdichtPrice = pos.unit === 'm' ? 35 : 25; // Pro Meter oder pro Fenster
    if (Math.abs(oldPrice - abdichtPrice) > 15) {
      pos.unitPrice = abdichtPrice;
      warnings.push(`✏️ Abdichtung: €${oldPrice} → €${abdichtPrice}`);
    }
  }
  
  // Leibungsverputz
  if (fullText.includes('leibung') || fullText.includes('laibung')) {
    const leibungPrice = pos.unit === 'm²' ? 45 : 80; // Pro m² oder pro Fenster
    if (Math.abs(oldPrice - leibungPrice) > 20) {
      pos.unitPrice = leibungPrice;
      warnings.push(`✏️ Leibung: €${oldPrice} → €${leibungPrice}`);
    }
  }
  
  // Silikonverfugung
  if (fullText.includes('silikon') || fullText.includes('verfugung')) {
    const silikonPrice = pos.unit === 'm' ? 15 : 35; // Pro Meter oder pauschal
    if (Math.abs(oldPrice - silikonPrice) > 10) {
      pos.unitPrice = silikonPrice;
      warnings.push(`✏️ Verfugung: €${oldPrice} → €${silikonPrice}`);
    }
  }
  
  // Reinigung
  if (fullText.includes('reinigung') || fullText.includes('endreinigung')) {
    const reinigungPrice = 25; // Pro Fenster
    if (Math.abs(oldPrice - reinigungPrice) > 15) {
      pos.unitPrice = reinigungPrice;
      warnings.push(`✏️ Reinigung: €${oldPrice} → €${reinigungPrice}`);
    }
  }
  
  // Aufmaß/Vermessung
  if (fullText.includes('aufmaß') || fullText.includes('vermessung')) {
    const aufmassPrice = 75; // Pro Fenster oder Pauschal bis 10 Fenster
    if (Math.abs(oldPrice - aufmassPrice) > 25) {
      pos.unitPrice = aufmassPrice;
      warnings.push(`✏️ Aufmaß: €${oldPrice} → €${aufmassPrice}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TÜREN-PREISKORREKTUR (GEWERK TIS)
// ═══════════════════════════════════════════════════════════════════════

function correctDoorPosition(pos, fullText, warnings) {
  const oldPrice = pos.unitPrice || 0;
  
  // Größenfaktor berechnen
  const sizeMatch = fullText.match(/(\d+)\s*[x×]\s*(\d+)/);
  let sizeFactor = 1.0;
  
  if (sizeMatch) {
    const width = parseInt(sizeMatch[1]);
    const height = parseInt(sizeMatch[2]);
    
    // Sondermaße
    if (width > 100 || height > 210) {
      sizeFactor = 1.3;
    }
    if (width > 120 || height > 230) {
      sizeFactor = 1.5;
    }
  }
  
  // ═══════════════════════════════════════════
  // 1. DEMONTAGE & ENTSORGUNG TÜREN
  // ═══════════════════════════════════════════
  if (fullText.includes('demontage') || fullText.includes('ausbau')) {
    if (fullText.includes('entsorgung')) {
      pos.unitPrice = 100; // Demontage + Entsorgung
      if (Math.abs(oldPrice - 100) > 20) {
        warnings.push(`✏️ Tür Demontage+Entsorgung: €${oldPrice} → €100`);
      }
    } else {
      pos.unitPrice = 80; // Nur Demontage
      if (Math.abs(oldPrice - 80) > 20) {
        warnings.push(`✏️ Tür Demontage: €${oldPrice} → €80`);
      }
    }
    return;
  }
  
  // ═══════════════════════════════════════════
  // 2. WOHNUNGSEINGANGSTÜREN
  // ═══════════════════════════════════════════
  if (fullText.includes('wohnungstür') || 
      fullText.includes('wohnungseingang') ||
      fullText.includes('eingangstür') ||
      (fullText.includes('sicherheit') && fullText.includes('tür'))) {
    
    let doorPrice = 2200; // Standard Wohnungstür
    
    // Sicherheitsklassen
    if (fullText.includes('rc3') || fullText.includes('wk3')) {
      doorPrice = 3500;
    } else if (fullText.includes('rc2') || fullText.includes('wk2')) {
      doorPrice = 2800;
    }
    
    // Material
    if (fullText.includes('massivholz')) {
      doorPrice *= 1.3;
    } else if (fullText.includes('alu')) {
      doorPrice *= 1.2;
    }
    
    // Zusatzausstattung
    if (fullText.includes('mehrfachverriegelung')) {
      doorPrice += 300;
    }
    if (fullText.includes('elektronisch') || fullText.includes('fingerprint')) {
      doorPrice += 800;
    }
    
    doorPrice = Math.round(doorPrice * sizeFactor);
    
    if (Math.abs(oldPrice - doorPrice) > 200) {
      pos.unitPrice = doorPrice;
      warnings.push(`✏️ Wohnungstür: €${oldPrice} → €${doorPrice}`);
    }
    return;
  }
  
  // ═══════════════════════════════════════════
  // 3. INNENTÜREN
  // ═══════════════════════════════════════════
  if (fullText.includes('innentür') || 
      (fullText.includes('tür') && fullText.includes('lieferung'))) {
    
    let doorPrice = 600; // Standard Innentür
    
    // Qualität/Material
    if (fullText.includes('massiv') || fullText.includes('echtholz')) {
      doorPrice = 900;
    } else if (fullText.includes('cpl') || fullText.includes('laminat')) {
      doorPrice = 500;
    } else if (fullText.includes('weißlack') || fullText.includes('lackiert')) {
      doorPrice = 650;
    } else if (fullText.includes('furnier')) {
      doorPrice = 750;
    } else if (fullText.includes('glas')) {
      doorPrice = 1200;
    }
    
    // Spezialausführungen
    if (fullText.includes('schallschutz') || fullText.includes('rw')) {
      doorPrice *= 1.4;
    }
    if (fullText.includes('brandschutz') || fullText.includes('t30')) {
      doorPrice *= 1.5;
    }
    if (fullText.includes('t60') || fullText.includes('t90')) {
      doorPrice *= 1.8;
    }
    if (fullText.includes('schiebe')) {
      doorPrice *= 1.3;
    }
    if (fullText.includes('doppelflügel') || fullText.includes('zweiflügel')) {
      doorPrice *= 1.8;
    }
    
    doorPrice = Math.round(doorPrice * sizeFactor);
    
    if (Math.abs(oldPrice - doorPrice) > 100) {
      pos.unitPrice = doorPrice;
      warnings.push(`✏️ Innentür: €${oldPrice} → €${doorPrice}`);
    }
    return;
  }
  
  // ═══════════════════════════════════════════
  // 4. ZARGEN
  // ═══════════════════════════════════════════
  if (fullText.includes('zarge') && !fullText.includes('dichtung')) {
    let zargePrice = 180; // Standard
    
    // Material
    if (fullText.includes('stahl')) {
      zargePrice = 220;
    } else if (fullText.includes('edelstahl')) {
      zargePrice = 380;
    } else if (fullText.includes('massivholz')) {
      zargePrice = 280;
    }
    
    // Spezial
    if (fullText.includes('umfassungszarge')) {
      zargePrice *= 1.2;
    }
    if (fullText.includes('blockzarge')) {
      zargePrice *= 0.9;
    }
    
    zargePrice = Math.round(zargePrice * sizeFactor);
    
    if (Math.abs(oldPrice - zargePrice) > 50) {
      pos.unitPrice = zargePrice;
      warnings.push(`✏️ Zarge: €${oldPrice} → €${zargePrice}`);
    }
    return;
  }
  
  // ═══════════════════════════════════════════
  // 5. TÜRBESCHLÄGE & ZUBEHÖR
  // ═══════════════════════════════════════════
  
  // Türdrücker/Beschläge
  if (fullText.includes('drücker') || fullText.includes('türgriff') || 
      fullText.includes('beschlag')) {
    
    let beschlagPrice = 95; // Standard
    
    if (fullText.includes('edelstahl')) {
      beschlagPrice = 150;
    } else if (fullText.includes('messing') || fullText.includes('antik')) {
      beschlagPrice = 180;
    }
    
    if (fullText.includes('sicherheit') || fullText.includes('wohnungstür')) {
      beschlagPrice = 280;
    }
    
    if (Math.abs(oldPrice - beschlagPrice) > 30) {
      pos.unitPrice = beschlagPrice;
      warnings.push(`✏️ Türbeschlag: €${oldPrice} → €${beschlagPrice}`);
    }
    return;
  }
  
  // Türschloss
  if (fullText.includes('schloss') || fullText.includes('zylinder')) {
    let schlossPrice = 120;
    
    if (fullText.includes('sicherheit')) {
      schlossPrice = 250;
    }
    if (fullText.includes('elektronisch') || fullText.includes('smart')) {
      schlossPrice = 450;
    }
    
    if (Math.abs(oldPrice - schlossPrice) > 40) {
      pos.unitPrice = schlossPrice;
      warnings.push(`✏️ Türschloss: €${oldPrice} → €${schlossPrice}`);
    }
    return;
  }
  
  // Türspion
  if (fullText.includes('spion')) {
    const spionPrice = 55;
    if (Math.abs(oldPrice - spionPrice) > 20) {
      pos.unitPrice = spionPrice;
      warnings.push(`✏️ Türspion: €${oldPrice} → €55`);
    }
    return;
  }
  
  // Türdichtung
  if (fullText.includes('dichtung') || fullText.includes('anschlagdichtung')) {
    const dichtungPrice = 35;
    if (Math.abs(oldPrice - dichtungPrice) > 15) {
      pos.unitPrice = dichtungPrice;
      warnings.push(`✏️ Türdichtung: €${oldPrice} → €35`);
    }
    return;
  }
  
  // Türstopper
  if (fullText.includes('stopper') || fullText.includes('türpuffer')) {
    const stopperPrice = 25;
    if (Math.abs(oldPrice - stopperPrice) > 10) {
      pos.unitPrice = stopperPrice;
      warnings.push(`✏️ Türstopper: €${oldPrice} → €25`);
    }
    return;
  }
  
  // Türschließer
  if (fullText.includes('schließer') || fullText.includes('türschließer')) {
    let schliesserPrice = 180;
    
    if (fullText.includes('freilauf') || fullText.includes('feststellung')) {
      schliesserPrice = 280;
    }
    
    if (Math.abs(oldPrice - schliesserPrice) > 50) {
      pos.unitPrice = schliesserPrice;
      warnings.push(`✏️ Türschließer: €${oldPrice} → €${schliesserPrice}`);
    }
    return;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// INTEGRATION IN BESTEHENDE VALIDIERUNG
// ═══════════════════════════════════════════════════════════════════════

function applyWindowPriceCorrection(lv, tradeCode) {
  if (!lv.positions || (tradeCode !== 'FEN' && tradeCode !== 'TIS')) {
    return lv;
  }
  
  const { positions, warnings } = correctWindowAndDoorPrices(lv.positions, tradeCode);
  
  // Log Warnungen
  if (warnings.length > 0) {
    console.log('═══════════════════════════════════════════');
    console.log(`💰 ${tradeCode === 'FEN' ? 'FENSTER' : 'TÜREN'}-PREISKORREKTUREN:`);
    warnings.forEach(w => console.log(w));
    console.log('═══════════════════════════════════════════');
  }
  
  // Aktualisiere Gesamtpreise
  positions.forEach(pos => {
    if (pos.unitPrice && pos.quantity) {
      pos.totalPrice = Math.round(pos.unitPrice * pos.quantity);
    }
  });
  
  lv.positions = positions;
  return lv;
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
  correctWindowAndDoorPrices,
  applyWindowPriceCorrection
};

/**
 * Korrigiert Fensterpreise basierend auf Material, Größe und Ausstattung
 * Marktpreise Stand 2024/2025 inkl. Montage
 */
function correctWindowPrices(positions, tradeCode) {
  if (tradeCode !== 'FEN') return { positions, warnings: [] };
  
  const warnings = [];
  let correctedCount = 0;
  
  positions.forEach(pos => {
    const titleLower = (pos.title || '').toLowerCase();
    const descLower = (pos.description || '').toLowerCase();
    const fullText = titleLower + ' ' + descLower;
    
    // Skip non-window main positions
    if (!fullText.includes('fenster') || 
        fullText.includes('reinigung') || 
        fullText.includes('abdichtung') ||
        fullText.includes('vermessung') ||
        fullText.includes('gerüst')) {
      return;
    }
    
    const oldPrice = pos.unitPrice || 0;
    
    // ═══════════════════════════════════════════
    // 1. DEMONTAGE & ENTSORGUNG
    // ═══════════════════════════════════════════
    if (fullText.includes('demontage') || fullText.includes('ausbau')) {
      const isDemontageOnly = !fullText.includes('entsorgung');
      const isWithEntsorgung = fullText.includes('entsorgung');
      
      if (isWithEntsorgung) {
        // Demontage + Entsorgung pro Fenster
        pos.unitPrice = 120; // 80€ Demontage + 40€ Entsorgung
        if (Math.abs(oldPrice - 120) > 20) {
          warnings.push(`✏️ Demontage+Entsorgung: €${oldPrice} → €120`);
          correctedCount++;
        }
      } else if (isDemontageOnly) {
        // Nur Demontage
        pos.unitPrice = 80;
        if (Math.abs(oldPrice - 80) > 20) {
          warnings.push(`✏️ Demontage: €${oldPrice} → €80`);
          correctedCount++;
        }
      }
      return;
    }
    
    // ═══════════════════════════════════════════
    // 2. NEUE FENSTER - LIEFERUNG & MONTAGE
    // ═══════════════════════════════════════════
    if (fullText.includes('lieferung') || fullText.includes('montage') || 
        fullText.includes('einbau') || fullText.includes('stk')) {
      
      // Extrahiere Maße
      const sizeMatch = fullText.match(/(\d+)\s*[x×]\s*(\d+)/);
      
      if (sizeMatch) {
        const width = parseInt(sizeMatch[1]);
        const height = parseInt(sizeMatch[2]);
        
        // Konvertiere zu cm falls in mm angegeben
        const widthCm = width > 300 ? width / 10 : width;
        const heightCm = height > 300 ? height / 10 : height;
        
        // Berechne Fläche in m²
        const area = (widthCm * heightCm) / 10000;
        
        // ═══════════════════════════════════════════
        // MATERIAL-BASIERTE PREISKALKULATION
        // ═══════════════════════════════════════════
        
        let basePrice = 0;
        let areaPrice = 0;
        let materialType = '';
        
        // Detaillierte Material-Erkennung
        if (fullText.includes('holz-alu') || fullText.includes('holz-aluminium')) {
          // HOLZ-ALU (Premium)
          materialType = 'Holz-Alu';
          basePrice = 600;  // Grundpreis
          areaPrice = 700;  // Preis pro m²
          
        } else if (fullText.includes('aluminium') || fullText.includes('alu')) {
          // ALUMINIUM
          materialType = 'Aluminium';
          basePrice = 500;
          areaPrice = 600;
          
        } else if (fullText.includes('holz')) {
          // HOLZ
          materialType = 'Holz';
          
          // Unterscheide Holzarten
          if (fullText.includes('eiche') || fullText.includes('lärche')) {
            basePrice = 550;
            areaPrice = 650;
            materialType = 'Holz (Hartholz)';
          } else {
            basePrice = 450;
            areaPrice = 550;
            materialType = 'Holz (Weichholz)';
          }
          
        } else if (fullText.includes('kunststoff') || fullText.includes('pvc')) {
          // KUNSTSTOFF/PVC
          materialType = 'Kunststoff';
          basePrice = 350;
          areaPrice = 400;
          
        } else {
          // STANDARD/UNBEKANNT
          materialType = 'Standard';
          basePrice = 400;
          areaPrice = 450;
        }
        
        // ═══════════════════════════════════════════
        // ZUSATZ-FAKTOREN
        // ═══════════════════════════════════════════
        
        let priceFactor = 1.0;
        const extras = [];
        
        // Verglasung
        if (fullText.includes('3-fach') || fullText.includes('dreifach')) {
          priceFactor *= 1.15;
          extras.push('3-fach');
        } else if (fullText.includes('2-fach') || fullText.includes('zweifach')) {
          priceFactor *= 1.0; // Standard
        }
        
        // Sicherheit
        if (fullText.includes('rc2') || fullText.includes('einbruch')) {
          priceFactor *= 1.2;
          extras.push('RC2');
        } else if (fullText.includes('rc3')) {
          priceFactor *= 1.3;
          extras.push('RC3');
        }
        
        // Schallschutz
        if (fullText.includes('schallschutz')) {
          priceFactor *= 1.1;
          extras.push('Schallschutz');
        }
        
        // Spezialformen
        if (fullText.includes('rundbogen') || fullText.includes('dreieck') || 
            fullText.includes('schräg')) {
          priceFactor *= 1.25;
          extras.push('Sonderform');
        }
        
        // Bodentief
        if (fullText.includes('bodentief') || heightCm > 200) {
          priceFactor *= 1.15;
          extras.push('Bodentief');
        }
        
        // ═══════════════════════════════════════════
        // FINALE PREISBERECHNUNG
        // ═══════════════════════════════════════════
        
        // Grundformel: Basispreis + (Fläche × Flächenpreis) × Faktoren
        let calculatedPrice = (basePrice + (area * areaPrice)) * priceFactor;
        
        // Größenrabatt bei sehr kleinen Fenstern (unter 0.5m²)
        if (area < 0.5) {
          calculatedPrice = Math.max(calculatedPrice, 380); // Mindestpreis
        }
        
        // Aufschlag für sehr große Fenster (über 3m²)
        if (area > 3) {
          calculatedPrice *= 1.1; // Transport/Montage-Aufschlag
        }
        
        // Runde auf 10€
        calculatedPrice = Math.round(calculatedPrice / 10) * 10;
        
        // Setze neuen Preis wenn Abweichung signifikant
        if (Math.abs(oldPrice - calculatedPrice) > oldPrice * 0.15) {
          pos.unitPrice = calculatedPrice;
          
          const extrasInfo = extras.length > 0 ? ` [${extras.join(', ')}]` : '';
          warnings.push(
            `✏️ ${materialType}-Fenster ${widthCm}x${heightCm}cm (${area.toFixed(2)}m²)${extrasInfo}: €${oldPrice} → €${calculatedPrice}`
          );
          correctedCount++;
        }
        
      } else {
        // ═══════════════════════════════════════════
        // FENSTER OHNE MAßE - STANDARDPREISE
        // ═══════════════════════════════════════════
        
        let standardPrice = 800;
        
        if (fullText.includes('holz-alu')) {
          standardPrice = 1200;
        } else if (fullText.includes('alu')) {
          standardPrice = 1000;
        } else if (fullText.includes('holz')) {
          standardPrice = 900;
        } else if (fullText.includes('kunststoff')) {
          standardPrice = 700;
        }
        
        if (Math.abs(oldPrice - standardPrice) > 100) {
          pos.unitPrice = standardPrice;
          warnings.push(`✏️ Standard-Fenster (ohne Maße): €${oldPrice} → €${standardPrice}`);
          correctedCount++;
        }
      }
    }
    
    // ═══════════════════════════════════════════
    // 3. ZUSATZLEISTUNGEN
    // ═══════════════════════════════════════════
    
    // Fensterbänke
    if (fullText.includes('fensterbank') || fullText.includes('fensterbänke')) {
      let bankPrice = 150; // Standard
      
      if (fullText.includes('naturstein') || fullText.includes('granit')) {
        bankPrice = 250;
      } else if (fullText.includes('alu')) {
        bankPrice = 120;
      } else if (fullText.includes('kunststoff')) {
        bankPrice = 80;
      }
      
      if (Math.abs(oldPrice - bankPrice) > 30) {
        pos.unitPrice = bankPrice;
        warnings.push(`✏️ Fensterbank: €${oldPrice} → €${bankPrice}`);
        correctedCount++;
      }
    }
    
    // Rollläden
    if (fullText.includes('rollladen') || fullText.includes('rolladen')) {
      let rollladenPrice = 350; // Manuell
      
      if (fullText.includes('elektrisch') || fullText.includes('motor')) {
        rollladenPrice = 550;
      }
      if (fullText.includes('aufsatz')) {
        rollladenPrice += 150; // Aufsatzrollläden teurer
      }
      
      if (Math.abs(oldPrice - rollladenPrice) > 50) {
        pos.unitPrice = rollladenPrice;
        warnings.push(`✏️ Rollladen: €${oldPrice} → €${rollladenPrice}`);
        correctedCount++;
      }
    }
  });
  
  if (correctedCount > 0) {
    console.log(`💰 Fenster-Preiskorrektur: ${correctedCount} Positionen angepasst`);
  }
  
  return { positions, warnings };
}

// ═══════════════════════════════════════════════════════════════════════
// INTEGRATION IN BESTEHENDE VALIDIERUNG
// ═══════════════════════════════════════════════════════════════════════

function applyWindowPriceCorrection(lv, tradeCode) {
  if (!lv.positions || tradeCode !== 'FEN') {
    return lv;
  }
  
  const { positions, warnings } = correctWindowPrices(lv.positions, tradeCode);
  
  // Log Warnungen
  if (warnings.length > 0) {
    console.log('═══════════════════════════════════════════');
    console.log('💰 FENSTER-PREISKORREKTUREN:');
    warnings.forEach(w => console.log(w));
    console.log('═══════════════════════════════════════════');
  }
  
  // Aktualisiere Gesamtpreise
  positions.forEach(pos => {
    if (pos.unitPrice && pos.quantity) {
      pos.totalPrice = Math.round(pos.unitPrice * pos.quantity);
    }
  });
  
  lv.positions = positions;
  return lv;
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
  correctWindowPrices,
  applyWindowPriceCorrection
};
