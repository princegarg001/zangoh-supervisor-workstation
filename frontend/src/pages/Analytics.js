// Trend charts, issue analysis and conversation search — the "deeper" analytics
// view that complements the live Dashboard.
import React, { useEffect, useState } from 'react';
import {
  Box, Flex, Heading, Text, SimpleGrid, Button, ButtonGroup, VStack, HStack,
  Progress, Tabs, TabList, Tab, TabPanels, TabPanel, Spinner,
} from '@chakra-ui/react';
import { useAppData } from '../context/AppDataContext';
import * as api from '../api';
import TrendChart from '../components/TrendChart';
import HeatmapGrid from '../components/HeatmapGrid';
import ConversationList from '../components/ConversationList';
import { issueDayHeatmap } from '../utils/activity';

const RANGES = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];
const METRICS = [
  { key: 'conversations', label: 'Volume', format: (v) => v },
  { key: 'responseTime', label: 'Response Time', format: (v) => `${v}s` },
  { key: 'sentiment', label: 'Sentiment', format: (v) => `${Math.round(v * 100)}%` },
  { key: 'escalations', label: 'Escalation Rate', format: (v) => `${Math.round(v * 100)}%` },
];

const Analytics = () => {
  const { conversations, agents, loading } = useAppData();
  const [timeRange, setTimeRange] = useState('month');
  const [metric, setMetric] = useState('conversations');
  const [overview, setOverview] = useState(null);
  const [agentAnalytics, setAgentAnalytics] = useState(null);
  const [issues, setIssues] = useState(null);

  useEffect(() => {
    Promise.all([api.getOverviewAnalytics(timeRange), api.getAgentAnalytics(timeRange), api.getIssueAnalytics(timeRange)])
      .then(([o, a, i]) => { setOverview(o); setAgentAnalytics(a); setIssues(i); })
      .catch((err) => console.error('Failed to load analytics:', err.friendlyMessage || err.message));
  }, [timeRange]);

  const trendData = (overview?.trends?.[metric] || []).map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: d.count ?? d.value,
  }));

  const agentTrendData = (agentAnalytics?.trends?.conversations || []).map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    ...Object.fromEntries((agentAnalytics.agents || []).map((a) => [a.id, d[a.id] || 0])),
  }));

  const heatmap = issues ? issueDayHeatmap(conversations, issues.topIssues.map((t) => t.name)) : null;
  const activeMetric = METRICS.find((m) => m.key === metric);

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={5} flexWrap="wrap" gap={3}>
        <Box>
          <Heading size="lg" color="navy.800">Analytics</Heading>
          <Text color="gray.500" fontSize="sm">Trends, common issues and agent performance over time</Text>
        </Box>
        <ButtonGroup size="sm" isAttached variant="outline">
          {RANGES.map((r) => (
            <Button key={r.key} variant={timeRange === r.key ? 'solid' : 'outline'} onClick={() => setTimeRange(r.key)}>{r.label}</Button>
          ))}
        </ButtonGroup>
      </Flex>

      <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={4} mb={5}>
        <Box gridColumn={{ xl: 'span 2' }} layerStyle="glass" p={4}>
          <Flex justify="space-between" align="center" mb={2} flexWrap="wrap" gap={2}>
            <Heading size="sm" color="navy.800">Trend</Heading>
            <ButtonGroup size="xs" isAttached variant="outline">
              {METRICS.map((m) => (
                <Button key={m.key} variant={metric === m.key ? 'solid' : 'outline'} onClick={() => setMetric(m.key)}>{m.label}</Button>
              ))}
            </ButtonGroup>
          </Flex>
          {trendData.length > 1 ? (
            <TrendChart data={trendData} valueFormatter={activeMetric.format} />
          ) : (
            <Flex justify="center" py={16}><Spinner size="sm" color="brand.500" /></Flex>
          )}
        </Box>

        <Box layerStyle="glass" p={4}>
          <Heading size="sm" color="navy.800" mb={3}>Top Issues</Heading>
          <VStack align="stretch" spacing={3}>
            {(issues?.topIssues || []).slice(0, 6).map((issue) => (
              <Box key={issue.name}>
                <Flex justify="space-between" fontSize="sm" mb={1}>
                  <Text noOfLines={1}>{issue.name}</Text>
                  <Text color="gray.400">{issue.percentage}%</Text>
                </Flex>
                <Progress value={issue.percentage} size="xs" borderRadius="full" colorScheme="brand" />
              </Box>
            ))}
            {!issues?.topIssues?.length && <Text fontSize="sm" color="gray.400">No tagged conversations yet</Text>}
          </VStack>
        </Box>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={4} mb={5}>
        <Box gridColumn={{ xl: 'span 2' }} layerStyle="glass" p={4}>
          <Heading size="sm" color="navy.800" mb={2}>Conversations per Agent</Heading>
          {agentTrendData.length > 1 && agentAnalytics?.agents?.length ? (
            <TrendChart type="line" data={agentTrendData} series={agentAnalytics.agents.map((a) => a.id)} />
          ) : (
            <Flex justify="center" py={16}><Spinner size="sm" color="brand.500" /></Flex>
          )}
        </Box>
        <Box layerStyle="glass" p={4} overflowX="auto">
          <Heading size="sm" color="navy.800" mb={3}>Issues by Day</Heading>
          {heatmap && heatmap.cols.length > 0 ? <HeatmapGrid {...heatmap} /> : <Text fontSize="sm" color="gray.400">No data yet</Text>}
        </Box>
      </SimpleGrid>

      <Box layerStyle="glass" p={4} mb={5}>
        <Heading size="sm" color="navy.800" mb={3}>Agent Performance</Heading>
        <Tabs size="sm" variant="soft-rounded" colorScheme="brand">
          <TabList mb={3}>
            {(agentAnalytics?.agents || agents).map((a) => <Tab key={a.id}>{a.name}</Tab>)}
          </TabList>
          <TabPanels>
            {(agentAnalytics?.agents || []).map((a) => (
              <TabPanel key={a.id} px={0}>
                <HStack spacing={8} flexWrap="wrap">
                  <Stat label="Conversations" value={a.conversations} />
                  <Stat label="Resolution Rate" value={`${Math.round((a.resolutionRate || 0) * 100)}%`} />
                  <Stat label="Escalation Rate" value={`${Math.round((a.escalationRate || 0) * 100)}%`} />
                  <Stat label="Avg Response Time" value={`${a.avgResponseTime || 0}s`} />
                  <Stat label="Avg Confidence" value={`${Math.round((a.avgConfidence || 0) * 100)}%`} />
                </HStack>
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      </Box>

      <Box>
        <Heading size="sm" color="navy.800" mb={3}>Search &amp; Filter Conversations</Heading>
        <ConversationList conversations={conversations} loading={loading.conversations} error={null} />
      </Box>
    </Box>
  );
};

const Stat = ({ label, value }) => (
  <Box>
    <Text fontSize="xs" color="gray.500">{label}</Text>
    <Text fontSize="xl" fontWeight="bold" color="navy.800">{value}</Text>
  </Box>
);

export default Analytics;
