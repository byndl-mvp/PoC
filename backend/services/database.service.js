const { query } = require('../db.js');

/**
 * Database Service - Zentrale Datenbankoperationen
 */
class DatabaseService {
  
  /**
   * LV speichern - IMMER mit JSON.stringify
   */
  async saveLV(projectId, tradeId, content) {
    return query(
      `INSERT INTO lvs (project_id, trade_id, content)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (project_id, trade_id)
       DO UPDATE SET content = $3::jsonb, updated_at = NOW()`,
      [projectId, tradeId, JSON.stringify(content)]
    );
  }
  
  /**
   * LV laden - IMMER mit JSON.parse
   */
  async getLV(projectId, tradeId) {
    const result = await query(
      'SELECT content FROM lvs WHERE project_id = $1 AND trade_id = $2',
      [projectId, tradeId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const content = result.rows[0].content;
    return typeof content === 'string' ? JSON.parse(content) : content;
  }
  
  /**
   * LV aktualisieren - IMMER mit JSON.stringify
   */
  async updateLV(projectId, tradeId, content) {
    return query(
      `UPDATE lvs 
       SET content = $1::jsonb, updated_at = NOW()
       WHERE project_id = $2 AND trade_id = $3`,
      [JSON.stringify(content), projectId, tradeId]
    );
  }
  
  /**
   * Prompt aus DB laden
   */
  async getPromptByName(name) {
    try {
      const result = await query(
        'SELECT content FROM prompts WHERE name = $1 LIMIT 1',
        [name]
      );
      if (result.rows.length === 0) {
        console.warn(`[DB] Prompt "${name}" not found`);
        return '';
      }
      return result.rows[0].content || '';
    } catch (err) {
      console.error(`[DB] Error loading prompt "${name}":`, err);
      return '';
    }
  }
  
  /**
   * Prompt für spezifisches Gewerk laden
   */
  async getPromptForTrade(tradeId, type) {
    try {
      const result = await query(
        `SELECT content FROM prompts 
         WHERE trade_id = $1 AND type = $2 
         ORDER BY updated_at DESC LIMIT 1`,
        [tradeId, type]
      );
      if (result.rows.length === 0) {
        console.warn(`[DB] No ${type} prompt found for trade ${tradeId}`);
        return '';
      }
      return result.rows[0].content || '';
    } catch (err) {
      console.error(`[DB] Error loading ${type} prompt for trade ${tradeId}:`, err);
      return '';
    }
  }
  
  /**
   * Alle verfügbaren Gewerke laden
   */
  async getAvailableTrades() {
    try {
      const result = await query(
        'SELECT id, code, name, sort_order FROM trades ORDER BY sort_order, id'
      );
      return result.rows;
    } catch (err) {
      console.error('[DB] Failed to load trades:', err);
      return [];
    }
  }
  
  /**
   * Trade-Zuordnung prüfen
   */
  async isTradeAssignedToProject(projectId, tradeId) {
    const result = await query(
      'SELECT 1 FROM project_trades WHERE project_id = $1 AND trade_id = $2',
      [projectId, tradeId]
    );
    return result.rows.length > 0;
  }
  
  /**
   * Projekt-Trade Verknüpfung
   */
  async ensureProjectTrade(projectId, tradeId, source = 'unknown') {
    const exists = await this.isTradeAssignedToProject(projectId, tradeId);
    
    if (!exists) {
      console.log(`[PROJECT_TRADE] Adding trade ${tradeId} to project ${projectId} (source: ${source})`);
      await query(
        `INSERT INTO project_trades (project_id, trade_id)
         VALUES ($1, $2)
         ON CONFLICT (project_id, trade_id) DO NOTHING`,  
        [projectId, tradeId]
      );
    }
  }
  
  /**
 * Alle Trades eines Projekts abrufen
 */
async getProjectTrades(projectId) {
  const result = await query(
    `SELECT t.*, pt.is_manual
     FROM trades t
     JOIN project_trades pt ON pt.trade_id = t.id
     WHERE pt.project_id = $1
     ORDER BY t.sort_order, t.id`,
    [projectId]
  );
  
  console.log('[DB] Project trades with manual flags:', result.rows.map(t => ({
    id: t.id, 
    name: t.name, 
    is_manual: t.is_manual
  })));
  
  return result.rows;
}

/**
   * Fragen speichern (Intake oder Gewerke)
   */
  async saveQuestions(projectId, tradeId, questions) {
    let savedCount = 0;
    for (const q of questions) {
      await query(
        `INSERT INTO questions (project_id, trade_id, question_id, text, type, required, options, depends_on, show_if)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (project_id, trade_id, question_id) 
         DO UPDATE SET text = $4, type = $5, required = $6, options = $7, depends_on = $8, show_if = $9`,
        [
          projectId,
          tradeId,
          q.id || q.question_id,
          q.question || q.text,
          q.multiSelect ? 'multiselect' : (q.type || 'text'),
          q.required !== undefined ? q.required : false,
          q.options ? JSON.stringify({
            values: q.options,
            multiSelect: q.multiSelect || false,
            dependsOn: q.dependsOn || null,
            showIf: q.showIf || null
          }) : null,
          q.dependsOn || null,
          q.showIf || null
        ]
      );
      savedCount++;
    }
    return savedCount;
  }

  /**
   * Fragen laden
   */
  async getQuestions(projectId, tradeId) {
    const result = await query(
      `SELECT q.*, t.name as trade_name, t.code as trade_code
       FROM questions q
       JOIN trades t ON t.id = q.trade_id
       WHERE q.project_id = $1 AND q.trade_id = $2
       ORDER BY q.question_id`,
      [projectId, tradeId]
    );
    
    return result.rows.map(q => {
      const parsedOptions = q.options ? 
        (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : null;
      
      return {
        ...q,
        options: parsedOptions,
        dependsOn: q.depends_on || null,
        showIf: q.show_if || null
      };
    });
  }

  /**
   * Antworten speichern
   */
  async saveAnswers(projectId, tradeId, answers) {
    const savedAnswers = [];
    for (const answer of answers) {
      const isUncertain = answer.answer === 'unsicher' || 
                         answer.answer?.toLowerCase?.() === 'unsicher' ||
                         answer.answer?.toLowerCase?.()?.includes('weiß nicht');
      
      let assumption = answer.assumption || null;
      let finalAnswer = answer.answer;
      
      if (isUncertain) {
        assumption = 'Nutzer war unsicher - Standardwert angenommen';
        finalAnswer = 'Standardannahme getroffen';
      }
      
      await query(
        `INSERT INTO answers (project_id, trade_id, question_id, answer_text, assumption)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (project_id, trade_id, question_id)
         DO UPDATE SET answer_text = $4, assumption = $5, updated_at = NOW()`,
        [projectId, tradeId, answer.questionId, finalAnswer, assumption]
      );
      
      savedAnswers.push({
        questionId: answer.questionId,
        answer: finalAnswer,
        assumption
      });
    }
    return savedAnswers;
  }

  /**
   * Intake-Antworten speichern (spezielle Tabelle)
   */
  async saveIntakeResponses(projectId, answers, tradeId) {
    const savedAnswers = [];
    
    for (const answer of answers) {
      const questionResult = await query(
        'SELECT text FROM questions WHERE project_id = $1 AND trade_id = $2 AND question_id = $3',
        [projectId, tradeId, answer.questionId]
      );
      
      const questionText = questionResult.rows[0]?.text || '';
      
      await query(
        `INSERT INTO intake_responses (project_id, question_id, question_text, answer_text)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (project_id, question_id) 
         DO UPDATE SET answer_text = $4`,
        [
          projectId,
          parseInt(answer.questionId.replace('INT-', '')),
          questionText,
          answer.answer
        ]
      );
      
      savedAnswers.push({
        questionId: answer.questionId,
        answer: answer.answer
      });
    }
    return savedAnswers;
  }

  /**
   * Intake-Antworten laden
   */
  async getIntakeResponses(projectId) {
    const result = await query(
      `SELECT question_text, answer_text, created_at
       FROM intake_responses
       WHERE project_id = $1
       ORDER BY created_at ASC`,
      [projectId]
    );
    return result.rows;
  }

  /**
   * Antworten für Trade laden
   */
  async getAnswersForTrade(projectId, tradeId) {
    const result = await query(
      `SELECT q.text as question, q.question_id, a.answer_text as answer, a.assumption
       FROM answers a
       JOIN questions q ON q.project_id = a.project_id 
         AND q.trade_id = a.trade_id 
         AND q.question_id = a.question_id
       WHERE a.project_id = $1 AND a.trade_id = $2
       ORDER BY q.question_id`,
      [projectId, tradeId]
    );
    return result.rows;
  }

  /**
   * Alle LVs eines Projekts laden
   */
  async getAllProjectLVs(projectId) {
    const result = await query(
      `SELECT l.*, t.name as trade_name, t.code as trade_code
       FROM lvs l
       JOIN trades t ON t.id = l.trade_id
       WHERE l.project_id = $1
       ORDER BY t.sort_order`,
      [projectId]
    );
    
    return result.rows.map(row => ({
      ...row,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content
    }));
  }

  /**
   * Projekt laden
   */
  async getProject(projectId) {
    const result = await query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const project = result.rows[0];
    if (project.metadata && typeof project.metadata === 'string') {
      try {
        project.metadata = JSON.parse(project.metadata);
      } catch (e) {
        console.error('[DB] Failed to parse metadata:', e);
        project.metadata = {};
      }
    }
    return project;
  }

  /**
   * Projekt erstellen
   */
  async createProject(category, subCategory, description, timeframe, budget, metadata = {}) {
    const result = await query(
      `INSERT INTO projects (category, sub_category, description, timeframe, budget, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [category || null, subCategory || null, description, timeframe || null, budget || null, JSON.stringify(metadata)]
    );
    return result.rows[0];
  }

  } // Klasse endet hier

module.exports = new DatabaseService();  // MIT new
