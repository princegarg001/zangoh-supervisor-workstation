const mongoose = require('mongoose');
const { cleanJson } = require('./plugins');

// A named, reusable snapshot of agent configuration.
const toggle = { _id: false, id: String, enabled: Boolean };

const configPresetSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, maxlength: 300 },
    // When set, the preset was captured from this agent; presets can still be applied to any agent.
    agentId: String,
    config: {
      parameters: { temperature: Number, max_tokens: Number, top_p: Number },
      capabilities: [toggle],
      knowledgeBases: [toggle],
      escalationThresholds: { lowConfidence: Number, negativeSentiment: Number, responseTime: Number },
    },
    createdBy: String,
  },
  { timestamps: true }
);

configPresetSchema.plugin(cleanJson);

module.exports = mongoose.model('ConfigPreset', configPresetSchema);
