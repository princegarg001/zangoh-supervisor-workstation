// Centralised runtime configuration. Every value can be overridden via env vars.
require('dotenv').config();

const bool = (value, fallback) => (value === undefined ? fallback : value === 'true');
const int = (value, fallback) => (value === undefined ? fallback : parseInt(value, 10));

module.exports = {
  port: int(process.env.PORT, 8080),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/zangoh',
  qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Seed the database on boot when it is empty (idempotent).
  autoSeed: bool(process.env.AUTO_SEED, true),

  // Live conversation simulator (drives the "real-time" part of the demo).
  simulation: {
    enabled: bool(process.env.SIMULATION_ENABLED, true),
    tickMs: int(process.env.SIMULATION_TICK_MS, 7000),
    maxOpenConversations: int(process.env.SIMULATION_MAX_OPEN, 14),
  },

  // Supervisor used when a request does not carry an `x-supervisor-id` header.
  defaultSupervisorId: process.env.DEFAULT_SUPERVISOR_ID || 'supervisor-001',
};
