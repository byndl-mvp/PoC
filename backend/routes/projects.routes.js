const express = require('express');
const router = express.Router();
const { query } = require('../db');
const db = require('../services/database.service');
const tradeService = require('../services/trade.service');
const { extractProjectKeyData } = require('../utils/helpers');

// Create project with trade detection
app.post('/api/projects', async (req, res) => {
  try {
    const { category, subCategory, description, timeframe, budget } = req.body;
    
    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }
    
    // NEU: Extrahiere Schlüsseldaten aus der Beschreibung
    const extractedData = extractProjectKeyData(description, category);
    
    // Speichere Projekt MIT extrahierten Daten
    const projectResult = await query(
      `INSERT INTO projects (category, sub_category, description, timeframe, budget, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        category || null, 
        subCategory || null, 
        description, 
        timeframe || null, 
        budget || null,
        JSON.stringify({ extracted: extractedData }) // NEU: Speichere extrahierte Daten
      ]
    );
    
    const project = projectResult.rows[0];
    
    // Übergebe extrahierte Daten an detectTrades
    const detectedTrades = await detectTrades({
      category,
      subCategory,
      description,
      timeframe,
      budget,
      extractedData // NEU: Weitergabe der extrahierten Daten
    });
    
    // Nur erkannte Trades hinzufügen
    console.log(`[PROJECT] Creating project ${project.id} with ${detectedTrades.length} detected trades`);
    console.log(`[PROJECT] Extracted quantities:`, extractedData.quantities);
    console.log(`[PROJECT] Extracted measures:`, extractedData.measures);
    
    for (const trade of detectedTrades) {
      await ensureProjectTrade(project.id, trade.id, 'detection');
    }
    
    res.json({
      project: {
        ...project,
        trades: detectedTrades,
        complexity: determineProjectComplexity(project),
        extractedData // NEU: Sende extrahierte Daten zurück an Frontend
      }
    });
    
  } catch (err) {
    console.error('Failed to create project:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get project details
app.get('/api/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = projectResult.rows[0];
    const trades = await getProjectTrades(projectId);
    
    // NEU: Parse metadata falls vorhanden
    if (project.metadata && typeof project.metadata === 'string') {
      try {
        project.metadata = JSON.parse(project.metadata);
      } catch (e) {
        console.error('[PROJECT] Failed to parse metadata:', e);
        project.metadata = {};
      }
    }
    
    // NEU: Extrahiere Daten falls in metadata vorhanden
    const extractedData = project.metadata?.extracted || null;
    
    project.trades = trades;
    project.complexity = determineProjectComplexity(project);
    project.extractedData = extractedData; // NEU: Füge extrahierte Daten hinzu
    
    console.log(`[PROJECT] Retrieved project ${projectId} with ${trades.length} trades, complexity: ${project.complexity}`);
    if (extractedData) {
      console.log(`[PROJECT] Has extracted data:`, extractedData.quantities);
    }
    
    res.json(project);
    
  } catch (err) {
    console.error('Failed to fetch project:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
