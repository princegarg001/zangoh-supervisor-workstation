// WebSocket hub: one server-wide broadcaster fed by the event bus.
//
// Protocol (JSON messages):
//   client -> server: { type: 'subscribe', channel, parameters? } | { type: 'unsubscribe', channel } | { type: 'pong' }
//   server -> client: 'connection', 'ping', 'subscription_confirmation', 'conversations_update' (snapshot),
//                     'new_conversation', 'conversation_updated', 'message_update', 'metrics_update',
//                     'agent_update', 'template_*', 'alert'
// Clients that never subscribe receive every channel; once they subscribe they
// receive only their chosen channels (optionally narrowed by agentId).
const WebSocket = require('ws');
const eventBus = require('./eventBus');
const Conversation = require('../models/conversation');
const { summarize } = require('../services/conversations');

const HEARTBEAT_MS = 30000;

function attach(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', async (ws) => {
    ws.isAlive = true;
    ws.subscriptions = new Map(); // channel -> parameters

    ws.on('pong', () => { ws.isAlive = true; }); // protocol-level heartbeat
    ws.on('message', (raw) => handleClientMessage(ws, raw));

    send(ws, { type: 'connection', message: 'Connected to Agent Supervisor WebSocket server' });

    // Initial snapshot so a fresh client is consistent without an extra REST call.
    try {
      const conversations = await Conversation.find().sort({ startTime: -1 }).limit(100);
      send(ws, { type: 'conversations_update', data: conversations.map(summarize) });
    } catch (err) {
      console.error('[ws] snapshot failed', err.message);
    }
  });

  const unsubscribe = eventBus.subscribe((event) => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN && wants(client, event)) send(client, event);
    }
  });

  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      if (!client.isAlive) { client.terminate(); continue; }
      client.isAlive = false;
      client.ping();
      send(client, { type: 'ping' }); // application-level ping kept for API compatibility
    }
  }, HEARTBEAT_MS);

  wss.on('close', () => { clearInterval(heartbeat); unsubscribe(); });
  return wss;
}

function handleClientMessage(ws, raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return send(ws, { type: 'error', message: 'Invalid JSON' });
  }
  switch (message.type) {
    case 'subscribe':
      if (!message.channel) return send(ws, { type: 'error', message: 'channel is required' });
      ws.subscriptions.set(message.channel, message.parameters || {});
      return send(ws, { type: 'subscription_confirmation', channel: message.channel, message: `Subscribed to ${message.channel}` });
    case 'unsubscribe':
      ws.subscriptions.delete(message.channel);
      return undefined;
    case 'pong':
      ws.isAlive = true;
      return undefined;
    default:
      return send(ws, { type: 'error', message: `Unknown message type: ${message.type}` });
  }
}

function wants(ws, event) {
  if (ws.subscriptions.size === 0) return true;
  const params = ws.subscriptions.get(event.channel);
  if (!params) return false;
  const agentId = event.data?.agent?.id || event.agentId;
  return !params.agentId || !agentId || params.agentId === agentId;
}

function send(ws, payload) {
  ws.send(JSON.stringify({ timestamp: new Date().toISOString(), ...payload }));
}

module.exports = { attach };
