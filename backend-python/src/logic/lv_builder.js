/**
 * LV-Builder für VOB-konforme Leistungsverzeichnisse
 * 
 * Generiert aus Antworten strukturierte Leistungsverzeichnisse mit Preisen aus dem Katalog
 */

const fs = require('fs-extra');
const path = require('path');
const PDFDocument = require('pdfkit');
const llmProvider = require('../llm/provider');
const pricingCatalog = require('../pricing/catalog');
const questionEngine = require('./question_engine');

class LVBuilder {
  constructor() {
    this.lvCache = new Map();
    this.outputDir = path.join(__dirname, '../../../data/lvs');
  }

  /**
   * Generiert LV für eine Session
   */
  async generateLV(sessionId, tradeId = null) {
    try {
      // Stelle sicher, dass Katalog geladen ist
      if (Object.keys(pricingCatalog.catalog).length === 0) {
        await pricingCatalog.loadCatalog();
        if (Object.keys(pricingCatalog.catalog).length === 0) {
          await pricingCatalog.initialize();
        }
      }

      const sessionInfo = questionEngine.getSessionInfo(sessionId);
      
      if (tradeId) {
        // Einzelnes Gewerk
        return await this.generateTradeLV(sessionInfo, tradeId);
      } else {
        // Alle Gewerke
        const lvs = {};
        for (const trade of sessionInfo.detectedTrades) {
          if (sessionInfo.tradeProgress[trade].completed) {
            lvs[trade] = await this.generateTradeLV(sessionInfo, trade);
          }
        }
        return lvs;
      }
      
    } catch (error) {
      console.error('❌ Fehler beim Generieren des LV:', error);
      throw error;
    }
  }

  /**
   * Generiert LV für ein spezifisches Gewerk
   */
  async generateTradeLV(sessionInfo, tradeId) {
    const tradeProgress = sessionInfo.tradeProgress[tradeId];
    const answers = tradeProgress.answers;
    
    // Lade LV-Prompt für das Gewerk
    const lvPrompt = await this.loadLVPrompt(tradeId);
    
    // Generiere LV mit KI
    const lvContent = await this.generateLVWithAI(tradeId, answers, lvPrompt, sessionInfo.projectData);
    
    // Parse und strukturiere LV
    const structuredLV = this.parseLVContent(lvContent, tradeId);
    
    // Berechne Preise aus Katalog
    const pricedLV = await this.calculatePrices(structuredLV, tradeId);
    
    // Erstelle finales LV-Objekt
    const lv = {
      id: this.generateLVId(sessionInfo.sessionId, tradeId),
      sessionId: sessionInfo.sessionId,
      tradeId,
      tradeName: this.getTradeDisplayName(tradeId),
      projectData: sessionInfo.projectData,
      generatedAt: new Date(),
      content: pricedLV,
      summary: this.calculateSummary(pricedLV),
      metadata: {
        totalPositions: pricedLV.positions.length,
        answeredQuestions: Object.keys(answers).length,
        assumptions: this.extractAssumptions(answers),
      },
    };

    // Cache LV
    this.lvCache.set(lv.id, lv);
    
    // Speichere LV
    await this.saveLV(lv);
    
    return lv;
  }

  /**
   * Lädt LV-Prompt für ein Gewerk
   */
  async loadLVPrompt(tradeId) {
    const promptFile = `${tradeId}-lv-prompt.txt`;
    const promptPath = path.join(__dirname, '../../../prompts', promptFile);
    
    try {
      return await fs.readFile(promptPath, 'utf8');
    } catch (error) {
      console.warn(`⚠️ LV-Prompt nicht gefunden: ${promptFile}`);
      return this.getDefaultLVPrompt(tradeId);
    }
  }

