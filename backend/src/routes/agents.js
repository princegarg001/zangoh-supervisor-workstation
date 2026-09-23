const express = require('express');
const Agent = require('../models/agent');
const Conversation = require('../models/conversation');
const eventBus = require('../realtime/eventBus');
const conversations = require('../services/conversations');
const { asyncHandler, badRequest, notFound } = require('../middleware/errors');

const router = express.Router();

const RANGES = {
  'parameters.temperature': [0, 1],
  'parameters.top_p': [0, 1],
  'parameters.max_tokens': [16, 4096],
  'escalationThresholds.lowConfidence': [0, 1],
  'escalationThresholds.negativeSentiment': [0, 1],
  'escalationThresholds.responseTime': [1, 600],
};

/** Flattens and validates a config patch into dotted `$set` paths. */
function buildConfigUpdate(body, agent) {
  const errors = [];
  const set = {};

  for (const group of ['parameters', 'escalationThresholds']) {
    for (const [key, value] of Object.entries(body[group] || {})) {
      const path = `${group}.${key}`;
      if (!RANGES[path]) { errors.push(`Unknown field ${path}`); continue; }
      const [min, max] = RANGES[path];
      if (typeof value !== 'number' || Number.isNaN(value) || value < min || value > max) {
        errors.push(`${path} must be a number between ${min} and ${max}`);
        continue;
      }
      set[path] = key === 'max_tokens' ? Math.round(value) : value;
    }
  }

  for (const group of ['capabilities', 'knowledgeBases']) {
    if (!body[group]) continue;
    if (!Array.isArray(body[group])) { errors.push(`${group} must be an array`); continue; }
    body[group].forEach((item) => {
      const index = agent[group].findIndex((existing) => existing.id === item.id);
      if (index === -1) errors.push(`Unknown ${group} id: ${item.id}`);
      else if (typeof item.enabled !== 'boolean') errors.push(`${group}.${item.id}.enabled must be boolean`);
      else set[`${group}.${index}.enabled`] = item.enabled;
    });
  }

  if (body.status !== undefined) {
    if (!['active', 'inactive', 'maintenance'].includes(body.status)) errors.push('status must be active, inactive or maintenance');
    else set.status = body.status;
  }

  if (errors.length) throw badRequest('Invalid agent configuration', errors);
  return set;
}

router.get('/', asyncHandler(async (req, res) => {
  res.json(await Agent.find().sort({ id: 1 }));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const agent = await Agent.findOne({ id: req.params.id });
  if (!agent) throw notFound('Agent not found');
  res.json(agent);
}));

// PATCH /api/agents/:id/config – partial update of parameters, toggles, thresholds and status.
router.patch('/:id/config', asyncHandler(async (req, res) => {
  const agent = await Agent.findOne({ id: req.params.id });
  if (!agent) throw notFound('Agent not found');

  const set = buildConfigUpdate(req.body || {}, agent);
  const updated = Object.keys(set).length
    ? await Agent.findOneAndUpdate({ id: req.params.id }, { $set: set }, { new: true, runValidators: true })
    : agent;

  eventBus.publish('agent_update', { agentId: updated.id, data: updated.toJSON() });
  // New thresholds apply immediately to the agent's live conversations.
  if (Object.keys(set).some((path) => path.startsWith('escalationThresholds'))) {
    await conversations.reevaluateForAgent(updated.id);
  }
  res.json({ message: 'Agent configuration updated', agent: updated });
}));

// GET /api/agents/:id/metrics – baseline metrics blended with live conversation data.
router.get('/:id/metrics', asyncHandler(async (req, res) => {
  const agent = await Agent.findOne({ id: req.params.id }).lean();
  if (!agent) throw notFound('Agent not found');

  const [live] = await Conversation.aggregate([
    { $match: { 'agent.id': agent.id } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        escalated: { $sum: { $cond: ['$humanIntervention.occurred', 1, 0] } },
        avgResponseTime: { $avg: '$metrics.responseTime' },
        avgSentiment: { $avg: '$metrics.sentiment' },
        avgConfidence: { $avg: '$metrics.confidenceScore' },
      },
    },
  ]);

  const base = agent.metrics || {};
  res.json({
    conversations: base.conversations || 0,
    avgResponseTime: base.avgResponseTime || 0,
    satisfaction: base.satisfaction || 0,
    escalationRate: base.escalationRate || 0,
    topIssues: base.topIssues || [],
    live: live
      ? {
          conversations: live.total,
          resolutionRate: round(live.resolved / live.total),
          escalationRate: round(live.escalated / live.total),
          avgResponseTime: round(live.avgResponseTime, 1),
          avgSentiment: round(live.avgSentiment),
          avgConfidence: round(live.avgConfidence),
        }
      : null,
  });
}));

const round = (v, digits = 2) => (typeof v === 'number' ? Number(v.toFixed(digits)) : 0);

module.exports = router;
