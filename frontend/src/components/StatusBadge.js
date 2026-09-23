import React from 'react';
import { Badge } from '@chakra-ui/react';

const STATUS_COLOR = { active: 'green', waiting: 'orange', resolved: 'blue', escalated: 'purple' };
const ALERT_COLOR = { low: 'gray', medium: 'orange', high: 'red' };

export const StatusBadge = ({ status, ...props }) => (
  <Badge colorScheme={STATUS_COLOR[status] || 'gray'} {...props}>
    {status}
  </Badge>
);

export const AlertBadge = ({ level, ...props }) => {
  if (!level || level === 'low') return null;
  return (
    <Badge colorScheme={ALERT_COLOR[level] || 'gray'} {...props}>
      {level} alert
    </Badge>
  );
};

export const ALERT_REASON_LABELS = {
  negative_sentiment: 'Negative sentiment',
  human_requested: 'Customer asked for a human',
  low_confidence: 'Low AI confidence',
  slow_response: 'Slow response time',
};
