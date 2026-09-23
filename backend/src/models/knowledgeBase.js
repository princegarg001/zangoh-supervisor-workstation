const mongoose = require('mongoose');
const { cleanJson } = require('./plugins');

const knowledgeBaseSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    documentCount: Number,
    lastUpdated: Date,
  },
  { timestamps: true }
);

knowledgeBaseSchema.plugin(cleanJson);

module.exports = mongoose.model('KnowledgeBase', knowledgeBaseSchema);
