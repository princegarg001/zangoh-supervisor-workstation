// "Co-pilot recommendation" — previews what the AI agent would say next (via the
// real mock-LLM endpoint, using the agent's live configuration) so a supervisor
// reviewing a flagged conversation can approve it, edit it first, or skip straight
// to escalation, without waiting for the AI's own auto-reply.
import React, { useEffect, useState } from 'react';
import { Box, Flex, Text, Badge, Button, HStack, Spinner, Icon } from '@chakra-ui/react';
import { FiZap } from 'react-icons/fi';
import * as api from '../api';

const CopilotCard = ({ conversation, agent, onApprove, onEdit, onEscalate }) => {
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .generateReply({
        conversationId: conversation.id,
        messages: conversation.messages.map((m) => ({ role: m.sender, content: m.text })),
        parameters: agent?.parameters,
        capabilities: (agent?.capabilities || []).filter((c) => c.enabled).map((c) => c.id),
        knowledgeBases: (agent?.knowledgeBases || []).filter((k) => k.enabled).map((k) => k.id),
      })
      .then((res) => { if (!cancelled) setSuggestion(res); })
      .catch((err) => { if (!cancelled) setError(err.friendlyMessage || err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, conversation.messages.length, agent?.id]);

  if (error) return null; // fail quiet — the AI's own auto-reply still works independently
  const confidencePct = suggestion ? Math.round((suggestion.metrics?.confidenceScore ?? 0) * 100) : null;

  return (
    <Box bg="brand.50" border="1px solid" borderColor="brand.100" borderRadius="lg" p={3} mb={3}>
      <Flex align="center" gap={2} mb={2}>
        <Icon as={FiZap} color="brand.500" />
        <Text fontSize="xs" fontWeight="bold" color="brand.700" textTransform="uppercase" letterSpacing="wide">Co-pilot Recommendation</Text>
        {confidencePct !== null && <Badge colorScheme={confidencePct >= 70 ? 'green' : confidencePct >= 45 ? 'orange' : 'red'} ml="auto">Confidence {confidencePct}%</Badge>}
      </Flex>

      {loading ? (
        <Flex align="center" gap={2} color="gray.500" fontSize="sm"><Spinner size="xs" /> Thinking…</Flex>
      ) : (
        <Text fontSize="sm" color="navy.800" mb={3}>{suggestion?.response}</Text>
      )}

      <HStack spacing={2}>
        <Button size="xs" colorScheme="brand" isDisabled={!suggestion} onClick={() => onApprove(suggestion?.response)}>Approve &amp; Send</Button>
        <Button size="xs" variant="outline" isDisabled={!suggestion} onClick={() => onEdit(suggestion?.response)}>Edit Response</Button>
        <Button size="xs" variant="ghost" colorScheme="red" onClick={onEscalate}>Escalate</Button>
      </HStack>
    </Box>
  );
};

export default CopilotCard;
