// Small colored-square heatmap (day x hour, or any row/column pair) — mirrors the
// reference dashboard's "Integration Error Counts" widget. Pure presentational.
import React from 'react';
import { Box, Flex, Text, Tooltip } from '@chakra-ui/react';

const shade = (intensity) => {
  if (intensity <= 0) return 'gray.100';
  if (intensity < 0.25) return 'brand.100';
  if (intensity < 0.5) return 'brand.200';
  if (intensity < 0.75) return 'brand.400';
  return 'brand.600';
};

/**
 * @param {string[]} rows - row labels (e.g. days)
 * @param {string[]} cols - column labels (e.g. hours)
 * @param {number[][]} values - values[row][col], any scale — normalized internally against the grid max
 * @param {(row: string, col: string, value: number) => string} [tooltip]
 */
const HeatmapGrid = ({ rows, cols, values, tooltip }) => {
  const max = Math.max(1, ...values.flat());
  return (
    <Box>
      <Flex direction="column" gap="3px">
        {rows.map((row, r) => (
          <Flex key={row} align="center" gap="3px">
            <Text fontSize="10px" color="gray.400" w="34px" flexShrink={0} textAlign="right" pr={1}>{row}</Text>
            {cols.map((col, c) => {
              const value = values[r]?.[c] || 0;
              const label = tooltip ? tooltip(row, col, value) : `${row} ${col}: ${value}`;
              return (
                <Tooltip key={col} label={label} fontSize="xs">
                  <Box w="14px" h="14px" borderRadius="3px" bg={shade(value / max)} />
                </Tooltip>
              );
            })}
          </Flex>
        ))}
      </Flex>
    </Box>
  );
};

export default HeatmapGrid;
