import React from 'react';
import { Box, Flex, Text, Badge } from '@chakra-ui/react';
import { formatTime } from '../utils/dateUtils';

const SENDER_STYLE = {
  customer: { align: 'flex-start', bg: 'gray.100', color: 'gray.800', label: 'Customer' },
  agent: { align: 'flex-start', bg: 'brand.50', color: 'brand.800', label: 'AI Agent' },
  supervisor: { align: 'flex-end', bg: 'brand.500', color: 'white', label: 'Supervisor' },
};

const MessageBubble = ({ message }) => {
  if (message.sender === 'system') {
    return (
      <Flex justify="center" my={1}>
        <Text fontSize="xs" color="gray.400" fontStyle="italic" textAlign="center">
          {message.text}
        </Text>
      </Flex>
    );
  }

  const style = SENDER_STYLE[message.sender] || SENDER_STYLE.customer;
  return (
    <Flex direction="column" alignItems={style.align} w="100%">
      <Box maxW="75%" bg={style.bg} color={message.sender === 'supervisor' ? 'white' : style.color} px={3} py={2} borderRadius="lg">
        <Flex justify="space-between" gap={3} mb={0.5}>
          <Text fontSize="xs" fontWeight="bold" opacity={0.75}>
            {style.label}{message.supervisorId ? ` · ${message.supervisorId}` : ''}
          </Text>
          {message.template && (
            <Badge fontSize="9px" colorScheme="whiteAlpha" variant="subtle">
              {message.template.name}
            </Badge>
          )}
        </Flex>
        <Text whiteSpace="pre-wrap" wordBreak="break-word">{message.text}</Text>
        <Text fontSize="10px" opacity={0.6} textAlign="right" mt={1}>
          {formatTime(message.timestamp)}
        </Text>
      </Box>
    </Flex>
  );
};

export default MessageBubble;
