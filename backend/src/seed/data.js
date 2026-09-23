// Seed data. The first three conversations are the ones from the challenge brief;
// the rest is deterministic history so analytics and filters have something to show.
const { SCENARIOS, FOLLOW_UPS, NAMES } = require('./scenarios');

const minutesAgo = (m) => new Date(Date.now() - m * 60000);

const agents = [
  {
    id: 'agent-cs-1',
    name: 'Customer Service Agent',
    model: 'gpt-3.5-turbo',
    description: 'General customer service agent for handling inquiries',
    parameters: { temperature: 0.7, max_tokens: 150, top_p: 1.0 },
    capabilities: [
      { id: 'order_lookup', name: 'Order Lookup', enabled: true },
      { id: 'return_processing', name: 'Return Processing', enabled: true },
      { id: 'product_info', name: 'Product Information', enabled: true },
      { id: 'shipping_calculator', name: 'Shipping Calculator', enabled: false },
      { id: 'discount_manager', name: 'Discount Manager', enabled: false },
    ],
    knowledgeBases: [
      { id: 'kb-cs-general', name: 'Customer Service Guidelines', enabled: true },
      { id: 'kb-product-catalog', name: 'Product Catalog', enabled: true },
      { id: 'kb-shipping-policy', name: 'Shipping Policy', enabled: true },
      { id: 'kb-return-policy', name: 'Return Policy', enabled: true },
    ],
    escalationThresholds: { lowConfidence: 0.4, negativeSentiment: 0.3, responseTime: 20 },
    status: 'active',
    metrics: {
      conversations: 2456, avgResponseTime: 12.7, satisfaction: 0.86, escalationRate: 0.16,
      topIssues: [{ name: 'Shipping Delays', count: 587 }, { name: 'Order Status', count: 423 }, { name: 'Payment Issues', count: 312 }],
    },
  },
  {
    id: 'agent-cs-2',
    name: 'Product Specialist Agent',
    model: 'gpt-4o',
    description: 'Specialized agent for product information and technical questions',
    parameters: { temperature: 0.5, max_tokens: 200, top_p: 0.9 },
    capabilities: [
      { id: 'order_lookup', name: 'Order Lookup', enabled: false },
      { id: 'return_processing', name: 'Return Processing', enabled: false },
      { id: 'product_info', name: 'Product Information', enabled: true },
      { id: 'product_comparison', name: 'Product Comparison', enabled: true },
      { id: 'technical_support', name: 'Technical Support', enabled: true },
    ],
    knowledgeBases: [
      { id: 'kb-product-catalog', name: 'Product Catalog', enabled: true },
      { id: 'kb-product-specs', name: 'Technical Specifications', enabled: true },
      { id: 'kb-product-faq', name: 'Product FAQs', enabled: true },
    ],
    escalationThresholds: { lowConfidence: 0.6, negativeSentiment: 0.4, responseTime: 15 },
    status: 'active',
    metrics: {
      conversations: 1879, avgResponseTime: 14.2, satisfaction: 0.91, escalationRate: 0.08,
      topIssues: [{ name: 'Product Features', count: 542 }, { name: 'Compatibility', count: 389 }, { name: 'Technical Specs', count: 298 }],
    },
  },
  {
    id: 'agent-cs-3',
    name: 'Returns Specialist Agent',
    model: 'claude-3-haiku',
    description: 'Specialized agent for handling returns and refunds',
    parameters: { temperature: 0.3, max_tokens: 150, top_p: 0.95 },
    capabilities: [
      { id: 'order_lookup', name: 'Order Lookup', enabled: true },
      { id: 'return_processing', name: 'Return Processing', enabled: true },
      { id: 'refund_calculator', name: 'Refund Calculator', enabled: true },
      { id: 'shipping_calculator', name: 'Shipping Calculator', enabled: true },
      { id: 'discount_manager', name: 'Discount Manager', enabled: false },
    ],
    knowledgeBases: [
      { id: 'kb-return-policy', name: 'Return Policy', enabled: true },
      { id: 'kb-shipping-policy', name: 'Shipping Policy', enabled: true },
      { id: 'kb-warranty-info', name: 'Warranty Information', enabled: true },
    ],
    escalationThresholds: { lowConfidence: 0.5, negativeSentiment: 0.3, responseTime: 18 },
    status: 'active',
    metrics: {
      conversations: 1456, avgResponseTime: 11.5, satisfaction: 0.84, escalationRate: 0.19,
      topIssues: [{ name: 'Return Eligibility', count: 412 }, { name: 'Refund Status', count: 376 }, { name: 'Exchange Process', count: 289 }],
    },
  },
];

