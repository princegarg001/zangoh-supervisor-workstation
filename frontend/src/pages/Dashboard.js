import React, { useState } from 'react';
import {
  Box, Flex, Heading, Text, SimpleGrid, Tabs, TabList, TabPanel, TabPanels, Tab, Badge,
  Button, ButtonGroup, Icon,
} from '@chakra-ui/react';
import { FiMessageCircle, FiAlertTriangle, FiClock, FiSmile, FiShield, FiWifi, FiWifiOff } from 'react-icons/fi';
import { useAppData } from '../context/AppDataContext';
import { useWebSocket } from '../context/WebSocketContext';
import { useOverviewStream } from '../hooks/useOverviewStream';
import ConversationList from '../components/ConversationList';
import MetricsCard from '../components/MetricsCard';
import TrendChart from '../components/TrendChart';
import PeakHoursStrip from '../components/PeakHoursStrip';
import QueueHealth from '../components/QueueHealth';
import CriticalSignals from '../components/CriticalSignals';
import PriorityQueueTable from '../components/PriorityQueueTable';
import ActivityFeed from '../components/ActivityFeed';
import { hourlyActivity } from '../utils/activity';
import { dayOverDayChange } from '../utils/risk';

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

const Dashboard = () => {
  const { conversations, agents, alerts, activityFeed, loading, error } = useAppData();
  const { isConnected } = useWebSocket();
  const [timeRange, setTimeRange] = useState('week');
  // Real readiness signal (not a guessed timer) for when it's safe to open the SSE
  // stream — see useOverviewStream's comment for why this matters.
  const dataReady = !loading.conversations && !loading.agents && !loading.knowledgeBases && !loading.templates;
  const { overview, live } = useOverviewStream(timeRange, dataReady);

  const activeConversations = conversations.filter((c) => c.status === 'active').length;
  const highAlerts = conversations.filter((c) => c.alertLevel === 'high').length;
  const needsAttention = conversations.filter((c) => c.alertLevel !== 'low');

  const peakHours = hourlyActivity(conversations, 8);
  const conversationTrend = (overview?.trends?.conversations || []).map((d) => ({ date: shortDate(d.date), value: d.count }));
  const volumeDelta = dayOverDayChange(overview?.trends?.conversations, 'count');
  const responseDelta = dayOverDayChange(overview?.trends?.responseTime, 'value');
  const containment = overview ? Math.round((1 - overview.escalationRate) * 100) : null;

  return (
    <Box>
      <Flex justify="space-between" align={{ base: 'start', md: 'center' }} mb={5} direction={{ base: 'column', md: 'row' }} gap={3}>
        <Box>
          <Heading size={{ base: 'md', md: 'lg' }} color="navy.800">Agent Supervisor Dashboard</Heading>
          <Flex align="center" gap={3} mt={1} flexWrap="wrap">
            <Text color="gray.500" fontSize="sm">Live supervision across {agents.length} agents</Text>
            <StatPill icon={FiMessageCircle} label={`${activeConversations} active`} color="green" />
            {highAlerts > 0 && <StatPill icon={FiAlertTriangle} label={`${highAlerts} high alert${highAlerts > 1 ? 's' : ''}`} color="red" />}
            <StatPill icon={isConnected ? FiWifi : FiWifiOff} label={isConnected ? 'Live' : 'Reconnecting'} color={isConnected ? 'green' : 'gray'} />
            <StatPill icon={live ? FiWifi : FiWifiOff} label={live ? 'Metrics streaming' : 'Metrics polling'} color={live ? 'brand' : 'gray'} />
          </Flex>
        </Box>

        <ButtonGroup size="sm" isAttached variant="outline" flexWrap="wrap">
          {RANGES.map((r) => (
            <Button key={r.key} variant={timeRange === r.key ? 'solid' : 'outline'} onClick={() => setTimeRange(r.key)}>
              {r.label}
            </Button>
          ))}
        </ButtonGroup>
      </Flex>

      <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 5 }} spacing={4} mb={5}>
        <MetricsCard title="Active Conversations" value={overview?.activeConversations ?? activeConversations} icon={FiMessageCircle} color="brand" change={volumeDelta && `${volumeDelta.pct}%`} changeType={volumeDelta?.type} />
        <MetricsCard title="Open Alerts" value={overview?.openAlerts ?? highAlerts} icon={FiAlertTriangle} color="red" />
        <MetricsCard title="AI Containment" value={containment !== null ? `${containment}%` : '—'} icon={FiShield} color="green" />
        <MetricsCard title="Avg Handle Time" value={overview ? `${overview.avgResponseTime}s` : '—'} icon={FiClock} color="navy" change={responseDelta && `${responseDelta.pct}%`} changeType={responseDelta?.type === 'increase' ? 'decrease' : 'increase'} />
        <MetricsCard title="Avg Sentiment" value={overview ? `${Math.round(overview.avgSentiment * 100)}%` : '—'} icon={FiSmile} color="green" />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={4} mb={5}>
        <Box gridColumn={{ xl: 'span 2' }} layerStyle="glass" p={4}>
          <Flex justify="space-between" align="center" mb={2}>
            <Heading size="sm" color="navy.800">Conversation Volume</Heading>
            <Text fontSize="xs" color="gray.400">{RANGES.find((r) => r.key === timeRange)?.label}</Text>
          </Flex>
          {conversationTrend.length > 1 ? <TrendChart data={conversationTrend} /> : <Text fontSize="sm" color="gray.400" py={10} textAlign="center">Not enough data yet</Text>}
        </Box>

        <Box layerStyle="glass" p={4}>
          <Heading size="sm" color="navy.800" mb={3}>Activity — Last 8 Hours</Heading>
          <PeakHoursStrip buckets={peakHours} columns={{ base: 2, sm: 4, xl: 2 }} />
        </Box>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={4} mb={5}>
        <Box layerStyle="glass" p={4}>
          <Heading size="sm" color="navy.800" mb={4}>Queue Health</Heading>
          <QueueHealth agents={agents} conversations={conversations} />
        </Box>
        <Box layerStyle="glass" p={4}>
          <Heading size="sm" color="navy.800" mb={4}>Critical Signals</Heading>
          <CriticalSignals alerts={alerts} />
        </Box>
        <Box layerStyle="glass" p={4}>
          <Heading size="sm" color="navy.800" mb={2}>Live Supervisor Feed</Heading>
          <ActivityFeed activity={activityFeed} />
        </Box>
      </SimpleGrid>

      <Box layerStyle="glass" p={4} mb={5}>
        <Heading size="sm" color="navy.800" mb={4}>Priority Conversation Queue</Heading>
        <PriorityQueueTable conversations={conversations} />
      </Box>

      <Tabs variant="enclosed" colorScheme="brand" isLazy>
        <TabList overflowX="auto" overflowY="hidden" whiteSpace="nowrap">
          <Tab>All Conversations</Tab>
          <Tab>
            Needs Attention{' '}
            {needsAttention.length > 0 && <Badge ml={2} colorScheme="red" borderRadius="full">{needsAttention.length}</Badge>}
          </Tab>
          <Tab>Agent Performance</Tab>
        </TabList>

        <TabPanels>
          <TabPanel px={0}>
            <ConversationList conversations={conversations} loading={loading.conversations} error={error.conversations} />
          </TabPanel>
          <TabPanel px={0}>
            <ConversationList conversations={needsAttention} loading={loading.conversations} error={error.conversations} />
          </TabPanel>
          <TabPanel px={0}>
            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
              {agents.map((agent) => <AgentPerformanceCard key={agent.id} agent={agent} />)}
            </SimpleGrid>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

