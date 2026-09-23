// REST client. Every request carries the acting supervisor's id so the backend can
// enforce per-supervisor template ownership and attribute messages/interventions.
import axios from 'axios';
import { getSupervisorId } from '../utils/supervisorStore';

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const api = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use((config) => {
  config.headers['x-supervisor-id'] = getSupervisorId();
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || 'Request failed';
    console.error('API error:', message, error.response?.data?.details || '');
    return Promise.reject(Object.assign(error, { friendlyMessage: message }));
  }
);

const unwrap = (promise) => promise.then((res) => res.data);

// Conversations
export const getConversations = (filters = {}) => unwrap(api.get('/api/conversations', { params: filters }));
export const getConversation = (id) => unwrap(api.get(`/api/conversations/${id}`));
export const addMessage = (conversationId, payload) => unwrap(api.post(`/api/conversations/${conversationId}/messages`, payload));
export const updateConversationStatus = (conversationId, status) => unwrap(api.patch(`/api/conversations/${conversationId}/status`, { status }));
export const addTags = (conversationId, tags) => unwrap(api.post(`/api/conversations/${conversationId}/tags`, { tags }));
export const addFeedback = (conversationId, feedback) => unwrap(api.post(`/api/conversations/${conversationId}/feedback`, feedback));

// Intervention
export const interveneInConversation = (conversationId, notes) => unwrap(api.post('/api/intervene', { conversationId, notes }));
export const releaseIntervention = (conversationId, supervisorNotes) => unwrap(api.post('/api/intervene/release', { conversationId, supervisorNotes }));

// Agents
export const getAgents = () => unwrap(api.get('/api/agents'));
export const getAgent = (id) => unwrap(api.get(`/api/agents/${id}`));
export const updateAgentConfig = (id, config) => unwrap(api.patch(`/api/agents/${id}/config`, config));
export const getAgentMetrics = (id) => unwrap(api.get(`/api/agents/${id}/metrics`));

// Config presets
export const getPresets = () => unwrap(api.get('/api/presets'));
export const createPreset = (preset) => unwrap(api.post('/api/presets', preset));
export const deletePreset = (id) => unwrap(api.delete(`/api/presets/${id}`));

// Response templates
export const getTemplates = (filters = {}) => unwrap(api.get('/api/templates', { params: filters }));
export const getTemplateCategories = () => unwrap(api.get('/api/templates/categories'));
export const getTemplate = (id) => unwrap(api.get(`/api/templates/${id}`));
export const createTemplate = (template) => unwrap(api.post('/api/templates', template));
export const updateTemplate = (id, template) => unwrap(api.patch(`/api/templates/${id}`, template));
export const deleteTemplate = (id) => unwrap(api.delete(`/api/templates/${id}`));
export const renderTemplate = (id, values) => unwrap(api.post(`/api/templates/${id}/render`, { values }));

// Mock LLM (used by the Co-pilot recommendation preview)
export const generateReply = (payload) => unwrap(api.post('/api/llm/generate', payload));

// Knowledge base
export const getKnowledgeBases = () => unwrap(api.get('/api/knowledge-base'));
export const searchKnowledge = (query, knowledgeBases, limit) => unwrap(api.post('/api/vector/search', { query, knowledgeBases, limit }));

// Analytics
export const getOverviewAnalytics = (timeRange) => unwrap(api.get('/api/analytics/overview', { params: { timeRange } }));
export const getAgentAnalytics = (timeRange, agentId) => unwrap(api.get('/api/analytics/agents', { params: { timeRange, agentId } }));
export const getIssueAnalytics = (timeRange) => unwrap(api.get('/api/analytics/issues', { params: { timeRange } }));

export default api;
