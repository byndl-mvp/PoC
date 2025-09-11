const PDFDocument = require('pdfkit');
const { formatCurrency } = require('../utils/helpers');
const { query } = require('../db');

class PDFService {
  
  /**
 * PDF Generation für LV
 */

generateLVPDF(lv, tradeName, tradeCode, projectDescription, withPrices = true) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Header
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .text('LEISTUNGSVERZEICHNIS', { align: 'center' });
      
      doc.moveDown(0.5);
      
      doc.fontSize(14)
         .font('Helvetica')
         .fillColor('#666666')
         .text(withPrices ? 'Kalkulation' : 'Angebotsanfrage', { align: 'center' });
      
      doc.moveDown(1.5);
      
      // NEU: Vorbemerkungen einfügen (nach Projektinfo, vor Positionen)
  if (lv.vorbemerkungen && lv.vorbemerkungen.length > 0) {
    doc.moveDown(1);
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('VORBEMERKUNGEN', { underline: true });
    
    doc.moveDown(0.5);
    doc.fontSize(10)
       .font('Helvetica');
    
    lv.vorbemerkungen.forEach((vorbemerkung, index) => {
      doc.text(`${index + 1}. ${vorbemerkung}`, {
        indent: 20,
        width: 500
      });
      doc.moveDown(0.3);
    });
    
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y)
       .lineTo(545, doc.y)
       .stroke();
    doc.moveDown(1);
  }
  
 // Projektinfo
      doc.fontSize(12)
         .fillColor('black')
         .font('Helvetica-Bold')
         .text('Projektbeschreibung:', { continued: false });
      
      doc.font('Helvetica')
         .text(projectDescription || 'Keine Beschreibung vorhanden');
      
      doc.moveDown(0.5);
      
      doc.font('Helvetica-Bold')
         .text('Gewerk: ', { continued: true })
         .font('Helvetica')
         .text(`${tradeCode} - ${tradeName}`);
      
      doc.moveDown(0.5);
      
      doc.font('Helvetica-Bold')
         .text('Erstellt am: ', { continued: true })
         .font('Helvetica')
         .text(new Date().toLocaleDateString('de-DE', {
           year: 'numeric',
           month: 'long',
           day: 'numeric'
         }));
      
      // Datenqualität anzeigen
      if (lv.dataQuality) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold')
           .text('Datenqualität: ', { continued: true })
           .font('Helvetica')
           .text(`${Math.round(lv.dataQuality.confidence * 100)}% Konfidenz`);
      }
      
      doc.moveDown(1);
      
      // Trennlinie
      doc.moveTo(50, doc.y)
         .lineTo(545, doc.y)
         .stroke();
      
      doc.moveDown(1);
      
      if (!withPrices) {
        doc.fontSize(10)
           .fillColor('#FF6600')
           .font('Helvetica-Oblique')
           .text('Hinweis: Bitte tragen Sie Ihre Preise in die vorgesehenen Felder ein.', { align: 'center' });
        doc.moveDown(1);
        doc.fillColor('black');
      }
      
      // Positionen
      doc.font('Helvetica-Bold')
         .fontSize(14)
         .text('POSITIONEN', { underline: true });
      
      doc.moveDown(0.5);
      
      const tableTop = doc.y;
      const col1 = 50;  
      const col2 = 90;  
      const col3 = 250; 
      const col4 = 310; 
      const col5 = 370; 
      const col6 = 450; 
      
      doc.fontSize(10)
         .font('Helvetica-Bold');
      
      doc.text('Pos.', col1, tableTop);
      doc.text('Bezeichnung', col2, tableTop);
      doc.text('Menge', col3, tableTop);
      doc.text('Einheit', col4, tableTop);
      doc.text('EP (€)', col5, tableTop);
      doc.text('GP (€)', col6, tableTop);
      
      doc.moveTo(col1, tableTop + 15)
         .lineTo(545, tableTop + 15)
         .stroke();
      
      let yPosition = tableTop + 25;
      let totalSum = 0;
      
      doc.font('Helvetica')
         .fontSize(9);
      
      if (lv && lv.positions && Array.isArray(lv.positions)) {
        lv.positions.forEach((pos, index) => {
          if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
            
            doc.fontSize(10)
               .font('Helvetica-Bold');
            doc.text('Pos.', col1, yPosition);
            doc.text('Bezeichnung', col2, yPosition);
            doc.text('Menge', col3, yPosition);
            doc.text('Einheit', col4, yPosition);
            doc.text('EP (€)', col5, yPosition);
            doc.text('GP (€)', col6, yPosition);
            
            doc.moveTo(col1, yPosition + 15)
               .lineTo(545, yPosition + 15)
               .stroke();
            
            yPosition += 25;
            doc.font('Helvetica')
               .fontSize(9);
          }
          
          // Position mit NEP-Kennzeichnung
let posText = pos.pos || `${index + 1}`;
if (pos.isNEP) {
  posText += ' (NEP)';
}
doc.text(posText, col1, yPosition, { width: 30 });
          
          let titleText = pos.title || 'Keine Bezeichnung';
if (pos.isNEP) {
  titleText = '(NEP) ' + titleText;
}
const titleHeight = doc.heightOfString(titleText, { width: 150 });
doc.text(titleText, col2, yPosition, { width: 150 });
          
          doc.text(pos.quantity?.toString() || '-', col3, yPosition, { width: 50, align: 'right' });
          doc.text(pos.unit || '-', col4, yPosition, { width: 50 });
          
          if (withPrices && pos.unitPrice) {
            doc.text(formatCurrency(pos.unitPrice), col5, yPosition, { width: 70, align: 'right' });
          } else {
            doc.text('________', col5, yPosition, { width: 70, align: 'right' });
          }
          
          if (withPrices && pos.totalPrice) {
  // NEU: Bei NEP-Positionen den Preis in Klammern setzen
  if (pos.isNEP) {
    doc.text(`(${formatCurrency(pos.totalPrice)})`, col6, yPosition, { 
      width: 70, 
      align: 'right' 
    });
    // NEP nicht zur totalSum addieren!
  } else {
    doc.text(formatCurrency(pos.totalPrice), col6, yPosition, { 
      width: 70, 
      align: 'right' 
    });
    totalSum += parseFloat(pos.totalPrice) || 0;
  }
} else {
  doc.text('________', col6, yPosition, { width: 70, align: 'right' });
}
          
          // Beschreibung und Datenquelle
          if (pos.description) {
            yPosition += Math.max(titleHeight, 15);
            doc.fontSize(8)
               .fillColor('#666666')
               .text(pos.description, col2, yPosition, { width: 400 });
            
            const descHeight = doc.heightOfString(pos.description, { width: 400 });
            yPosition += descHeight;
            
            // FIX: Datenquelle UNTER der Beschreibung anzeigen
            if (pos.dataSource && pos.dataSource !== 'measured') {
              const sourceText = pos.dataSource === 'estimated' ? '(geschätzt)' : '(angenommen)';
              yPosition += 2; // Kleine Lücke
              doc.fontSize(7)
                 .fillColor('#FF6600')
                 .text(sourceText, col2, yPosition);
              yPosition += 10; // Abstand nach Label
            }
            
            doc.fontSize(9)
               .fillColor('black');
          } else {
            yPosition += Math.max(titleHeight, 15);
          }
          
          yPosition += 5;
        });
      }
      
      // Summen
      yPosition += 10;
      
      if (yPosition > 650) {
        doc.addPage();
        yPosition = 50;
      }
      
      doc.moveTo(col5 - 10, yPosition)
         .lineTo(545, yPosition)
         .stroke();
      
      yPosition += 10;
      
      if (withPrices) {
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('Nettosumme:', col5 - 80, yPosition)
           .text(formatCurrency(totalSum), col6, yPosition, { width: 70, align: 'right' });

        // NEU: NEP-Summe anzeigen wenn vorhanden
  if (lv.nepSum && lv.nepSum > 0) {
    yPosition += 20;
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('#666666')
       .text('NEP-Positionen:', col5 - 80, yPosition)
       .text(formatCurrency(lv.nepSum), col6, yPosition, { width: 70, align: 'right' });
    doc.fillColor('black');
  }
        
        yPosition += 20;
        
        const vat = totalSum * 0.19;
        doc.font('Helvetica')
           .text('MwSt. (19%):', col5 - 80, yPosition)
           .text(formatCurrency(vat), col6, yPosition, { width: 70, align: 'right' });
        
        yPosition += 20;
        
        doc.moveTo(col5 - 10, yPosition - 5)
           .lineTo(545, yPosition - 5)
           .stroke();
        doc.moveTo(col5 - 10, yPosition - 3)
           .lineTo(545, yPosition - 3)
           .stroke();
        
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('Gesamtsumme:', col5 - 80, yPosition + 5)
           .text(formatCurrency(totalSum + vat), col6, yPosition + 5, { width: 70, align: 'right' });
      } else {
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('Gesamtsumme:', col5 - 80, yPosition)
           .text('________', col6, yPosition, { width: 70, align: 'right' });
      }
      
      // Annahmen anzeigen
      if (lv.assumptions && lv.assumptions.length > 0) {
        yPosition += 40;
        
        if (yPosition > 650) {
          doc.addPage();
          yPosition = 50;
        }
        
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('Annahmen und Hinweise:', 50, yPosition);
        
        yPosition += 15;
        doc.fontSize(8)
           .font('Helvetica');
        
        lv.assumptions.forEach(assumption => {
          doc.text(`• ${assumption}`, 60, yPosition, { width: 485 });
          yPosition += doc.heightOfString(assumption, { width: 485 }) + 5;
        });
      }
      
      // Footer
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor('#666666')
         .text('Alle Preise verstehen sich inklusive aller Nebenleistungen gemäß VOB/C.', 50, 750)
         .text('Erstellt mit BYNDL - KI-gestützte Bauprojektplanung', 50, 765);
      
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
} 
  
  /**
 * PDF Generation für komplettes Projekt-LV
 */
