// ═══════════════════════════════════════════════════════════════════════
// FENSTER-PREISKORREKTUR - REALISTISCHE MARKTPREISE 2024/2025
// ═══════════════════════════════════════════════════════════════════════

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
