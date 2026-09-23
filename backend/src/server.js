// Process entry point: connects MongoDB, seeds if empty, indexes knowledge,
// then starts HTTP + WebSocket and the conversation simulator.
const http = require('http');
const mongoose = require('mongoose');
const config = require('./config');
const app = require('./app');
const websocketHub = require('./realtime/websocketHub');
const knowledge = require('./services/knowledge');
const simulator = require('./services/simulator');
const { seedDatabase } = require('./seed/seed');

async function connectWithRetry(uri, attempts = 10) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await mongoose.connect(uri);
      return;
    } catch (err) {
      if (attempt >= attempts) throw err;
      console.warn(`[db] connection attempt ${attempt} failed (${err.message}); retrying in 3s`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

async function main() {
  await connectWithRetry(config.mongoUri);
  console.log('[db] connected to MongoDB');

  if (config.autoSeed && (await seedDatabase())) console.log('[seed] empty database seeded');
  await knowledge.init();

  const server = http.createServer(app);
  websocketHub.attach(server);
  server.listen(config.port, () => {
    console.log(`[http] listening on http://localhost:${config.port} (docs: /api-docs)`);
  });

  if (config.simulation.enabled) simulator.start(config.simulation);

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    simulator.stop();
    server.close(() => mongoose.connection.close().then(() => process.exit(0)));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
