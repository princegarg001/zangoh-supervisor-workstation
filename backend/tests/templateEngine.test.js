const engine = require('../src/services/templateEngine');

const SHIPPING = "I apologize for the delay with your order #{{order_number}}. It should arrive by {{expected_date}}. Order {{ order_number }} is flagged.";

describe('templateEngine', () => {
  test('extracts unique variables in order, tolerating inner whitespace', () => {
    expect(engine.extractVariables(SHIPPING)).toEqual(['order_number', 'expected_date']);
  });

  test('parses text and variable segments for highlighting', () => {
    expect(engine.parseSegments('Hi {{name}}!')).toEqual([
      { type: 'text', value: 'Hi ' },
      { type: 'variable', name: 'name', raw: '{{name}}' },
      { type: 'text', value: '!' },
    ]);
  });

  test('renders every occurrence and reports nothing missing when complete', () => {
    const result = engine.render(SHIPPING, { order_number: 'ORD-1', expected_date: 'Friday' });
    expect(result.text).toBe('I apologize for the delay with your order #ORD-1. It should arrive by Friday. Order ORD-1 is flagged.');
    expect(result).toMatchObject({ missing: [], complete: true });
  });

  test('leaves blank variables as placeholders and lists them as missing', () => {
    const result = engine.render(SHIPPING, { order_number: '  ' });
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual(['order_number', 'expected_date']);
    expect(result.text).toContain('{{order_number}}');
  });

  test('values are inserted literally (no recursive substitution)', () => {
    expect(engine.render('{{a}}', { a: '{{b}}', b: 'x' }).text).toBe('{{b}}');
  });

  test('validates malformed placeholders and unbalanced braces', () => {
    expect(engine.validateContent('Hello {{order number}}')[0]).toMatch(/Invalid variable name/);
    expect(engine.validateContent('Hello {{}}')[0]).toMatch(/Empty variable/);
    expect(engine.validateContent('Hello {{name')).toContainEqual(expect.stringMatching(/Unbalanced/));
    expect(engine.validateContent('Hello {{name}}')).toEqual([]);
    expect(engine.validateContent('   ')).toContain('Content cannot be empty');
  });

  test('buildVariables derives names from content and keeps provided descriptions', () => {
    const variables = engine.buildVariables('{{a}} {{b}}', [{ name: 'b', description: 'B desc' }, { name: 'zzz', description: 'unused' }]);
    expect(variables).toEqual([
      { name: 'a', description: '' },
      { name: 'b', description: 'B desc' },
    ]);
  });
});
