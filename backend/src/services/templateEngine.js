// Response-template engine: parsing, validation and `{{variable}}` substitution.
// Pure functions only. An identical copy lives in frontend/src/utils/templateEngine.js
// so the editor preview and the server always agree on the syntax.

const VARIABLE_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const TOKEN = /\{\{\s*([^{}]*?)\s*\}\}/g;

/**
 * Splits content into text and variable segments, e.g. for highlighting.
 * @returns {Array<{type: 'text', value: string} | {type: 'variable', name: string, raw: string}>}
 */
function parseSegments(content = '') {
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

/** Unique variable names in order of first appearance. */
function extractVariables(content = '') {
  const names = parseSegments(content)
    .filter((s) => s.type === 'variable' && VARIABLE_NAME.test(s.name))
    .map((s) => s.name);
  return [...new Set(names)];
}

/** Returns a list of human-readable problems with the template syntax (empty = valid). */
function validateContent(content = '') {
  const errors = [];
  if (!content.trim()) errors.push('Content cannot be empty');

  for (const segment of parseSegments(content)) {
    if (segment.type === 'variable' && !VARIABLE_NAME.test(segment.name)) {
      errors.push(
        segment.name
          ? `Invalid variable name "${segment.name}" – use letters, numbers and underscores (e.g. order_number)`
          : 'Empty variable placeholder "{{}}"'
      );
    }
  }

  // Braces left over after removing well-formed tokens are unbalanced.
  const leftover = content.replace(TOKEN, '');
  if (leftover.includes('{{') || leftover.includes('}}')) {
    errors.push('Unbalanced braces – every "{{" needs a matching "}}"');
  }
  return [...new Set(errors)];
}

/**
 * Builds the stored variables list: names always come from the content, descriptions are
 * carried over from the author's input (or a previous version) when present.
 */
function buildVariables(content, provided = []) {
  const descriptions = new Map((provided || []).filter((v) => v && v.name).map((v) => [v.name, v.description || '']));
  return extractVariables(content).map((name) => ({ name, description: descriptions.get(name) || '' }));
}

/**
 * Substitutes values into the template. Variables without a (non-blank) value are left
 * as `{{name}}` and reported in `missing`, so callers can block sending incomplete text.
 */
function render(content = '', values = {}) {
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

module.exports = { parseSegments, extractVariables, validateContent, buildVariables, render, VARIABLE_NAME };
