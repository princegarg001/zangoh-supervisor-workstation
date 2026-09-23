// Alert evaluation: turns a conversation's live metrics + its agent's escalation
// thresholds into an alert level with explicit, explainable reasons.

const HUMAN_REQUEST = /\b(human|real person|representative|supervisor|manager|speak to (someone|a person))\b/i;

const REASONS = {
  negative_sentiment: { label: 'Negative customer sentiment', severity: 'high' },
  human_requested: { label: 'Customer asked for a human', severity: 'high' },
  low_confidence: { label: 'Low AI confidence', severity: 'medium' },
  slow_response: { label: 'Slow agent response time', severity: 'medium' },
};

const DEFAULT_THRESHOLDS = { lowConfidence: 0.5, negativeSentiment: 0.3, responseTime: 20 };

function lastCustomerMessage(messages = []) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].sender === 'customer') return messages[i];
  }
  return null;
}

/**
 * @param {object} conversation - needs metrics, messages, status
 * @param {object} [thresholds] - agent.escalationThresholds
 * @returns {{ alertLevel: 'low'|'medium'|'high', alertReasons: string[] }}
 */
function evaluateAlerts(conversation, thresholds = {}) {
  if (conversation.status === 'resolved') return { alertLevel: 'low', alertReasons: [] };

  const t = { ...DEFAULT_THRESHOLDS, ...stripEmpty(thresholds) };
  const m = conversation.metrics || {};
  const reasons = [];

  if (typeof m.sentiment === 'number' && m.sentiment < t.negativeSentiment) reasons.push('negative_sentiment');
  if (typeof m.confidenceScore === 'number' && m.confidenceScore < t.lowConfidence) reasons.push('low_confidence');
  if (typeof m.responseTime === 'number' && m.responseTime > t.responseTime) reasons.push('slow_response');

  // Only an *unanswered-by-human* request counts: once a supervisor has spoken after it, it's handled.
  const lastCustomer = lastCustomerMessage(conversation.messages);
  if (lastCustomer && HUMAN_REQUEST.test(lastCustomer.text)) {
    const answeredByHuman = (conversation.messages || []).some(
      (msg) => msg.sender === 'supervisor' && new Date(msg.timestamp) >= new Date(lastCustomer.timestamp)
    );
    if (!answeredByHuman) reasons.push('human_requested');
  }

  let alertLevel = 'low';
  if (reasons.some((r) => REASONS[r].severity === 'high') || reasons.length >= 2) alertLevel = 'high';
  else if (reasons.length === 1) alertLevel = 'medium';

  return { alertLevel, alertReasons: reasons };
}

function stripEmpty(obj) {
  return Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => typeof v === 'number'));
}

module.exports = { evaluateAlerts, REASONS, HUMAN_REQUEST };
