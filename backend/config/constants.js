// ===========================================================================
// GEWERKE-KOMPLEXITÄT DEFINITIONEN (KORREKTE CODES)
// ===========================================================================

const TRADE_COMPLEXITY = {
  // Sehr komplexe Gewerke (25-40 Fragen)
  'DACH': { complexity: 'SEHR_HOCH', minQuestions: 18, maxQuestions: 28 },
  'ELEKT': { complexity: 'SEHR_HOCH', minQuestions: 15, maxQuestions: 25 },
  'SAN': { complexity: 'SEHR_HOCH', minQuestions: 15, maxQuestions: 25 },
  'HEI': { complexity: 'SEHR_HOCH', minQuestions: 15, maxQuestions: 26 },
  'KLIMA': { complexity: 'SEHR_HOCH', minQuestions: 15, maxQuestions: 25 },
  'ROH': { complexity: 'HOCH', minQuestions: 18, maxQuestions: 28 },
  
  // Komplexe Gewerke (20-30 Fragen)
  'TIS': { complexity: 'HOCH', minQuestions: 15, maxQuestions: 20 },
  'FEN': { complexity: 'HOCH', minQuestions: 18, maxQuestions: 22 },
  'FASS': { complexity: 'HOCH', minQuestions: 18, maxQuestions: 22 },
  'SCHL': { complexity: 'HOCH', minQuestions: 15, maxQuestions: 20 },
  'PV': { complexity: 'HOCH', minQuestions: 15, maxQuestions: 22 },
  
  // Mittlere Komplexität (15-25 Fragen)
  'FLI': { complexity: 'MITTEL', minQuestions: 15, maxQuestions: 20 },
  'ESTR': { complexity: 'MITTEL', minQuestions: 12, maxQuestions: 17 },
  'TRO': { complexity: 'MITTEL', minQuestions: 15, maxQuestions: 20 },
  'BOD': { complexity: 'MITTEL', minQuestions: 15, maxQuestions: 20 },
  'AUSS': { complexity: 'MITTEL', minQuestions: 15, maxQuestions: 20 },
  
  // Einfache Gewerke (8-15 Fragen)
  'MAL': { complexity: 'EINFACH', minQuestions: 8, maxQuestions: 15 },
  'GER': { complexity: 'EINFACH', minQuestions: 8, maxQuestions: 12 },
  'ABBR': { complexity: 'EINFACH', minQuestions: 10, maxQuestions: 15 },
  
  // Intake ist speziell (12-20 Fragen)
  'INT': { complexity: 'INTAKE', minQuestions: 16, maxQuestions: 24 }
};

// Fallback für nicht definierte Gewerke
const DEFAULT_COMPLEXITY = { complexity: 'MITTEL', minQuestions: 14, maxQuestions: 22 };

module.exports = {
  TRADE_COMPLEXITY,
  DEFAULT_COMPLEXITY
};
