const express = require('express');
const Conversation = require('../models/conversation');
const conversations = require('../services/conversations');
const agentRuntime = require('../services/agentRuntime');
const { asyncHandler, badRequest } = require('../middleware/errors');

const router = express.Router();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const csv = (value) => String(value).split(',').map((v) => v.trim()).filter(Boolean);

// GET /api/conversations?page&limit&status&alertLevel&agentId&search&control=human|ai
router.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const { status, alertLevel, agentId, search, control } = req.query;

  const filter = {};
  if (status) filter.status = { $in: csv(status) };
  if (alertLevel) filter.alertLevel = { $in: csv(alertLevel) };
  if (agentId) filter['agent.id'] = { $in: csv(agentId) };
  if (control === 'human') filter['humanIntervention.active'] = true;
  if (control === 'ai') filter['humanIntervention.active'] = { $ne: true };
  if (search) {
    const pattern = new RegExp(escapeRegex(String(search)), 'i');
    filter.$or = [{ 'customer.name': pattern }, { tags: pattern }, { id: pattern }];
  }

  const [data, total] = await Promise.all([
    Conversation.find(filter).sort({ startTime: -1 }).skip((page - 1) * limit).limit(limit),
    Conversation.countDocuments(filter),
  ]);
  res.json({ data, pagination: { total, page, pages: Math.ceil(total / limit), limit } });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json(await conversations.findOrThrow(req.params.id));
}));

// POST /api/conversations/:id/messages { sender, text, templateId? }
router.post('/:id/messages', asyncHandler(async (req, res) => {
  const { sender, text, templateId } = req.body || {};
  const message = await conversations.addMessage(req.params.id, { sender, text, templateId, supervisorId: req.supervisorId });
  // A customer message gets an AI reply unless a supervisor holds the conversation.
  if (sender === 'customer') agentRuntime.scheduleResponse(req.params.id);
  res.status(201).json(message);
}));

router.patch('/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!status) throw badRequest('Status is required');
  await conversations.updateStatus(req.params.id, status);
  res.json({ message: 'Status updated', status });
}));

router.post('/:id/tags', asyncHandler(async (req, res) => {
  const tags = await conversations.addTags(req.params.id, (req.body || {}).tags);
  res.json({ message: 'Tags added', tags });
}));

// Supervisor feedback on the AI agent's handling of this conversation.
router.post('/:id/feedback', asyncHandler(async (req, res) => {
  const feedback = await conversations.addFeedback(req.params.id, req.body || {}, req.supervisorId);
  res.status(201).json({ message: 'Feedback recorded', feedback });
}));

module.exports = router;
