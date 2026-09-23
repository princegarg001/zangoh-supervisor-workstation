process.env.QDRANT_URL = 'http://127.0.0.1:1'; // unreachable -> forces the in-memory index

const knowledge = require('../src/services/knowledge');
const llm = require('../src/services/llm');
const { analyzeSentiment } = require('../src/services/sentiment');
const { customerAwaitingReply } = require('../src/services/agentRuntime');

// Deterministic RNG for stable assertions.
const fixedRandom = () => 0.5;

const agent = (overrides = {}) => ({
  parameters: { temperature: 0.3, max_tokens: 150 },
  capabilities: [{ id: 'order_lookup', enabled: true }, { id: 'return_processing', enabled: true }, { id: 'product_info', enabled: true }],
  knowledgeBases: [{ id: 'kb-product-catalog', enabled: true }, { id: 'kb-shipping-policy', enabled: true }],
  ...overrides,
});
const ask = (text) => [{ sender: 'customer', text }];

beforeAll(async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  await knowledge.init();
});

describe('mock LLM reacts to agent configuration', () => {
  test('grounds answers in enabled knowledge bases', async () => {
    const reply = await llm.generateReply({ agent: agent(), messages: ask('What is the warranty on the Eco-Friendly Blender?'), random: fixedRandom });
    expect(reply.response).toMatch(/Product Catalog/);
    expect(reply.citations.length).toBeGreaterThan(0);
    expect(reply.metrics.confidenceScore).toBeGreaterThan(0.7);
  });

  test('disabled knowledge bases are not used', async () => {
    const reply = await llm.generateReply({
      agent: agent({ knowledgeBases: [{ id: 'kb-product-catalog', enabled: false }] }),
      messages: ask('What is the warranty on the Eco-Friendly Blender?'),
      random: fixedRandom,
    });
    expect(reply.citations).toEqual([]);
  });

  test('a disabled capability forces a hand-off with low confidence', async () => {
    const reply = await llm.generateReply({
      agent: agent({ capabilities: [{ id: 'order_lookup', enabled: false }] }),
      messages: ask('Where is my package? Tracking has not updated.'),
      random: fixedRandom,
    });
    expect(reply.response).toMatch(/escalating/);
    expect(reply.metrics.confidenceScore).toBeLessThan(0.4);
  });

  test('max_tokens caps the reply length', async () => {
    const reply = await llm.generateReply({ agent: agent({ parameters: { temperature: 0.9, max_tokens: 16 } }), messages: ask('Where is my package?'), random: fixedRandom });
    expect(reply.response.split(/\s+/).length).toBeLessThanOrEqual(12);
  });

  test('supervisor guidance is acknowledged on the next reply', async () => {
    const reply = await llm.generateReply({ agent: agent(), messages: ask('Any update?'), guidance: 'Offer a $10 credit', random: fixedRandom });
    expect(reply.response).toMatch(/colleague's notes/);
  });

  test('human requests are detected', () => {
    expect(llm.detectIntent('I want to talk to a real person')).toBe('human');
  });
});

describe('sentiment + runtime helpers', () => {
  test('sentiment separates angry and happy customers', () => {
    expect(analyzeSentiment('This is unacceptable, really terrible service!').score).toBeLessThan(0.3);
    expect(analyzeSentiment('Thanks so much, great help!').score).toBeGreaterThan(0.7);
  });

  test('AI only answers when the customer spoke last (system notes ignored)', () => {
    expect(customerAwaitingReply([{ sender: 'customer' }, { sender: 'system' }])).toBe(true);
    expect(customerAwaitingReply([{ sender: 'customer' }, { sender: 'supervisor' }, { sender: 'system' }])).toBe(false);
  });
});
