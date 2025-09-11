const express = require('express');
const router = express.Router();
const { query } = require('../db');
const db = require('../services/database.service');
const { detectTrades } = require('../services/trade.service');
const { extractProjectKeyData, determineProjectComplexity, formatCurrency } = require('../utils/helpers');
const { llmWithPolicy } = require('../services/llm.service');

// Create project with trade detection
router.post('/', async (req, res) => {
  try {
    const { category, subCategory, description, timeframe, budget } = req.body;
    
    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }
    
    // Extrahiere Schlüsseldaten aus der Beschreibung
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
        JSON.stringify({ extracted: extractedData })
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
      extractedData
    });
    
    // Nur erkannte Trades hinzufügen
    console.log(`[PROJECT] Creating project ${project.id} with ${detectedTrades.length} detected trades`);
    console.log(`[PROJECT] Extracted quantities:`, extractedData.quantities);
    console.log(`[PROJECT] Extracted measures:`, extractedData.measures);
    
    for (const trade of detectedTrades) {
      await db.ensureProjectTrade(project.id, trade.id, 'detection');
    }
    
    res.json({
      project: {
        ...project,
        trades: detectedTrades,
        complexity: determineProjectComplexity(project),
        extractedData
      }
    });
    
  } catch (err) {
    console.error('Failed to create project:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get project details
router.get('/:projectId', async (req, res) => {
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
    const trades = await db.getProjectTrades(projectId);
    
    // Parse metadata falls vorhanden
    if (project.metadata && typeof project.metadata === 'string') {
      try {
        project.metadata = JSON.parse(project.metadata);
      } catch (e) {
        console.error('[PROJECT] Failed to parse metadata:', e);
        project.metadata = {};
      }
    }
    
    // Extrahiere Daten falls in metadata vorhanden
    const extractedData = project.metadata?.extracted || null;
    
    project.trades = trades;
    project.complexity = determineProjectComplexity(project);
    project.extractedData = extractedData;
    
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

// Get project cost summary
router.get('/:projectId/cost-summary', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const lvsResult = await query(
      `SELECT l.content, t.name as trade_name, t.code as trade_code
       FROM lvs l 
       JOIN trades t ON t.id = l.trade_id
       WHERE l.project_id = $1`,
      [projectId]
    );

    // Projekt-Daten laden
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = projectResult.rows[0];    
    
    const summary = {
      trades: [],
      totalCost: 0,
      budget: project.budget,
      pricesComplete: true,
      dataQuality: {
        measured: 0,
        estimated: 0,
        assumed: 0
      }
    };
    
    for (const row of lvsResult.rows) {
      const lv = typeof row.content === 'string' 
        ? JSON.parse(row.content) 
        : row.content;
      
      const tradeCost = parseFloat(lv.totalSum) || 
        (lv.positions || []).reduce((sum, pos) => 
          sum + (parseFloat(pos.totalPrice) || 0), 0
        );
      
      // Zähle Datenqualität
      if (lv.positions) {
        lv.positions.forEach(pos => {
          if (pos.dataSource === 'measured') summary.dataQuality.measured++;
          else if (pos.dataSource === 'estimated') summary.dataQuality.estimated++;
          else summary.dataQuality.assumed++;
        });
      }
      
      summary.trades.push({
        name: row.trade_name,
        code: row.trade_code,
        cost: parseFloat(tradeCost) || 0,
        hasPrice: tradeCost > 0,
        positionCount: lv.positions?.length || 0,
        confidence: lv.dataQuality?.confidence || 0.5
      });

      summary.totalCost = summary.totalCost + (parseFloat(tradeCost) || 0);
      
      if (tradeCost === 0) {
        summary.pricesComplete = false;
      }
    }
    
    // Berechne Gesamtdatenqualität
    const totalPositions = summary.dataQuality.measured + 
                          summary.dataQuality.estimated + 
                          summary.dataQuality.assumed;
    
    summary.dataQuality.confidence = totalPositions > 0
      ? (summary.dataQuality.measured / totalPositions)
      : 0;
    
    summary.additionalCosts = {
      planningCosts: summary.totalCost * 0.10,
      contingency: summary.totalCost * 0.05,
      vat: summary.totalCost * 0.19
    };
    
    summary.grandTotal = summary.totalCost + 
      summary.additionalCosts.planningCosts +
      summary.additionalCosts.contingency +
      summary.additionalCosts.vat;
    
    res.json({ ok: true, summary });
    
  } catch (err) {
    console.error('Cost summary failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper-Funktion für Gewerk-Beschreibungen
function getTradeDescription(tradeCode) {
  const descriptions = {
    'ABBR': 'Abbruch, Entkernung, Rückbau, Entsorgung',
    'ROH': 'Rohbau, Mauerarbeiten, Betonarbeiten, Fundamente',
    'GER': 'Gerüstbau, Arbeitsplattformen, Absturzsicherung',
    'DACH': 'Dachdeckerarbeiten, Abdichtungen, Terrassen, Flachdach',
    'FEN': 'Fenster, Außentüren, Montage, Rollläden',
    'FASS': 'Fassadenbau, Fassadensanierung, WDVS',
    'AUSS': 'Außenanlagen, Garten- und Landschaftsbau, Pflasterarbeiten',
    'ELEKT': 'Elektroinstallation, Schalter, Steckdosen, Beleuchtung',
    'SAN': 'Sanitärinstallation, Armaturen, Rohre, Bad, WC',
    'HEI': 'Heizungsinstallation, Heizkörper, Thermostate, Warmwasser',
    'KLIMA': 'Lüftung, Klimatechnik, Kühlung, Be- und Entlüftung',
    'PV': 'Photovoltaik, Solarmodule, Wechselrichter, Batteriespeicher',
    'ESTR': 'Estricharbeiten, Bodenaufbau, Dämmung, Fußbodenheizung',
    'TRO': 'Trockenbau, Wände, Decken, Dämmung, Schallschutz',
    'FLI': 'Fliesen, Plattenarbeiten, Verfugung, Abdichtung',
    'TIS': 'Innentüren, Innenausbau, Einbaumöbel, Holzarbeiten',
    'BOD': 'Bodenbeläge, Parkett, Laminat, Teppich, PVC',
    'MAL': 'Malerarbeiten, Lackieren, Tapezieren, Spachteln',
    'SCHL': 'Schlosserarbeiten, Metallbau, Geländer, Stahlkonstruktionen',
    'INT': 'Allgemeine Projektaufnahme, Bestandserfassung'
  };
  return descriptions[tradeCode] || 'Allgemeine Bauarbeiten';
}

// Budget-Optimierung generieren
router.post('/:projectId/budget-optimization', async (req, res) => {
  console.log('[BUDGET-OPT] Route called for project:', req.params.projectId);
  try {
    const { projectId } = req.params;
    const { currentTotal, targetBudget, lvBreakdown } = req.body;

    // Lade zusätzliche Kontextdaten
    const lvPositions = await query(
      `SELECT t.name as trade_name, l.content 
       FROM lvs l 
       JOIN trades t ON t.id = l.trade_id 
       WHERE l.project_id = $1`,
      [projectId]
    );

    const intakeData = await query(
      `SELECT question_text, answer_text 
       FROM intake_responses 
       WHERE project_id = $1`,
      [projectId]
    );

    const projectData = await query(
      'SELECT description, category FROM projects WHERE id = $1',
      [projectId]
    );
    
    const overspend = currentTotal - targetBudget;
    const percentOver = ((overspend / targetBudget) * 100).toFixed(1);
    
    const systemPrompt = `Du bist ein Baukostenoptimierer mit 20 Jahren Erfahrung.

PROJEKTKONTEXT:
${projectData.rows[0]?.description || 'Keine Beschreibung'}
Kategorie: ${projectData.rows[0]?.category || 'Nicht angegeben'}

KONKRETE ARBEITEN IM PROJEKT (aus LV):
${lvPositions.rows.slice(0, 30).map(p => {
  try {
    const content = JSON.parse(p.content);
    return content.positions?.slice(0, 3).map(pos => 
      `- ${p.trade_name}: ${pos.title}`
    ).join('\n');
  } catch {
    return `- ${p.trade_name}: [Positionen nicht lesbar]`;
  }
}).join('\n')}

ERFASSTE PROJEKTDETAILS:
${intakeData.rows.slice(0, 20).map(r => `- ${r.question_text}: ${r.answer_text}`).join('\n')}

VERFÜGBARE GEWERKE-CODES (NUR DIESE VERWENDEN!):
${lvBreakdown.map(lv => `${lv.tradeCode} = ${lv.tradeName} (Typisch: ${getTradeDescription(lv.tradeCode)})`).join('\n')}

KRITISCH: Im "trade" Feld MÜSSEN EXAKT diese Codes verwendet werden:
[${lvBreakdown.map(lv => lv.tradeCode).join(', ')}]

Beispiel korrekte/falsche Ausgaben:
✓ trade: "KLIMA" (wenn KLIMA in der Liste ist)
✓ trade: "SAN" (wenn SAN in der Liste ist)
✗ trade: "TGA" (FALSCH - kein gültiger Code)
✗ trade: "LEISTUNGSREDUZIERUNG" (FALSCH - das ist eine Kategorie, kein Trade-Code)

ANALYSIERE NUR was tatsächlich im Projekt enthalten ist!
- Bei Dachprojekt: KEINE Vorschläge zu Innenräumen
- Bei Badprojekt: KEINE Vorschläge zur Fassade

ERSTELLE 5-7 KONKRETE SPARVORSCHLÄGE aus diesen Kategorien:

1. MATERIALOPTIMIERUNG:
- Standardprodukte statt Premium
- Alternative Materialien gleicher Funktion
- Reduzierte Ausstattung

2. EIGENLEISTUNG (nur bei einfachen Arbeiten):
- Malervorarbeiten, Tapeten entfernen
- Bodenbeläge entfernen
- NICHT: Elektro, Sanitär, Statik, Dach

3. MENGENOPTIMIERUNG:
- Teilbereiche weglassen
- Reduzierte Flächen
- Bestand erhalten wo möglich

BEISPIELE GUTER VORSCHLÄGE:
✓ "Standard-Armaturen statt Designermodelle im Bad (spart 1.200€)"
✓ "Malervorarbeiten in Eigenleistung (spart 600€)"
✓ "Fliesen nur in Nassbereichen (spart 2.000€)"

EXTREM WICHTIG: 
Das "trade" Feld MUSS EXAKT einer dieser Codes sein: ${lvBreakdown.map(lv => lv.tradeCode).join(', ')}
KEINE ANDEREN CODES! Nicht KLIMA wenn KLIMA nicht in der Liste ist!

OUTPUT als JSON:
{
  "optimizations": [
    {
      "trade": "${lvBreakdown[0]?.tradeCode || 'DACH'}",
      "tradeName": "${lvBreakdown[0]?.tradeName || 'Dachdeckerarbeiten'}",
      "measure": "Konkrete Maßnahme für ${lvBreakdown[0]?.tradeName || 'dieses Gewerk'}",
      "savingAmount": 2500,
      "savingPercent": 15,
      "difficulty": "mittel",
      "type": "material",
      "impact": "Auswirkung auf Qualität"
    }${lvBreakdown[1] ? `,
    {
      "trade": "${lvBreakdown[1].tradeCode}",
      "tradeName": "${lvBreakdown[1].tradeName}",
      "measure": "Weitere Optimierung für ${lvBreakdown[1].tradeName}",
      "savingAmount": 1500,
      "savingPercent": 10,
      "difficulty": "einfach",
      "type": "eigenleistung",
      "impact": "Keine Funktionseinschränkung"
    }` : ''}
  ],
  "totalPossibleSaving": 12500,
  "summary": "Durch gezielte Optimierungen können die Kosten reduziert werden"
}`;

    const userPrompt = `Budget: ${formatCurrency(targetBudget)}
Aktuelle Kosten: ${formatCurrency(currentTotal)}
Überschreitung: ${formatCurrency(overspend)} (${percentOver}%)

GEWERKE MIT CODES UND KOSTEN:
${lvBreakdown.map(lv => `${lv.tradeCode}: ${lv.tradeName} = ${formatCurrency(lv.total)}`).join('\n')}

WICHTIGSTE LV-POSITIONEN:
${lvPositions.rows.slice(0, 10).map(p => {
  try {
    const content = JSON.parse(p.content);
    return content.positions?.slice(0, 2).map(pos => 
      `- ${p.trade_name}: ${pos.title}`
    ).join('\n');
  } catch {
    return '';
  }
}).filter(Boolean).join('\n')}

Analysiere JEDES Gewerk und finde konkrete Einsparmöglichkeiten.
Verwende im "trade" Feld NUR die Codes aus der obigen Liste!`;

    const response = await llmWithPolicy('optimization', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { 
      maxTokens: 3000,
      temperature: 0.3,
      jsonMode: true
    });

    console.log('[OPTIMIZATION] Raw LLM response:', response.substring(0, 500));
    const optimizations = JSON.parse(response);
    
    // Sofort nach dem Parsen alle Beträge runden
    if (optimizations.optimizations && Array.isArray(optimizations.optimizations)) {
      optimizations.optimizations = optimizations.optimizations.map(opt => ({
        ...opt,
        savingAmount: Math.round(parseFloat(opt.savingAmount) || 0)
      }));
    }
    
    console.log('[OPTIMIZATION] Parsed optimizations:', JSON.stringify(optimizations.optimizations?.slice(0, 2)));

    // Speichere Optimierungsvorschläge
    await query(
      `INSERT INTO project_optimizations (project_id, suggestions, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (project_id) 
       DO UPDATE SET suggestions = $2, created_at = NOW()`,
      [projectId, JSON.stringify(optimizations)]
    );

    // Runde alle Beträge und korrigiere die Gesamtsumme
    if (optimizations.optimizations && optimizations.optimizations.length > 0) {
      optimizations.optimizations = optimizations.optimizations.map(opt => ({
        ...opt,
        savingAmount: Math.round(parseFloat(opt.savingAmount) || 0)
      }));
      
      optimizations.totalPossibleSaving = optimizations.optimizations.reduce(
        (sum, opt) => sum + opt.savingAmount, 
        0
      );
    }
    
    // Validierung: Filtere ungültige und unrealistische Optimierungen
    const validTradeCodes = lvBreakdown.map(lv => lv.tradeCode);
    if (optimizations.optimizations) {
      optimizations.optimizations = optimizations.optimizations.filter(opt => {
        if (!opt.trade || opt.trade === 'undefined') {
          console.log('[OPTIMIZATION] Skipping optimization with undefined trade');
          return false;
        }
        
        const isValid = validTradeCodes.includes(opt.trade);
        if (!isValid) {
          console.log(`[OPTIMIZATION] Filtered invalid trade: ${opt.trade}`);
          return false;
        }
        
        if (opt.savingAmount < 200) {
          console.log(`[OPTIMIZATION] Filtered unrealistic low amount: ${opt.savingAmount}€`);
          return false;
        }
        
        const tradeLv = lvBreakdown.find(lv => lv.tradeCode === opt.trade);
        if (tradeLv && opt.savingAmount > tradeLv.total * 0.5) {
          console.log(`[OPTIMIZATION] Capped high amount: ${opt.savingAmount}€ to 30% of ${tradeLv.total}€`);
          opt.savingAmount = Math.floor(tradeLv.total * 0.3);
          opt.savingPercent = 30;
        }
        
        return true;
      });
      
      // Stelle sicher dass tradeName korrekt ist
      optimizations.optimizations = optimizations.optimizations.map(opt => {
        const matchingTrade = lvBreakdown.find(lv => lv.tradeCode === opt.trade);
        if (matchingTrade) {
          opt.tradeName = matchingTrade.tradeName;
        }
        return opt;
      });
    }

    // Fallback mit realistischem Mindestbetrag
    if (!optimizations.optimizations || optimizations.optimizations.length === 0) {
      console.log('[OPTIMIZATION] No valid optimizations found, generating fallback');
      optimizations.optimizations = [{
        trade: lvBreakdown[0]?.tradeCode || 'GENERAL',
        tradeName: lvBreakdown[0]?.tradeName || 'Allgemein',
        measure: 'Materialqualität leicht reduzieren ohne Funktionseinbußen',
        savingAmount: Math.max(500, overspend * 0.1),
        savingPercent: 10,
        difficulty: 'einfach',
        type: 'material',
        impact: 'Geringe optische Einschränkungen'
      }];
    }

    // Debug: Zeige alle finalen Beträge
    console.log('[OPTIMIZATION] Final amounts before response:', 
      optimizations.optimizations.map(opt => opt.savingAmount));

    // Stelle sicher, dass die Summe korrekt ist
    optimizations.totalPossibleSaving = optimizations.optimizations.reduce(
      (sum, opt) => sum + opt.savingAmount, 
      0
    );

    console.log('[OPTIMIZATION] Final total:', optimizations.totalPossibleSaving);
    
    res.json(optimizations);
    
  } catch (err) {
    console.error('Optimization generation failed:', err);
    res.status(500).json({ error: 'Fehler bei der Optimierung' });
  }
});

module.exports = router;
