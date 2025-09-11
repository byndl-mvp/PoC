const PDFDocument = require('pdfkit');
const { formatCurrency } = require('../utils/helpers');
const { query } = require('../db');

class PDFService {
  
  /**
 * PDF Generation für LV
 */
function formatCurrency(amount) {
  if (!amount && amount !== 0) return '________';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

function generateLVPDF(lv, tradeName, tradeCode, projectDescription, withPrices = true) {
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
   * Generiert Gesamt-PDF mit allen LVs
   */
  async generateCompleteLVPDF(lvs, project) {
    // KOPIEREN SIE aus server.js die KOMPLETTE generateCompleteLVPDF Funktion
    // (ca. Zeilen 2700-3000 oder wo auch immer sie ist)
  }
  
  /**
   * Generiert Zusammenfassungs-PDF
   */
  async generateSummaryPDF(project, trades) {
    // KOPIEREN SIE aus server.js falls vorhanden
    // Falls nicht vorhanden, diese Methode löschen
  }
}

module.exports = new PDFService();