  /**
   * Generiert LV-Inhalt mit KI
   */
  async generateLVWithAI(tradeId, answers, lvPrompt, projectData) {
    if (!llmProvider.isAvailable()) {
      return this.generateFallbackLV(tradeId, answers);
    }

    try {
      // Bereite Antworten für KI auf
      const answerSummary = Object.entries(answers).map(([questionId, answer]) => {
        return `${questionId}: ${answer.value || answer}`;
      }).join('\n');

      const prompt = `
${lvPrompt}

PROJEKTDATEN:
Kategorie: ${projectData.category}
Unterkategorie: ${projectData.subCategory || 'Nicht angegeben'}
Beschreibung: ${projectData.description}
Zeitrahmen: ${projectData.timeframe || 'Nicht angegeben'}
Budget: ${projectData.budget || 'Nicht angegeben'}

ANTWORTEN AUS FRAGEBOGEN:
${answerSummary}

Erstelle ein detailliertes, VOB-konformes Leistungsverzeichnis für das Gewerk "${tradeId}".

Struktur:
1. KAPITEL/ABSCHNITTE mit Überschriften
2. POSITIONEN mit:
   - Position-Nr. (z.B. 1.1, 1.2, etc.)
   - Kurzbeschreibung
   - Detailbeschreibung
   - Einheit (Stk, m², lfm, etc.)
   - Menge (basierend auf Antworten)
   - Hinweise zu Qualität/Ausführung

Verwende die Preise und Positionen aus dem ursprünglichen Prompt als Grundlage.
`;

      const response = await llmProvider.chatComplete({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 4000,
      });

      return response;
      
    } catch (error) {
      console.warn('⚠️ KI-LV-Generierung fehlgeschlagen, verwende Fallback:', error.message);
      return this.generateFallbackLV(tradeId, answers);
    }
  }

  /**
   * Fallback LV-Generierung ohne KI
   */
  generateFallbackLV(tradeId, answers) {
    const positions = pricingCatalog.getTradePositions(tradeId);
    
    let content = `# Leistungsverzeichnis - ${this.getTradeDisplayName(tradeId)}\n\n`;
    content += `## 1. DEMONTAGE UND VORBEREITUNG\n\n`;
    
    positions.slice(0, 5).forEach((pos, index) => {
      content += `### Position 1.${index + 1}: ${pos.kurztext}\n`;
      content += `- Beschreibung: ${pos.langtext}\n`;
      content += `- Einheit: ${pos.einheit}\n`;
      content += `- Menge: 1\n`;
      content += `- Hinweise: ${pos.hinweise || 'Standardausführung'}\n\n`;
    });
    
    content += `## 2. NEUINSTALLATION\n\n`;
    
    positions.slice(5, 10).forEach((pos, index) => {
      content += `### Position 2.${index + 1}: ${pos.kurztext}\n`;
      content += `- Beschreibung: ${pos.langtext}\n`;
      content += `- Einheit: ${pos.einheit}\n`;
      content += `- Menge: 1\n`;
      content += `- Hinweise: ${pos.hinweise || 'Standardausführung'}\n\n`;
    });
    
    return content;
  }

  /**
   * Parst LV-Inhalt in strukturierte Form
   */
  parseLVContent(content, tradeId) {
    const lines = content.split('\n');
    const chapters = [];
    let currentChapter = null;
    let currentPosition = null;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Kapitel erkennen
      if (trimmed.startsWith('## ')) {
        if (currentChapter) {
          chapters.push(currentChapter);
        }
        currentChapter = {
          title: trimmed.replace('## ', ''),
          positions: [],
        };
        continue;
      }
      
      // Positionen erkennen
      if (trimmed.startsWith('### Position ')) {
        if (currentPosition && currentChapter) {
          currentChapter.positions.push(currentPosition);
        }
        
        const positionMatch = trimmed.match(/Position\s+(\d+\.\d+):\s*(.+)/);
        if (positionMatch) {
          currentPosition = {
            positionNr: positionMatch[1],
            kurztext: positionMatch[2],
            langtext: '',
            einheit: 'Stk',
            menge: 1,
            hinweise: '',
          };
        }
        continue;
      }
      
      // Position-Details parsen
      if (currentPosition) {
        if (trimmed.startsWith('- Beschreibung:')) {
          currentPosition.langtext = trimmed.replace('- Beschreibung:', '').trim();
        } else if (trimmed.startsWith('- Einheit:')) {
          currentPosition.einheit = trimmed.replace('- Einheit:', '').trim();
        } else if (trimmed.startsWith('- Menge:')) {
          const menge = parseFloat(trimmed.replace('- Menge:', '').trim());
          currentPosition.menge = isNaN(menge) ? 1 : menge;
        } else if (trimmed.startsWith('- Hinweise:')) {
          currentPosition.hinweise = trimmed.replace('- Hinweise:', '').trim();
        }
      }
    }
    
    // Letzte Position und Kapitel hinzufügen
    if (currentPosition && currentChapter) {
      currentChapter.positions.push(currentPosition);
    }
    if (currentChapter) {
      chapters.push(currentChapter);
    }

