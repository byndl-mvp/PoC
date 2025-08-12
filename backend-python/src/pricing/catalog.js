/**
 * Preis-Katalog Parser
 * 
 * Extrahiert Preise aus LV-Prompt-Dateien und erstellt einen strukturierten JSON-Katalog
 */

const fs = require('fs-extra');
const path = require('path');

class PricingCatalog {
  constructor() {
    this.catalog = {};
    this.promptsDir = path.join(__dirname, '../../../prompts');
    this.outputPath = path.join(__dirname, '../../../data/pricing.json');
  }

  /**
   * Initialisiert den Katalog durch Parsen aller LV-Prompt-Dateien
   */
  async initialize() {
    console.log('🔄 Initialisiere Preis-Katalog...');
    
    try {
      // Erstelle data-Verzeichnis falls nicht vorhanden
      await fs.ensureDir(path.dirname(this.outputPath));
      
      // Lade alle LV-Prompt-Dateien
      const promptFiles = await this.findLVPromptFiles();
      
      for (const file of promptFiles) {
        const tradeName = this.extractTradeNameFromFile(file);
        console.log(`📄 Parse ${tradeName} aus ${file}`);
        
        const positions = await this.parsePromptFile(file, tradeName);
        this.catalog[tradeName] = positions;
      }
      
      // Speichere Katalog als JSON
      await this.saveCatalog();
      
      console.log(`✅ Preis-Katalog erstellt mit ${Object.keys(this.catalog).length} Gewerken`);
      return this.catalog;
      
    } catch (error) {
      console.error('❌ Fehler beim Initialisieren des Preis-Katalogs:', error);
      throw error;
    }
  }

  /**
   * Findet alle LV-Prompt-Dateien im prompts-Verzeichnis
   */
  async findLVPromptFiles() {
    const files = await fs.readdir(this.promptsDir);
    return files.filter(file => file.includes('-lv-prompt') && file.endsWith('.txt'));
  }

  /**
   * Extrahiert den Gewerke-Namen aus dem Dateinamen
   */
  extractTradeNameFromFile(filename) {
    // z.B. "sanitaer-lv-prompt.txt" -> "sanitaer"
    return filename.replace('-lv-prompt.txt', '').replace('-lv-prompt-2.txt', '');
  }

  /**
   * Parst eine LV-Prompt-Datei und extrahiert Positionen mit Preisen
   */
  async parsePromptFile(filename, tradeName) {
    const filePath = path.join(this.promptsDir, filename);
    const content = await fs.readFile(filePath, 'utf8');
    
    const positions = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Suche nach Positionen mit Preisen
      const positionMatch = this.extractPosition(line, tradeName);
      if (positionMatch) {
        positions.push(positionMatch);
      }
    }
    
