// Single shared WebSocket connection with auto-reconnect (capped exponential backoff)
// and channel resubscription on reconnect. Components read `lastMessage` (a fresh
// object per incoming frame) rather than opening their own sockets.
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const WebSocketContext = createContext(null);
export const useWebSocket = () => useContext(WebSocketContext);

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8080';
const MAX_BACKOFF_MS = 15000;

export const WebSocketProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const attemptRef = useRef(0);
  const reconnectTimer = useRef(null);
  const subscriptionsRef = useRef(new Map()); // channel -> parameters, replayed on (re)connect
  const mountedRef = useRef(true);

  const send = useCallback((message) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(typeof message === 'string' ? message : JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  const subscribe = useCallback((channel, parameters = {}) => {
    subscriptionsRef.current.set(channel, parameters);
    send({ type: 'subscribe', channel, parameters });
  }, [send]);

  const unsubscribe = useCallback((channel) => {
    subscriptionsRef.current.delete(channel);
    send({ type: 'unsubscribe', channel });
  }, [send]);

  useEffect(() => {
    mountedRef.current = true;

    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        attemptRef.current = 0;
        for (const [channel, parameters] of subscriptionsRef.current) {
          ws.send(JSON.stringify({ type: 'subscribe', channel, parameters }));
        }
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const message = JSON.parse(event.data);
          setLastMessage(message);
          if (message.type === 'ping') ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        } catch (err) {
          console.error('Malformed WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        const delay = Math.min(1000 * 2 ** attemptRef.current, MAX_BACKOFF_MS);
        attemptRef.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, lastMessage, send, subscribe, unsubscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
};
