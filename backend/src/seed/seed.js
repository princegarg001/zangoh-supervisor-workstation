// Seeds MongoDB. Used automatically on boot when the database is empty, and
// manually via `npm run seed` (which resets everything).
const mongoose = require('mongoose');
const config = require('../config');
const Conversation = require('../models/conversation');
const Agent = require('../models/agent');
const KnowledgeBase = require('../models/knowledgeBase');
const ResponseTemplate = require('../models/responseTemplate');
const ConfigPreset = require('../models/configPreset');
const { evaluateAlerts } = require('../services/alerts');
const { buildVariables } = require('../services/templateEngine');
const data = require('./data');

async function seedDatabase({ force = false } = {}) {
  if (!force && (await Agent.estimatedDocumentCount()) > 0) return false;

  await Promise.all([Conversation, Agent, KnowledgeBase, ResponseTemplate, ConfigPreset].map((Model) => Model.deleteMany({})));

  const thresholds = Object.fromEntries(data.agents.map((a) => [a.id, a.escalationThresholds]));
  const conversations = data.conversations.map((c) => ({ ...c, ...evaluateAlerts(c, thresholds[c.agent.id]) }));
  const templates = data.templates.map((t) => ({ ...t, variables: buildVariables(t.content, t.variables) }));

  await Agent.insertMany(data.agents);
  await KnowledgeBase.insertMany(data.knowledgeBases);
  await Conversation.insertMany(conversations);
  await ResponseTemplate.insertMany(templates);
  await ConfigPreset.insertMany(data.presets);
  await Promise.all([Conversation, Agent, KnowledgeBase, ResponseTemplate, ConfigPreset].map((Model) => Model.syncIndexes()));

  console.log(`[seed] ${conversations.length} conversations, ${data.agents.length} agents, ${templates.length} templates, ${data.presets.length} presets`);
  return true;
}

if (require.main === module) {
  mongoose
    .connect(config.mongoUri)
    .then(() => seedDatabase({ force: true }))
    .then(() => console.log('[seed] done'))
    .catch((err) => {
      console.error('[seed] failed', err);
      process.exitCode = 1;
    })
    .finally(() => mongoose.connection.close());
}

module.exports = { seedDatabase };
