// Express application (no side effects – server.js wires DB, WebSocket and simulator).
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const swaggerUi = require('swagger-ui-express');
const config = require('./config');
const openapi = require('./docs/openapi.json');
const knowledge = require('./services/knowledge');
const currentSupervisor = require('./middleware/currentSupervisor');
const { errorHandler, notFoundHandler } = require('./middleware/errors');
const { llmRouter, vectorRouter } = require('./routes/ai');

const app = express();

app.use(helmet({ contentSecurityPolicy: false })); // JSON API; CSP would only block the Swagger UI
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '100kb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date(),
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    vectorStore: knowledge.backend(),
  });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi));

app.use('/api', currentSupervisor);
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/intervene', require('./routes/intervene'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/presets', require('./routes/presets'));
app.use('/api/knowledge-base', require('./routes/knowledgeBase'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/llm', llmRouter);
app.use('/api/vector', vectorRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