    return positions;
  }

  /**
   * Extrahiert Position und Preis aus einer Zeile
   */
  extractPosition(line, tradeName) {
    // Verschiedene Preis-Pattern erkennen
    const patterns = [
      // Pattern: "Position X.Y: Beschreibung -- **Preis €**"
      /Position\s+(\d+\.\d+):\s*(.+?)\s*--\s*\*\*([^*]+)\*\*/,
      // Pattern: "- Position X.Y: Beschreibung -- **Preis**"
      /-\s*Position\s+(\d+\.\d+):\s*(.+?)\s*--\s*\*\*([^*]+)\*\*/,
      // Pattern: "Beschreibung: **Preis**"
      /^([^:]+):\s*\*\*([^*]+)\*\*/,
      // Pattern: "- Beschreibung -- **Preis**"
      /-\s*([^-]+?)\s*--\s*\*\*([^*]+)\*\*/,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        let positionCode, description, priceText;
        
        if (match.length === 4) {
          // Pattern mit Position-Nummer
          positionCode = match[1];
          description = match[2].trim();
          priceText = match[3];
        } else if (match.length === 3) {
          // Pattern ohne Position-Nummer
          positionCode = this.generatePositionCode(description || match[1]);
          description = match[1].trim();
          priceText = match[2];
        }
        
        const priceInfo = this.parsePrice(priceText);
        if (priceInfo) {
          return {
            positionCode: positionCode || this.generatePositionCode(description),
            kurztext: this.extractShortText(description),
            langtext: description,
            einheit: priceInfo.unit,
            defaultEP: priceInfo.defaultPrice,
            minEP: priceInfo.minPrice,
            maxEP: priceInfo.maxPrice,
            qualitaetsstufen: priceInfo.qualityLevels,
            gewerk: tradeName,
            hinweise: this.extractNotes(description),
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Parst Preis-Information aus Text
   */
  parsePrice(priceText) {
    // Entferne Formatierung
    const cleanText = priceText.replace(/\*\*/g, '').trim();
    
    // Pattern für verschiedene Preisformate
    const patterns = [
      // "50-80 €/Stk"
      /(\d+)-(\d+)\s*€\/(\w+)/,
      // "50-80 €"
      /(\d+)-(\d+)\s*€/,
      // "~90 €/m²"
      /~(\d+)\s*€\/(\w+)/,
      // "500 €"
      /(\d+)\s*€/,
      // "2.000-5.000 €"
      /([\d.]+)-([\d.]+)\s*€/,
    ];

    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
      if (match) {
        if (match[2] && match[3]) {
          // Preisspanne mit Einheit
          return {
            minPrice: parseFloat(match[1].replace('.', '')),
            maxPrice: parseFloat(match[2].replace('.', '')),
            defaultPrice: (parseFloat(match[1].replace('.', '')) + parseFloat(match[2].replace('.', ''))) / 2,
            unit: match[3],
            qualityLevels: this.extractQualityLevels(cleanText),
          };
        } else if (match[2] && !match[3]) {
          // Preisspanne ohne Einheit
          return {
            minPrice: parseFloat(match[1].replace('.', '')),
            maxPrice: parseFloat(match[2].replace('.', '')),
            defaultPrice: (parseFloat(match[1].replace('.', '')) + parseFloat(match[2].replace('.', ''))) / 2,
            unit: 'Stk',
            qualityLevels: this.extractQualityLevels(cleanText),
          };
        } else {
          // Einzelpreis
          return {
            minPrice: parseFloat(match[1].replace('.', '')),
            maxPrice: parseFloat(match[1].replace('.', '')),
            defaultPrice: parseFloat(match[1].replace('.', '')),
            unit: match[2] || 'Stk',
            qualityLevels: this.extractQualityLevels(cleanText),
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Extrahiert Qualitätsstufen aus Beschreibung
   */
  extractQualityLevels(text) {
    const levels = {};
    
    if (text.includes('Budget') || text.includes('Standard') || text.includes('Premium')) {
      // Explizite Qualitätsstufen gefunden
      const budgetMatch = text.match(/Budget[^:]*:\s*([^;]+)/i);
      const standardMatch = text.match(/Standard[^:]*:\s*([^;]+)/i);
      const premiumMatch = text.match(/Premium[^:]*:\s*([^;]+)/i);
      
      if (budgetMatch) levels.budget = budgetMatch[1].trim();
      if (standardMatch) levels.standard = standardMatch[1].trim();
      if (premiumMatch) levels.premium = premiumMatch[1].trim();
    }
    
    return Object.keys(levels).length > 0 ? levels : null;
  }

  /**
   * Generiert Position-Code aus Beschreibung
   */
  generatePositionCode(description) {
    return description
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 20);
  }

  /**
   * Extrahiert Kurztext aus Beschreibung
   */
  extractShortText(description) {
    // Nimm ersten Teil vor Komma oder ersten 50 Zeichen
    const shortText = description.split(',')[0].split('(')[0].trim();
    return shortText.length > 50 ? shortText.substring(0, 47) + '...' : shortText;
  }

  /**
   * Extrahiert Hinweise aus Beschreibung
   */
  extractNotes(description) {
    const notes = [];
    
    if (description.includes('inkl.')) {
      const inclMatch = description.match(/inkl\.\s*([^)]+)/i);
      if (inclMatch) notes.push(`Inklusive: ${inclMatch[1]}`);
    }
    
    if (description.includes('zzgl.')) {
      const addMatch = description.match(/zzgl\.\s*([^)]+)/i);
      if (addMatch) notes.push(`Zusätzlich: ${addMatch[1]}`);
    }
    
    return notes.length > 0 ? notes.join('; ') : null;
  }

  /**
   * Speichert den Katalog als JSON-Datei
   */
  async saveCatalog() {
    const catalogData = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      trades: Object.keys(this.catalog),
      catalog: this.catalog,
    };
    
    await fs.writeJson(this.outputPath, catalogData, { spaces: 2 });
    console.log(`💾 Katalog gespeichert: ${this.outputPath}`);
  }

  /**
   * Lädt den Katalog aus der JSON-Datei
   */
  async loadCatalog() {
    try {
      if (await fs.pathExists(this.outputPath)) {
        const data = await fs.readJson(this.outputPath);
        this.catalog = data.catalog || {};
        return this.catalog;
      }
    } catch (error) {
      console.warn('⚠️ Katalog konnte nicht geladen werden:', error.message);
    }
    
    return {};
  }

  /**
   * Sucht Position im Katalog
   */
  findPosition(tradeName, positionCode) {
    const trade = this.catalog[tradeName];
    if (!trade) return null;
    
    return trade.find(pos => pos.positionCode === positionCode);
  }

  /**
   * Gibt alle Positionen für ein Gewerk zurück
   */
  getTradePositions(tradeName) {
    return this.catalog[tradeName] || [];
  }

  /**
   * Gibt Katalog-Statistiken zurück
   */
  getStats() {
    const trades = Object.keys(this.catalog);
    const totalPositions = trades.reduce((sum, trade) => sum + this.catalog[trade].length, 0);
    
    return {
      trades: trades.length,
      totalPositions,
      tradesWithPositions: trades.map(trade => ({
        name: trade,
        positions: this.catalog[trade].length,
      })),
    };
  }
}

// Singleton-Instanz
const pricingCatalog = new PricingCatalog();

module.exports = pricingCatalog;

