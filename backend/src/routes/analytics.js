// Analytics computed from live conversation data with MongoDB aggregations.
const express = require('express');
const Conversation = require('../models/conversation');
const Agent = require('../models/agent');
const { asyncHandler } = require('../middleware/errors');

const router = express.Router();
const RANGE_DAYS = { today: 1, week: 7, month: 30, year: 365 };
const OPEN = ['active', 'waiting', 'escalated'];

const since = (range) => {
  const days = RANGE_DAYS[range] || RANGE_DAYS.week;
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return date;
};
const round = (v, digits = 2) => (typeof v === 'number' ? Number(v.toFixed(digits)) : 0);
const day = { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } };

const statsGroup = {
  total: { $sum: 1 },
  resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
  escalated: { $sum: { $cond: ['$humanIntervention.occurred', 1, 0] } },
  avgResponseTime: { $avg: '$metrics.responseTime' },
  avgSentiment: { $avg: '$metrics.sentiment' },
  avgConfidence: { $avg: '$metrics.confidenceScore' },
};

const shapeStats = (s = {}) => ({
  conversations: s.total || 0,
  resolutionRate: s.total ? round(s.resolved / s.total) : 0,
  escalationRate: s.total ? round(s.escalated / s.total) : 0,
  avgResponseTime: round(s.avgResponseTime, 1),
  avgSentiment: round(s.avgSentiment),
  avgConfidence: round(s.avgConfidence),
});

// Shared by GET /overview and the SSE /stream endpoint below, so both ever return
// the exact same shape computed the exact same way.
async function buildOverview(timeRange) {
  const match = { startTime: { $gte: since(timeRange) } };
  const [[totals], daily, activeConversations, openAlerts] = await Promise.all([
    Conversation.aggregate([{ $match: match }, { $group: { _id: null, ...statsGroup } }]),
    Conversation.aggregate([{ $match: match }, { $group: { _id: day, ...statsGroup } }, { $sort: { _id: 1 } }]),
    Conversation.countDocuments({ status: { $in: OPEN } }),
    Conversation.countDocuments({ status: { $in: OPEN }, alertLevel: 'high' }),
  ]);
  const stats = shapeStats(totals);

  return {
    activeConversations,
    openAlerts,
    ...stats,
    trends: {
      conversations: daily.map((d) => ({ date: d._id, count: d.total })),
      responseTime: daily.map((d) => ({ date: d._id, value: round(d.avgResponseTime, 1) })),
      sentiment: daily.map((d) => ({ date: d._id, value: round(d.avgSentiment) })),
      escalations: daily.map((d) => ({ date: d._id, value: d.total ? round(d.escalated / d.total) : 0 })),
    },
    generatedAt: new Date().toISOString(),
  };
}

// GET /api/analytics/overview?timeRange=today|week|month|year
router.get('/overview', asyncHandler(async (req, res) => {
  res.json(await buildOverview(req.query.timeRange));
}));

// GET /api/analytics/stream?timeRange=... — Server-Sent Events push of the same
// overview payload every 2s, so the dashboard's KPI tiles/trends update live
// without polling. Plain `text/event-stream`; the browser's EventSource handles
// reconnection automatically if the connection drops.
router.get('/stream', asyncHandler(async (req, res) => {
  const { timeRange } = req.query;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable proxy buffering (nginx) so events flush immediately
  });
  res.flushHeaders();

  let closed = false;
  const tick = async () => {
    if (closed) return;
    try {
      const payload = await buildOverview(timeRange);
      if (!closed) res.write(`event: overview\ndata: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      if (!closed) res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    }
  };

  await tick();
  const interval = setInterval(tick, 2000);

  req.on('close', () => {
    closed = true;
    clearInterval(interval);
  });
}));

// GET /api/analytics/agents?timeRange&agentId
router.get('/agents', asyncHandler(async (req, res) => {
  const match = { startTime: { $gte: since(req.query.timeRange) } };
  if (req.query.agentId) match['agent.id'] = req.query.agentId;

  const [agents, perAgent, daily] = await Promise.all([
    Agent.find(req.query.agentId ? { id: req.query.agentId } : {}).lean(),
    Conversation.aggregate([{ $match: match }, { $group: { _id: '$agent.id', ...statsGroup } }]),
    Conversation.aggregate([
      { $match: match },
      { $group: { _id: { date: day, agent: '$agent.id' }, count: { $sum: 1 }, rt: { $avg: '$metrics.responseTime' } } },
      { $sort: { '_id.date': 1 } },
    ]),
  ]);

  const statsById = Object.fromEntries(perAgent.map((s) => [s._id, shapeStats(s)]));
  const byDate = (field, fn) => {
    const rows = {};
    for (const d of daily) {
      rows[d._id.date] = rows[d._id.date] || { date: d._id.date };
      rows[d._id.date][d._id.agent] = fn(d);
    }
    return Object.values(rows);
  };

  res.json({
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      model: a.model,
      status: a.status,
      ...shapeStats(),
      ...statsById[a.id],
      topIssues: a.metrics?.topIssues || [],
    })),
    trends: {
      conversations: byDate('count', (d) => d.count),
      responseTime: byDate('rt', (d) => round(d.rt, 1)),
    },
  });
}));

// GET /api/analytics/issues?timeRange – issue categories derived from conversation tags.
router.get('/issues', asyncHandler(async (req, res) => {
  const match = { startTime: { $gte: since(req.query.timeRange) } };
  const [tags, [{ total } = { total: 0 }]] = await Promise.all([
    Conversation.aggregate([
      { $match: match },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 }, avgSentiment: { $avg: '$metrics.sentiment' } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Conversation.aggregate([{ $match: match }, { $count: 'total' }]),
  ]);

  res.json({
    total,
    topIssues: tags.map((t) => ({
      name: t._id,
      count: t.count,
      percentage: total ? round((t.count / total) * 100, 1) : 0,
      avgSentiment: round(t.avgSentiment),
    })),
  });
}));

module.exports = router;
