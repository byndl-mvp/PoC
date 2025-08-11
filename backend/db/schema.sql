-- BYNDL database schema
--
-- This SQL script defines the tables required for the BYNDL proof of concept.
-- It should be executed on a PostgreSQL database. Adjust types or defaults
-- based on your deployment environment. The primary key of each table is
-- defined as a serial integer for simplicity. In production you might want
-- to use UUIDs.

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  sub_category TEXT,
  description TEXT NOT NULL,
  timeframe TEXT,
  budget NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  trade_id INTEGER NOT NULL REFERENCES trades (id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (trade_id, question_id)
);

CREATE TABLE IF NOT EXISTS answers (
  id SERIAL PRIMARY KEY,
  question_db_id INTEGER NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  assumption TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lvs (
  id SERIAL PRIMARY KEY,
  trade_id INTEGER NOT NULL REFERENCES trades (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects (id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);