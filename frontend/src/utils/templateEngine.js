// Mirror of backend/src/services/templateEngine.js — kept identical so the editor
// preview and the server always agree on `{{variable}}` syntax.

const VARIABLE_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const TOKEN = /\{\{\s*([^{}]*?)\s*\}\}/g;

export function parseSegments(content = '') {
  const segments = [];
  let cursor = 0;
  for (const match of content.matchAll(TOKEN)) {
    if (match.index > cursor) segments.push({ type: 'text', value: content.slice(cursor, match.index) });
    segments.push({ type: 'variable', name: match[1], raw: match[0] });
    cursor = match.index + match[0].length;
  }
  if (cursor < content.length) segments.push({ type: 'text', value: content.slice(cursor) });
  return segments;
}

export function extractVariables(content = '') {
  const names = parseSegments(content)
    .filter((s) => s.type === 'variable' && VARIABLE_NAME.test(s.name))
    .map((s) => s.name);
  return [...new Set(names)];
}

export function validateContent(content = '') {
  const errors = [];
  if (!content.trim()) errors.push('Content cannot be empty');
  for (const segment of parseSegments(content)) {
    if (segment.type === 'variable' && !VARIABLE_NAME.test(segment.name)) {
      errors.push(
        segment.name
          ? `Invalid variable name "${segment.name}" – use letters, numbers and underscores`
          : 'Empty variable placeholder "{{}}"'
      );
    }
  }
  const leftover = content.replace(TOKEN, '');
  if (leftover.includes('{{') || leftover.includes('}}')) errors.push('Unbalanced braces – every "{{" needs a matching "}}"');
  return [...new Set(errors)];
}

export function render(content = '', values = {}) {
  const missing = [];
  const text = content.replace(TOKEN, (raw, name) => {
    const value = values[name];
    if (value === undefined || value === null || String(value).trim() === '') {
      if (VARIABLE_NAME.test(name) && !missing.includes(name)) missing.push(name);
      return raw;
    }
    return String(value);
  });
  return { text, missing, complete: missing.length === 0 };
}

export { VARIABLE_NAME };
