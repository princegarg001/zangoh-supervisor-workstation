// Gradient-filled area/line trend chart — mirrors the reference dashboard's usage
// trend widgets. `series` lets one chart plot several lines (e.g. per-agent).
import React from 'react';
import { Box } from '@chakra-ui/react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const PALETTE = ['brand.500', 'navy.500', 'green.500', 'red.400', 'purple.400'];
const cssVar = (token) => `var(--chakra-colors-${token.replace('.', '-')})`;

/**
 * @param {Array<object>} data - rows with `date` plus one numeric field per series key
 * @param {string[]} [series] - field names to plot (default: ['value'])
 * @param {'area'|'line'} [type]
 */
const TrendChart = ({ data, series = ['value'], type = 'area', height = 260, valueFormatter, labelFormatter }) => {
  const Chart = type === 'area' ? AreaChart : LineChart;
  return (
    <Box h={`${height}px`} w="100%">
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            {series.map((key, i) => (
              <linearGradient key={key} id={`trend-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cssVar(PALETTE[i % PALETTE.length])} stopOpacity={0.3} />
                <stop offset="100%" stopColor={cssVar(PALETTE[i % PALETTE.length])} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={cssVar('gray.100')} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: cssVar('gray.400') }} tickLine={false} axisLine={false} tickFormatter={labelFormatter} />
          <YAxis tick={{ fontSize: 11, fill: cssVar('gray.400') }} tickLine={false} axisLine={false} width={36} />
          <Tooltip
            formatter={valueFormatter}
            labelFormatter={labelFormatter}
            contentStyle={{ borderRadius: 8, border: `1px solid ${cssVar('gray.100')}`, fontSize: 12 }}
          />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {series.map((key, i) =>
            type === 'area' ? (
              <Area key={key} type="monotone" dataKey={key} stroke={cssVar(PALETTE[i % PALETTE.length])} strokeWidth={2} fill={`url(#trend-${key})`} isAnimationActive={false} />
            ) : (
              <Line key={key} type="monotone" dataKey={key} stroke={cssVar(PALETTE[i % PALETTE.length])} strokeWidth={2} dot={false} isAnimationActive={false} />
            )
          )}
        </Chart>
      </ResponsiveContainer>
    </Box>
  );
};

export default TrendChart;
