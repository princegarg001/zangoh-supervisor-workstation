// Scenario library shared by the seed script and the live simulator.

const SCENARIOS = [
  {
    tag: 'shipping',
    extraTags: ['delay'],
    agentId: 'agent-cs-1',
    openers: [
      'My order ORD-48213-XQ was supposed to arrive yesterday and tracking has not updated.',
      'Where is my package? It has been a week since I ordered.',
      'Can you tell me when order ORD-77120-LM will be delivered?',
    ],
    sampleReply: 'I have checked your order: it is in transit and should be delivered within 1-2 business days.',
    followUps: {
      negative: [
        'That is not good enough, I paid for express shipping!',
        'This delay is unacceptable. I need it by Friday.',
        'I want to speak to a human, this is really frustrating.',
      ],
      positive: ['Okay, can I get the tracking link please?', 'Thanks, that helps. Will I get an email when it ships?', 'Good to know, I appreciate the update.'],
    },
  },
  {
    tag: 'returns',
    extraTags: ['refund'],
    agentId: 'agent-cs-3',
    openers: [
      'I would like to return the jacket I bought, it does not fit.',
      'How do I get a refund for a damaged blender?',
      'Can I exchange my shoes for a larger size?',
    ],
    sampleReply: 'You can return it within 30 days of delivery using our prepaid mail-in label.',
    followUps: {
      negative: ['I still have not received my refund, this is ridiculous.', 'Why do I have to pay for return shipping? It arrived damaged!', 'It has been over a week, where is my money?'],
      positive: ['Great, how long does the refund take?', 'Perfect, can you email me the label?', 'That works, thanks for sorting it out.'],
    },
  },
  {
    tag: 'product',
    extraTags: ['information'],
    agentId: 'agent-cs-2',
    openers: [
      'What is the warranty on the Eco-Friendly Blender?',
      'Is the Smart Home Security System compatible with Alexa?',
      'Does the Professional Chef Blender come in black?',
    ],
    sampleReply: 'Yes! It comes with a multi-year manufacturer warranty and works with all major assistants.',
    followUps: {
      negative: ['That does not answer my question about the specs.', 'The product page says something different, this is confusing.', 'I am still not sure this is the right fit for me.'],
      positive: ['Nice, what colors are available?', 'Does it need a monthly subscription?', 'Sounds great, thanks for the detail.'],
    },
  },
  {
    tag: 'billing',
    extraTags: ['payment'],
    agentId: 'agent-cs-1',
    openers: [
      'I was charged twice for my last order.',
      'My payment failed but the money left my account.',
      'Why is there an extra fee on my invoice?',
    ],
    sampleReply: 'I can see the duplicate charge and have started a refund; it takes 3-5 business days.',
    followUps: {
      negative: ['I need a manager, this double charge is a serious problem.', 'This is the second time this happened, I am very upset.', 'This is unacceptable, I want this fixed today.'],
      positive: ['Thank you, will I get a confirmation email?', 'Okay, appreciate the quick help.', 'Great, thanks for clearing that up.'],
    },
  },
];

const FOLLOW_UPS = {
  negative: ['This is taking too long.', 'I am not happy with this answer.', 'Can I talk to a real person please?'],
  positive: ['Thanks for the help!', 'Great, that makes sense.', 'Okay, sounds good.'],
  closing: ['Thanks, that solves it. Have a great day!', 'Perfect, thank you so much for your help!', 'Great, all sorted. Thanks!'],
};

const NAMES = [
  'Priya Sharma', 'Liam Walker', 'Sofia Garcia', 'Noah Kim', 'Emma Johansson', 'Arjun Mehta', 'Olivia Brown',
  'Lucas Martin', 'Chloe Dubois', 'Ethan Wright', 'Aisha Khan', 'Mateo Rossi', 'Hannah Lee', 'Daniel Novak',
];

module.exports = { SCENARIOS, FOLLOW_UPS, NAMES };
