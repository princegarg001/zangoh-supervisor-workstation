// Conversation domain service – the single place where conversation state changes.
// Used by the REST routes and the simulator alike, so every change is persisted
// atomically, alert-evaluated and broadcast the same way.

const Conversation = require('../models/conversation');
const Agent = require('../models/agent');
const ResponseTemplate = require('../models/responseTemplate');
const eventBus = require('../realtime/eventBus');
const { evaluateAlerts } = require('./alerts');
const { analyzeSentiment } = require('./sentiment');
const { notFound, conflict, badRequest } = require('../middleware/errors');

const OPEN_STATUSES = ['active', 'waiting', 'escalated'];
const SENTIMENT_SMOOTHING = 0.5; // weight of the newest customer message

/** Lightweight projection sent over WebSocket and used by list views. */
function summarize(conversation) {
  const c = typeof conversation.toJSON === 'function' ? conversation.toJSON() : conversation;
  const messages = c.messages || [];
  return {
    id: c.id,
    customer: c.customer,
    agent: c.agent,
    status: c.status,
    alertLevel: c.alertLevel,
    alertReasons: c.alertReasons || [],
    startTime: c.startTime,
    endTime: c.endTime,
    lastActivityAt: c.lastActivityAt,
    metrics: c.metrics,
    tags: c.tags || [],
    humanIntervention: c.humanIntervention,
    messageCount: messages.length,
    lastMessage: messages[messages.length - 1] || null,
  };
}

async function findOrThrow(id) {
  const conversation = await Conversation.findOne({ id });
  if (!conversation) throw notFound('Conversation not found');
  return conversation;
}

async function thresholdsFor(agentId) {
  const agent = await Agent.findOne({ id: agentId }, { escalationThresholds: 1 }).lean();
  return agent?.escalationThresholds || {};
}

/**
 * Re-evaluates alerts for a freshly updated conversation, persists changes, and
 * publishes the resulting events. Emits an `alert` event when the level rises to high.
 */
async function commit(conversation, previousLevel) {
  const { alertLevel, alertReasons } = evaluateAlerts(conversation, await thresholdsFor(conversation.agent?.id));
  const reasonsChanged = alertReasons.join() !== (conversation.alertReasons || []).join();
  if (alertLevel !== conversation.alertLevel || reasonsChanged) {
    conversation = await Conversation.findOneAndUpdate(
      { id: conversation.id },
      { $set: { alertLevel, alertReasons } },
      { new: true }
    );
  }

  const summary = summarize(conversation);
  eventBus.publish('conversation_updated', { data: summary });
  if (alertLevel === 'high' && previousLevel !== 'high') {
    eventBus.publish('alert', {
      conversationId: conversation.id,
      agentId: conversation.agent?.id,
      alertLevel,
      reasons: alertReasons,
      customerName: conversation.customer?.name,
    });
  }
  return conversation;
}

/**
 * Appends a message. Customer messages update smoothed sentiment; agent messages
 * carry the LLM's metrics (response time / confidence).
 */
async function addMessage(id, { sender, text, supervisorId, templateId }, agentMetrics) {
  if (!sender || !text || !String(text).trim()) throw badRequest('Sender and text are required');
  if (!Conversation.SENDERS.includes(sender)) throw badRequest(`sender must be one of: ${Conversation.SENDERS.join(', ')}`);

  const current = await findOrThrow(id);
  const message = { sender, text: String(text).trim(), timestamp: new Date() };
  if (supervisorId && sender === 'supervisor') message.supervisorId = supervisorId;

  if (templateId) {
    const template = await ResponseTemplate.findOneAndUpdate(
      { id: templateId },
      { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } },
      { new: true }
    );
    if (template) message.template = { id: template.id, name: template.name };
  }

  const set = { lastActivityAt: message.timestamp };
  if (sender === 'customer') {
    const { score } = analyzeSentiment(message.text);
    const previous = current.metrics?.sentiment ?? 0.5;
    set['metrics.sentiment'] = Number((previous * (1 - SENTIMENT_SMOOTHING) + score * SENTIMENT_SMOOTHING).toFixed(2));
    if (current.status === 'resolved') set.status = 'active'; // customer re-opened the thread
  }
  if (sender === 'agent' && agentMetrics) {
    set['metrics.responseTime'] = agentMetrics.responseTime;
    set['metrics.confidenceScore'] = agentMetrics.confidenceScore;
  }

  const updated = await Conversation.findOneAndUpdate({ id }, { $push: { messages: message }, $set: set }, { new: true });
  const saved = updated.messages[updated.messages.length - 1];

  eventBus.publish('message_update', { conversationId: id, agentId: updated.agent?.id, message: saved.toJSON() });
  if (sender === 'customer' || sender === 'agent') {
    eventBus.publish('metrics_update', { conversationId: id, agentId: updated.agent?.id, metrics: updated.metrics });
  }
  await commit(updated, current.alertLevel);
  return saved.toJSON();
}

