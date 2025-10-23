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
      
      // Material-basierte Kalkulation
      if (fullText.includes('holz-alu') || fullText.includes('holz-aluminium')) {
        basePrice = 600;
        areaPrice = 700;
      } else if (fullText.includes('aluminium') || fullText.includes('alu')) {
        basePrice = 500;
        areaPrice = 600;
      } else if (fullText.includes('holz')) {
        basePrice = 450;
        areaPrice = 550;
      } else if (fullText.includes('kunststoff') || fullText.includes('pvc')) {
        basePrice = 350;
        areaPrice = 400;
      } else {
        basePrice = 400;
        areaPrice = 450;
      }
      
      // Zusatzfaktoren
      let priceFactor = 1.0;
      
      if (fullText.includes('3-fach') || fullText.includes('dreifach')) {
        priceFactor *= 1.15;
      }
      if (fullText.includes('rc2') || fullText.includes('einbruch')) {
        priceFactor *= 1.2;
      }
      if (fullText.includes('rc3')) {
        priceFactor *= 1.3;
      }
      if (fullText.includes('schallschutz')) {
        priceFactor *= 1.1;
      }
      if (fullText.includes('bodentief') || heightCm > 200) {
        priceFactor *= 1.15;
      }
      
      let calculatedPrice = (basePrice + (area * areaPrice)) * priceFactor;
      calculatedPrice = Math.round(calculatedPrice / 10) * 10;
      
      if (Math.abs(oldPrice - calculatedPrice) > oldPrice * 0.15) {
        pos.unitPrice = calculatedPrice;
        warnings.push(`✏️ Fenster ${widthCm}x${heightCm}cm: €${oldPrice} → €${calculatedPrice}`);
      }
    } else {
      // Fenster ohne Maße - Standardpreise
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
        warnings.push(`✏️ Standard-Fenster: €${oldPrice} → €${standardPrice}`);
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
