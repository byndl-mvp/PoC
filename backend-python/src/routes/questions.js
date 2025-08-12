/**
 * API-Routen für den adaptiven Fragenfluss
 */

const express = require('express');
const questionEngine = require('../logic/question_engine');

const router = express.Router();

/**
 * POST /api/session
 * Erstellt eine neue Fragen-Session
 */
router.post('/session', async (req, res) => {
  try {
    const { category, subCategory, description, timeframe, budget } = req.body;
    
    if (!category || !description) {
      return res.status(400).json({ 
        error: 'Kategorie und Beschreibung sind erforderlich' 
      });
    }

    const projectData = {
      category,
      subCategory,
      description,
      timeframe,
      budget,
    };

    const session = await questionEngine.createSession(projectData);
    
    res.json({
      success: true,
      sessionId: session.id,
      detectedTrades: session.detectedTrades,
      projectData: session.projectData,
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Erstellen der Session:', error);
    res.status(500).json({ 
      error: 'Fehler beim Erstellen der Session',
      details: error.message 
    });
  }
});

/**
 * GET /api/questions/:sessionId
 * Gibt die nächsten Fragen für eine Session zurück
 */
router.get('/questions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { tradeId } = req.query;
    
    const result = await questionEngine.getNextQuestions(sessionId, tradeId);
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der Fragen:', error);
    
    if (error.message === 'Session nicht gefunden') {
      return res.status(404).json({ error: 'Session nicht gefunden' });
    }
    
    res.status(500).json({ 
      error: 'Fehler beim Abrufen der Fragen',
      details: error.message 
    });
  }
});

/**
 * POST /api/answers/:sessionId
 * Speichert Antworten für eine Session
 */
router.post('/answers/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { answers } = req.body;
    
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ 
        error: 'Antworten sind erforderlich' 
      });
    }

    const result = await questionEngine.saveAnswers(sessionId, answers);
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Fehler beim Speichern der Antworten:', error);
    
    if (error.message === 'Session nicht gefunden') {
      return res.status(404).json({ error: 'Session nicht gefunden' });
    }
    
    res.status(500).json({ 
      error: 'Fehler beim Speichern der Antworten',
      details: error.message 
    });
  }
});

/**
 * GET /api/session/:sessionId
 * Gibt Session-Informationen zurück
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const sessionInfo = questionEngine.getSessionInfo(sessionId);
    
    res.json(sessionInfo);
    
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der Session-Info:', error);
    
    if (error.message === 'Session nicht gefunden') {
      return res.status(404).json({ error: 'Session nicht gefunden' });
    }
    
    res.status(500).json({ 
      error: 'Fehler beim Abrufen der Session-Info',
      details: error.message 
    });
  }
});

/**
 * GET /api/session/:sessionId/trades
 * Gibt verfügbare Gewerke für eine Session zurück
 */
router.get('/session/:sessionId/trades', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const sessionInfo = questionEngine.getSessionInfo(sessionId);
    
    const trades = sessionInfo.detectedTrades.map(tradeId => {
      const progress = sessionInfo.tradeProgress[tradeId];
      return {
        id: tradeId,
        name: tradeId,
        displayName: getTradeDisplayName(tradeId),
        totalQuestions: progress.totalQuestions,
        answeredQuestions: Object.keys(progress.answers).length,
        completed: progress.completed,
        progress: progress.totalQuestions > 0 
          ? Math.round((Object.keys(progress.answers).length / progress.totalQuestions) * 100)
          : 0,
      };
    });
    
    res.json({ trades });
    
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der Gewerke:', error);
    
    if (error.message === 'Session nicht gefunden') {
      return res.status(404).json({ error: 'Session nicht gefunden' });
    }
    
    res.status(500).json({ 
      error: 'Fehler beim Abrufen der Gewerke',
      details: error.message 
    });
  }
});

/**
 * DELETE /api/session/:sessionId
 * Löscht eine Session
 */
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Session aus Engine entfernen
    if (questionEngine.sessions.has(sessionId)) {
      questionEngine.sessions.delete(sessionId);
      res.json({ success: true, message: 'Session gelöscht' });
    } else {
      res.status(404).json({ error: 'Session nicht gefunden' });
    }
    
  } catch (error) {
    console.error('❌ Fehler beim Löschen der Session:', error);
    res.status(500).json({ 
      error: 'Fehler beim Löschen der Session',
      details: error.message 
    });
  }
});

/**
 * Hilfsfunktion: Gibt benutzerfreundliche Gewerke-Namen zurück
 */
function getTradeDisplayName(tradeId) {
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

module.exports = router;

