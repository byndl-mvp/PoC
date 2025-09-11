const { openai, anthropic, MODEL_OPENAI, MODEL_ANTHROPIC } = require('../config/llm.config');

/**
 * Erweiterte LLM-Policy mit robuster Fehlerbehandlung
 */
async function llmWithPolicy(task, messages, options = {}) {
  const defaultMaxTokens = {
    'detect': 3000,      
    'questions': 6000,   
    'lv': 10000,         
    'intake': 4000,      
    'summary': 3000,
    'validation': 3000   
  };
  
  const maxTokens = options.maxTokens || defaultMaxTokens[task] || 4000;
  const temperature = options.temperature !== undefined ? options.temperature : 0.4;
  
  // LV IMMER mit OpenAI (wegen JSON-Mode), Rest bevorzugt Anthropic
  const primaryProvider = task === 'lv' 
    ? 'openai'  // LV immer OpenAI
    : ['detect', 'questions', 'intake', 'validation'].includes(task) 
      ? 'anthropic' 
      : 'openai';
  
  const callOpenAI = async () => {
  try {
    // JSON-Mode ohne Token-Limit-Beschränkung verwenden
    const useJsonMode = options.jsonMode;
    
    const response = await openai.chat.completions.create({
      model: MODEL_OPENAI,
      messages,
      temperature,
      max_tokens: Math.min(maxTokens, 16384),  // HIER: max_tokens statt max_completion_tokens!
      response_format: useJsonMode ? { type: "json_object" } : undefined
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('[LLM] OpenAI error:', error.status || error.message);
    throw error;
  }
};
  
  const callClaude = async () => {
    try {
      let systemMessage = messages.find(m => m.role === "system")?.content || "";
      
      // Für Claude: JSON-Instruktion in System-Prompt einbauen
      if (options.jsonMode) {
        systemMessage = `KRITISCH: Antworte AUSSCHLIESSLICH mit validem JSON!
- Beginne direkt mit {
- Ende mit }
- KEIN Markdown (keine \`\`\`)
- KEINE Erklärungen außerhalb des JSON
- KEINE Kommentare

${systemMessage}

ERINNERUNG: NUR valides JSON ausgeben!`;
      }
      
      const otherMessages = messages.filter(m => m.role !== "system");

      const response = await anthropic.messages.create({
        model: MODEL_ANTHROPIC,
        max_tokens: Math.min(maxTokens, 8192),
        temperature,
        system: systemMessage,
        messages: otherMessages,
      });

      return response.content[0].text;
    } catch (error) {
      console.error('[LLM] Anthropic error:', error.status || error.message);
      throw error;
    }
  };
  
  // Rest der Funktion bleibt gleich...
  let result = null;
  let lastError = null;
  
  // Try primary provider
  try {
    console.log(`[LLM] Task: ${task} | Trying primary: ${primaryProvider} | Tokens: ${maxTokens}`);
    
    if (primaryProvider === 'anthropic') {
      result = await callClaude();
    } else {
      result = await callOpenAI();
    }
    
    console.log(`[LLM] Success with primary ${primaryProvider}`);
    return result;
    
  } catch (primaryError) {
    lastError = primaryError;
    console.warn(`[LLM] Primary ${primaryProvider} failed with status ${primaryError.status || 'unknown'}`);
    
    // Try fallback provider
    const fallbackProvider = primaryProvider === 'anthropic' ? 'openai' : 'anthropic';
    
    try {
      console.log(`[LLM] Trying fallback: ${fallbackProvider}`);
      
      if (fallbackProvider === 'openai') {
        result = await callOpenAI();
      } else {
        result = await callClaude();
      }
      
      console.log(`[LLM] Success with fallback ${fallbackProvider}`);
      return result;
      
    } catch (fallbackError) {
      console.error(`[LLM] Fallback ${fallbackProvider} also failed with status ${fallbackError.status || 'unknown'}`);
      lastError = fallbackError;
    }
  }
  
  // Both failed - last resort for questions
  if (task === 'questions' || task === 'intake') {
    console.log('[LLM] Both providers failed, using emergency fallback questions');
    return '[]';
  }
  
  throw new Error(`All LLM providers unavailable. Last error: ${lastError?.message || 'Unknown error'}`);
}

module.exports = {
  llmWithPolicy
};
