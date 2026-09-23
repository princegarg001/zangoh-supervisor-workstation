const { evaluateAlerts } = require('../src/services/alerts');

const thresholds = { lowConfidence: 0.5, negativeSentiment: 0.3, responseTime: 20 };
const base = (overrides = {}) => ({
  status: 'active',
  metrics: { sentiment: 0.7, confidenceScore: 0.9, responseTime: 5 },
  messages: [{ sender: 'customer', text: 'Where is my order?', timestamp: new Date('2024-01-01T10:00:00Z') }],
  ...overrides,
});

describe('evaluateAlerts', () => {
  test('healthy conversation is low', () => {
    expect(evaluateAlerts(base(), thresholds)).toEqual({ alertLevel: 'low', alertReasons: [] });
  });

  test('single medium-severity breach is medium', () => {
    const result = evaluateAlerts(base({ metrics: { sentiment: 0.7, confidenceScore: 0.4, responseTime: 5 } }), thresholds);
    expect(result).toEqual({ alertLevel: 'medium', alertReasons: ['low_confidence'] });
  });

  test('negative sentiment is high', () => {
    expect(evaluateAlerts(base({ metrics: { sentiment: 0.2, confidenceScore: 0.9, responseTime: 5 } }), thresholds).alertLevel).toBe('high');
  });

  test('two medium breaches escalate to high', () => {
    const result = evaluateAlerts(base({ metrics: { sentiment: 0.7, confidenceScore: 0.3, responseTime: 30 } }), thresholds);
    expect(result.alertLevel).toBe('high');
    expect(result.alertReasons).toEqual(['low_confidence', 'slow_response']);
  });

  test('a request for a human is high until a supervisor replies', () => {
    const asked = { sender: 'customer', text: 'I want to speak to a human representative', timestamp: new Date('2024-01-01T10:01:00Z') };
    expect(evaluateAlerts(base({ messages: [asked] }), thresholds).alertReasons).toContain('human_requested');

    const answered = { sender: 'supervisor', text: 'Hi, I am here', timestamp: new Date('2024-01-01T10:02:00Z') };
    expect(evaluateAlerts(base({ messages: [asked, answered] }), thresholds).alertReasons).not.toContain('human_requested');
  });

  test('thresholds come from the agent configuration', () => {
    const conv = base({ metrics: { sentiment: 0.35, confidenceScore: 0.9, responseTime: 5 } });
    expect(evaluateAlerts(conv, thresholds).alertLevel).toBe('low');
    expect(evaluateAlerts(conv, { ...thresholds, negativeSentiment: 0.4 }).alertLevel).toBe('high');
  });

  test('resolved conversations never alert', () => {
    expect(evaluateAlerts(base({ status: 'resolved', metrics: { sentiment: 0.1 } }), thresholds).alertLevel).toBe('low');
  });
});
