// Generates src/docs/openapi.json. Run: node scripts/build-openapi.js
const fs = require('fs');
const path = require('path');

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ content: { 'application/json': { schema } } });
const ok = (schema, description = 'OK') => ({ description, ...json(schema) });
const body = (schema) => ({ required: true, ...json(schema) });
const idParam = (name = 'id') => ({ name, in: 'path', required: true, schema: { type: 'string' } });
const query = (name, schema, description) => ({ name, in: 'query', schema, ...(description && { description }) });
const errors = { 400: ok(ref('Error'), 'Validation error'), 404: ok(ref('Error'), 'Not found') };
const obj = (properties, required) => ({ type: 'object', properties, ...(required && { required }) });
const timeRange = query('timeRange', { type: 'string', enum: ['today', 'week', 'month', 'year'] });

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Zangoh AI Agent Supervisor API',
    version: '1.0.0',
    description:
      'REST API for the supervisor workstation. Identity is taken from the optional `x-supervisor-id` header (default `supervisor-001`). Real-time updates are pushed over WebSocket on the same port (see README).',
  },
  servers: [{ url: 'http://localhost:8080' }],
  tags: ['Conversations', 'Intervention', 'Agents', 'Presets', 'Templates', 'Knowledge', 'Analytics', 'Mock LLM'].map((name) => ({ name })),
  components: {
    parameters: {},
    schemas: {
      Error: obj({ message: { type: 'string' }, details: { type: 'array', items: { type: 'string' } } }),
      Message: obj({
        sender: { type: 'string', enum: ['customer', 'agent', 'supervisor', 'system'] },
        text: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        supervisorId: { type: 'string' },
        template: obj({ id: { type: 'string' }, name: { type: 'string' } }),
      }),
      Conversation: obj({
        id: { type: 'string' },
        customer: obj({ id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' }, tier: { type: 'string' } }),
        agent: obj({ id: { type: 'string' }, name: { type: 'string' } }),
        status: { type: 'string', enum: ['active', 'waiting', 'resolved', 'escalated'] },
        alertLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
        alertReasons: { type: 'array', items: { type: 'string', enum: ['negative_sentiment', 'human_requested', 'low_confidence', 'slow_response'] } },
        startTime: { type: 'string', format: 'date-time' },
        metrics: obj({ sentiment: { type: 'number' }, responseTime: { type: 'number' }, confidenceScore: { type: 'number' } }),
        messages: { type: 'array', items: ref('Message') },
        tags: { type: 'array', items: { type: 'string' } },
        humanIntervention: obj({ occurred: { type: 'boolean' }, active: { type: 'boolean' }, supervisorId: { type: 'string' }, timestamp: { type: 'string' }, notes: { type: 'string' } }),
        supervisorNotes: { type: 'string' },
      }),
      Toggle: obj({ id: { type: 'string' }, name: { type: 'string' }, enabled: { type: 'boolean' } }),
      AgentConfig: obj({
        parameters: obj({ temperature: { type: 'number', minimum: 0, maximum: 1 }, max_tokens: { type: 'integer', minimum: 16, maximum: 4096 }, top_p: { type: 'number', minimum: 0, maximum: 1 } }),
        capabilities: { type: 'array', items: ref('Toggle') },
        knowledgeBases: { type: 'array', items: ref('Toggle') },
        escalationThresholds: obj({ lowConfidence: { type: 'number' }, negativeSentiment: { type: 'number' }, responseTime: { type: 'number', description: 'seconds' } }),
        status: { type: 'string', enum: ['active', 'inactive', 'maintenance'] },
      }),
      Agent: {
        allOf: [
          obj({ id: { type: 'string' }, name: { type: 'string' }, model: { type: 'string' }, description: { type: 'string' }, metrics: { type: 'object' } }),
          ref('AgentConfig'),
        ],
      },
      Preset: obj({ id: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, agentId: { type: 'string' }, config: ref('AgentConfig'), createdBy: { type: 'string' } }),
      Variable: obj({ name: { type: 'string' }, description: { type: 'string' } }),
      Template: obj({
        id: { type: 'string' },
        name: { type: 'string' },
        category: { type: 'string' },
        content: { type: 'string', example: 'Your order #{{order_number}} arrives {{expected_date}}.' },
        variables: { type: 'array', items: ref('Variable') },
        createdBy: { type: 'string' },
        isShared: { type: 'boolean' },
        usageCount: { type: 'integer' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      }),
      TemplateInput: obj(
        { name: { type: 'string' }, category: { type: 'string' }, content: { type: 'string' }, variables: { type: 'array', items: ref('Variable') }, isShared: { type: 'boolean' } },
        ['name', 'category', 'content']
      ),
    },
  },
  paths: {
    '/api/conversations': {
      get: {
        tags: ['Conversations'],
        summary: 'List conversations (paginated, filterable)',
        parameters: [
          query('page', { type: 'integer', default: 1 }),
          query('limit', { type: 'integer', default: 10, maximum: 200 }),
          query('status', { type: 'string' }, 'Comma-separated: active,waiting,resolved,escalated'),
          query('alertLevel', { type: 'string' }, 'Comma-separated: low,medium,high'),
          query('agentId', { type: 'string' }),
          query('search', { type: 'string' }, 'Matches customer name, tag or id'),
          query('control', { type: 'string', enum: ['human', 'ai'] }),
        ],
        responses: { 200: ok(obj({ data: { type: 'array', items: ref('Conversation') }, pagination: { type: 'object' } })) },
      },
    },
    '/api/conversations/{id}': {
      get: { tags: ['Conversations'], summary: 'Get a conversation with full history', parameters: [idParam()], responses: { 200: ok(ref('Conversation')), ...errors } },
    },
    '/api/conversations/{id}/messages': {
      post: {
        tags: ['Conversations'],
        summary: 'Add a message (customer messages trigger an AI reply unless a supervisor is in control)',
        parameters: [idParam()],
        requestBody: body(obj({ sender: { type: 'string', enum: ['customer', 'agent', 'supervisor'] }, text: { type: 'string' }, templateId: { type: 'string', description: 'Template used to compose this message (tracks usage)' } }, ['sender', 'text'])),
        responses: { 201: ok(ref('Message'), 'Created'), ...errors },
      },
    },
    '/api/conversations/{id}/status': {
      patch: { tags: ['Conversations'], summary: 'Update status', parameters: [idParam()], requestBody: body(obj({ status: { type: 'string', enum: ['active', 'waiting', 'resolved', 'escalated'] } }, ['status'])), responses: { 200: ok(obj({ message: { type: 'string' }, status: { type: 'string' } })), ...errors } },
    },
    '/api/conversations/{id}/tags': {
      post: { tags: ['Conversations'], summary: 'Add tags', parameters: [idParam()], requestBody: body(obj({ tags: { type: 'array', items: { type: 'string' } } }, ['tags'])), responses: { 200: ok(obj({ message: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } })), ...errors } },
    },
    '/api/conversations/{id}/feedback': {
      post: { tags: ['Conversations'], summary: "Rate the AI agent's handling of the conversation", parameters: [idParam()], requestBody: body(obj({ rating: { type: 'integer', minimum: 1, maximum: 5 }, comment: { type: 'string' } }, ['rating'])), responses: { 201: ok(obj({ message: { type: 'string' }, feedback: { type: 'object' } }), 'Created'), ...errors } },
    },
    '/api/intervene': {
      post: {
        tags: ['Intervention'],
        summary: 'Take over a conversation from the AI (409 if another supervisor holds it)',
        requestBody: body(obj({ conversationId: { type: 'string' }, supervisorId: { type: 'string' }, notes: { type: 'string' } }, ['conversationId'])),
        responses: { 200: ok(obj({ message: { type: 'string' }, intervention: { type: 'object' } })), 409: ok(ref('Error'), 'Held by another supervisor'), ...errors },
      },
    },
    '/api/intervene/release': {
      post: {
        tags: ['Intervention'],
        summary: 'Return control to the AI with guidance notes',
        requestBody: body(obj({ conversationId: { type: 'string' }, supervisorNotes: { type: 'string' } }, ['conversationId'])),
        responses: { 200: ok(obj({ message: { type: 'string' }, conversation: { type: 'object' } })), ...errors },
      },
    },
    '/api/agents': { get: { tags: ['Agents'], summary: 'List agents', responses: { 200: ok({ type: 'array', items: ref('Agent') }) } } },
    '/api/agents/{id}': { get: { tags: ['Agents'], summary: 'Get agent', parameters: [idParam()], responses: { 200: ok(ref('Agent')), ...errors } } },
    '/api/agents/{id}/config': {
      patch: { tags: ['Agents'], summary: 'Partially update agent configuration (validated)', parameters: [idParam()], requestBody: body(ref('AgentConfig')), responses: { 200: ok(obj({ message: { type: 'string' }, agent: ref('Agent') })), ...errors } },
    },
    '/api/agents/{id}/metrics': { get: { tags: ['Agents'], summary: 'Baseline + live performance metrics', parameters: [idParam()], responses: { 200: ok({ type: 'object' }), ...errors } } },
    '/api/presets': {
      get: { tags: ['Presets'], summary: 'List configuration presets', responses: { 200: ok({ type: 'array', items: ref('Preset') }) } },
      post: { tags: ['Presets'], summary: 'Save a configuration preset', requestBody: body(obj({ name: { type: 'string' }, description: { type: 'string' }, agentId: { type: 'string' }, config: ref('AgentConfig') }, ['name', 'config'])), responses: { 201: ok(ref('Preset'), 'Created'), ...errors } },
    },
    '/api/presets/{id}': { delete: { tags: ['Presets'], summary: 'Delete a preset (author only)', parameters: [idParam()], responses: { 200: ok(obj({ message: { type: 'string' } })), 403: ok(ref('Error'), 'Forbidden'), ...errors } } },
    '/api/templates': {
      get: {
        tags: ['Templates'],
        summary: 'List templates visible to the supervisor (shared + own)',
        parameters: [
          query('shared', { type: 'boolean' }),
          query('mine', { type: 'boolean' }),
          query('category', { type: 'string' }),
          query('search', { type: 'string' }),
          query('sort', { type: 'string', enum: ['recent', 'popular', 'name'] }),
        ],
        responses: { 200: ok({ type: 'array', items: ref('Template') }) },
      },
      post: { tags: ['Templates'], summary: 'Create a template (variables derived from {{placeholders}})', requestBody: body(ref('TemplateInput')), responses: { 201: ok(ref('Template'), 'Created'), ...errors } },
    },
    '/api/templates/categories': { get: { tags: ['Templates'], summary: 'Distinct categories', responses: { 200: ok({ type: 'array', items: { type: 'string' } }) } } },
    '/api/templates/{id}': {
      get: { tags: ['Templates'], summary: 'Get template', parameters: [idParam()], responses: { 200: ok(ref('Template')), ...errors } },
      patch: { tags: ['Templates'], summary: 'Update template (author only)', parameters: [idParam()], requestBody: body(ref('TemplateInput')), responses: { 200: ok(ref('Template')), 403: ok(ref('Error'), 'Forbidden'), ...errors } },
      delete: { tags: ['Templates'], summary: 'Delete template (author only)', parameters: [idParam()], responses: { 200: ok(obj({ message: { type: 'string' } })), 403: ok(ref('Error'), 'Forbidden'), ...errors } },
    },
    '/api/templates/{id}/render': {
      post: {
        tags: ['Templates'],
        summary: 'Substitute variables server-side',
        parameters: [idParam()],
        requestBody: body(obj({ values: { type: 'object', additionalProperties: { type: 'string' } } })),
        responses: { 200: ok(obj({ text: { type: 'string' }, missing: { type: 'array', items: { type: 'string' } }, complete: { type: 'boolean' } })), ...errors },
      },
    },
    '/api/knowledge-base': { get: { tags: ['Knowledge'], summary: 'List knowledge bases', responses: { 200: ok({ type: 'array', items: { type: 'object' } }) } } },
    '/api/vector/search': {
      post: { tags: ['Knowledge'], summary: 'Semantic search (Qdrant, in-memory fallback)', requestBody: body(obj({ query: { type: 'string' }, knowledgeBases: { type: 'array', items: { type: 'string' } }, limit: { type: 'integer' } }, ['query'])), responses: { 200: ok({ type: 'object' }), ...errors } },
    },
    '/api/vector/kb/{id}': { get: { tags: ['Knowledge'], summary: 'Full knowledge base document', parameters: [idParam()], responses: { 200: ok({ type: 'object' }), ...errors } } },
    '/api/analytics/overview': { get: { tags: ['Analytics'], summary: 'Headline metrics + daily trends', parameters: [timeRange], responses: { 200: ok({ type: 'object' }) } } },
    '/api/analytics/agents': { get: { tags: ['Analytics'], summary: 'Per-agent stats + trends', parameters: [timeRange, query('agentId', { type: 'string' })], responses: { 200: ok({ type: 'object' }) } } },
    '/api/analytics/issues': { get: { tags: ['Analytics'], summary: 'Top issues from conversation tags', parameters: [timeRange], responses: { 200: ok({ type: 'object' }) } } },
    '/api/llm/generate': {
      post: { tags: ['Mock LLM'], summary: 'Generate an agent reply', requestBody: body(obj({ messages: { type: 'array', items: obj({ role: { type: 'string' }, content: { type: 'string' } }) }, parameters: { type: 'object' }, capabilities: { type: 'array', items: { type: 'string' } }, knowledgeBases: { type: 'array', items: { type: 'string' } }, guidance: { type: 'string' } }, ['messages'])), responses: { 200: ok({ type: 'object' }), ...errors } },
    },
    '/api/llm/sentiment': { post: { tags: ['Mock LLM'], summary: 'Sentiment of a text (0..1)', requestBody: body(obj({ text: { type: 'string' } }, ['text'])), responses: { 200: ok({ type: 'object' }), ...errors } } },
    '/health': { get: { summary: 'Health check', responses: { 200: ok({ type: 'object' }) } } },
  },
};

const out = path.join(__dirname, '..', 'src', 'docs', 'openapi.json');
fs.writeFileSync(out, `${JSON.stringify(spec, null, 2)}\n`);
console.log(`wrote ${out}`);
