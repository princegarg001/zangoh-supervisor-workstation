// KPI tile: big number, label above, colored icon badge, optional trend sparkline —
// mirrors the reference dashboard's stat-card language.
import React from 'react';
import { Box, Flex, Text, Icon } from '@chakra-ui/react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

const MetricsCard = ({ title, value, icon, change, changeType, color = 'brand', sparkline }) => (
  <Box layerStyle="glass" p={4}>
    <Flex justify="space-between" align="flex-start" mb={sparkline ? 1 : 0}>
      <Box>
        <Text fontSize="xs" color="gray.500" fontWeight="medium" mb={1}>{title}</Text>
        <Text fontSize="2xl" fontWeight="bold" color="navy.800" lineHeight="1.1">{value}</Text>
        {change && (
          <Text fontSize="xs" mt={1} color={changeType === 'increase' ? 'green.500' : 'red.400'} fontWeight="medium">
            {changeType === 'increase' ? '↑' : '↓'} {change}
          </Text>
        )}
      </Box>
      <Flex align="center" justify="center" boxSize="40px" borderRadius="lg" bg={`${color}.50`} color={`${color}.500`} flexShrink={0}>
        <Icon as={icon} boxSize={5} />
      </Flex>
    </Flex>
    {sparkline && sparkline.length > 1 && (
      <Box h="36px" mt={2} mx="-4px">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkline}>
            <defs>
              <linearGradient id={`spark-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`var(--chakra-colors-${color}-400)`} stopOpacity={0.35} />
                <stop offset="100%" stopColor={`var(--chakra-colors-${color}-400)`} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke={`var(--chakra-colors-${color}-500)`} strokeWidth={2} fill={`url(#spark-${title})`} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    )}
  </Box>
);

export default MetricsCard;
