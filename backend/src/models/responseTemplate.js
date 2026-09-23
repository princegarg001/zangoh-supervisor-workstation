const mongoose = require('mongoose');
const { cleanJson } = require('./plugins');

const responseTemplateSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true, trim: true, lowercase: true, maxlength: 40 },
    content: { type: String, required: true, maxlength: 4000 },
    // Always derived from `content` on write; descriptions are supplied by the author.
    variables: [{ _id: false, name: String, description: String }],
    createdBy: { type: String, index: true },
    isShared: { type: Boolean, default: false, index: true },
    usageCount: { type: Number, default: 0 },
    lastUsedAt: Date,
  },
  { timestamps: true }
);

responseTemplateSchema.plugin(cleanJson);

module.exports = mongoose.model('ResponseTemplate', responseTemplateSchema);