const StatPill = ({ icon, label, color }) => (
  <Flex align="center" gap={1.5} px={2.5} py={1} borderRadius="full" bg={`${color}.50`} color={`${color}.600`} fontSize="xs" fontWeight="semibold">
    <Icon as={icon} boxSize={3} /> {label}
  </Flex>
);

const AgentPerformanceCard = ({ agent }) => (
  <Box layerStyle="glass" p={4}>
    <Flex justify="space-between" align="center" mb={4}>
      <Flex align="center">
        <Box w={3} h={3} borderRadius="full" bg={agent.status === 'active' ? 'green.400' : 'gray.300'} mr={3} />
        <Heading size="sm" color="navy.800">{agent.name}</Heading>
      </Flex>
      <Text fontSize="sm" color="gray.500">{agent.model}</Text>
    </Flex>
    <SimpleGrid columns={2} spacing={4}>
      <Metric label="Conversations" value={agent.metrics?.conversations || 0} />
      <Metric label="Avg Response Time" value={`${agent.metrics?.avgResponseTime || 0}s`} />
      <Metric label="Satisfaction" value={agent.metrics?.satisfaction ? `${Math.round(agent.metrics.satisfaction * 100)}%` : 'N/A'} />
      <Metric label="Escalation Rate" value={agent.metrics?.escalationRate ? `${Math.round(agent.metrics.escalationRate * 100)}%` : 'N/A'} />
    </SimpleGrid>
  </Box>
);

const Metric = ({ label, value }) => (
  <Box>
    <Text color="gray.500" fontSize="sm">{label}</Text>
    <Text fontWeight="bold" fontSize="xl" color="navy.800">{value}</Text>
  </Box>
);

const shortDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default Dashboard;
