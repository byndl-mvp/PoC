const { TRADE_COMPLEXITY, DEFAULT_COMPLEXITY } = require('../config/constants');
const { llmWithPolicy } = require('./llm.service');
const db = require('./database.service');

class QuestionService {
  
  /**
   * Intelligente, dynamische Fragenanzahl-Ermittlung
   */
  getIntelligentQuestionCount(tradeCode, projectContext, intakeAnswers = []) {
    // KOPIEREN SIE DIE KOMPLETTE FUNKTION aus Ihrem Dokument (Zeilen 4-344)
  }
  
  /**
   * Intelligente Antwort-Validierung und Schätzung
   */
  async validateAndEstimateAnswers(answers, tradeCode, projectContext) {
    // KOPIEREN SIE DIE KOMPLETTE FUNKTION aus server.js
  }
  
  /**
   * Intelligente Fragengenerierung mit Mengenerfassung
   */
  async generateQuestions(tradeId, projectContext = {}) {
    // KOPIEREN SIE DIE KOMPLETTE FUNKTION aus server.js (sehr lang!)
  }
  
  /**
   * Generiert adaptive Folgefragen basierend auf Kontext-Antwort
   */
  async generateContextBasedQuestions(tradeId, projectId, contextAnswer) {
    // KOPIEREN SIE DIE KOMPLETTE FUNKTION aus server.js
  }
}

module.exports = new QuestionService();
