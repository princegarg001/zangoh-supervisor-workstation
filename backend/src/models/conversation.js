const mongoose = require('mongoose');
const { cleanJson } = require('./plugins');

const SENDERS = ['customer', 'agent', 'supervisor', 'system'];
const STATUSES = ['active', 'waiting', 'resolved', 'escalated'];
const ALERT_LEVELS = ['low', 'medium', 'high'];

const messageSchema = new mongoose.Schema(
  {
    sender: { type: String, enum: SENDERS, required: true },
    text: { type: String, required: true, trim: true, maxlength: 4000 },
    timestamp: { type: Date, default: Date.now },
    // Optional provenance: which supervisor wrote it / which template it came from.
    supervisorId: String,
    template: { id: String, name: String },
  },
  { _id: false }
);

const interventionSchema = new mongoose.Schema(
  {
    supervisorId: String,
    startedAt: Date,
    endedAt: Date,
    takeoverNotes: String,
    returnNotes: String,
  },
  { _id: false }
);

const feedbackSchema = new mongoose.Schema(
  {
    supervisorId: String,
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    customer: { id: String, name: String, email: String, tier: String },
    agent: { id: String, name: String },
    status: { type: String, enum: STATUSES, default: 'active', index: true },
    alertLevel: { type: String, enum: ALERT_LEVELS, default: 'low', index: true },
    // Human-readable reasons behind the current alert level (see services/alerts.js).
    alertReasons: [String],
    startTime: { type: Date, default: Date.now, index: true },
    endTime: Date,
    lastActivityAt: { type: Date, default: Date.now },
    metrics: {
      sentiment: { type: Number, default: 0.6 },
      responseTime: { type: Number, default: 0 },
      confidenceScore: { type: Number, default: 0.85 },
    },
    messages: [messageSchema],
    tags: [String],
    // Latest guidance handed back to the AI when a supervisor returns control.
    supervisorNotes: String,
    // Guidance not yet consumed by the AI; applied to (and cleared by) its next reply.
    pendingGuidance: String,
    // Shape kept compatible with the documented API; `active` = human currently in control.
    humanIntervention: {
      occurred: { type: Boolean, default: false },
      active: { type: Boolean, default: false },
      supervisorId: String,
      timestamp: Date,
      notes: String,
    },
    interventions: [interventionSchema],
    feedback: [feedbackSchema],
  },
  { timestamps: true }
);

conversationSchema.index({ 'agent.id': 1 });
conversationSchema.plugin(cleanJson);

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
module.exports.SENDERS = SENDERS;
module.exports.STATUSES = STATUSES;
module.exports.ALERT_LEVELS = ALERT_LEVELS;
