/*
 * BYNDL Proof of Concept – Backend v4.0
 *
 * HAUPTVERBESSERUNGEN:
 * - Intelligente Fragenanzahl basierend auf Gewerke-Komplexität
 * - Detaillierte Mengenerfassung mit Validierung
 * - Keine erfundenen LV-Positionen - nur explizit erfragte
 * - Laienverständliche Fragen mit Erläuterungen
 * - Intelligente Schätzlogik bei unsicheren Angaben
 * - Realistische Preiskalkulationen
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ===========================================================================
// EXPRESS APP SETUP
// ===========================================================================

const app = express();

// CORS Configuration
const allowedOrigins = [
  'https://byndl-poc.netlify.app',
  'https://byndl.de',
  'http://localhost:3000',
  'http://localhost:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(bodyParser.json());

// ===========================================================================
// ROUTE IMPORTS
// ===========================================================================

const projectRoutes = require('./routes/projects.routes');
const intakeRoutes = require('./routes/intake.routes');
const tradeRoutes = require('./routes/trades.routes');
const questionRoutes = require('./routes/questions.routes');
const answerRoutes = require('./routes/answers.routes');
const lvRoutes = require('./routes/lv.routes');
const promptRoutes = require('./routes/prompts.routes');
const adminRoutes = require('./routes/admin.routes');
const testRoutes = require('./routes/test.routes');

// ===========================================================================
// ROUTE MOUNTING
// ===========================================================================

// Test & Health Check Routes (Root level)
app.use('/', testRoutes);

// API Routes
app.use('/api', testRoutes);                    // Test endpoints unter /api
app.use('/api/projects', projectRoutes);        // Project CRUD
app.use('/api/projects', intakeRoutes);         // Intake unter projects
app.use('/api/projects', questionRoutes);       // Questions unter projects
app.use('/api/projects', answerRoutes);         // Answers unter projects
app.use('/api/projects', lvRoutes);             // LV unter projects
app.use('/api/trades', tradeRoutes);            // Trades listing
app.use('/api/projects', tradeRoutes);          // Trade management unter projects
app.use('/api/prompts', promptRoutes);          // Public prompt endpoints
app.use('/api/admin', adminRoutes);             // Admin endpoints

// ===========================================================================
// ERROR HANDLING
// ===========================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ===========================================================================
// SERVER START
// ===========================================================================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║                                        ║
║     BYNDL Backend v4.0                 ║
║     Intelligente LV-Erstellung         ║
║                                        ║
║     Port: ${PORT}                        ║
║     Environment: ${process.env.NODE_ENV || 'development'}          ║
║                                        ║
║     Features:                          ║
║     ✓ Adaptive Fragenanzahl           ║
║       (8-40 Fragen je nach Gewerk)    ║
║     ✓ Detaillierte Mengenerfassung    ║
║     ✓ Laienverständliche Fragen       ║
║     ✓ Intelligente Schätzlogik        ║
║     ✓ Realistische Preiskalkulation   ║
║     ✓ Datenqualitäts-Tracking         ║
║                                        ║
║     Gewerke-Komplexität:               ║
║     • Sehr hoch: DACH, ELEKT, SAN     ║
║     • Hoch: TIS, FEN, FASS            ║
║     • Mittel: FLI, ESTR, TRO          ║
║     • Einfach: MAL, GER, ABBR         ║
║                                        ║
║     Routes:                            ║
║     • Projects: 4 endpoints            ║
║     • Intake: 3 endpoints              ║
║     • Trades: 3 endpoints              ║
║     • Questions: 3 endpoints           ║
║     • Answers: 1 endpoint              ║
║     • LV: 10 endpoints                 ║
║     • Prompts: 2 endpoints             ║
║     • Admin: 11 endpoints              ║
║     • Test/Debug: 8 endpoints          ║
║     Total: 45 endpoints                ║
║                                        ║
╚════════════════════════════════════════╝
  `);
});
