// Response templates (mid-challenge requirement).
// Visibility: a supervisor sees every shared template plus their own private ones.
// Only the author may edit or delete a template.
const express = require('express');
const crypto = require('crypto');
const ResponseTemplate = require('../models/responseTemplate');
const eventBus = require('../realtime/eventBus');
const engine = require('../services/templateEngine');
const { asyncHandler, badRequest, forbidden, notFound } = require('../middleware/errors');

const router = express.Router();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const visibleTo = (supervisorId) => ({ $or: [{ isShared: true }, { createdBy: supervisorId }] });

const SORTS = { recent: { updatedAt: -1 }, popular: { usageCount: -1, updatedAt: -1 }, name: { name: 1 } };

function validatePayload(body, { partial = false } = {}) {
  const errors = [];
  const required = ['name', 'category', 'content'];
  for (const field of required) {
    const present = body[field] !== undefined;
    if ((!partial || present) && (typeof body[field] !== 'string' || !body[field].trim())) {
      errors.push(`${field} is required`);
    }
  }
  if (typeof body.content === 'string' && body.content.trim()) errors.push(...engine.validateContent(body.content));
  if (body.isShared !== undefined && typeof body.isShared !== 'boolean') errors.push('isShared must be a boolean');
  if (body.variables !== undefined && !Array.isArray(body.variables)) errors.push('variables must be an array');
  if (errors.length) throw badRequest('Invalid template', errors);
}

async function findVisible(id, supervisorId) {
  const template = await ResponseTemplate.findOne({ id, ...visibleTo(supervisorId) });
  if (!template) throw notFound('Template not found');
  return template;
}

function assertOwner(template, supervisorId) {
  if (template.createdBy !== supervisorId) throw forbidden('Only the author can modify this template');
}

// GET /api/templates?shared=true|false&mine=true&category=&search=&sort=recent|popular|name
router.get('/', asyncHandler(async (req, res) => {
  const { shared, mine, category, search, sort } = req.query;
  const filter = { ...visibleTo(req.supervisorId) };
  const and = [];
  if (shared === 'true') and.push({ isShared: true });
  if (shared === 'false') and.push({ isShared: false });
  if (mine === 'true') and.push({ createdBy: req.supervisorId });
  if (category) and.push({ category: String(category).toLowerCase() });
  if (search) {
    const pattern = new RegExp(escapeRegex(String(search)), 'i');
    and.push({ $or: [{ name: pattern }, { content: pattern }, { category: pattern }] });
  }
  if (and.length) filter.$and = and;

  res.json(await ResponseTemplate.find(filter).sort(SORTS[sort] || SORTS.recent));
}));

router.get('/categories', asyncHandler(async (req, res) => {
  const categories = await ResponseTemplate.distinct('category', visibleTo(req.supervisorId));
  res.json(categories.sort());
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json(await findVisible(req.params.id, req.supervisorId));
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = req.body || {};
  validatePayload(body);

  const template = await ResponseTemplate.create({
    id: `template-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
    name: body.name.trim(),
    category: body.category.trim(),
    content: body.content,
    variables: engine.buildVariables(body.content, body.variables),
    isShared: body.isShared === true,
    createdBy: req.supervisorId,
  });
  eventBus.publish('template_created', { data: template.toJSON() });
  res.status(201).json(template);
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const template = await findVisible(req.params.id, req.supervisorId);
  assertOwner(template, req.supervisorId);
  validatePayload(body, { partial: true });

  if (body.name !== undefined) template.name = body.name.trim();
  if (body.category !== undefined) template.category = body.category.trim();
  if (body.isShared !== undefined) template.isShared = body.isShared;
  if (body.content !== undefined || body.variables !== undefined) {
    if (body.content !== undefined) template.content = body.content;
    // Keep existing descriptions unless new ones are supplied (later entries win).
    const descriptions = [...template.variables.map((v) => ({ name: v.name, description: v.description })), ...(body.variables || [])];
    template.variables = engine.buildVariables(template.content, descriptions);
  }

  await template.save();
  eventBus.publish('template_updated', { data: template.toJSON() });
  res.json(template);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const template = await findVisible(req.params.id, req.supervisorId);
  assertOwner(template, req.supervisorId);
  await template.deleteOne();
  eventBus.publish('template_deleted', { data: { id: template.id, createdBy: template.createdBy, isShared: template.isShared } });
  res.json({ message: 'Template deleted successfully' });
}));

// POST /api/templates/:id/render { values } – server-side substitution (same engine as the UI).
router.post('/:id/render', asyncHandler(async (req, res) => {
  const template = await findVisible(req.params.id, req.supervisorId);
  res.json(engine.render(template.content, (req.body || {}).values || {}));
}));

module.exports = router;