generateCompleteLVPDF(project, lvs, withPrices = true) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Titelseite
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .text('GESAMT-LEISTUNGSVERZEICHNIS', { align: 'center' });
      
      doc.moveDown(0.5);
      
      doc.fontSize(16)
         .font('Helvetica')
         .fillColor('#666666')
         .text(withPrices ? 'Komplette Kalkulation' : 'Angebotsanfrage', { align: 'center' });
      
      doc.moveDown(2);
      
      // Projektinfo
      doc.fontSize(14)
         .fillColor('black')
         .font('Helvetica-Bold')
         .text('Projekt:', { continued: false });
      
      doc.fontSize(12)
         .font('Helvetica')
         .text(project.description || 'Keine Beschreibung vorhanden');
      
      if (project.category) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold')
           .text('Kategorie: ', { continued: true })
           .font('Helvetica')
           .text(project.category);
      }
      
      if (project.budget) {
        doc.font('Helvetica-Bold')
           .text('Budget: ', { continued: true })
           .font('Helvetica')
           .text(project.budget);
      }
      
      doc.moveDown(1);
      
      doc.font('Helvetica-Bold')
         .text('Datum: ', { continued: true })
         .font('Helvetica')
         .text(new Date().toLocaleDateString('de-DE', {
           year: 'numeric',
           month: 'long',
           day: 'numeric'
         }));

      // Globale Projekt-Vorbemerkungen aus Intake-Daten
