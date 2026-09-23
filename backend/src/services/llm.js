// Mock LLM "agent brain". Deterministic enough to demo, but genuinely driven by the
// agent's configuration so supervisor changes have visible effects:
//   - temperature  -> tone variety and confidence spread
//   - max_tokens   -> hard cap on reply length
//   - capabilities -> a disabled tool forces a hand-off style reply with low confidence
//   - knowledgeBases -> only enabled KBs are searched to ground the answer (RAG)
//   - guidance     -> supervisor notes given when control returns to the AI

const knowledge = require('./knowledge');

const INTENTS = {
  human: { pattern: /\b(human|real person|representative|supervisor|manager)\b/i, capability: null },
  shipping: { pattern: /\b(ship|shipping|deliver|delivery|track|tracking|arrive|package|parcel|late)\b/i, capability: 'order_lookup' },
  returns: { pattern: /\b(return|refund|money back|exchange|send it back)\b/i, capability: 'return_processing' },
  product: { pattern: /\b(feature|spec|warranty|compatible|wattage|color|colour|model|battery|size)\b/i, capability: 'product_info' },
  general: { pattern: /.*/, capability: null },
};

const OPENERS = {
  shipping: ['I understand how important this delivery is.', "I've checked the status of your order.", 'Thanks for your patience while I looked into your shipment.'],
  returns: ['I can help you with that return.', "Happy to sort out the return for you.", "Let's get this return taken care of."],
  product: ['Great question!', 'Happy to help with the product details.', 'Here is what I found for you.'],
  general: ['Thanks for reaching out.', "I'm here to help.", 'I appreciate you contacting us.'],
};

const FALLBACK = {
  shipping: [
    'Your package is in transit and I have flagged it for priority handling with the carrier.',
    'I can see it is moving through our network; I have requested an expedited scan at the next hub.',
    'It is on its way — I have set an alert so we catch any further delay immediately.',
  ],
  returns: [
    'You can start the return from your order history and we will email a prepaid label.',
    'I can get a return started right now — you will have a prepaid label in your inbox shortly.',
    'That is eligible for a return; I just need to generate the shipping label on our end.',
  ],
  product: [
    'This product comes with a manufacturer warranty and is fully covered for defects.',
    'It is one of our best-reviewed items, backed by a full manufacturer warranty.',
    'That model is covered under warranty, and I can pull the full spec sheet if useful.',
  ],
  general: [
    'Could you share a bit more detail so I can resolve this for you?',
    'Let me make sure I understand — could you walk me through what happened?',
    "I want to get this right for you — can you tell me a little more about the issue?",
  ],
};

const CLOSERS = [
  'Is there anything else I can help you with today?',
  'Please let me know if you need anything else.',
  "I'll keep an eye on this for you.",
  'Your satisfaction is our priority.',
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pick = (list, rand) => list[Math.floor(rand() * list.length) % list.length];

function detectIntent(text = '') {
  return Object.keys(INTENTS).find((key) => INTENTS[key].pattern.test(text));
}

// Picks the most query-relevant bullet/sentence from a retrieved chunk.
function extractFact(chunkText, query) {
  const queryTerms = new Set(query.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const candidates = chunkText
    .split(/\n|(?<=\.)\s/)
    .map((l) => l.replace(/^[\s\-*\d.]+/, '').replace(/\*\*/g, '').trim())
    .filter((l) => l.length > 20);
  if (!candidates.length) return null;
  const score = (line) => line.toLowerCase().split(/\W+/).filter((w) => queryTerms.has(w)).length;
  const best = candidates.reduce((a, b) => (score(b) > score(a) ? b : a));
  return best.endsWith('.') ? best : `${best}.`;
}

function truncateToTokens(text, maxTokens) {
  const maxWords = Math.max(8, Math.floor(maxTokens * 0.75)); // ~0.75 words per token
  const words = text.split(/\s+/);
  return words.length <= maxWords ? text : `${words.slice(0, maxWords).join(' ')}…`;
}

/**
 * @param {object} input
 * @param {object} input.agent - agent document (parameters, capabilities, knowledgeBases)
 * @param {Array<{sender: string, text: string}>} input.messages - conversation history
 * @param {string} [input.guidance] - supervisor notes to honour on the next reply
 * @param {() => number} [input.random] - injectable RNG (tests)
 */
async function generateReply({ agent = {}, messages = [], guidance, random = Math.random }) {
  const params = { temperature: 0.7, max_tokens: 150, ...(agent.parameters || {}) };
  const lastCustomer = [...messages].reverse().find((m) => m.sender === 'customer' || m.role === 'customer');
  const query = lastCustomer ? lastCustomer.text || lastCustomer.content || '' : '';
  const intent = detectIntent(query);

  const enabledCapabilities = (agent.capabilities || []).filter((c) => c.enabled).map((c) => c.id);
  const enabledKbs = (agent.knowledgeBases || []).filter((k) => k.enabled).map((k) => k.id);
  const requiredCapability = INTENTS[intent].capability;
  const hasCapability = !requiredCapability || enabledCapabilities.includes(requiredCapability);

  const parts = [];
  let confidence;
  let citations = [];

  if (guidance) parts.push("Thanks for your patience — I've reviewed my colleague's notes and I'll take it from here.");

  if (intent === 'human') {
    parts.push("I understand you'd like to speak with a person. I've flagged this conversation for a supervisor, who will join shortly.");
    confidence = 0.35;
  } else if (!hasCapability) {
    parts.push("I'm sorry, I don't have access to the tools needed for this request right now. I'm escalating it to a specialist who can help.");
    confidence = 0.3;
  } else {
    const temperatureVariety = params.temperature >= 0.5;
    parts.push(temperatureVariety ? pick(OPENERS[intent], random) : OPENERS[intent][0]);

    const results = enabledKbs.length ? await knowledge.search(query, enabledKbs, 2) : [];
    const top = results[0];
    const fact = top && top.relevance >= 0.15 ? extractFact(top.text, query) : null;
    if (fact) {
      parts.push(`According to our ${top.source}: ${fact}`);
      citations = results.map(({ source, section, relevance }) => ({ source, section, relevance }));
    } else {
      parts.push(pick(FALLBACK[intent], random));
    }
    confidence = (fact ? 0.86 : 0.62) + (intent === 'general' ? -0.08 : 0);
  }

  if (params.temperature > 0.7) parts.push(pick(CLOSERS, random));

  // Higher temperature widens the spread (and lowers the mean) of the confidence score.
  confidence = clamp(confidence - params.temperature * 0.08 + (random() - 0.5) * params.temperature * 0.2, 0.05, 0.99);

  // Response latency grows with max_tokens; occasional spikes model a slow tool call.
  let responseTime = 2 + params.max_tokens / 80 + random() * 4;
  if (random() < 0.08) responseTime += 15 + random() * 10;

  return {
    response: truncateToTokens(parts.join(' '), params.max_tokens),
    intent,
    citations,
    metrics: {
      responseTime: Number(responseTime.toFixed(1)),
      confidenceScore: Number(confidence.toFixed(2)),
      sentiment: null, // sentiment is measured on customer messages, not agent replies
    },
  };
}

module.exports = { generateReply, detectIntent, truncateToTokens };
