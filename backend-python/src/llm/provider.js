/**
 * LLM Provider Abstraction
 * 
 * Dieses Modul stellt eine einheitliche Schnittstelle für OpenAI und Anthropic APIs bereit.
 * Reihenfolge: OPENAI_API_KEY → ANTHROPIC_API_KEY → Fehler
 */

const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

class LLMProvider {
  constructor() {
    this.openaiClient = null;
    this.anthropicClient = null;
    this.activeProvider = null;
    
    this.initializeProviders();
  }

  initializeProviders() {
    // Prüfe OpenAI API Key (bevorzugt)
    if (process.env.OPENAI_API_KEY) {
      try {
        this.openaiClient = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        this.activeProvider = 'openai';
        console.log('✅ OpenAI Provider initialisiert');
        return;
      } catch (error) {
        console.warn('⚠️ OpenAI Provider Initialisierung fehlgeschlagen:', error.message);
      }
    }

    // Fallback zu Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        this.anthropicClient = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });
        this.activeProvider = 'anthropic';
        console.log('✅ Anthropic Provider initialisiert (Fallback)');
        return;
      } catch (error) {
        console.warn('⚠️ Anthropic Provider Initialisierung fehlgeschlagen:', error.message);
      }
    }

    // Kein Provider verfügbar
    this.activeProvider = null;
    console.error('❌ Kein LLM Provider verfügbar - bitte OPENAI_API_KEY oder ANTHROPIC_API_KEY setzen');
  }

  /**
   * Einheitliche Chat-Completion Methode
   * @param {Object} options - Chat-Optionen
   * @param {Array} options.messages - Array von Nachrichten
   * @param {string} options.model - Modell-Name (optional, verwendet Defaults)
   * @param {string} options.systemPrompt - System-Prompt (optional)
   * @param {number} options.maxTokens - Maximale Token-Anzahl (optional)
   * @param {number} options.temperature - Temperatur (optional)
   * @returns {Promise<string>} - Antwort des LLM
   */
  async chatComplete(options) {
    const { messages, model, systemPrompt, maxTokens = 4000, temperature = 0.7 } = options;

    if (!this.activeProvider) {
      throw new Error('Kein API-Key gesetzt – bitte OPENAI_API_KEY oder ANTHROPIC_API_KEY hinterlegen.');
    }

    // Nachrichten vorbereiten
    let formattedMessages = [...messages];
    if (systemPrompt) {
      formattedMessages.unshift({ role: 'system', content: systemPrompt });
    }

    try {
      if (this.activeProvider === 'openai') {
        return await this.callOpenAI(formattedMessages, model, maxTokens, temperature);
      } else if (this.activeProvider === 'anthropic') {
        return await this.callAnthropic(formattedMessages, model, maxTokens, temperature);
      }
    } catch (error) {
      console.error(`❌ ${this.activeProvider} API Fehler:`, error.message);
      throw new Error(`LLM API Fehler: ${error.message}`);
    }
  }

  async callOpenAI(messages, model, maxTokens, temperature) {
    const modelName = model || process.env.MODEL_OPENAI || 'gpt-4o-mini';
    
    const response = await this.openaiClient.chat.completions.create({
      model: modelName,
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature,
    });

    return response.choices[0].message.content;
  }

  async callAnthropic(messages, model, maxTokens, temperature) {
    const modelName = model || process.env.MODEL_ANTHROPIC || 'claude-3-5-sonnet-latest';
    
    // Anthropic erwartet system-Nachrichten separat
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const response = await this.anthropicClient.messages.create({
      model: modelName,
      max_tokens: maxTokens,
      temperature: temperature,
      system: systemMessage ? systemMessage.content : undefined,
      messages: userMessages,
    });

    return response.content[0].text;
  }

  /**
   * Gibt den aktuell aktiven Provider zurück
   * @returns {string|null} - 'openai', 'anthropic' oder null
   */
  getActiveProvider() {
    return this.activeProvider;
  }

  /**
   * Prüft, ob ein Provider verfügbar ist
   * @returns {boolean}
   */
  isAvailable() {
    return this.activeProvider !== null;
  }

  /**
   * Gibt Provider-Informationen zurück
   * @returns {Object}
   */
  getProviderInfo() {
    return {
      activeProvider: this.activeProvider,
      openaiAvailable: !!this.openaiClient,
      anthropicAvailable: !!this.anthropicClient,
      openaiModel: process.env.MODEL_OPENAI || 'gpt-4o-mini',
      anthropicModel: process.env.MODEL_ANTHROPIC || 'claude-3-5-sonnet-latest',
    };
  }
}

// Singleton-Instanz
const llmProvider = new LLMProvider();

module.exports = llmProvider;

