/**
 * Adaptive Fragenfluss-Engine
 * 
 * Verwaltet den dynamischen Fragenfluss basierend auf Projektart und Gewerk
 */

const fs = require('fs-extra');
const path = require('path');
const llmProvider = require('../llm/provider');

class QuestionEngine {
  constructor() {
    this.sessions = new Map();
    this.promptsDir = path.join(__dirname, '../../../prompts');
    this.questionCache = new Map();
  }

  /**
   * Erstellt eine neue Fragen-Session
   */
  async createSession(projectData) {
    const sessionId = this.generateSessionId();
    
    const session = {
      id: sessionId,
      projectData,
      currentTrade: null,
      currentStep: 0,
      answers: {},
      tradeProgress: {},
      detectedTrades: [],
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    // Erkenne relevante Gewerke basierend auf Projektbeschreibung
    session.detectedTrades = await this.detectTrades(projectData);
    
    // Initialisiere Progress für jedes Gewerk
    session.detectedTrades.forEach(trade => {
      session.tradeProgress[trade] = {
        currentQuestion: 0,
        totalQuestions: 0,
        completed: false,
        questions: [],
        answers: {},
      };
    });

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Erkennt relevante Gewerke basierend auf Projektbeschreibung
   */
  async detectTrades(projectData) {
    const { category, subCategory, description } = projectData;
    
    // Verwende LLM für intelligente Gewerke-Erkennung
    if (llmProvider.isAvailable()) {
      try {
        const prompt = `
Analysiere das folgende Bauprojekt und bestimme die relevanten Gewerke:

Kategorie: ${category}
Unterkategorie: ${subCategory || 'Nicht angegeben'}
Beschreibung: ${description}

Verfügbare Gewerke:
- sanitaer (Sanitärinstallation)
- elektro (Elektroinstallation)
- heizung (Heizung/Lüftung)
- fliesen (Fliesenarbeiten)
- maler (Malerarbeiten)
- trockenbau (Trockenbauarbeiten)
- dachdecker (Dacharbeiten)
- fenster-tueren (Fenster/Türen)
- fassadenbau (Fassadenarbeiten)
- geruest (Gerüstbau)
- aussenanlagen (Außenanlagen)
- tischler (Tischlerarbeiten)
- schlosser (Schlosserarbeiten)

Antworte nur mit einer kommagetrennten Liste der relevanten Gewerke-IDs.
`;

        const response = await llmProvider.chatComplete({
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        });

        const trades = response.split(',').map(t => t.trim()).filter(t => t);
        return trades.length > 0 ? trades : this.fallbackTradeDetection(description);
        
      } catch (error) {
        console.warn('⚠️ LLM Gewerke-Erkennung fehlgeschlagen, verwende Fallback:', error.message);
      }
    }

    return this.fallbackTradeDetection(description);
  }

  /**
   * Fallback Gewerke-Erkennung basierend auf Keywords
   */
  fallbackTradeDetection(description) {
    const lower = description.toLowerCase();
    const trades = [];

    const tradeKeywords = {
      sanitaer: ['bad', 'sanitär', 'wc', 'dusche', 'badewanne', 'waschbecken', 'toilette'],
      elektro: ['elektro', 'strom', 'licht', 'steckdose', 'schalter', 'beleuchtung'],
      heizung: ['heizung', 'heizkörper', 'thermostat', 'warmwasser', 'boiler'],
      fliesen: ['fliesen', 'kacheln', 'bodenfliesen', 'wandfliesen'],
      maler: ['maler', 'streichen', 'tapete', 'farbe', 'anstrich'],
      trockenbau: ['trockenbau', 'rigips', 'gipskarton', 'wand', 'decke'],
      dachdecker: ['dach', 'ziegel', 'dachrinne', 'schornstein'],
      'fenster-tueren': ['fenster', 'tür', 'türen', 'rolladen'],
      fassadenbau: ['fassade', 'außenwand', 'dämmung', 'putz'],
    };

    Object.entries(tradeKeywords).forEach(([trade, keywords]) => {
      if (keywords.some(keyword => lower.includes(keyword))) {
        trades.push(trade);
      }
    });

    // Mindestens ein Gewerk zurückgeben
    return trades.length > 0 ? trades : ['sanitaer'];
  }

  /**
   * Lädt Fragen für ein spezifisches Gewerk
   */
  async loadTradeQuestions(tradeName) {
    const cacheKey = `questions_${tradeName}`;
    
    if (this.questionCache.has(cacheKey)) {
      return this.questionCache.get(cacheKey);
    }

    try {
      const promptFile = `${tradeName}_fragenprompt_optimiert.md`;
      const promptPath = path.join(this.promptsDir, promptFile);
      
      if (!(await fs.pathExists(promptPath))) {
        console.warn(`⚠️ Fragenprompt nicht gefunden: ${promptFile}`);
        return [];
      }

      const content = await fs.readFile(promptPath, 'utf8');
      const questions = this.parseQuestionsFromPrompt(content, tradeName);
      
      this.questionCache.set(cacheKey, questions);
      return questions;
      
    } catch (error) {
      console.error(`❌ Fehler beim Laden der Fragen für ${tradeName}:`, error);
      return [];
    }
  }

  /**
   * Parst Fragen aus einem Fragenprompt
   */
  parseQuestionsFromPrompt(content, tradeName) {
    const questions = [];
    const lines = content.split('\n');
    
    let currentSection = null;
    let currentQuestion = null;
    let questionCounter = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Erkenne Abschnitte
      if (line.startsWith('## ') || line.startsWith('### ')) {
        currentSection = line.replace(/^#+\s*/, '');
        continue;
      }

      // Erkenne Fragen (verschiedene Formate)
      const questionPatterns = [
        /^\*\*(.+?)\*\*\s*\*\((.+?)\)\*/,  // **Frage** *(Erklärung)*
        /^\*\*(.+?)\*\*/,                   // **Frage**
        /^(.+?)\?\s*\*\((.+?)\)\*/,        // Frage? *(Erklärung)*
        /^(.+?)\?$/,                       // Frage?
      ];

      for (const pattern of questionPatterns) {
        const match = line.match(pattern);
        if (match) {
          const questionText = match[1].trim();
          const explanation = match[2] || null;
          
          // Sammle Antwortoptionen aus den folgenden Zeilen
          const options = this.extractOptionsFromFollowingLines(lines, i + 1);
          
          const question = {
            id: `${tradeName}_q${questionCounter}`,
            trade: tradeName,
            section: currentSection,
            text: questionText,
            explanation,
            type: this.determineQuestionType(questionText, options),
            options: options.length > 0 ? options : null,
            required: this.isRequiredQuestion(questionText),
            dependencies: this.extractDependencies(questionText),
          };

          questions.push(question);
          questionCounter++;
          break;
        }
      }
    }

    return questions;
  }

  /**
   * Extrahiert Antwortoptionen aus folgenden Zeilen
   */
  extractOptionsFromFollowingLines(lines, startIndex) {
    const options = [];
    
    for (let i = startIndex; i < lines.length && i < startIndex + 10; i++) {
      const line = lines[i].trim();
      
      // Stoppe bei neuer Frage oder Abschnitt
      if (line.startsWith('**') || line.startsWith('##') || line === '') {
        break;
      }

      // Erkenne Optionen
      const optionPatterns = [
        /^-\s*🔴\s*\*\*(.+?)\*\*(.*)$/,     // - 🔴 **Option** Beschreibung
        /^-\s*🟡\s*\*\*(.+?)\*\*(.*)$/,     // - 🟡 **Option** Beschreibung
        /^-\s*🟢\s*\*\*(.+?)\*\*(.*)$/,     // - 🟢 **Option** Beschreibung
        /^-\s*\*\*(.+?)\*\*(.*)$/,          // - **Option** Beschreibung
        /^-\s*(.+?)$/,                      // - Option
      ];

      for (const pattern of optionPatterns) {
        const match = line.match(pattern);
        if (match) {
          const value = match[1].trim();
          const description = match[2] ? match[2].trim() : '';
          
          options.push({
            value,
            label: value,
            description: description.replace(/^-\s*/, ''),
          });
          break;
        }
      }
    }

    return options;
  }

  /**
   * Bestimmt den Fragentyp basierend auf Inhalt
   */
  determineQuestionType(questionText, options) {
    if (options && options.length > 0) {
      return options.length > 5 ? 'select' : 'radio';
    }
    
    if (questionText.toLowerCase().includes('größe') || 
        questionText.toLowerCase().includes('abmessungen') ||
        questionText.toLowerCase().includes('meter')) {
      return 'number';
    }
    
    if (questionText.toLowerCase().includes('beschreib') ||
        questionText.toLowerCase().includes('erläuter')) {
      return 'textarea';
    }
    
    return 'text';
  }

  /**
   * Prüft, ob eine Frage erforderlich ist
   */
  isRequiredQuestion(questionText) {
    const requiredKeywords = ['wichtig', 'erforderlich', 'muss', 'grunddaten'];
    return requiredKeywords.some(keyword => 
      questionText.toLowerCase().includes(keyword)
    );
  }

  /**
   * Extrahiert Abhängigkeiten zwischen Fragen
   */
  extractDependencies(questionText) {
    // Vereinfachte Abhängigkeits-Erkennung
    // In einer vollständigen Implementierung würde dies komplexer sein
    return [];
  }

  /**
   * Gibt die nächsten Fragen für eine Session zurück
   */
  async getNextQuestions(sessionId, tradeId = null) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session nicht gefunden');
    }

    // Aktualisiere letzte Aktivität
    session.lastActivity = new Date();

    // Wenn kein spezifisches Gewerk angegeben, nimm das erste unvollständige
    if (!tradeId) {
      tradeId = this.getNextIncompleteTrade(session);
    }

    if (!tradeId) {
      return { completed: true, questions: [] };
    }

    // Lade Fragen für das Gewerk falls noch nicht geschehen
    if (session.tradeProgress[tradeId].questions.length === 0) {
      const questions = await this.loadTradeQuestions(tradeId);
      session.tradeProgress[tradeId].questions = questions;
      session.tradeProgress[tradeId].totalQuestions = questions.length;
    }

    const tradeProgress = session.tradeProgress[tradeId];
    const currentIndex = tradeProgress.currentQuestion;
    
    // Gib nächste 3-5 Fragen zurück (adaptiv)
    const batchSize = this.calculateBatchSize(tradeId, currentIndex);
    const nextQuestions = tradeProgress.questions.slice(currentIndex, currentIndex + batchSize);

    return {
      sessionId,
      tradeId,
      tradeName: tradeId,
      currentStep: currentIndex + 1,
      totalSteps: tradeProgress.totalQuestions,
      questions: nextQuestions,
      progress: Math.round((currentIndex / tradeProgress.totalQuestions) * 100),
      completed: false,
    };
  }

