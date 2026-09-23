// Renders template content with variables visually distinguished from static text,
// so supervisors can see at a glance what will be substituted before sending.
import React from 'react';
import { Text, Wrap, WrapItem, Box } from '@chakra-ui/react';
import { parseSegments } from '../utils/templateEngine';

const TemplatePreview = ({ content, values = {}, fontSize = 'sm' }) => {
  const segments = parseSegments(content);
  return (
    <Box lineHeight="1.8" fontSize={fontSize} whiteSpace="pre-wrap" wordBreak="break-word">
      {segments.map((segment, i) => {
        if (segment.type === 'text') return <React.Fragment key={i}>{segment.value}</React.Fragment>;
        const value = values[segment.name];
        const filled = value !== undefined && value !== null && String(value).trim() !== '';
        return (
          <Text
            as="span"
            key={i}
            px="1"
            mx="0.5"
            borderRadius="sm"
            fontWeight="semibold"
            bg={filled ? 'green.100' : 'orange.100'}
            color={filled ? 'green.800' : 'orange.800'}
            title={filled ? `{{${segment.name}}} → filled` : `{{${segment.name}}} → not filled yet`}
          >
            {filled ? String(value) : `{{${segment.name}}}`}
          </Text>
        );
      })}
    </Box>
  );
};

export const VariableLegend = () => (
  <Wrap spacing={3} fontSize="xs" color="gray.500">
    <WrapItem>
      <Box as="span" px={1} borderRadius="sm" bg="green.100" color="green.800" mr={1}>
        text
      </Box>
      filled
    </WrapItem>
    <WrapItem>
      <Box as="span" px={1} borderRadius="sm" bg="orange.100" color="orange.800" mr={1}>
        {'{{var}}'}
      </Box>
      needs a value
    </WrapItem>
  </Wrap>
);

export default TemplatePreview;
