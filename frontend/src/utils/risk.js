// Turns a conversation's real alert signals into a single 0-100 risk score and a
// recommended next action — feeds the Dashboard's "Priority Queue" table.
const REASON_WEIGHT = { human_requested: 30, negative_sentiment: 25, low_confidence: 20, slow_response: 15 };
const LEVEL_BASE = { high: 55, medium: 25, low: 0 };

export function riskScore(conversation) {
  const base = LEVEL_BASE[conversation.alertLevel] || 0;
  const fromReasons = (conversation.alertReasons || []).reduce((sum, r) => sum + (REASON_WEIGHT[r] || 10), 0);
  const controlled = conversation.humanIntervention?.active ? -20 : 0; // already being handled
  return Math.max(0, Math.min(100, Math.round(base + fromReasons + controlled)));
}

const ACTION_BY_REASON = {
  human_requested: 'Take over',
  negative_sentiment: 'Take over',
  low_confidence: 'Review evidence',
  slow_response: 'Send template',
};

export function recommendedAction(conversation) {
  if (conversation.humanIntervention?.active) return 'In progress';
  const topReason = (conversation.alertReasons || [])[0];
  return ACTION_BY_REASON[topReason] || 'Monitor';
}

/** Rolling day-over-day % change from a trend array's last two points (real, not fabricated). */
export function dayOverDayChange(trend, key = 'count') {
  if (!trend || trend.length < 2) return null;
  const prev = trend[trend.length - 2][key];
  const curr = trend[trend.length - 1][key];
  if (!prev) return null;
  const pct = ((curr - prev) / prev) * 100;
  return { pct: Math.round(Math.abs(pct)), type: pct >= 0 ? 'increase' : 'decrease' };
}
