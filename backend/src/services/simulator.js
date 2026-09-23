// Customer traffic simulator. A single server-wide loop (not one per WebSocket
// client) that writes real data through the conversation service, so every
// supervisor sees the same consistent, persisted state.

const Conversation = require('../models/conversation');
const Agent = require('../models/agent');
const conversations = require('./conversations');
const agentRuntime = require('./agentRuntime');
const eventBus = require('../realtime/eventBus');
const { SCENARIOS, FOLLOW_UPS, NAMES } = require('../seed/scenarios');

const pick = (list) => list[Math.floor(Math.random() * list.length)];
let timer = null;

async function tick(maxOpen) {
  const open = await Conversation.find({ status: { $in: conversations.OPEN_STATUSES } }, { id: 1, tags: 1, metrics: 1, humanIntervention: 1, lastActivityAt: 1 }).lean();

  // 1. Occasionally start a brand-new conversation.
  if (open.length < maxOpen && Math.random() < 0.3) return startConversation();

  // 2. Occasionally wrap up a happy conversation the AI is handling.
  const happy = open.filter((c) => !c.humanIntervention?.active && (c.metrics?.sentiment ?? 0) > 0.7);
  if (happy.length && (open.length >= maxOpen || Math.random() < 0.12)) {
    const conversation = pick(happy);
    await conversations.addMessage(conversation.id, { sender: 'customer', text: pick(FOLLOW_UPS.closing) });
    return conversations.updateStatus(conversation.id, 'resolved');
  }

  // 3. Otherwise a customer in an open conversation writes again.
  if (!open.length) return startConversation();
  const conversation = pick(open);
  const scenario = SCENARIOS.find((s) => (conversation.tags || []).includes(s.tag));
  const mood = (conversation.metrics?.sentiment ?? 0.5) < 0.4 ? 'negative' : Math.random() < 0.3 ? 'negative' : 'positive';
  const pool = scenario?.followUps?.[mood] || FOLLOW_UPS[mood];
  await conversations.addMessage(conversation.id, { sender: 'customer', text: pick(pool) });
  agentRuntime.scheduleResponse(conversation.id);
  return null;
}

async function startConversation() {
  const agents = await Agent.find({ status: 'active' }).lean();
  if (!agents.length) return null;
  const scenario = pick(SCENARIOS);
  const agent = agents.find((a) => a.id === scenario.agentId) || pick(agents);
  const name = pick(NAMES);
  const now = new Date();

  const conversation = await Conversation.create({
    id: `conv-${now.getTime().toString(36)}`,
    customer: {
      id: `cust-${1000 + Math.floor(Math.random() * 9000)}`,
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      tier: pick(['Standard', 'Standard', 'Gold', 'Platinum']),
    },
    agent: { id: agent.id, name: agent.name },
    status: 'active',
    startTime: now,
    lastActivityAt: now,
    metrics: { sentiment: 0.6, responseTime: 0, confidenceScore: 0.85 },
    tags: [scenario.tag, ...(scenario.extraTags || [])],
    messages: [],
  });
  eventBus.publish('new_conversation', { data: conversations.summarize(conversation) });
  await conversations.addMessage(conversation.id, { sender: 'customer', text: pick(scenario.openers) });
  agentRuntime.scheduleResponse(conversation.id);
  return conversation;
}

function start({ tickMs, maxOpenConversations }) {
  if (timer) return;
  timer = setInterval(() => {
    tick(maxOpenConversations).catch((err) => console.error('[simulator] tick failed:', err.message));
  }, tickMs);
  console.log(`[simulator] running every ${tickMs}ms (max ${maxOpenConversations} open conversations)`);
}

function stop() {
  clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, tick, startConversation };
