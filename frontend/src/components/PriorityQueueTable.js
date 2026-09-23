// "Priority conversation queue" — top-risk open conversations, ranked and with a
// recommended next action derived from the real alert reasons (see utils/risk.js).
import React from 'react';
import { Box, Table, Thead, Tbody, Tr, Th, Td, Text, Badge, Button } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { riskScore, recommendedAction } from '../utils/risk';
import { timeAgo } from '../utils/dateUtils';

const riskColor = (score) => (score >= 66 ? 'red' : score >= 33 ? 'orange' : 'green');

const PriorityQueueTable = ({ conversations, limit = 6 }) => {
  const navigate = useNavigate();
  const rows = conversations
    .filter((c) => c.status !== 'resolved')
    .map((c) => ({ conversation: c, score: riskScore(c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (!rows.length) return <Text fontSize="sm" color="gray.400">No open conversations</Text>;

  return (
    <Box overflowX="auto">
      <Table size="sm">
        <Thead>
          <Tr>
            <Th>Customer</Th>
            <Th>Agent</Th>
            <Th>Risk</Th>
            <Th>Wait</Th>
            <Th>Action</Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map(({ conversation, score }) => (
            <Tr key={conversation.id} _hover={{ bg: 'rgba(70,62,240,0.04)' }}>
              <Td>
                <Text fontWeight="medium" fontSize="sm">{conversation.customer?.name}</Text>
                <Text fontSize="xs" color="gray.400">{conversation.id}</Text>
              </Td>
              <Td fontSize="sm" color="gray.500">{conversation.agent?.name}</Td>
              <Td><Badge colorScheme={riskColor(score)}>{score}</Badge></Td>
              <Td fontSize="xs" color="gray.400">{timeAgo(conversation.lastActivityAt || conversation.startTime)}</Td>
              <Td>
                <Button size="xs" variant="link" colorScheme="brand" onClick={() => navigate(`/conversation/${conversation.id}`)}>
                  {recommendedAction(conversation)}
                </Button>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
};

export default PriorityQueueTable;
