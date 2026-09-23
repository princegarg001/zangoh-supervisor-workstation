// Central client-side cache: conversations, agents, knowledge bases and templates.
// REST is the source of truth for the current view (filters/pagination); the
// WebSocket connection only patches that view incrementally as events arrive.
//
// Template events are deliberately NOT merged from the WS payload: templates are
// private-by-default, and trusting an unfiltered broadcast could flash another
// supervisor's private template content on screen. Instead we re-fetch through
// the authorized REST endpoint, which enforces visibility server-side.
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useWebSocket } from './WebSocketContext';
import * as api from '../api';

const AppDataContext = createContext(null);
export const useAppData = () => useContext(AppDataContext);

const MAX_ALERTS = 20;
const MAX_ACTIVITY = 30;
const LIVE_CONVERSATION_LIMIT = 100;

export const AppDataProvider = ({ children }) => {
  const { lastMessage, subscribe, isConnected } = useWebSocket();

  const [conversations, setConversations] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: LIVE_CONVERSATION_LIMIT });
  const [agents, setAgents] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [loading, setLoading] = useState({ conversations: true, agents: true, knowledgeBases: true, templates: true });
  const [error, setError] = useState({ conversations: null, agents: null, knowledgeBases: null, templates: null });

  const lastFiltersRef = useRef({});
  const templateRefetchTimer = useRef(null);

  const refreshConversations = useCallback(async (filters = {}) => {
    lastFiltersRef.current = filters;
    setLoading((prev) => ({ ...prev, conversations: true }));
    try {
      const result = await api.getConversations({ limit: LIVE_CONVERSATION_LIMIT, ...filters });
      setConversations((result.data || []).map(normalizeConversation));
      setPagination(result.pagination || { total: 0, page: 1, pages: 1, limit: LIVE_CONVERSATION_LIMIT });
      setError((prev) => ({ ...prev, conversations: null }));
    } catch (err) {
      setError((prev) => ({ ...prev, conversations: err.friendlyMessage || err.message }));
    } finally {
      setLoading((prev) => ({ ...prev, conversations: false }));
    }
  }, []);

  const refreshAgents = useCallback(async () => {
    setLoading((prev) => ({ ...prev, agents: true }));
    try {
      setAgents(await api.getAgents());
      setError((prev) => ({ ...prev, agents: null }));
    } catch (err) {
      setError((prev) => ({ ...prev, agents: err.friendlyMessage || err.message }));
    } finally {
      setLoading((prev) => ({ ...prev, agents: false }));
    }
  }, []);

  const refreshKnowledgeBases = useCallback(async () => {
    setLoading((prev) => ({ ...prev, knowledgeBases: true }));
    try {
      setKnowledgeBases(await api.getKnowledgeBases());
      setError((prev) => ({ ...prev, knowledgeBases: null }));
    } catch (err) {
      setError((prev) => ({ ...prev, knowledgeBases: err.friendlyMessage || err.message }));
    } finally {
      setLoading((prev) => ({ ...prev, knowledgeBases: false }));
    }
  }, []);

  const refreshTemplates = useCallback(async (filters = {}) => {
    setLoading((prev) => ({ ...prev, templates: true }));
    try {
      setTemplates(await api.getTemplates(filters));
      setError((prev) => ({ ...prev, templates: null }));
    } catch (err) {
      setError((prev) => ({ ...prev, templates: err.friendlyMessage || err.message }));
    } finally {
      setLoading((prev) => ({ ...prev, templates: false }));
    }
  }, []);

  // Initial load + live channel subscriptions.
  useEffect(() => {
    refreshConversations();
    refreshAgents();
    refreshKnowledgeBases();
    refreshTemplates();
  }, [refreshConversations, refreshAgents, refreshKnowledgeBases, refreshTemplates]);

  useEffect(() => {
    if (!isConnected) return;
    subscribe('conversations');
    subscribe('agents');
    subscribe('templates');
    subscribe('alerts');
  }, [isConnected, subscribe]);

  // Incremental WebSocket patches.
  useEffect(() => {
    if (!lastMessage) return;

    const pushActivity = (entry) =>
      setActivityFeed((prev) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, timestamp: lastMessage.timestamp, ...entry }, ...prev].slice(0, MAX_ACTIVITY));

    switch (lastMessage.type) {
      case 'new_conversation':
        setConversations((prev) => (prev.some((c) => c.id === lastMessage.data.id) ? prev : [lastMessage.data, ...prev]));
        setPagination((prev) => ({ ...prev, total: prev.total + 1 }));
        pushActivity({ kind: 'new_conversation', conversationId: lastMessage.data.id, title: 'New conversation', subtitle: lastMessage.data.customer?.name, color: 'brand' });
        break;

      case 'conversation_updated': {
        let previous = null;
        setConversations((prev) => {
          previous = prev.find((c) => c.id === lastMessage.data.id);
          return mergeById(prev, lastMessage.data);
        });
        if (previous?.humanIntervention?.active !== lastMessage.data.humanIntervention?.active) {
          pushActivity({
            kind: 'intervention',
            conversationId: lastMessage.data.id,
            title: lastMessage.data.humanIntervention?.active ? 'Takeover' : 'Released to AI',
            subtitle: `${lastMessage.data.humanIntervention?.supervisorId || ''} · ${lastMessage.data.customer?.name || ''}`,
            color: lastMessage.data.humanIntervention?.active ? 'orange' : 'green',
          });
        } else if (previous && previous.status !== lastMessage.data.status) {
          pushActivity({ kind: 'status', conversationId: lastMessage.data.id, title: `Marked ${lastMessage.data.status}`, subtitle: lastMessage.data.customer?.name, color: 'gray' });
        }
        break;
      }

      case 'message_update':
        setConversations((prev) =>
          prev.map((c) =>
            c.id === lastMessage.conversationId
              ? {
                  ...c,
                  lastMessage: lastMessage.message,
                  messageCount: (c.messageCount || 0) + 1,
                  // Keep the shadow copy in sync when we have one (from the initial REST load)
                  // so client-side aggregates (e.g. the Peak Hours widget) stay accurate.
                  messages: c.messages ? [...c.messages, lastMessage.message] : c.messages,
                }
              : c
          )
        );
        if (lastMessage.message?.sender === 'supervisor') {
          pushActivity({ kind: 'reply', conversationId: lastMessage.conversationId, title: 'Supervisor replied', subtitle: lastMessage.message.template ? `via "${lastMessage.message.template.name}"` : lastMessage.message.text?.slice(0, 60), color: 'brand' });
        }
        break;

      case 'metrics_update':
        setConversations((prev) =>
          prev.map((c) => (c.id === lastMessage.conversationId ? { ...c, metrics: { ...c.metrics, ...lastMessage.metrics } } : c))
        );
        break;

      case 'agent_update':
        setAgents((prev) => mergeById(prev, lastMessage.data));
        pushActivity({ kind: 'agent', title: 'Agent config updated', subtitle: lastMessage.data.name, color: 'navy' });
        break;

      case 'template_created':
      case 'template_updated':
      case 'template_deleted':
        // Debounced re-fetch: several events can arrive in a burst (e.g. bulk edits).
        clearTimeout(templateRefetchTimer.current);
        templateRefetchTimer.current = setTimeout(() => refreshTemplates(), 150);
        break;

      case 'alert':
        setAlerts((prev) => [{ ...lastMessage, id: `${lastMessage.conversationId}-${lastMessage.timestamp}`, read: false }, ...prev].slice(0, MAX_ALERTS));
        pushActivity({ kind: 'alert', conversationId: lastMessage.conversationId, title: 'High alert raised', subtitle: `${lastMessage.customerName || ''} · ${(lastMessage.reasons || []).join(', ')}`, color: 'red' });
        break;

      default:
        break;
    }
  }, [lastMessage, refreshTemplates]);

  const markAlertsRead = useCallback(() => setAlerts((prev) => prev.map((a) => ({ ...a, read: true }))), []);
  const unreadAlertCount = alerts.filter((a) => !a.read).length;

  const value = {
    conversations,
    pagination,
    agents,
    knowledgeBases,
    templates,
    alerts,
    unreadAlertCount,
    markAlertsRead,
    activityFeed,
    loading,
    error,
    refreshConversations,
    refreshAgents,
    refreshKnowledgeBases,
    refreshTemplates,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

// The REST list endpoint returns full documents (matching the documented API
// contract), but `messageCount` / `lastMessage` are derived fields that only exist
// on the WebSocket hub's summarized payloads. Derive them here once, so every
// consumer (ConversationList, the Peak Hours widget, ...) can rely on both fields
// always being present regardless of which path the data arrived through.
function normalizeConversation(conversation) {
  const messages = conversation.messages || [];
  return {
    ...conversation,
    messageCount: conversation.messageCount ?? messages.length,
    lastMessage: conversation.lastMessage ?? (messages.length ? messages[messages.length - 1] : null),
  };
}

function mergeById(list, updated) {
  const index = list.findIndex((item) => item.id === updated.id);
  if (index === -1) return list;
  const next = [...list];
  next[index] = { ...next[index], ...updated };
  return next;
}
