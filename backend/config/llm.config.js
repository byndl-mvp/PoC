const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const OpenAI = require("openai");
const Anthropic = require("@anthropic-ai/sdk");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL_OPENAI = process.env.MODEL_OPENAI || 'gpt-4.1-mini';
const MODEL_ANTHROPIC = process.env.MODEL_ANTHROPIC || 'claude-sonnet-4-20250514';

module.exports = {
  openai,
  anthropic,
  MODEL_OPENAI,
  MODEL_ANTHROPIC
};