// Lade Intake-Antworten für Vorbemerkungen
const intakeData = [];
for (const row of lvs) {
  const lv = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
  if (lv.vorbemerkungen && lv.vorbemerkungen.length > 0) {
    // Sammle alle Vorbemerkungen aus den LVs (die aus Intake-Daten generiert wurden)
    intakeData.push(...lv.vorbemerkungen.filter(v => 
      v.includes('Gebäude') || 
      v.includes('Zufahrt') || 
      v.includes('Arbeitszeit') || 
      v.includes('Baustrom') || 
      v.includes('Bauwasser')
    ));
  }
}

// Entferne Duplikate
const uniqueVorbemerkungen = [...new Set(intakeData)];

if (uniqueVorbemerkungen.length > 0) {
  doc.moveDown(2);
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .text('ALLGEMEINE VORBEMERKUNGEN:', { underline: true });

  doc.moveDown(0.5);
  doc.fontSize(10)
     .font('Helvetica');

  uniqueVorbemerkungen.forEach(vorbemerkung => {
    doc.text(`• ${vorbemerkung}`, { indent: 20 });
  });
}
      
      // Inhaltsverzeichnis
      doc.moveDown(2);
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('ENTHALTENE GEWERKE:', { underline: true });
      
      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica');
      
      let grandTotal = 0;
      const tradeSummaries = [];
      
      // Berechne Summen für Übersicht