const knowledgeBases = [
  { id: 'kb-cs-general', name: 'Customer Service Guidelines', description: 'General customer service policies and procedures', documentCount: 45, lastUpdated: new Date('2023-09-15T14:30:00Z') },
  { id: 'kb-product-catalog', name: 'Product Catalog', description: 'Complete product listings with details and pricing', documentCount: 1243, lastUpdated: new Date('2023-10-01T09:15:00Z') },
  { id: 'kb-shipping-policy', name: 'Shipping Policy', description: 'Shipping options, timelines, and costs', documentCount: 12, lastUpdated: new Date('2023-08-22T11:45:00Z') },
  { id: 'kb-return-policy', name: 'Return Policy', description: 'Return and exchange procedures and limitations', documentCount: 18, lastUpdated: new Date('2023-09-05T16:20:00Z') },
  { id: 'kb-product-specs', name: 'Technical Specifications', description: 'Detailed technical information for all products', documentCount: 842, lastUpdated: new Date('2023-09-28T13:10:00Z') },
  { id: 'kb-product-faq', name: 'Product FAQs', description: 'Frequently asked questions about products', documentCount: 367, lastUpdated: new Date('2023-09-18T10:30:00Z') },
  { id: 'kb-warranty-info', name: 'Warranty Information', description: 'Warranty terms and claim procedures', documentCount: 29, lastUpdated: new Date('2023-08-15T15:45:00Z') },
];

const briefConversations = [
  {
    id: 'conv-2023-10',
    customer: { id: 'cust-5672', name: 'Alex Johnson', email: 'alex.johnson@example.com', tier: 'Gold' },
    agent: { id: 'agent-cs-1', name: 'Customer Service Agent' },
    status: 'active',
    startTime: minutesAgo(20),
    metrics: { sentiment: 0.2, responseTime: 15.3, confidenceScore: 0.65 },
    messages: [
      ['customer', "I ordered a package 5 days ago and it still hasn't arrived. The tracking hasn't updated in 3 days.", 20],
      ['agent', 'I understand your concern about your package. Let me check the status for you. Could you please provide your order number?', 19],
      ['customer', "Order #ORD-29384-KJH. I need this package by tomorrow for my daughter's birthday.", 18],
      ['agent', "Thank you for providing your order number. I'm checking your order status now.", 17],
      ['agent', 'I can see that your package is currently in transit. Sometimes tracking information may take time to update.', 16],
      ['customer', "That's not helpful at all. I need to know if it will arrive by tomorrow. This is a gift for my daughter!", 15],
      ['agent', 'I apologize for the inconvenience. Based on the current location of your package, standard delivery estimates suggest it should arrive within 1-2 business days.', 14],
      ['customer', "That's not good enough. I paid for express shipping specifically to have it arrive by tomorrow. I want to speak to a human representative.", 13],
    ],
    tags: ['shipping', 'delay', 'urgent', 'escalation-requested'],
  },
  {
    id: 'conv-2023-45',
    customer: { id: 'cust-3891', name: 'Morgan Smith', email: 'morgan.smith@example.com', tier: 'Standard' },
    agent: { id: 'agent-cs-2', name: 'Product Specialist Agent' },
    status: 'active',
    startTime: minutesAgo(10),
    metrics: { sentiment: 0.8, responseTime: 8.2, confidenceScore: 0.92 },
    messages: [
      ['customer', 'Does the Eco-Friendly Blender come with a warranty?', 10],
      ['agent', "Yes, the Eco-Friendly Blender comes with a 2-year manufacturer's warranty that covers parts and labor for defects in materials or workmanship.", 9],
      ['customer', "Great! And what's the wattage on the motor?", 8],
      ['agent', 'The Eco-Friendly Blender features a powerful 1200-watt motor, which is excellent for blending tough ingredients like frozen fruits and vegetables.', 7],
      ['customer', 'Perfect. One last question - does it come in any colors besides white?', 6],
      ['agent', 'Yes, the Eco-Friendly Blender is available in white, black, red, and a limited edition green color. All colors are currently in stock and the same price.', 5],
      ['customer', "Thanks so much for the information! I think I'll go with the red one.", 4],
    ],
    tags: ['product', 'information', 'positive'],
  },
  {
    id: 'conv-2023-78',
    customer: { id: 'cust-7294', name: 'Jamie Lee', email: 'jamie.lee@example.com', tier: 'Platinum' },
    agent: { id: 'agent-cs-3', name: 'Returns Specialist Agent' },
    status: 'active',
    startTime: minutesAgo(15),
    metrics: { sentiment: 0.5, responseTime: 12.7, confidenceScore: 0.45 },
    messages: [
      ['customer', "I bought a sweater last month but it's pilling badly after just two washes. I'd like to return it but I no longer have the receipt. Can I still get a refund? Also, if I exchange it for something else, will I need to pay for shipping?", 15],
      ['agent', "I'm sorry to hear about the quality issue with your sweater. For returns without a receipt, we can offer store credit at the current selling price if we can verify the purchase through the credit card used, your loyalty account, or email address.", 14],
      ['customer', "I used my loyalty account when purchasing. It's linked to my email jamie.lee@example.com.", 13],
      ['agent', "I've found your purchase from April 15th for the Cozy Comfort Sweater in size M for $49.99. Since this is a quality issue, we'd be happy to process a full refund to your original payment method.", 11],
      ['customer', "That's great, thanks! What about my second question regarding exchange shipping?", 10],
      ['agent', "For exchanges due to quality issues, we cover the return shipping costs. If you'd like to exchange for a different item, we also provide free shipping for the new item as a courtesy.", 9],
      ['customer', "Perfect! I think I'll go ahead with the refund for now and order something else later. How do I start the return process?", 8],
    ],
    tags: ['returns', 'quality-issue', 'multi-part-question'],
  },
].map((c) => ({
  ...c,
  lastActivityAt: minutesAgo(c.messages[c.messages.length - 1][2]),
  messages: c.messages.map(([sender, text, ago]) => ({ sender, text, timestamp: minutesAgo(ago) })),
  humanIntervention: { occurred: false, active: false },
}));

