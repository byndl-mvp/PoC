// ============================================================================
// DEPENDENCY VALIDATION & FIXING (nach LLM-Generate)
// ============================================================================

const { query } = require('./db');

/**
 * Validiert und korrigiert Dependencies nach der LLM-Generierung
 * - Entfernt Dependencies auf nicht-vorhandene Gewerke
 * - Fügt kritische fehlende Dependencies hinzu
 * - Loggt Warnings für potenzielle Probleme
 */
async function validateAndFixDependencies(scheduleId) {
  console.log('[DEPS] Starting validation for schedule:', scheduleId);
  
  // 1. Lade alle Entries des Schedules
  const allEntries = await query(
    `SELECT se.*, t.code as trade_code
     FROM schedule_entries se
     JOIN trades t ON se.trade_id = t.id
     WHERE se.schedule_id = $1
     ORDER BY se.planned_start`,
    [scheduleId]
  );
  
  const entries = allEntries.rows;
  const availableTrades = new Set(entries.map(e => e.trade_code));
  
  console.log('[DEPS] Available trades:', Array.from(availableTrades));
  
  // 2. KRITISCHE DEPENDENCY-REGELN (nur wenn beide Gewerke vorhanden)
  const criticalRules = {
    // FASS muss nach FEN (wenn beide vorhanden)
    'FASS': {
      mustHaveIfExists: ['FEN'],
      reason: 'WDVS braucht fertige Fenster',
      severity: 'CRITICAL'
    },
    
    // BOD muss nach MAL (wenn beide vorhanden)
    'BOD': {
      mustHaveIfExists: ['MAL'],
      reason: 'Boden nach Malerarbeiten (Farbspritzer vermeiden)',
      severity: 'CRITICAL'
    },
    
    // TRO muss nach allen Rohinstallationen (wenn vorhanden)
    'TRO': {
      mustHaveIfExists: ['ELEKT', 'SAN', 'HEI'],
      phasePattern: 'Rohinstallation',
      reason: 'Wände erst schließen wenn Leitungen verlegt',
      severity: 'CRITICAL'
    },
    
    // ESTR muss nach allen Rohinstallationen (wenn vorhanden)
    'ESTR': {
      mustHaveIfExists: ['ELEKT', 'SAN', 'HEI'],
      phasePattern: 'Rohinstallation',
      reason: 'Estrich nach allen Leitungen',
      severity: 'CRITICAL'
    },
    
    // Feininstallationen nach MAL (wenn beide vorhanden)
    'ELEKT-Fein': {
      tradeCode: 'ELEKT',
      phasePattern: 'Feininstallation',
      mustHaveIfExists: ['MAL'],
      reason: 'Schalter/Steckdosen nach Malerarbeiten',
      severity: 'WARNING'
    },
    'SAN-Fein': {
      tradeCode: 'SAN',
      phasePattern: 'Feininstallation',
      mustHaveIfExists: ['MAL', 'FLI'],
      reason: 'Sanitärobjekte auf Fliesen, nach Malerarbeiten',
      severity: 'WARNING'
    },
    'HEI-Fein': {
      tradeCode: 'HEI',
      phasePattern: 'Feininstallation',
      mustHaveIfExists: ['MAL'],
      reason: 'Heizkörper nach Malerarbeiten',
      severity: 'WARNING'
    }
  };
  
  // 3. Durchlaufe alle Entries und validiere/fixe Dependencies
  for (const entry of entries) {
    let deps = [];
    
    try {
      deps = typeof entry.dependencies === 'string' 
        ? JSON.parse(entry.dependencies) 
        : (entry.dependencies || []);
    } catch {
      deps = [];
    }
    
    const originalDeps = [...deps];
    let changed = false;
    
    // ================================================================
    // STEP 1: ENTFERNE DEPENDENCIES AUF NICHT-VORHANDENE GEWERKE
    // ================================================================
    const validDeps = deps.filter(dep => {
      // Format: "DACH" oder "DACH-Eindeckung"
      const tradeCode = dep.includes('-') ? dep.split('-')[0] : dep;
      
      if (!availableTrades.has(tradeCode)) {
        console.log(`[DEPS-REMOVE] ${entry.trade_code} ${entry.phase_name}: Entferne "${dep}" (Gewerk nicht vorhanden)`);
        changed = true;
        return false;
      }
      return true;
    });
    
    deps = validDeps;
    
    // ================================================================
    // STEP 2: FÜGE KRITISCHE FEHLENDE DEPENDENCIES HINZU
    // ================================================================
    for (const [ruleKey, rule] of Object.entries(criticalRules)) {
      // Prüfe ob Regel für diesen Entry gilt
      const isMatch = 
        (rule.tradeCode && rule.tradeCode === entry.trade_code && 
         (!rule.phasePattern || entry.phase_name.includes(rule.phasePattern))) ||
        (!rule.tradeCode && ruleKey === entry.trade_code);
      
      if (!isMatch) continue;
      
      // Prüfe jede Required Dependency
      for (const requiredTrade of rule.mustHaveIfExists) {
        // Nur hinzufügen wenn Gewerk vorhanden UND noch nicht in Dependencies
        if (availableTrades.has(requiredTrade) && !deps.includes(requiredTrade)) {
          
          // Bei Rohinstallationen: Prüfe ob Phase-spezifisch
          if (rule.phasePattern === 'Rohinstallation') {
            const hasRohPhase = entries.some(e => 
              e.trade_code === requiredTrade && 
              e.phase_name.toLowerCase().includes('rohinstallation')
            );
            
            if (hasRohPhase) {
              deps.push(requiredTrade);
              console.log(`[DEPS-ADD-${rule.severity}] ${entry.trade_code} ${entry.phase_name}: Füge "${requiredTrade}" hinzu (${rule.reason})`);
              changed = true;
            }
          } else {
            deps.push(requiredTrade);
            console.log(`[DEPS-ADD-${rule.severity}] ${entry.trade_code} ${entry.phase_name}: Füge "${requiredTrade}" hinzu (${rule.reason})`);
            changed = true;
          }
        }
      }
    }
    
    // ================================================================
    // STEP 3: UPDATE IN DATENBANK (wenn geändert)
    // ================================================================
    if (changed) {
      await query(
        `UPDATE schedule_entries 
         SET dependencies = $2
         WHERE id = $1`,
        [entry.id, JSON.stringify(deps)]
      );
      
      console.log(`[DEPS-UPDATED] ${entry.trade_code} ${entry.phase_name}:`, {
        old: originalDeps,
        new: deps
      });
    }
  }
  
  // ================================================================
  // STEP 4: VALIDIERUNGS-REPORT
  // ================================================================
  console.log('[DEPS] Validation complete. Checking for issues...');
  
  const issues = [];
  
  // Check 1: FASS ohne FEN (wenn beide vorhanden)
  if (availableTrades.has('FASS') && availableTrades.has('FEN')) {
    const fassEntry = entries.find(e => e.trade_code === 'FASS');
    if (fassEntry) {
      const deps = JSON.parse(fassEntry.dependencies || '[]');
      if (!deps.includes('FEN')) {
        issues.push({
          severity: 'CRITICAL',
          trade: 'FASS',
          message: 'FASS ohne FEN dependency (WDVS braucht fertige Fenster!)'
        });
      }
    }
  }
  
  // Check 2: BOD ohne MAL (wenn beide vorhanden)
  if (availableTrades.has('BOD') && availableTrades.has('MAL')) {
    const bodEntry = entries.find(e => e.trade_code === 'BOD');
    if (bodEntry) {
      const deps = JSON.parse(bodEntry.dependencies || '[]');
      if (!deps.includes('MAL')) {
        issues.push({
          severity: 'CRITICAL',
          trade: 'BOD',
          message: 'BOD ohne MAL dependency (Farbspritzer auf neuem Boden!)'
        });
      }
    }
  }
  
  // Check 3: Feininstallationen ohne MAL (wenn beide vorhanden)
  ['ELEKT', 'SAN', 'HEI'].forEach(trade => {
    if (availableTrades.has(trade) && availableTrades.has('MAL')) {
      const feinEntry = entries.find(e => 
        e.trade_code === trade && 
        e.phase_name.toLowerCase().includes('feininstallation')
      );
      if (feinEntry) {
        const deps = JSON.parse(feinEntry.dependencies || '[]');
        if (!deps.includes('MAL')) {
          issues.push({
            severity: 'WARNING',
            trade: trade,
            message: `${trade} Feininstallation ohne MAL dependency`
          });
        }
      }
    }
  });
  
  // Logge Issues
  if (issues.length > 0) {
    console.log('[DEPS] ⚠️  Found', issues.length, 'issues:');
    issues.forEach(issue => {
      console.log(`[DEPS-${issue.severity}] ${issue.trade}: ${issue.message}`);
    });
  } else {
    console.log('[DEPS] ✅ No critical issues found');
  }
  
  return {
    success: true,
    issuesFound: issues.length,
    issues: issues
  };
}

module.exports = { validateAndFixDependencies };
