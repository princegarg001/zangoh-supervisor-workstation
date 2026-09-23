// Derives a rolling "activity by hour" strip from currently loaded conversations —
// feeds the Dashboard's Peak Hours widget without needing a dedicated backend endpoint.

/** @returns {{label: string, value: number}[]} last `hours` hours, value = 0-100 relative to the busiest hour */
export function hourlyActivity(conversations, hours = 8) {
  const now = new Date();
  const buckets = Array.from({ length: hours }, (_, i) => {
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);
    hourStart.setHours(hourStart.getHours() - (hours - 1 - i));
    return { hourStart, count: 0 };
  });

  for (const conversation of conversations) {
    for (const message of conversation.messages || []) {
      const t = new Date(message.timestamp).getTime();
      const bucket = buckets.find((b) => t >= b.hourStart.getTime() && t < b.hourStart.getTime() + 3600000);
      if (bucket) bucket.count += 1;
    }
    // Summaries (dashboard list) don't carry full `messages`; fall back to lastMessage/startTime.
    if (!conversation.messages && conversation.lastMessage) {
      const t = new Date(conversation.lastMessage.timestamp).getTime();
      const bucket = buckets.find((b) => t >= b.hourStart.getTime() && t < b.hourStart.getTime() + 3600000);
      if (bucket) bucket.count += 1;
    }
  }

  const max = Math.max(1, ...buckets.map((b) => b.count));
  return buckets.map((b) => ({
    label: b.hourStart.toLocaleTimeString('en-US', { hour: 'numeric' }),
    value: Math.round((b.count / max) * 100),
  }));
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Builds a day-of-week × issue-tag count grid from currently loaded conversations,
 * for the Analytics "issue heatmap".
 * @returns {{ rows: string[], cols: string[], values: number[][] }}
 */
export function issueDayHeatmap(conversations, topTags) {
  const cols = topTags.slice(0, 6);
  const values = DAY_LABELS.map(() => cols.map(() => 0));

  for (const conversation of conversations) {
    const day = new Date(conversation.startTime).getDay();
    for (const tag of conversation.tags || []) {
      const col = cols.indexOf(tag);
      if (col !== -1) values[day][col] += 1;
    }
  }
  return { rows: DAY_LABELS, cols, values };
}
