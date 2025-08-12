/**
 * Health Check Modul
 * 
 * Stellt Health-Check Endpunkte für Monitoring und Deployment bereit
 */

const llmProvider = require('./llm/provider');

/**
 * Health Check Handler
 * @param {Object} req - Express Request
 * @param {Object} res - Express Response
 */
function healthCheck(req, res) {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: require('../package.json').version,
    providers: llmProvider.getProviderInfo(),
  };

  // Prüfe kritische Services
  const issues = [];
  
  if (!llmProvider.isAvailable()) {
    issues.push('Kein LLM Provider verfügbar');
    health.status = 'degraded';
  }

  if (!process.env.DATABASE_URL) {
    issues.push('DATABASE_URL nicht gesetzt');
    health.status = 'degraded';
  }

  if (issues.length > 0) {
    health.issues = issues;
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
}

/**
 * Readiness Check Handler (für Kubernetes/Render)
 * @param {Object} req - Express Request
 * @param {Object} res - Express Response
 */
function readinessCheck(req, res) {
  // Prüfe, ob alle kritischen Services bereit sind
  const ready = llmProvider.isAvailable() && process.env.DATABASE_URL;
  
  if (ready) {
    res.status(200).json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready' });
  }
}

/**
 * Liveness Check Handler (für Kubernetes/Render)
 * @param {Object} req - Express Request
 * @param {Object} res - Express Response
 */
function livenessCheck(req, res) {
  // Einfacher Liveness-Check
  res.status(200).json({ status: 'alive' });
}

module.exports = {
  healthCheck,
  readinessCheck,
  livenessCheck,
};

