const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Render-Postgres verlangt SSL
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { query };