  /**
   * Berechnet die optimale Batch-Größe für Fragen
   */
  calculateBatchSize(tradeId, currentIndex) {
    // Komplexe Gewerke: kleinere Batches für bessere UX
    const complexTrades = ['elektro', 'heizung', 'sanitaer'];
    
    if (complexTrades.includes(tradeId)) {
      return currentIndex === 0 ? 3 : 2; // Erste Fragen: 3, dann 2
    }
    
    return currentIndex === 0 ? 5 : 3; // Einfache Gewerke: größere Batches
  }

  /**
   * Findet das nächste unvollständige Gewerk
   */
  getNextIncompleteTrade(session) {
    for (const trade of session.detectedTrades) {
      if (!session.tradeProgress[trade].completed) {
        return trade;
      }
    }
    return null;
  }

  /**
   * Speichert Antworten für eine Session
   */
  async saveAnswers(sessionId, answers) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session nicht gefunden');
    }

    session.lastActivity = new Date();

    // Speichere Antworten
    Object.entries(answers).forEach(([questionId, answer]) => {
      session.answers[questionId] = {
        questionId,
        answer: answer.value || answer,
        assumption: answer.assumption || null,
        timestamp: new Date(),
      };

      // Aktualisiere Trade-Progress
      const trade = questionId.split('_')[0];
      if (session.tradeProgress[trade]) {
        session.tradeProgress[trade].answers[questionId] = answer;
        session.tradeProgress[trade].currentQuestion++;
      }
    });

    // Prüfe, ob Gewerk abgeschlossen ist
    this.checkTradeCompletion(session);

    return {
      success: true,
      nextAvailable: this.getNextIncompleteTrade(session) !== null,
    };
  }

  /**
   * Prüft, ob ein Gewerk abgeschlossen ist
   */
  checkTradeCompletion(session) {
    Object.entries(session.tradeProgress).forEach(([trade, progress]) => {
      if (progress.currentQuestion >= progress.totalQuestions && !progress.completed) {
        progress.completed = true;
        console.log(`✅ Gewerk ${trade} abgeschlossen`);
      }
    });
  }

  /**
   * Gibt Session-Informationen zurück
   */
  getSessionInfo(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session nicht gefunden');
    }

    const totalQuestions = Object.values(session.tradeProgress)
      .reduce((sum, progress) => sum + progress.totalQuestions, 0);
    
    const answeredQuestions = Object.keys(session.answers).length;
    
    const completedTrades = Object.values(session.tradeProgress)
      .filter(progress => progress.completed).length;

    return {
      sessionId: session.id,
      projectData: session.projectData,
      detectedTrades: session.detectedTrades,
      totalTrades: session.detectedTrades.length,
      completedTrades,
      totalQuestions,
      answeredQuestions,
      overallProgress: totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0,
      tradeProgress: session.tradeProgress,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
    };
  }

  /**
   * Generiert eine eindeutige Session-ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Bereinigt alte Sessions (älter als 24 Stunden)
   */
  cleanupOldSessions() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActivity < cutoff) {
        this.sessions.delete(sessionId);
        console.log(`🗑️ Session ${sessionId} bereinigt (inaktiv)`);
      }
    }
  }
}

// Singleton-Instanz
const questionEngine = new QuestionEngine();

// Automatische Bereinigung alle 6 Stunden
setInterval(() => {
  questionEngine.cleanupOldSessions();
}, 6 * 60 * 60 * 1000);

module.exports = questionEngine;