async function systemNote(id, text) {
  return Conversation.findOneAndUpdate(
    { id },
    { $push: { messages: { sender: 'system', text, timestamp: new Date() } } },
    { new: true }
  );
}

/** Supervisor assumes control. Idempotent for the same supervisor, 409 for another. */
async function takeOver(id, supervisorId, notes = '') {
  if (!supervisorId) throw badRequest('supervisorId is required');
  const current = await findOrThrow(id);
  const hi = current.humanIntervention || {};
  if (hi.active && hi.supervisorId !== supervisorId) {
    throw conflict(`Conversation is already controlled by ${hi.supervisorId}`);
  }
  if (hi.active) return current.humanIntervention;

  const now = new Date();
  const updated = await Conversation.findOneAndUpdate(
    // Guard against a concurrent take-over between the read above and this write.
    { id, 'humanIntervention.active': { $ne: true } },
    {
      $set: {
        humanIntervention: { occurred: true, active: true, supervisorId, timestamp: now, notes },
        status: 'escalated',
        lastActivityAt: now,
      },
      $push: {
        interventions: { supervisorId, startedAt: now, takeoverNotes: notes },
        messages: { sender: 'system', text: `Supervisor ${supervisorId} took over the conversation.`, timestamp: now },
      },
    },
    { new: true }
  );
  if (!updated) throw conflict('Conversation was taken over by another supervisor');
  await commit(updated, current.alertLevel);
  return updated.humanIntervention;
}

/** Returns control to the AI with guidance notes that shape its next reply. */
async function release(id, supervisorNotes = '', supervisorId) {
  const current = await findOrThrow(id);
  if (!current.humanIntervention?.occurred) throw badRequest('No active intervention to release');
  if (!current.humanIntervention.active) return current; // already with the AI – idempotent

  const now = new Date();
  const lastIndex = current.interventions.length - 1;
  const set = {
    'humanIntervention.active': false,
    status: 'active',
    lastActivityAt: now,
    ...(supervisorNotes && { supervisorNotes, pendingGuidance: supervisorNotes }),
    ...(lastIndex >= 0 && {
      [`interventions.${lastIndex}.endedAt`]: now,
      [`interventions.${lastIndex}.returnNotes`]: supervisorNotes,
    }),
  };
  const note = supervisorNotes
    ? `Control returned to AI by ${supervisorId || current.humanIntervention.supervisorId}. Guidance: ${supervisorNotes}`
    : `Control returned to AI by ${supervisorId || current.humanIntervention.supervisorId}.`;

  const updated = await Conversation.findOneAndUpdate(
    { id },
    { $set: set, $push: { messages: { sender: 'system', text: note, timestamp: now } } },
    { new: true }
  );
  return commit(updated, current.alertLevel);
}

async function updateStatus(id, status) {
  if (!Conversation.STATUSES.includes(status)) throw badRequest(`status must be one of: ${Conversation.STATUSES.join(', ')}`);
  const current = await findOrThrow(id);
  const now = new Date();
  const set = { status, lastActivityAt: now };
  if (status === 'resolved') {
    set.endTime = now;
    set['humanIntervention.active'] = false; // resolving ends any takeover
  } else {
    set.endTime = null;
  }
  const updated = await Conversation.findOneAndUpdate(
    { id },
    { $set: set, $push: { messages: { sender: 'system', text: `Conversation marked as ${status}.`, timestamp: now } } },
    { new: true }
  );
  return commit(updated, current.alertLevel);
}

async function addTags(id, tags) {
  if (!Array.isArray(tags) || !tags.length) throw badRequest('Tags array is required');
  const clean = tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  await findOrThrow(id);
  const updated = await Conversation.findOneAndUpdate({ id }, { $addToSet: { tags: { $each: clean } } }, { new: true });
  eventBus.publish('conversation_updated', { data: summarize(updated) });
  return updated.tags;
}

async function addFeedback(id, { rating, comment }, supervisorId) {
  const value = Number(rating);
  if (!Number.isInteger(value) || value < 1 || value > 5) throw badRequest('rating must be an integer between 1 and 5');
  await findOrThrow(id);
  const entry = { supervisorId, rating: value, comment: comment ? String(comment).slice(0, 1000) : undefined, createdAt: new Date() };
  const updated = await Conversation.findOneAndUpdate({ id }, { $push: { feedback: entry } }, { new: true });
  return updated.feedback[updated.feedback.length - 1];
}

/** Re-applies alert rules to an agent's open conversations (e.g. after threshold changes). */
async function reevaluateForAgent(agentId) {
  const conversations = await Conversation.find({ 'agent.id': agentId, status: { $in: OPEN_STATUSES } });
  for (const conversation of conversations) await commit(conversation, conversation.alertLevel);
}

module.exports = {
  OPEN_STATUSES,
  summarize,
  findOrThrow,
  addMessage,
  systemNote,
  takeOver,
  release,
  updateStatus,
  addTags,
  addFeedback,
  reevaluateForAgent,
};
