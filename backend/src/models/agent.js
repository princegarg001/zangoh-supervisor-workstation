const mongoose = require('mongoose');
const { cleanJson } = require('./plugins');

const toggleSchema = new mongoose.Schema(
  { id: String, name: String, enabled: { type: Boolean, default: true } },
  { _id: false }
);

const agentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    model: { type: String, required: true },
    description: String,
    parameters: {
      temperature: { type: Number, default: 0.7, min: 0, max: 1 },
      max_tokens: { type: Number, default: 150, min: 16, max: 4096 },
      top_p: { type: Number, default: 1.0, min: 0, max: 1 },
    },
    capabilities: [toggleSchema],
    knowledgeBases: [toggleSchema],
    // Conversations crossing these thresholds raise alerts (see services/alerts.js).
    escalationThresholds: {
      lowConfidence: { type: Number, default: 0.5, min: 0, max: 1 },
      negativeSentiment: { type: Number, default: 0.3, min: 0, max: 1 },
      responseTime: { type: Number, default: 20, min: 1, max: 600 }, // seconds
    },
    status: { type: String, enum: ['active', 'inactive', 'maintenance'], default: 'active' },
    metrics: {
      conversations: Number,
      avgResponseTime: Number,
      satisfaction: Number,
      escalationRate: Number,
      topIssues: [{ _id: false, name: String, count: Number }],
    },
  },
  { timestamps: true }
);

agentSchema.plugin(cleanJson);

module.exports = mongoose.model('Agent', agentSchema);
