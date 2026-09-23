// "Critical signals" — the real alert feed from AppDataContext, rendered as a
// timestamped list with a severity dot.
import React from 'react';
import { Box, Flex, Text, VStack } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { timeAgo } from '../utils/dateUtils';
import { ALERT_REASON_LABELS } from './StatusBadge';

const CriticalSignals = ({ alerts }) => {
  const navigate = useNavigate();
  if (!alerts.length) return <Text fontSize="sm" color="gray.400">No critical signals right now</Text>;

  return (
    <VStack align="stretch" spacing={3}>
      {alerts.slice(0, 6).map((alert) => (
        <Flex key={alert.id} gap={3} cursor="pointer" onClick={() => navigate(`/conversation/${alert.conversationId}`)} _hover={{ opacity: 0.8 }}>
          <Box w={2} h={2} borderRadius="full" bg="red.400" mt={1.5} flexShrink={0} />
          <Box minW={0}>
            <Text fontSize="sm" fontWeight="medium" noOfLines={1}>{alert.customerName || alert.conversationId}</Text>
            <Text fontSize="xs" color="gray.400" noOfLines={1}>
              {(alert.reasons || []).map((r) => ALERT_REASON_LABELS[r] || r).join(', ')} · {timeAgo(alert.timestamp)}
            </Text>
          </Box>
        </Flex>
      ))}
    </VStack>
  );
};

export default CriticalSignals;