// Deterministic PRNG so the seeded history is identical on every run.
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function historicalConversations(count = 24) {
  const rand = rng(42);
  const agentNames = Object.fromEntries(agents.map((a) => [a.id, a.name]));
  return Array.from({ length: count }, (_, i) => {
    const scenario = SCENARIOS[i % SCENARIOS.length];
    const start = minutesAgo(60 * 3 + i * 60 * 7 + Math.floor(rand() * 120)); // spread over ~7 days
    const at = (min) => new Date(start.getTime() + min * 60000);
    const escalated = rand() < 0.25;
    const name = NAMES[i % NAMES.length];
    const sentiment = escalated ? 0.55 + rand() * 0.2 : 0.7 + rand() * 0.25;

    const messages = [
      { sender: 'customer', text: scenario.openers[i % scenario.openers.length], timestamp: at(0) },
      { sender: 'agent', text: scenario.sampleReply, timestamp: at(1) },
    ];
    const conversation = {
      id: `conv-h${String(i + 1).padStart(3, '0')}`,
      customer: { id: `cust-${2000 + i}`, name, email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`, tier: i % 5 === 0 ? 'Platinum' : 'Standard' },
      agent: { id: scenario.agentId, name: agentNames[scenario.agentId] },
      status: 'resolved',
      startTime: start,
      metrics: {
        sentiment: Number(sentiment.toFixed(2)),
        responseTime: Number((4 + rand() * 12).toFixed(1)),
        confidenceScore: Number((0.65 + rand() * 0.3).toFixed(2)),
      },
      tags: [scenario.tag, ...(scenario.extraTags || [])],
      humanIntervention: { occurred: escalated, active: false },
      interventions: [],
      feedback: [],
    };

    if (escalated) {
      messages.push(
        { sender: 'customer', text: scenario.followUps.negative[0], timestamp: at(3) },
        { sender: 'system', text: 'Supervisor supervisor-001 took over the conversation.', timestamp: at(4) },
        { sender: 'supervisor', text: "I'm sorry about this. I've personally resolved it and added a $10 credit to your account.", timestamp: at(5) },
        { sender: 'system', text: 'Control returned to AI by supervisor-001. Guidance: Offer expedited shipping on the next order.', timestamp: at(6) }
      );
      Object.assign(conversation.humanIntervention, { supervisorId: 'supervisor-001', timestamp: at(4), notes: 'Customer frustrated' });
      conversation.interventions.push({ supervisorId: 'supervisor-001', startedAt: at(4), endedAt: at(6), takeoverNotes: 'Customer frustrated', returnNotes: 'Offer expedited shipping on the next order.' });
      conversation.feedback.push({ supervisorId: 'supervisor-001', rating: 2, comment: 'AI should have offered compensation earlier.', createdAt: at(7) });
    }
    messages.push({ sender: 'customer', text: FOLLOW_UPS.closing[i % FOLLOW_UPS.closing.length], timestamp: at(8) });
    conversation.messages = messages;
    conversation.endTime = at(9);
    conversation.lastActivityAt = at(9);
    return conversation;
  });
}

const conversations = [...briefConversations, ...historicalConversations()];

const templates = [
  {
    id: 'template-001',
    name: 'Shipping Delay Apology',
    category: 'shipping',
    content: "I apologize for the delay with your order #{{order_number}}. We're experiencing some delays in our shipping department, but your package is expected to arrive by {{expected_date}}. As a courtesy for the inconvenience, I've added a $10 credit to your account.",
    variables: [
      { name: 'order_number', description: "Customer's order number" },
      { name: 'expected_date', description: 'Expected delivery date' },
    ],
    createdBy: 'supervisor-001',
    isShared: true,
    usageCount: 14,
  },
  {
    id: 'template-002',
    name: 'Return Process Instructions',
    category: 'returns',
    content: 'To return your {{product_name}}, please follow these steps:\n1. Print the return label from your order history\n2. Pack the item in its original packaging if possible\n3. Attach the return label to the outside of the package\n4. Drop off at any {{carrier_name}} location\n\nYou should receive your refund within {{refund_days}} business days after we receive the return.',
    variables: [
      { name: 'product_name', description: 'Name of the product being returned' },
      { name: 'carrier_name', description: 'Shipping carrier name' },
      { name: 'refund_days', description: 'Number of days for refund processing' },
    ],
    createdBy: 'supervisor-001',
    isShared: false,
    usageCount: 6,
  },
  {
    id: 'template-003',
    name: 'Supervisor Introduction',
    category: 'general',
    content: "Hi {{customer_name}}, my name is {{supervisor_name}} and I'm a supervisor here at RetailPlus. I've read through your conversation and I'm going to personally make sure this gets resolved for you.",
    variables: [
      { name: 'customer_name', description: "Customer's name (auto-filled)" },
      { name: 'supervisor_name', description: 'Your name (auto-filled)' },
    ],
    createdBy: 'supervisor-001',
    isShared: true,
    usageCount: 21,
  },
  {
    id: 'template-004',
    name: 'Duplicate Charge Refund',
    category: 'billing',
    content: "Hi {{customer_name}}, I've confirmed the duplicate charge of {{amount}} and issued a refund. Your reference number is {{reference_number}}. Refunds take 3-5 business days, and I've added a $10 store credit for the trouble.",
    variables: [
      { name: 'customer_name', description: "Customer's name (auto-filled)" },
      { name: 'amount', description: 'Charged amount, e.g. $49.99' },
      { name: 'reference_number', description: 'Refund transaction reference' },
    ],
    createdBy: 'supervisor-002',
    isShared: true,
    usageCount: 9,
  },
  {
    id: 'template-005',
    name: 'Warranty Claim Next Steps',
    category: 'product',
    content: 'Your {{product_name}} is covered by a {{warranty_period}} warranty. Please reply with a photo of the issue and your order number {{order_number}}, and we will ship a replacement at no cost.',
    variables: [
      { name: 'product_name', description: 'Product under warranty' },
      { name: 'warranty_period', description: 'e.g. 2-year' },
      { name: 'order_number', description: "Customer's order number" },
    ],
    createdBy: 'supervisor-002',
    isShared: true,
    usageCount: 3,
  },
  {
    id: 'template-006',
    name: 'VIP Escalation Handoff (private)',
    category: 'general',
    content: 'Thanks {{customer_name}}. As a Platinum member you have a dedicated account manager, {{manager_name}}, who will call you within {{hours}} hours.',
    variables: [
      { name: 'customer_name', description: "Customer's name" },
      { name: 'manager_name', description: 'Account manager name' },
      { name: 'hours', description: 'Callback window in hours' },
    ],
    createdBy: 'supervisor-002',
    isShared: false, // private to another supervisor – must NOT be visible to supervisor-001
    usageCount: 1,
  },
];

const presets = [
  {
    id: 'preset-conservative',
    name: 'Conservative',
    description: 'Deterministic answers, early escalation. Good for sensitive periods.',
    config: {
      parameters: { temperature: 0.2, max_tokens: 120, top_p: 0.8 },
      escalationThresholds: { lowConfidence: 0.6, negativeSentiment: 0.4, responseTime: 15 },
    },
    createdBy: 'supervisor-001',
  },
  {
    id: 'preset-balanced',
    name: 'Balanced',
    description: 'Default production settings.',
    config: {
      parameters: { temperature: 0.5, max_tokens: 150, top_p: 0.95 },
      escalationThresholds: { lowConfidence: 0.45, negativeSentiment: 0.3, responseTime: 20 },
    },
    createdBy: 'supervisor-001',
  },
  {
    id: 'preset-holiday-peak',
    name: 'Holiday Peak',
    description: 'Longer, friendlier replies and tolerant latency for peak season volume.',
    config: {
      parameters: { temperature: 0.8, max_tokens: 250, top_p: 1 },
      escalationThresholds: { lowConfidence: 0.35, negativeSentiment: 0.25, responseTime: 35 },
    },
    createdBy: 'supervisor-001',
  },
];

module.exports = { agents, knowledgeBases, conversations, templates, presets };
