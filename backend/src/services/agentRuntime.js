// Runs the AI agent's turn in a conversation. This is where "take over" is enforced:
// while a supervisor holds the conversation the AI stays silent.

const Conversation = require('../models/conversation');
const Agent = require('../models/agent');
const llm = require('./llm');
const conversations = require('./conversations');

const pending = new Set(); // conversation ids with a reply already scheduled

// True when the customer spoke last (ignoring system notes), i.e. is waiting on a reply.
function customerAwaitingReply(messages = []) {
  const last = [...messages].reverse().find((m) => m.sender !== 'system');
  return !!last && last.sender === 'customer';
}

/**
 * Generates and posts the AI reply for a conversation, if the AI is allowed to speak.
 * Consumes any pending supervisor guidance.
 * @returns {Promise<object|null>} the posted message, or null when skipped
 */
async function respond(conversationId) {
  const conversation = await Conversation.findOne({ id: conversationId }).lean();
  if (!conversation || conversation.status === 'resolved') return null;
  if (conversation.humanIntervention?.active) return null; // human in control
  if (!customerAwaitingReply(conversation.messages)) return null;

  const agent = await Agent.findOne({ id: conversation.agent?.id }).lean();
  if (!agent || agent.status !== 'active') return null; // disabled agents don't answer

  const guidance = conversation.pendingGuidance;
  const reply = await llm.generateReply({ agent, messages: conversation.messages, guidance });
  if (guidance) await Conversation.updateOne({ id: conversationId }, { $unset: { pendingGuidance: 1 } });
  return conversations.addMessage(conversationId, { sender: 'agent', text: reply.response }, reply.metrics);
}

/** Schedules a reply after a short "typing" delay; coalesces duplicate requests. */
function scheduleResponse(conversationId, delayMs = 1500 + Math.random() * 1500) {
  if (pending.has(conversationId)) return;
  pending.add(conversationId);
  setTimeout(async () => {
    pending.delete(conversationId);
    try {
      await respond(conversationId);
    } catch (err) {
      console.error(`[agent] reply failed for ${conversationId}:`, err.message);
    }
  }, delayMs);
}

module.exports = { respond, scheduleResponse, customerAwaitingReply };
