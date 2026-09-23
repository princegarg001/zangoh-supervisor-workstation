// Agent configuration presets: save a named snapshot, list, delete.
// Applying a preset happens in the UI (it loads into the form for review, then PATCHes the agent).
const express = require('express');
const crypto = require('crypto');
const ConfigPreset = require('../models/configPreset');
const { asyncHandler, badRequest, forbidden, notFound } = require('../middleware/errors');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json(await ConfigPreset.find().sort({ createdAt: 1 }));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, description, agentId, config } = req.body || {};
  if (!name || !String(name).trim()) throw badRequest('name is required');
  if (!config || typeof config !== 'object') throw badRequest('config is required');

  const pickToggles = (list) => (Array.isArray(list) ? list.map(({ id, enabled }) => ({ id, enabled: !!enabled })) : undefined);
  const preset = await ConfigPreset.create({
    id: `preset-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
    name: String(name).trim(),
    description,
    agentId,
    config: {
      parameters: config.parameters,
      capabilities: pickToggles(config.capabilities),
      knowledgeBases: pickToggles(config.knowledgeBases),
      escalationThresholds: config.escalationThresholds,
    },
    createdBy: req.supervisorId,
  });
  res.status(201).json(preset);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const preset = await ConfigPreset.findOne({ id: req.params.id });
  if (!preset) throw notFound('Preset not found');
  if (preset.createdBy && preset.createdBy !== req.supervisorId) throw forbidden('Only the author can delete this preset');
  await preset.deleteOne();
  res.json({ message: 'Preset deleted' });
}));

module.exports = router;
