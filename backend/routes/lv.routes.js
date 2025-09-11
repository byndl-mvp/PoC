const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { isTradeAssignedToProject, ensureProjectTrade } = require('../utils/helpers');
const { generateDetailedLVWithRetry, generateLVPDF, generateCompleteLVPDF } = require('../services/lv.service');

// Generate detailed LV for a trade
router.post('/:projectId/trades/:tradeId/lv', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    
    const isAssigned = await isTradeAssignedToProject(projectId, tradeId);
    
    const tradeInfo = await query('SELECT code FROM trades WHERE id = $1', [tradeId]);
    const tradeCode = tradeInfo.rows[0]?.code;
    
    if (!isAssigned && tradeCode !== 'INT') {
      console.log(`[LV] Trade ${tradeId} not assigned to project ${projectId}, adding it now`);
      await ensureProjectTrade(projectId, tradeId, 'lv_generation');
    }
    
    // Generiere detailliertes LV
    const lv = await generateDetailedLVWithRetry(projectId, tradeId);
    
    // Speichere LV in DB
    await query(
      `INSERT INTO lvs (project_id, trade_id, content)
       VALUES ($1,$2,$3)
       ON CONFLICT (project_id, trade_id)
       DO UPDATE SET content=$3, updated_at=NOW()`,
      [projectId, tradeId, JSON.stringify(lv)]  // <-- JSON.stringify() hinzugefügt!
    );
    
    console.log(`[LV] Generated for trade ${tradeId}: ${lv.positions?.length || 0} positions, Total: €${lv.totalSum || 0}`);
    
    res.json({ 
      ok: true, 
      trade: { 
        id: tradeId, 
        code: tradeCode, 
        name: tradeInfo.rows[0]?.name 
      }, 
      lv
    });
    
  } catch (err) {
    console.error('Generate LV failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get aggregated LVs for a project
router.get('/:projectId/lv', async (req, res) => {
  try {
    const { projectId } = req.params;
    const rows = (await query(
      `SELECT l.trade_id, t.code, t.name, l.content
       FROM lvs l JOIN trades t ON t.id=l.trade_id
       WHERE l.project_id=$1
       ORDER BY t.name`,
      [projectId]
    )).rows;

    const lvs = rows.map(row => ({
      ...row,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content
    }));
    
    // Berechne Gesamtstatistiken
    const totalSum = lvs.reduce((sum, lv) => sum + (lv.content.totalSum || 0), 0);
    const totalPositions = lvs.reduce((sum, lv) => sum + (lv.content.positions?.length || 0), 0);
    
    res.json({ 
      ok: true, 
      lvs,
      summary: {
        totalTrades: lvs.length,
        totalPositions,
        totalSum,
        vat: totalSum * 0.19,
        grandTotal: totalSum * 1.19
      }
    });
  } catch (err) {
    console.error('aggregate LV failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get all LVs for a project
router.get('/:projectId/lvs', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const result = await query(
      `SELECT l.*, t.name as trade_name, t.code as trade_code
       FROM lvs l
       JOIN trades t ON t.id = l.trade_id
       WHERE l.project_id = $1`,
      [projectId]
    );
    
    const lvs = result.rows.map(row => ({
      ...row,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content
    }));
    
    res.json({ lvs });
    
  } catch (err) {
    console.error('Failed to fetch LVs:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update LV positions (für Edit und Delete)
router.post('/:projectId/trades/:tradeId/lv/update', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    const { positions, totalSum } = req.body;
    
    // Hole existierendes LV
    const existing = await query(
      'SELECT content FROM lvs WHERE project_id = $1 AND trade_id = $2',
      [projectId, tradeId]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'LV not found' });
    }
    
    const existingContent = typeof existing.rows[0].content === 'string' 
      ? JSON.parse(existing.rows[0].content) 
      : existing.rows[0].content;
    
    // NEU: Berechne Summen mit NEP-Berücksichtigung
    let calculatedSum = 0;
    let nepSum = 0;
    
    const updatedPositions = positions.map(pos => {
      if (!pos.isNEP) {
        calculatedSum += parseFloat(pos.totalPrice) || 0;
      } else {
        nepSum += parseFloat(pos.totalPrice) || 0;
      }
      return pos;
    });
    
    // Update mit neuen Daten
    const updatedContent = {
      ...existingContent,
      positions: updatedPositions,
      totalSum: calculatedSum,
      nepSum: nepSum
    };
    
    // Speichere in DB
    await query(
      'UPDATE lvs SET content = $1, updated_at = NOW() WHERE project_id = $2 AND trade_id = $3',
      [JSON.stringify(updatedContent), projectId, tradeId]
    );
    
    res.json({ ok: true });
    
  } catch (err) {
    console.error('Update LV failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Export LV with or without prices
router.get('/:projectId/trades/:tradeId/lv/export', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    const { withPrices } = req.query;
    
    const result = await query(
      `SELECT l.content, t.name as trade_name, t.code as trade_code, p.description as project_description
       FROM lvs l 
       JOIN trades t ON t.id = l.trade_id
       JOIN projects p ON p.id = l.project_id
       WHERE l.project_id = $1 AND l.trade_id = $2`,
      [projectId, tradeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'LV not found' });
    }
    
    const { content, trade_name, trade_code, project_description } = result.rows[0];
    const lv = typeof content === 'string' ? JSON.parse(content) : content;
    
    if (withPrices === 'false') {
      lv.positions = lv.positions.map(pos => ({
        ...pos,
        unitPrice: '________',
        totalPrice: '________'
      }));
      lv.exportType = 'Angebotsanfrage';
      lv.note = 'Bitte tragen Sie Ihre Preise in die markierten Felder ein.';
    } else {
      lv.exportType = 'Kalkulation';
    }
    
    res.json({
      ok: true,
      tradeName: trade_name,
      tradeCode: trade_code,
      projectDescription: project_description,
      withPrices: withPrices !== 'false',
      lv
    });
    
  } catch (err) {
    console.error('Export LV failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate PDF for LV
router.get('/:projectId/trades/:tradeId/lv.pdf', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    const { withPrices } = req.query;
    
    const result = await query(
      `SELECT l.content, t.name as trade_name, t.code as trade_code, p.description as project_description
       FROM lvs l 
       JOIN trades t ON t.id = l.trade_id
       JOIN projects p ON p.id = l.project_id
       WHERE l.project_id = $1 AND l.trade_id = $2`,
      [projectId, tradeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'LV not found' });
    }
    
    const { content, trade_name, trade_code, project_description } = result.rows[0];
    const lv = typeof content === 'string' ? JSON.parse(content) : content;
    
    const pdfBuffer = await generateLVPDF(
      lv,
      trade_name,
      trade_code,
      project_description,
      withPrices !== 'false'
    );
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="LV_${trade_code}_${withPrices !== 'false' ? 'mit' : 'ohne'}_Preise.pdf"`);
    res.send(pdfBuffer);
    
  } catch (err) {
    console.error('PDF generation failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate complete PDF with all LVs for a project
router.get('/:projectId/lv-complete.pdf', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { withPrices } = req.query;
    
    // Hole Projektdaten und alle LVs
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = projectResult.rows[0];
    
    const lvsResult = await query(
      `SELECT l.content, t.name as trade_name, t.code as trade_code
       FROM lvs l 
       JOIN trades t ON t.id = l.trade_id
       WHERE l.project_id = $1
       ORDER BY t.name`,
      [projectId]
    );
    
    if (lvsResult.rows.length === 0) {
      return res.status(404).json({ error: 'No LVs found for this project' });
    }
    
    // Erstelle komplettes PDF
    const pdfBuffer = await generateCompleteLVPDF(
      project,
      lvsResult.rows,
      withPrices !== 'false'
    );
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Projekt_${projectId}_Komplett_LV_${withPrices !== 'false' ? 'mit' : 'ohne'}_Preise.pdf"`);
    res.send(pdfBuffer);
    
  } catch (err) {
    console.error('Complete PDF generation failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update LV (für Editierung im Frontend)
router.put('/:projectId/trades/:tradeId/lv', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    const { positions } = req.body;
    
    // Hole aktuelles LV
    const currentLV = await query(
      'SELECT content FROM lvs WHERE project_id = $1 AND trade_id = $2',
      [projectId, tradeId]
    );
    
    if (currentLV.rows.length === 0) {
      return res.status(404).json({ error: 'LV not found' });
    }
    
    let lv = typeof currentLV.rows[0].content === 'string' 
      ? JSON.parse(currentLV.rows[0].content) 
      : currentLV.rows[0].content;
    
    // Update Positionen
    lv.positions = positions;
    
    // Neuberechnung der Summe
    let totalSum = 0;
    lv.positions = lv.positions.map((pos, idx) => {
      // Stelle sicher dass Positionsnummer vorhanden ist
      if (!pos.pos) {
        pos.pos = `${idx + 1}.00`;
      }
      
      // Berechne Gesamtpreis wenn nötig
      if (pos.quantity && pos.unitPrice && !pos.totalPrice) {
        pos.totalPrice = Math.round(pos.quantity * pos.unitPrice * 100) / 100;
      }
      
      totalSum += pos.totalPrice || 0;
      return pos;
    });
    
    lv.totalSum = Math.round(totalSum * 100) / 100;
    lv.lastModified = new Date().toISOString();
    lv.modifiedBy = 'user';
    
    // Speichere aktualisiertes LV
    await query(
      `UPDATE lvs 
       SET content = $1, updated_at = NOW()
       WHERE project_id = $2 AND trade_id = $3`,
      [lv, projectId, tradeId]
    );
    
    res.json({ 
      ok: true, 
      message: 'LV erfolgreich aktualisiert',
      lv 
    });
    
  } catch (err) {
    console.error('Failed to update LV:', err);
    res.status(500).json({ error: err.message });
  }
});

// Einzelne Position hinzufügen
router.post('/:projectId/trades/:tradeId/lv/position', async (req, res) => {
  try {
    const { projectId, tradeId } = req.params;
    const newPosition = req.body;
    
    const currentLV = await query(
      'SELECT content FROM lvs WHERE project_id = $1 AND trade_id = $2',
      [projectId, tradeId]
    );
    
    if (currentLV.rows.length === 0) {
      return res.status(404).json({ error: 'LV not found' });
    }
    
    let lv = typeof currentLV.rows[0].content === 'string' 
      ? JSON.parse(currentLV.rows[0].content) 
      : currentLV.rows[0].content;
    
    if (!lv.positions || !Array.isArray(lv.positions)) {
      lv.positions = [];
    }
    
    // Füge neue Position hinzu mit NEP-Unterstützung
    const nextPos = lv.positions.length + 1;
    const positionToAdd = {
      pos: newPosition.pos || `${nextPos}.00`,
      title: newPosition.title || 'Neue Position',
      description: newPosition.description || '',
      quantity: parseFloat(newPosition.quantity) || 1,
      unit: newPosition.unit || 'Stk',
      unitPrice: parseFloat(newPosition.unitPrice) || 0,
      totalPrice: 0,
      dataSource: 'manual',
      notes: 'Manuell hinzugefügt',
      isNEP: newPosition.isNEP || false  // NEU: NEP-Flag übernehmen
    };
    
    // Berechne totalPrice
    positionToAdd.totalPrice = Math.round(
      positionToAdd.quantity * positionToAdd.unitPrice * 100
    ) / 100;
    
    lv.positions.push(positionToAdd);
    
    // NEU: Neuberechnung mit NEP-Berücksichtigung
    let calculatedSum = 0;
    let nepSum = 0;
    
    lv.positions.forEach(pos => {
      if (pos.isNEP) {
        nepSum += pos.totalPrice || 0;
      } else {
        calculatedSum += pos.totalPrice || 0;
      }
    });
    
    lv.totalSum = Math.round(calculatedSum * 100) / 100;
    lv.nepSum = Math.round(nepSum * 100) / 100;
    
    lv.lastModified = new Date().toISOString();
    
    // Speichere aktualisiertes LV
    await query(
      `UPDATE lvs 
       SET content = $1, updated_at = NOW()
       WHERE project_id = $2 AND trade_id = $3`,
      [JSON.stringify(lv), projectId, tradeId]
    );
    
    res.json({ 
      ok: true,
      success: true,
      message: 'Position hinzugefügt',
      position: positionToAdd,
      totalSum: lv.totalSum,
      nepSum: lv.nepSum,  // NEU: NEP-Summe zurückgeben
      lv
    });
    
  } catch (err) {
    console.error('Failed to add position:', err);
    res.status(500).json({ error: err.message });
  }
});

// Position löschen
router.delete('/:projectId/trades/:tradeId/lv/position/:positionId', async (req, res) => {
  try {
    const { projectId, tradeId, positionId } = req.params;
    
    const currentLV = await query(
      'SELECT content FROM lvs WHERE project_id = $1 AND trade_id = $2',
      [projectId, tradeId]
    );
    
    if (currentLV.rows.length === 0) {
      return res.status(404).json({ error: 'LV not found' });
    }
    
    let lv = typeof currentLV.rows[0].content === 'string' 
      ? JSON.parse(currentLV.rows[0].content) 
      : currentLV.rows[0].content;
    
    // Entferne Position
    lv.positions = lv.positions.filter(pos => pos.pos !== positionId);
    
    // Neuberechnung
    lv.totalSum = lv.positions.reduce((sum, pos) => sum + (pos.totalPrice || 0), 0);
    lv.lastModified = new Date().toISOString();
    
    // Nummeriere Positionen neu
    lv.positions = lv.positions.map((pos, idx) => {
      pos.pos = `${idx + 1}.00`;
      return pos;
    });
    
    await query(
      `UPDATE lvs 
       SET content = $1, updated_at = NOW()
       WHERE project_id = $2 AND trade_id = $3`,
      [lv, projectId, tradeId]
    );
    
    res.json({ 
      ok: true, 
      message: 'Position gelöscht',
      totalSum: lv.totalSum
    });
    
  } catch (err) {
    console.error('Failed to delete position:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
