// "Live supervisor feed" — real WebSocket events (takeovers, releases, replies,
// new conversations, alerts) rendered as a timestamped activity log.
import React, { useState } from 'react';
import { Box, Flex, Text, VStack, Switch, FormControl, FormLabel } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { timeAgo } from '../utils/dateUtils';

const ActivityFeed = ({ activity }) => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const navigate = useNavigate();
  const items = autoRefresh ? activity : activity.slice(0, activity.length ? Math.min(activity.length, 8) : 0);

  return (
    <Box>
      <FormControl display="flex" alignItems="center" justifyContent="flex-end" mb={3}>
        <FormLabel htmlFor="auto-refresh" fontSize="xs" color="gray.400" mb={0} mr={2}>Auto-refresh</FormLabel>
        <Switch id="auto-refresh" size="sm" isChecked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
      </FormControl>
      <VStack align="stretch" spacing={3} maxH="280px" overflowY="auto">
        {items.length === 0 && <Text fontSize="sm" color="gray.400">Waiting for activity…</Text>}
        {items.map((entry) => (
          <Flex key={entry.id} gap={3} cursor={entry.conversationId ? 'pointer' : 'default'} onClick={() => entry.conversationId && navigate(`/conversation/${entry.conversationId}`)} _hover={entry.conversationId ? { opacity: 0.8 } : undefined}>
            <Box w={2} h={2} borderRadius="full" bg={`${entry.color || 'gray'}.400`} mt={1.5} flexShrink={0} />
            <Box minW={0}>
              <Text fontSize="sm" fontWeight="medium" noOfLines={1}>{entry.title}</Text>
              {entry.subtitle && <Text fontSize="xs" color="gray.400" noOfLines={1}>{entry.subtitle}</Text>}
            </Box>
            <Text fontSize="10px" color="gray.300" ml="auto" whiteSpace="nowrap" flexShrink={0}>{timeAgo(entry.timestamp)}</Text>
          </Flex>
        ))}
      </VStack>
    </Box>
  );
};

export default ActivityFeed;
