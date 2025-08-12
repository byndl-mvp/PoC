/**
 * API-Routen für LV-Generierung und PDF-Export
 */

const express = require('express');
const path = require('path');
const lvBuilder = require('../logic/lv_builder');

const router = express.Router();

/**
 * POST /api/lv/generate/:sessionId
 * Generiert LV für eine Session
 */
router.post('/generate/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { tradeId } = req.body;
    
    const lv = await lvBuilder.generateLV(sessionId, tradeId);
    
    res.json({
      success: true,
      lv: Array.isArray(lv) ? lv : [lv],
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Generieren des LV:', error);
    
    if (error.message === 'Session nicht gefunden') {
      return res.status(404).json({ error: 'Session nicht gefunden' });
    }
    
    res.status(500).json({ 
      error: 'Fehler beim Generieren des LV',
      details: error.message 
    });
  }
});

/**
 * POST /api/lv/generate-all/:sessionId
 * Generiert LVs für alle abgeschlossenen Gewerke einer Session
 */
router.post('/generate-all/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const lvs = await lvBuilder.generateLV(sessionId);
    
    res.json({
      success: true,
      lvs: Object.entries(lvs).map(([tradeId, lv]) => ({
        tradeId,
        ...lv,
      })),
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Generieren aller LVs:', error);
    
    if (error.message === 'Session nicht gefunden') {
      return res.status(404).json({ error: 'Session nicht gefunden' });
    }
    
    res.status(500).json({ 
      error: 'Fehler beim Generieren der LVs',
      details: error.message 
    });
  }
});

/**
 * GET /api/lv/:lvId
 * Gibt ein spezifisches LV zurück
 */
router.get('/:lvId', async (req, res) => {
  try {
    const { lvId } = req.params;
    
    const lv = await lvBuilder.loadLV(lvId);
    
    if (!lv) {
      return res.status(404).json({ error: 'LV nicht gefunden' });
    }
    
    res.json(lv);
    
  } catch (error) {
    console.error('❌ Fehler beim Laden des LV:', error);
    res.status(500).json({ 
      error: 'Fehler beim Laden des LV',
      details: error.message 
    });
  }
});

/**
 * GET /api/lv/:lvId/pdf
 * Generiert und liefert PDF für ein LV
 */
router.get('/:lvId/pdf', async (req, res) => {
  try {
    const { lvId } = req.params;
    
    // Prüfe, ob LV existiert
    const lv = await lvBuilder.loadLV(lvId);
    if (!lv) {
      return res.status(404).json({ error: 'LV nicht gefunden' });
    }
    
    // Generiere PDF
    const pdfPath = await lvBuilder.generatePDF(lvId);
    
    // Sende PDF als Download
    const filename = `LV_${lv.tradeName}_${lv.generatedAt.toISOString().split('T')[0]}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(path.resolve(pdfPath));
    
  } catch (error) {
    console.error('❌ Fehler beim Generieren des PDFs:', error);
    res.status(500).json({ 
      error: 'Fehler beim Generieren des PDFs',
      details: error.message 
    });
  }
});

/**
 * GET /api/lv/:lvId/preview
 * Gibt LV-Vorschau für Frontend zurück
 */
router.get('/:lvId/preview', async (req, res) => {
  try {
    const { lvId } = req.params;
    
    const lv = await lvBuilder.loadLV(lvId);
    
    if (!lv) {
      return res.status(404).json({ error: 'LV nicht gefunden' });
    }
    
    // Vereinfachte Vorschau für Frontend
    const preview = {
      id: lv.id,
      tradeName: lv.tradeName,
      projectData: lv.projectData,
      generatedAt: lv.generatedAt,
      summary: lv.summary,
      chapters: lv.content.chapters.map(chapter => ({
        title: chapter.title,
        positionCount: chapter.positions.length,
        positions: chapter.positions.map(pos => ({
          positionNr: pos.positionNr,
          kurztext: pos.kurztext,
          menge: pos.menge,
          einheit: pos.einheit,
          ep: pos.ep,
          gp: pos.gp,
          catalogMatch: pos.catalogMatch,
        })),
      })),
      metadata: lv.metadata,
    };
    
    res.json(preview);
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der LV-Vorschau:', error);
    res.status(500).json({ 
      error: 'Fehler beim Laden der LV-Vorschau',
      details: error.message 
    });
  }
});

/**
 * POST /api/lv/:lvId/update
 * Aktualisiert Mengen oder Preise in einem LV
 */
router.post('/:lvId/update', async (req, res) => {
  try {
    const { lvId } = req.params;
    const { updates } = req.body;
    
    const lv = await lvBuilder.loadLV(lvId);
    
    if (!lv) {
      return res.status(404).json({ error: 'LV nicht gefunden' });
    }
    
    // Aktualisiere Positionen
    if (updates && Array.isArray(updates)) {
      updates.forEach(update => {
        const position = lv.content.positions.find(pos => 
          pos.positionNr === update.positionNr
        );
        
        if (position) {
          if (update.menge !== undefined) {
            position.menge = update.menge;
            position.gp = position.menge * position.ep;
          }
          if (update.ep !== undefined) {
            position.ep = update.ep;
            position.gp = position.menge * position.ep;
          }
        }
      });
      
      // Neuberechnung der Zusammenfassung
      lv.summary = lvBuilder.calculateSummary(lv.content);
      
      // Speichere aktualisiertes LV
      await lvBuilder.saveLV(lv);
      
      // Aktualisiere Cache
      lvBuilder.lvCache.set(lvId, lv);
    }
    
    res.json({
      success: true,
      lv,
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Aktualisieren des LV:', error);
    res.status(500).json({ 
      error: 'Fehler beim Aktualisieren des LV',
      details: error.message 
    });
  }
});

/**
 * DELETE /api/lv/:lvId
 * Löscht ein LV
 */
router.delete('/:lvId', async (req, res) => {
  try {
    const { lvId } = req.params;
    
    // Entferne aus Cache
    lvBuilder.lvCache.delete(lvId);
    
    // TODO: Lösche Dateien (JSON und PDF)
    // Für jetzt nur Cache-Entfernung
    
    res.json({
      success: true,
      message: 'LV gelöscht',
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Löschen des LV:', error);
    res.status(500).json({ 
      error: 'Fehler beim Löschen des LV',
      details: error.message 
    });
  }
});

module.exports = router;

