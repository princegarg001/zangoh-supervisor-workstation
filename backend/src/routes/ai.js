// Mock LLM (/api/llm) and vector search (/api/vector) endpoints from the API documentation.
const express = require('express');
const llm = require('../services/llm');
const knowledge = require('../services/knowledge');
const { analyzeSentiment } = require('../services/sentiment');
const { asyncHandler, badRequest, notFound } = require('../middleware/errors');

const llmRouter = express.Router();
const vectorRouter = express.Router();

// POST /api/llm/generate { messages: [{role, content}], parameters, capabilities: [ids], knowledgeBases: [ids], guidance? }
llmRouter.post('/generate', asyncHandler(async (req, res) => {
  const { messages, parameters, capabilities = [], knowledgeBases = [], guidance } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) throw badRequest('messages array is required');

  const started = Date.now();
  const result = await llm.generateReply({
    agent: {
      parameters,
      capabilities: capabilities.map((id) => ({ id, enabled: true })),
      knowledgeBases: knowledgeBases.map((id) => ({ id, enabled: true })),
    },
    messages: messages.map((m) => ({ sender: m.role || m.sender, text: m.content || m.text })),
    guidance,
  });
  res.json({ ...result, metrics: { ...result.metrics, responseTime: (Date.now() - started) / 1000 } });
}));

llmRouter.post('/sentiment', asyncHandler(async (req, res) => {
  const { text } = req.body || {};
  if (!text) throw badRequest('text is required');
  const { score, ...analysis } = analyzeSentiment(text);
  res.json({ sentiment: score, analysis });
}));

// POST /api/vector/search { query, knowledgeBases?, limit? }
vectorRouter.post('/search', asyncHandler(async (req, res) => {
  const { query, knowledgeBases = [], limit = 3 } = req.body || {};
  if (!query) throw badRequest('query is required');
  const results = await knowledge.search(query, knowledgeBases, Math.min(10, Number(limit) || 3));
  res.json({ results, backend: knowledge.backend() });
}));

vectorRouter.get('/kb/:id', (req, res) => {
  const document = knowledge.getDocument(req.params.id);
  if (!document) throw notFound('Knowledge base content not found');
  res.json(document);
});

module.exports = { llmRouter, vectorRouter };