for (const row of lvs) {
  const lv = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
  
  // NEU: Berechne Summe OHNE NEP-Positionen
  const tradeTotal = lv.positions && lv.positions.length > 0 
    ? lv.positions.reduce((sum, pos) => {
        // NEP-Positionen NICHT mitzählen
        if (!pos.isNEP) {
          return sum + (parseFloat(pos.totalPrice) || 0);
        }
        return sum;
      }, 0)
    : (parseFloat(lv.totalSum) || 0);
  
  // NEU: NEP-Summe separat erfassen
  const nepTotal = lv.positions && lv.positions.length > 0
    ? lv.positions.reduce((sum, pos) => {
        if (pos.isNEP) {
          return sum + (parseFloat(pos.totalPrice) || 0);
        }
        return sum;
      }, 0)
    : (lv.nepSum || 0);
  
  grandTotal += tradeTotal;  // NEP NICHT in Gesamtsumme
  
  tradeSummaries.push({
    code: row.trade_code,
    name: row.trade_name,
    total: tradeTotal,
    nepTotal: nepTotal  // NEU: NEP-Summe speichern
  });
  
  // Berechne und zeige die Gewerke in der Übersicht
  let displayText = `• ${row.trade_code} - ${row.trade_name}: ${withPrices ? formatCurrency(tradeTotal) : '________'}`;
  if (nepTotal > 0 && withPrices) {
  displayText += ` (+ NEP: ${formatCurrency(nepTotal)})`;
  }
  doc.text(displayText, { indent: 20 });
}    
      if (withPrices) {
        doc.moveDown(1);
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text(`Gesamtsumme (netto): ${formatCurrency(grandTotal)}`);
        doc.text(`MwSt. (19%): ${formatCurrency(grandTotal * 0.19)}`);
        doc.text(`Gesamtsumme (brutto): ${formatCurrency(grandTotal * 1.19)}`);
      }
      
      // Neue Seite für erstes Gewerk
      doc.addPage();
      
      // Einzelne Gewerke
      for (let i = 0; i < lvs.length; i++) {
        const row = lvs[i];
        const lv = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
        
        if (i > 0) {
          doc.addPage();
        }
        
        // Gewerk-Header
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .text(`GEWERK: ${row.trade_code} - ${row.trade_name}`, { align: 'center' });
        
        doc.moveDown(1);

        // Vorbemerkungen für dieses Gewerk
if (lv.vorbemerkungen && lv.vorbemerkungen.length > 0) {
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .text('VORBEMERKUNGEN:', { underline: true });
  
  doc.moveDown(0.3);
  doc.fontSize(9)
     .font('Helvetica');
  
  lv.vorbemerkungen.forEach((vorbemerkung, index) => {
    doc.text(`${index + 1}. ${vorbemerkung}`, {
      indent: 20,
      width: 480
    });
    doc.moveDown(0.2);
  });
  
  doc.moveDown(0.5);
}
        
        // Positionen-Tabelle
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('POSITIONEN:', { underline: true });
        
        doc.moveDown(0.5);
        
        const tableTop = doc.y;
        const col1 = 50;  
        const col2 = 90;  
        const col3 = 250; 
        const col4 = 310; 
        const col5 = 370; 
        const col6 = 450; 
        
        doc.fontSize(10)
           .font('Helvetica-Bold');
        
        doc.text('Pos.', col1, tableTop);
        doc.text('Bezeichnung', col2, tableTop);
        doc.text('Menge', col3, tableTop);
        doc.text('Einheit', col4, tableTop);
        doc.text('EP (€)', col5, tableTop);
        doc.text('GP (€)', col6, tableTop);
        
        doc.moveTo(col1, tableTop + 15)
           .lineTo(545, tableTop + 15)
           .stroke();
        
        let yPosition = tableTop + 25;
        let tradeSum = 0; // FIX: Initialisierung der Gewerk-Summe
        
        doc.font('Helvetica')
           .fontSize(9);
        
        if (lv && lv.positions && Array.isArray(lv.positions)) {
          lv.positions.forEach((pos, index) => {
            // Prüfe Seitenumbruch VOR dem Schreiben
            if (yPosition > 680) {  // Früher umbrechen für mehr Sicherheit
              doc.addPage();
              yPosition = 50;
              
              // Header wiederholen
              doc.fontSize(10)
                 .font('Helvetica-Bold');
              doc.text('Pos.', col1, yPosition);
              doc.text('Bezeichnung', col2, yPosition);
              doc.text('Menge', col3, yPosition);
              doc.text('Einheit', col4, yPosition);
              doc.text('EP (€)', col5, yPosition);
              doc.text('GP (€)', col6, yPosition);
              
              doc.moveTo(col1, yPosition + 15)
                 .lineTo(545, yPosition + 15)
                 .stroke();
              
              yPosition += 25;
              doc.font('Helvetica')
                 .fontSize(9);
            }
            
            // Position
            doc.text(pos.pos || `${index + 1}`, col1, yPosition, { width: 35 });
            
            // Titel mit Höhenberechnung
            const titleHeight = doc.heightOfString(pos.title || '', { width: 150 });
            doc.text(pos.title || 'Keine Bezeichnung', col2, yPosition, { width: 150 });
            
            // Andere Spalten auf gleicher Höhe
            doc.text(pos.quantity?.toString() || '-', col3, yPosition, { width: 50, align: 'right' });
            doc.text(pos.unit || '-', col4, yPosition, { width: 50 });
            
            if (withPrices && pos.unitPrice) {
              doc.text(formatCurrency(pos.unitPrice), col5, yPosition, { width: 70, align: 'right' });
              doc.text(formatCurrency(pos.totalPrice || 0), col6, yPosition, { width: 70, align: 'right' });
              tradeSum += parseFloat(pos.totalPrice) || 0; // FIX: Berechnung der Gewerk-Summe
            } else {
              doc.text('________', col5, yPosition, { width: 70, align: 'right' });
              doc.text('________', col6, yPosition, { width: 70, align: 'right' });
            }
            
            // Zeilenhöhe basierend auf Titel
            yPosition += Math.max(titleHeight, 20) + 5;
            
            // Beschreibung mit Abstandsprüfung
            if (pos.description) {
              const descHeight = doc.heightOfString(pos.description, { width: 400 });
              
              // Prüfe ob Beschreibung auf Seite passt
              if (yPosition + descHeight > 680) {
                doc.addPage();
                yPosition = 50;
              }
              
              doc.fontSize(8)
                 .fillColor('#666666')
                 .text(pos.description, col2, yPosition, { width: 400 });
              
              yPosition += descHeight + 10; // Extra Abstand nach Beschreibung
              
              doc.fontSize(9)
                 .fillColor('black');
            } else {
              yPosition += 8; // Kleinerer Abstand ohne Beschreibung
            }
          });
        }
        
        // Gewerk-Summe
        yPosition += 10;
        doc.moveTo(col5 - 10, yPosition)
           .lineTo(545, yPosition)
           .stroke();
        
        yPosition += 10;
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text(`Summe ${row.trade_code}:`, col5 - 80, yPosition)
           .text(withPrices ? formatCurrency(tradeSum) : '________', col6, yPosition, { width: 70, align: 'right' }); // FIX: Verwendung der berechneten Summe
      }
      
      // Abschlussseite mit Zusammenfassung
      doc.addPage();
      
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .text('KOSTENZUSAMMENFASSUNG', { align: 'center' });
      
      doc.moveDown(2);
      
      // Gewerke-Übersicht
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('Einzelkosten der Gewerke:');
      
      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica');
      
      for (const trade of tradeSummaries) {
        doc.text(`${trade.code} - ${trade.name}:`, 70, doc.y)
           .text(withPrices ? formatCurrency(trade.total) : '________', 400, doc.y - 11, { width: 100, align: 'right' });
      }
      
      doc.moveDown(1);
      doc.moveTo(70, doc.y)
         .lineTo(500, doc.y)
         .stroke();
      
      doc.moveDown(0.5);
      
      if (withPrices) {
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('Nettosumme:', 70, doc.y)
           .text(formatCurrency(grandTotal), 400, doc.y - 12, { width: 100, align: 'right' });
        
        doc.moveDown(0.5);
        
        const planningCosts = grandTotal * 0.10;
        const contingency = grandTotal * 0.05;
        const subtotal = grandTotal + planningCosts + contingency;
        const vat = subtotal * 0.19;
        const finalTotal = subtotal + vat;
        
        doc.fontSize(11)
           .font('Helvetica')
           .text('Planungskosten (10%):', 70, doc.y)
           .text(formatCurrency(planningCosts), 400, doc.y - 11, { width: 100, align: 'right' });
        
        doc.text('Unvorhergesehenes (5%):', 70, doc.y)
           .text(formatCurrency(contingency), 400, doc.y - 11, { width: 100, align: 'right' });
        
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold')
           .text('Zwischensumme:', 70, doc.y)
           .text(formatCurrency(subtotal), 400, doc.y - 11, { width: 100, align: 'right' });
        
        doc.moveDown(0.5);
        doc.font('Helvetica')
           .text('MwSt. (19%):', 70, doc.y)
           .text(formatCurrency(vat), 400, doc.y - 11, { width: 100, align: 'right' });
        
        doc.moveDown(0.5);
        doc.moveTo(70, doc.y)
           .lineTo(500, doc.y)
           .stroke();
        doc.moveTo(70, doc.y + 2)
           .lineTo(500, doc.y + 2)
           .stroke();
        
        doc.moveDown(0.5);
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('GESAMTSUMME:', 70, doc.y)
           .text(formatCurrency(finalTotal), 380, doc.y - 14, { width: 120, align: 'right' });
      } else {
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('Gesamtsumme:', 70, doc.y)
           .text('________', 400, doc.y - 12, { width: 100, align: 'right' });
      }
      
      // Footer
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor('#666666')
         .text('Alle Preise verstehen sich inklusive aller Nebenleistungen gemäß VOB/C.', 50, 750)
         .text(`Erstellt am ${new Date().toLocaleDateString('de-DE')} mit BYNDL`, 50, 765);
      
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}
} // Klasse endet hier

module.exports = new PDFService();