    return {
      tradeId,
      tradeName: this.getTradeDisplayName(tradeId),
      chapters,
      positions: this.flattenPositions(chapters),
    };
  }

  /**
   * Flacht Positionen aus Kapiteln ab
   */
  flattenPositions(chapters) {
    const positions = [];
    chapters.forEach(chapter => {
      chapter.positions.forEach(position => {
        positions.push({
          ...position,
          chapter: chapter.title,
        });
      });
    });
    return positions;
  }

  /**
   * Berechnet Preise aus dem Katalog
   */
  async calculatePrices(structuredLV, tradeId) {
    const catalogPositions = pricingCatalog.getTradePositions(tradeId);
    
    structuredLV.positions.forEach(position => {
      // Suche passende Position im Katalog
      const catalogPos = this.findMatchingCatalogPosition(position, catalogPositions);
      
      if (catalogPos) {
        position.ep = catalogPos.defaultEP;
        position.minEP = catalogPos.minEP;
        position.maxEP = catalogPos.maxEP;
        position.gp = position.menge * catalogPos.defaultEP;
        position.catalogMatch = true;
        position.catalogPosition = catalogPos.positionCode;
      } else {
        // Fallback-Preise
        position.ep = 100;
        position.minEP = 80;
        position.maxEP = 120;
        position.gp = position.menge * 100;
        position.catalogMatch = false;
        position.assumption = 'Preis geschätzt - keine Katalog-Position gefunden';
      }
    });

    return structuredLV;
  }

  /**
   * Findet passende Katalog-Position
   */
  findMatchingCatalogPosition(position, catalogPositions) {
    // Exakte Übereinstimmung nach Position-Code
    let match = catalogPositions.find(cat => 
      cat.positionCode === position.positionNr.replace('.', '_')
    );
    
    if (match) return match;
    
    // Textuelle Ähnlichkeit
    const positionText = (position.kurztext + ' ' + position.langtext).toLowerCase();
    
    match = catalogPositions.find(cat => {
      const catalogText = (cat.kurztext + ' ' + cat.langtext).toLowerCase();
      return this.calculateTextSimilarity(positionText, catalogText) > 0.6;
    });
    
    if (match) return match;
    
    // Fallback: erste Position mit passender Einheit
    return catalogPositions.find(cat => cat.einheit === position.einheit);
  }

  /**
   * Berechnet Textähnlichkeit (vereinfacht)
   */
  calculateTextSimilarity(text1, text2) {
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    
    const commonWords = words1.filter(word => 
      word.length > 3 && words2.includes(word)
    );
    
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  /**
   * Berechnet LV-Zusammenfassung
   */
  calculateSummary(structuredLV) {
    const positions = structuredLV.positions;
    
    const summary = {
      totalPositions: positions.length,
      nettoSumme: positions.reduce((sum, pos) => sum + (pos.gp || 0), 0),
      catalogMatches: positions.filter(pos => pos.catalogMatch).length,
      assumptions: positions.filter(pos => pos.assumption).length,
      chapters: structuredLV.chapters.map(chapter => ({
        title: chapter.title,
        positions: chapter.positions.length,
        summe: chapter.positions.reduce((sum, pos) => sum + (pos.gp || 0), 0),
      })),
    };

    // Berechne Risikopuffer (5-10% je nach Unsicherheit)
    const uncertaintyFactor = summary.assumptions / summary.totalPositions;
    const riskBuffer = Math.max(0.05, Math.min(0.10, 0.05 + uncertaintyFactor * 0.05));
    
    summary.riskBuffer = riskBuffer;
    summary.riskBufferAmount = summary.nettoSumme * riskBuffer;
    summary.bruttoSumme = summary.nettoSumme + summary.riskBufferAmount;

    return summary;
  }

  /**
   * Extrahiert Annahmen aus Antworten
   */
  extractAssumptions(answers) {
    const assumptions = [];
    
    Object.entries(answers).forEach(([questionId, answer]) => {
      if (answer.assumption) {
        assumptions.push({
          questionId,
          assumption: answer.assumption,
        });
      }
    });
    
    return assumptions;
  }

  /**
   * Generiert PDF für LV
   */
  async generatePDF(lvId) {
    const lv = this.lvCache.get(lvId);
    if (!lv) {
      throw new Error('LV nicht gefunden');
    }

    await fs.ensureDir(this.outputDir);
    const pdfPath = path.join(this.outputDir, `${lvId}.pdf`);
    
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(pdfPath);
        doc.pipe(stream);

        // Header
        doc.fontSize(20).text('LEISTUNGSVERZEICHNIS', { align: 'center' });
        doc.moveDown();
        
        doc.fontSize(16).text(lv.tradeName, { align: 'center' });
        doc.moveDown();
        
        // Projekt-Info
        doc.fontSize(12);
        doc.text(`Projekt: ${lv.projectData.description}`);
        doc.text(`Kategorie: ${lv.projectData.category}`);
        if (lv.projectData.subCategory) {
          doc.text(`Unterkategorie: ${lv.projectData.subCategory}`);
        }
        doc.text(`Erstellt am: ${lv.generatedAt.toLocaleDateString('de-DE')}`);
        doc.moveDown();

        // Kapitel und Positionen
        lv.content.chapters.forEach((chapter, chapterIndex) => {
          if (chapterIndex > 0) doc.addPage();
          
          doc.fontSize(14).text(chapter.title, { underline: true });
          doc.moveDown();
          
          chapter.positions.forEach(position => {
            doc.fontSize(12);
            doc.text(`${position.positionNr} ${position.kurztext}`, { continued: false });
            doc.fontSize(10);
            doc.text(`   ${position.langtext}`);
            doc.text(`   Menge: ${position.menge} ${position.einheit}`);
            doc.text(`   Einzelpreis: ${(position.ep || 0).toFixed(2)} €`);
            doc.text(`   Gesamtpreis: ${(position.gp || 0).toFixed(2)} €`);
            if (position.hinweise) {
              doc.text(`   Hinweise: ${position.hinweise}`);
            }
            doc.moveDown(0.5);
          });
        });

        // Zusammenfassung
        doc.addPage();
        doc.fontSize(16).text('KOSTENZUSAMMENFASSUNG', { underline: true });
        doc.moveDown();
        
        doc.fontSize(12);
        lv.summary.chapters.forEach(chapter => {
          doc.text(`${chapter.title}: ${chapter.summe.toFixed(2)} €`);
        });
        
        doc.moveDown();
        doc.text(`Netto-Summe: ${lv.summary.nettoSumme.toFixed(2)} €`);
        doc.text(`Risikopuffer (${(lv.summary.riskBuffer * 100).toFixed(1)}%): ${lv.summary.riskBufferAmount.toFixed(2)} €`);
        doc.fontSize(14).text(`GESAMT: ${lv.summary.bruttoSumme.toFixed(2)} €`, { underline: true });

        // Hinweise
        if (lv.summary.assumptions > 0) {
          doc.moveDown();
          doc.fontSize(10);
          doc.text(`Hinweis: ${lv.summary.assumptions} Position(en) basieren auf Annahmen.`);
          doc.text(`${lv.summary.catalogMatches} von ${lv.summary.totalPositions} Positionen aus Katalog.`);
        }

        doc.end();
        
        stream.on('finish', () => {
          resolve(pdfPath);
        });
        
        stream.on('error', reject);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Speichert LV als JSON
   */
  async saveLV(lv) {
    await fs.ensureDir(this.outputDir);
    const jsonPath = path.join(this.outputDir, `${lv.id}.json`);
    await fs.writeJson(jsonPath, lv, { spaces: 2 });
  }

  /**
   * Lädt LV aus Cache oder Datei
   */
  async loadLV(lvId) {
    if (this.lvCache.has(lvId)) {
      return this.lvCache.get(lvId);
    }
    
    const jsonPath = path.join(this.outputDir, `${lvId}.json`);
    if (await fs.pathExists(jsonPath)) {
      const lv = await fs.readJson(jsonPath);
      this.lvCache.set(lvId, lv);
      return lv;
    }
    
    return null;
  }

  /**
   * Hilfsfunktionen
   */
  generateLVId(sessionId, tradeId) {
    return `lv_${sessionId}_${tradeId}_${Date.now()}`;
  }

  getTradeDisplayName(tradeId) {
    const displayNames = {
      sanitaer: 'Sanitärinstallation',
      elektro: 'Elektroinstallation',
      heizung: 'Heizung & Lüftung',
      fliesen: 'Fliesenarbeiten',
      maler: 'Malerarbeiten',
      trockenbau: 'Trockenbauarbeiten',
      dachdecker: 'Dacharbeiten',
      'fenster-tueren': 'Fenster & Türen',
      fassadenbau: 'Fassadenarbeiten',
      geruest: 'Gerüstbau',
      aussenanlagen: 'Außenanlagen',
      tischler: 'Tischlerarbeiten',
      schlosser: 'Schlosserarbeiten',
    };
    
    return displayNames[tradeId] || tradeId;
  }

  getDefaultLVPrompt(tradeId) {
    return `Erstelle ein Leistungsverzeichnis für ${this.getTradeDisplayName(tradeId)} basierend auf den gegebenen Antworten.`;
  }
}

// Singleton-Instanz
const lvBuilder = new LVBuilder();

module.exports = lvBuilder;

