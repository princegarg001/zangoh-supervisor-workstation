const express = require('express');
const conversations = require('../services/conversations');
const agentRuntime = require('../services/agentRuntime');
const { asyncHandler, badRequest } = require('../middleware/errors');

const router = express.Router();

// POST /api/intervene { conversationId, supervisorId?, notes? } – supervisor takes over from the AI.
router.post('/', asyncHandler(async (req, res) => {
  const { conversationId, notes } = req.body || {};
  const supervisorId = (req.body || {}).supervisorId || req.supervisorId;
  if (!conversationId) throw badRequest('Conversation ID and supervisor ID are required');

  const intervention = await conversations.takeOver(conversationId, supervisorId, notes || '');
  res.json({ message: 'Intervention recorded', intervention });
}));

// POST /api/intervene/release { conversationId, supervisorNotes? } – hand control back to the AI.
router.post('/release', asyncHandler(async (req, res) => {
  const { conversationId, supervisorNotes } = req.body || {};
  if (!conversationId) throw badRequest('Conversation ID is required');

  const conversation = await conversations.release(conversationId, supervisorNotes || '', req.supervisorId);
  // If the customer is still waiting, the AI answers straight away using the guidance;
  // otherwise the guidance is applied to its next reply.
  agentRuntime.scheduleResponse(conversationId, 1200);
  res.json({ message: 'Intervention released, control returned to agent', conversation: conversations.summarize(conversation) });
}));

module.exports = router;
