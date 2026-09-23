import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box, Flex, Text, Button, VStack, HStack, Avatar, Divider, Heading, Icon, Textarea,
  IconButton, Tag, TagLabel, Input, useToast, Spinner, Select, Tooltip,
  Popover, PopoverTrigger, PopoverContent, PopoverArrow, PopoverBody, PopoverHeader, PopoverCloseButton,
} from '@chakra-ui/react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { FiArrowLeft, FiSend, FiFileText, FiUserCheck, FiUserX, FiPlus, FiStar, FiMic, FiMicOff } from 'react-icons/fi';
import * as api from '../api';
import { useWebSocket } from '../context/WebSocketContext';
import { useSupervisor } from '../context/SupervisorContext';
import { useAppData } from '../context/AppDataContext';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { StatusBadge, AlertBadge, ALERT_REASON_LABELS } from '../components/StatusBadge';
import MessageBubble from '../components/MessageBubble';
import TemplatePicker from '../components/TemplatePicker';
import CopilotCard from '../components/CopilotCard';
import { formatDate } from '../utils/dateUtils';

const isSameMessage = (a, b) => a.sender === b.sender && a.text === b.text && a.timestamp === b.timestamp;

const ConversationView = () => {
  const { id } = useParams();
  const toast = useToast();
  const { lastMessage, subscribe } = useWebSocket();
  const { supervisorId, supervisorName } = useSupervisor();
  const { agents } = useAppData();

  const [conversation, setConversation] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [draft, setDraft] = useState('');
  const [pendingTemplateId, setPendingTemplateId] = useState(null);
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [rating, setRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [notes, setNotes] = useState('');

  const messagesEndRef = useRef(null);

  // Voice input (Web Speech API): finalized phrases are appended to the draft as
  // they're recognized, so the supervisor can keep talking and edit before sending.
  const speech = useSpeechToText(
    useCallback((text) => setDraft((prev) => (prev ? `${prev} ${text}` : text)), [])
  );

  const load = useCallback(async () => {
    try {
      setConversation(await api.getConversation(id));
      setLoadError(null);
    } catch (err) {
      setLoadError(err.friendlyMessage || err.message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { subscribe('conversations'); }, [subscribe]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages?.length]);

  // Live patches scoped to this conversation.
  useEffect(() => {
    if (!lastMessage || !conversation) return;

    if (lastMessage.type === 'message_update' && lastMessage.conversationId === id) {
      setConversation((prev) => {
        if (!prev) return prev;
        if (prev.messages.some((m) => isSameMessage(m, lastMessage.message))) return prev; // dedupe our own optimistic append
        return { ...prev, messages: [...prev.messages, lastMessage.message] };
      });
    }
    if (lastMessage.type === 'conversation_updated' && lastMessage.data?.id === id) {
      setConversation((prev) => (prev ? { ...prev, ...lastMessage.data, messages: prev.messages } : prev));
    }
    if (lastMessage.type === 'metrics_update' && lastMessage.conversationId === id) {
      setConversation((prev) => (prev ? { ...prev, metrics: { ...prev.metrics, ...lastMessage.metrics } } : prev));
    }
  }, [lastMessage, id, conversation]);

  if (loadError) {
    return (
      <Box p={6} textAlign="center">
        <Text color="red.500" mb={3}>{loadError}</Text>
        <Button as={RouterLink} to="/" leftIcon={<FiArrowLeft />}>Back to dashboard</Button>
      </Box>
    );
  }
  if (!conversation) {
    return <Flex justify="center" py={20}><Spinner color="brand.500" /></Flex>;
  }

  const inControl = conversation.humanIntervention?.active;
  const iAmInControl = inControl && conversation.humanIntervention?.supervisorId === supervisorId;
  const heldByOther = inControl && !iAmInControl;

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      // Sending as supervisor implies taking control, so it never collides with the AI.
      if (!inControl) await api.interveneInConversation(id, 'Replied directly');
      const message = await api.addMessage(id, { sender: 'supervisor', text, templateId: pendingTemplateId || undefined });
      setConversation((prev) => (prev.messages.some((m) => isSameMessage(m, message)) ? prev : { ...prev, messages: [...prev.messages, message] }));
      setDraft('');
      setPendingTemplateId(null);
      if (!inControl) load(); // pick up humanIntervention/status changes from the implicit take-over
    } catch (err) {
      toast({ status: 'error', title: 'Could not send message', description: err.friendlyMessage || err.message });
    } finally {
      setSending(false);
    }
  };

  const takeOver = async () => {
    setActionLoading(true);
    try {
      await api.interveneInConversation(id, notes);
      setNotes('');
      toast({ status: 'success', title: 'You are now in control of this conversation' });
      load();
    } catch (err) {
      toast({ status: 'error', title: 'Could not take over', description: err.friendlyMessage || err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const release = async () => {
    setActionLoading(true);
    try {
      await api.releaseIntervention(id, notes);
      setNotes('');
      toast({ status: 'success', title: 'Control returned to the AI agent' });
      load();
    } catch (err) {
      toast({ status: 'error', title: 'Could not release', description: err.friendlyMessage || err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const changeStatus = async (status) => {
    try {
      await api.updateConversationStatus(id, status);
      load();
    } catch (err) {
      toast({ status: 'error', title: 'Could not update status', description: err.friendlyMessage || err.message });
    }
  };

  const addTag = async () => {
    const tag = newTag.trim();
    if (!tag) return;
    try {
      const tags = await api.addTags(id, [tag]);
      setConversation((prev) => ({ ...prev, tags }));
      setNewTag('');
    } catch (err) {
      toast({ status: 'error', title: 'Could not add tag', description: err.friendlyMessage || err.message });
    }
  };

  const submitFeedback = async () => {
    if (!rating) return;
    try {
      await api.addFeedback(id, { rating, comment: feedbackComment });
      toast({ status: 'success', title: 'Feedback recorded' });
      setRating(0);
      setFeedbackComment('');
    } catch (err) {
      toast({ status: 'error', title: 'Could not submit feedback', description: err.friendlyMessage || err.message });
    }
  };

  const handleTemplateInsert = (text, templateId) => {
    setDraft((prev) => (prev ? `${prev}\n${text}` : text));
    setPendingTemplateId(templateId);
  };

  const copilotApprove = async (text) => {
    if (!text) return;
    try {
      if (!inControl) await api.interveneInConversation(id, 'Approved co-pilot suggestion');
      const message = await api.addMessage(id, { sender: 'supervisor', text });
      setConversation((prev) => (prev.messages.some((m) => isSameMessage(m, message)) ? prev : { ...prev, messages: [...prev.messages, message] }));
      load();
    } catch (err) {
      toast({ status: 'error', title: 'Could not send', description: err.friendlyMessage || err.message });
    }
  };

  const copilotEdit = async (text) => {
    try {
      if (!inControl) await api.interveneInConversation(id, 'Editing co-pilot suggestion');
      setDraft(text || '');
      load();
    } catch (err) {
      toast({ status: 'error', title: 'Could not take over', description: err.friendlyMessage || err.message });
    }
  };

  const copilotEscalate = async () => {
    try {
      await api.interveneInConversation(id, 'Escalated via co-pilot recommendation');
      toast({ status: 'info', title: 'Escalated — you are now in control' });
      load();
    } catch (err) {
      toast({ status: 'error', title: 'Could not escalate', description: err.friendlyMessage || err.message });
    }
  };

  return (
    <Box>
      <Button as={RouterLink} to="/" leftIcon={<FiArrowLeft />} variant="ghost" size="sm" mb={3}>Back</Button>

      <Flex gap={4} direction={{ base: 'column', lg: 'row' }} align="stretch">
        {/* Conversation panel */}
        <Box flex="2" layerStyle="glass" p={4} display="flex" flexDirection="column" h={{ base: '75vh', lg: 'calc(100vh - 140px)' }} minH="480px">
          <Flex justify="space-between" align="start" mb={3} flexWrap="wrap" gap={2}>
            <Box>
              <Heading size="md" color="navy.800">{conversation.customer?.name}</Heading>
              <HStack mt={1} spacing={2}>
                <StatusBadge status={conversation.status} />
                <AlertBadge level={conversation.alertLevel} />
                {heldByOther && <Tag colorScheme="orange" size="sm">Held by {conversation.humanIntervention.supervisorId}</Tag>}
              </HStack>
            </Box>

            <HStack>
              <Select size="sm" value={conversation.status} onChange={(e) => changeStatus(e.target.value)} maxW="140px" isDisabled={heldByOther}>
                <option value="active">Active</option>
                <option value="waiting">Waiting</option>
                <option value="escalated">Escalated</option>
                <option value="resolved">Resolved</option>
              </Select>

              <Popover placement="bottom-end">
                <PopoverTrigger>
                  <Button
                    size="sm"
                    colorScheme={iAmInControl ? 'gray' : 'brand'}
                    leftIcon={<Icon as={iAmInControl ? FiUserX : FiUserCheck} />}
                    isDisabled={heldByOther}
                    isLoading={actionLoading}
                  >
                    {iAmInControl ? 'Release to AI' : 'Take Over'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <PopoverArrow />
                  <PopoverCloseButton />
                  <PopoverHeader fontSize="sm" fontWeight="semibold">
                    {iAmInControl ? 'Return control to the AI' : 'Take over this conversation'}
                  </PopoverHeader>
                  <PopoverBody>
                    <Text fontSize="xs" color="gray.500" mb={2}>
                      {iAmInControl ? 'Add guidance the AI should apply to its next reply.' : 'Optional note for your records.'}
                    </Text>
                    <Textarea size="sm" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={iAmInControl ? 'e.g. Offer expedited shipping on the next order' : 'e.g. Customer is very upset, handling personally'} mb={2} />
                    <Button size="sm" width="100%" colorScheme={iAmInControl ? 'gray' : 'brand'} onClick={iAmInControl ? release : takeOver} isLoading={actionLoading}>
                      Confirm
                    </Button>
                  </PopoverBody>
                </PopoverContent>
              </Popover>
            </HStack>
          </Flex>

          <VStack align="stretch" spacing={3} flex="1" overflowY="auto" py={2} data-testid="message-list" className="message-list">
            {conversation.messages.map((msg, i) => <MessageBubble key={`${msg.timestamp}-${i}`} message={msg} />)}
            <div ref={messagesEndRef} />
          </VStack>

          <Divider my={3} />

          {heldByOther ? (
            <Text fontSize="sm" color="gray.500" textAlign="center" py={2}>
              {conversation.humanIntervention.supervisorId} is currently handling this conversation.
            </Text>
          ) : (
            <Box>
              {!inControl && conversation.status !== 'resolved' && (
                <CopilotCard
                  conversation={conversation}
                  agent={agents.find((a) => a.id === conversation.agent?.id)}
                  onApprove={copilotApprove}
                  onEdit={copilotEdit}
                  onEscalate={copilotEscalate}
                />
              )}

              <Flex gap={2} mb={2}>
                <Tooltip label="Insert a response template">
                  <IconButton aria-label="Insert Template" title="Insert Template" icon={<FiFileText />} size="sm" variant="outline" onClick={() => setTemplateOpen(true)} />
                </Tooltip>
                {speech.isSupported && (
                  <Tooltip label={speech.isListening ? 'Stop voice input' : 'Start voice input'}>
                    <IconButton
                      aria-label={speech.isListening ? 'Stop voice input' : 'Start voice input'}
                      icon={speech.isListening ? <FiMicOff /> : <FiMic />}
                      size="sm"
                      variant={speech.isListening ? 'solid' : 'outline'}
                      colorScheme={speech.isListening ? 'red' : 'gray'}
                      onClick={speech.toggle}
                    />
                  </Tooltip>
                )}
                <Text fontSize="xs" color="gray.400" alignSelf="center">
                  {speech.isListening
                    ? `Listening… ${speech.interimText}`
                    : inControl
                    ? "You're in control — replying as supervisor"
                    : 'Sending a reply will take over from the AI'}
                </Text>
              </Flex>
              {speech.error && <Text fontSize="xs" color="red.500" mb={2}>{speech.error}</Text>}
              <Flex gap={2}>
                <Textarea
                  placeholder="Type your message, or use the mic…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  size="sm"
                  resize="vertical"
                  rows={2}
                />
                <IconButton aria-label="Send message" icon={<FiSend />} colorScheme="brand" onClick={sendMessage} isLoading={sending} isDisabled={!draft.trim()} />
              </Flex>
            </Box>
          )}
        </Box>

        {/* Sidebar */}
        <VStack flex="1" spacing={4} align="stretch" minW={{ lg: '300px' }}>
          <Box layerStyle="glass" p={4}>
            <Heading size="sm" color="navy.800" mb={3}>Customer</Heading>
            <HStack>
              <Avatar name={conversation.customer?.name} bg="brand.500" color="white" />
              <Box>
                <Text fontWeight="medium">{conversation.customer?.name}</Text>
                <Text fontSize="xs" color="gray.500">{conversation.customer?.email}</Text>
                {conversation.customer?.tier && <Tag size="sm" mt={1} colorScheme="brand">{conversation.customer.tier}</Tag>}
              </Box>
            </HStack>
            <Divider my={3} />
            <Text fontSize="xs" color="gray.500" mb={1}>Assigned agent</Text>
            <Text fontSize="sm" fontWeight="medium">{conversation.agent?.name}</Text>
            <Text fontSize="xs" color="gray.400">Started {formatDate(conversation.startTime)}</Text>
          </Box>

          <Box layerStyle="glass" p={4}>
            <Heading size="sm" color="navy.800" mb={3}>Live Metrics</Heading>
            <VStack align="stretch" spacing={2}>
              <MetricRow label="Sentiment" value={`${Math.round((conversation.metrics?.sentiment ?? 0) * 100)}%`} />
              <MetricRow label="Response Time" value={`${conversation.metrics?.responseTime ?? 0}s`} />
              <MetricRow label="AI Confidence" value={`${Math.round((conversation.metrics?.confidenceScore ?? 0) * 100)}%`} />
            </VStack>
            {conversation.alertReasons?.length > 0 && (
              <>
                <Divider my={3} />
                <Text fontSize="xs" color="gray.500" mb={1}>Alert reasons</Text>
                <VStack align="stretch" spacing={1}>
                  {conversation.alertReasons.map((reason) => (
                    <Text key={reason} fontSize="xs" color="red.500">• {ALERT_REASON_LABELS[reason] || reason}</Text>
                  ))}
                </VStack>
              </>
            )}
          </Box>

          <Box layerStyle="glass" p={4}>
            <Heading size="sm" color="navy.800" mb={3}>Tags</Heading>
            <Flex flexWrap="wrap" gap={2} mb={3}>
              {conversation.tags?.map((tag) => (
                <Tag key={tag} colorScheme="gray"><TagLabel>{tag}</TagLabel></Tag>
              ))}
            </Flex>
            <Flex gap={2}>
              <Input size="sm" placeholder="Add a tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} />
              <IconButton aria-label="Add tag" icon={<FiPlus />} size="sm" onClick={addTag} />
            </Flex>
          </Box>

          <Box layerStyle="glass" p={4}>
            <Heading size="sm" color="navy.800" mb={3}>Rate the AI's handling</Heading>
            <HStack mb={2}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Icon key={n} as={FiStar} boxSize={5} cursor="pointer" color={n <= rating ? 'brand.500' : 'gray.300'} onClick={() => setRating(n)} />
              ))}
            </HStack>
            <Textarea size="sm" placeholder="Optional comment for the config review" value={feedbackComment} onChange={(e) => setFeedbackComment(e.target.value)} mb={2} />
            <Button size="sm" width="100%" isDisabled={!rating} onClick={submitFeedback}>Submit Feedback</Button>
          </Box>
        </VStack>
      </Flex>

      <TemplatePicker
        isOpen={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onInsert={handleTemplateInsert}
        autofill={{ customer_name: conversation.customer?.name, supervisor_name: supervisorName }}
      />
    </Box>
  );
};

const MetricRow = ({ label, value }) => (
  <Flex justify="space-between" fontSize="sm">
    <Text color="gray.500">{label}</Text>
    <Text fontWeight="semibold" color="navy.800">{value}</Text>
  </Flex>
);

export default ConversationView;
