// "Queue health" — real per-agent risk, computed from that agent's currently open
// conversations (no synthetic "queues" in our data model, so agents are the queue).
import React from 'react';
import { Box, Flex, Text, Badge, VStack } from '@chakra-ui/react';

const STATUS = (pct) => (pct >= 66 ? { label: 'Risk', color: 'red' } : pct >= 33 ? { label: 'Watch', color: 'orange' } : { label: 'Healthy', color: 'green' });

const QueueHealth = ({ agents, conversations }) => {
  const rows = agents
    .map((agent) => {
      const open = conversations.filter((c) => c.agent?.id === agent.id && c.status !== 'resolved');
      const risky = open.filter((c) => c.alertLevel !== 'low').length;
      const pct = open.length ? Math.round((risky / open.length) * 100) : 0;
      return { agent, open: open.length, pct };
    })
    .sort((a, b) => b.pct - a.pct);

  return (
    <VStack align="stretch" spacing={4}>
      {rows.map(({ agent, open, pct }) => {
        const status = STATUS(pct);
        return (
          <Box key={agent.id}>
            <Flex justify="space-between" mb={1.5}>
              <Text fontSize="sm" fontWeight="medium" noOfLines={1}>{agent.name}</Text>
              <Flex align="center" gap={2}>
                <Text fontSize="xs" color="gray.400">{pct}%</Text>
                <Badge colorScheme={status.color} fontSize="9px">{open ? status.label : 'Idle'}</Badge>
              </Flex>
            </Flex>
            <Box h="6px" borderRadius="full" bg="gray.100" overflow="hidden">
              <Box h="100%" w={`${pct}%`} bg={`${status.color}.400`} borderRadius="full" transition="width 0.3s" />
            </Box>
          </Box>
        );
      })}
      {rows.length === 0 && <Text fontSize="sm" color="gray.400">No agents yet</Text>}
    </VStack>
  );
};

export default QueueHealth;
