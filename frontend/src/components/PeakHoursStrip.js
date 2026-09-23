// Row of small hour tiles with a severity dot + percentage + thin progress bar —
// mirrors the reference dashboard's "Peak Hours" widget.
import React from 'react';
import { SimpleGrid, Box, Text, Flex } from '@chakra-ui/react';

const severityColor = (pct) => (pct >= 80 ? 'red.500' : pct >= 50 ? 'brand.500' : 'green.500');

/** @param {{label: string, value: number}[]} buckets - value is a 0-100 percentage */
const PeakHoursStrip = ({ buckets = [], columns = { base: 3, sm: 4, lg: 6 } }) => (
  <SimpleGrid columns={columns} spacing={3}>
    {buckets.map((bucket) => (
      <Box key={bucket.label} p={3} borderRadius="lg" border="1px solid" borderColor="gray.100">
        <Flex justify="space-between" align="center" mb={1}>
          <Text fontSize="xs" color="gray.500" fontWeight="medium">{bucket.label}</Text>
          <Box w={2} h={2} borderRadius="full" bg={severityColor(bucket.value)} />
        </Flex>
        <Text fontSize="lg" fontWeight="bold" color="navy.800" mb={1.5}>{Math.round(bucket.value)}%</Text>
        <Box h="4px" borderRadius="full" bg="gray.100" overflow="hidden">
          <Box h="100%" w={`${Math.min(100, bucket.value)}%`} bg={severityColor(bucket.value)} borderRadius="full" transition="width 0.3s" />
        </Box>
      </Box>
    ))}
  </SimpleGrid>
);

export default PeakHoursStrip;
