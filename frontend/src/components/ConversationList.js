import React, { useState, useMemo } from 'react';
import {
  Box, Flex, Text, Badge, Icon, Input, InputGroup, InputLeftElement, Select, Stack,
} from '@chakra-ui/react';
import { FiSearch, FiAlertCircle, FiMessageSquare, FiClock, FiUserCheck } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { timeAgo } from '../utils/dateUtils';
import { StatusBadge } from './StatusBadge';

const ALERT_ICON_COLOR = { medium: 'orange.500', high: 'red.500' };

const ConversationList = ({ conversations, loading, error }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [alertFilter, setAlertFilter] = useState('all');

  const navigate = useNavigate();
  const hoverBg = 'rgba(70, 62, 240, 0.05)';
  const borderColor = 'rgba(70, 62, 240, 0.08)';

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return conversations
      .filter((conv) => {
        const matchesSearch =
          !term ||
          conv.customer?.name?.toLowerCase().includes(term) ||
          conv.tags?.some((tag) => tag.toLowerCase().includes(term)) ||
          conv.id.toLowerCase().includes(term);
        const matchesStatus = statusFilter === 'all' || conv.status === statusFilter;
        const matchesAlert = alertFilter === 'all' || conv.alertLevel === alertFilter;
        return matchesSearch && matchesStatus && matchesAlert;
      })
      .sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        if (order[a.alertLevel] !== order[b.alertLevel]) return order[a.alertLevel] - order[b.alertLevel];
        return new Date(b.lastActivityAt || b.startTime) - new Date(a.lastActivityAt || a.startTime);
      });
  }, [conversations, searchTerm, statusFilter, alertFilter]);

  if (loading) return <Box p={4}>Loading conversations…</Box>;
  if (error) return <Box p={4} color="red.500">Error loading conversations: {error}</Box>;

  return (
    <Box layerStyle="glass" overflow="hidden" data-testid="conversation-list">
      <Box p={4} borderBottom="1px" borderColor={borderColor}>
        <Stack spacing={3}>
          <InputGroup>
            <InputLeftElement pointerEvents="none">
              <Icon as={FiSearch} color="gray.400" />
            </InputLeftElement>
            <Input placeholder="Search by customer name, tag, or ID" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </InputGroup>

          <Flex gap={3} flexWrap="wrap">
            <Select size="sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} maxW="180px">
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="waiting">Waiting</option>
              <option value="resolved">Resolved</option>
              <option value="escalated">Escalated</option>
            </Select>

            <Select size="sm" value={alertFilter} onChange={(e) => setAlertFilter(e.target.value)} maxW="180px">
              <option value="all">All Alert Levels</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>

            <Text fontSize="xs" color="gray.500" alignSelf="center" ml="auto">
              {filtered.length} of {conversations.length}
            </Text>
          </Flex>
        </Stack>
      </Box>

      <Box maxH="640px" overflowY="auto">
        {filtered.length === 0 ? (
          <Box p={6} textAlign="center" color="gray.500">
            No conversations match your filters
          </Box>
        ) : (
          filtered.map((conversation) => (
            <Flex
              key={conversation.id}
              p={4}
              borderBottom="1px"
              borderColor={borderColor}
              _hover={{ bg: hoverBg, cursor: 'pointer' }}
              onClick={() => navigate(`/conversation/${conversation.id}`)}
              direction="column"
              data-testid="conversation-row"
            >
              <Flex justify="space-between" align="center" mb={1}>
                <Flex align="center" gap={2}>
                  <Text fontWeight="bold">{conversation.customer?.name}</Text>
                  <StatusBadge status={conversation.status} fontSize="xs" />
                  {conversation.humanIntervention?.active && (
                    <Badge colorScheme="brand" fontSize="xs" display="flex" alignItems="center" gap={1}>
                      <Icon as={FiUserCheck} boxSize={3} /> You
                    </Badge>
                  )}
                </Flex>
                {conversation.alertLevel !== 'low' && (
                  <Icon as={FiAlertCircle} color={ALERT_ICON_COLOR[conversation.alertLevel]} boxSize={5} />
                )}
              </Flex>

              <Text fontSize="sm" color="gray.600" noOfLines={1} mb={1}>
                {conversation.lastMessage?.text || conversation.agent?.name}
              </Text>

              <Flex align="center" fontSize="xs" color="gray.500" gap={3}>
                <Flex align="center" gap={1}>
                  <Icon as={FiMessageSquare} /> {conversation.messageCount ?? 0}
                </Flex>
                <Flex align="center" gap={1}>
                  <Icon as={FiClock} /> {timeAgo(conversation.lastActivityAt || conversation.startTime)}
                </Flex>
                <Text>{conversation.agent?.name}</Text>
              </Flex>

              {conversation.tags?.length > 0 && (
                <Flex mt={2} flexWrap="wrap" gap={2}>
                  {conversation.tags.map((tag) => (
                    <Badge key={tag} colorScheme="gray" fontSize="10px">
                      {tag}
                    </Badge>
                  ))}
                </Flex>
              )}
            </Flex>
          ))
        )}
      </Box>
    </Box>
  );
};

export default ConversationList;
