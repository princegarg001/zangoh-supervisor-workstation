// In-process pub/sub. Domain services publish events here; the WebSocket hub
// (and anything else, e.g. an audit log) subscribes. Keeps routes and services
// decoupled from the transport.
const { EventEmitter } = require('events');

const CHANNEL_BY_TYPE = {
  conversations_update: 'conversations',
  new_conversation: 'conversations',
  conversation_updated: 'conversations',
  message_update: 'conversations',
  metrics_update: 'conversations',
  agent_update: 'agents',
  template_created: 'templates',
  template_updated: 'templates',
  template_deleted: 'templates',
  alert: 'alerts',
};

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

function publish(type, payload = {}) {
  emitter.emit('event', { type, channel: CHANNEL_BY_TYPE[type] || 'system', ...payload, timestamp: new Date().toISOString() });
}

const subscribe = (listener) => {
  emitter.on('event', listener);
  return () => emitter.off('event', listener);
};

module.exports = { publish, subscribe, CHANNEL_BY_TYPE };
