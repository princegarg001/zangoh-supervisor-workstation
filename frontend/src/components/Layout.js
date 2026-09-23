import React from 'react';
import { Box, Flex } from '@chakra-ui/react';
import IconRail from './IconRail';
import TopBar from './TopBar';
import CommandPalette from './CommandPalette';

// Header spans the full width edge-to-edge; the icon rail sits below it on the
// left (not beside it), matching the reference layout exactly.
const Layout = ({ children }) => (
  <Box minH="100vh">
    <TopBar />
    <Flex align="stretch">
      <IconRail />
      <Box flex="1" minH="calc(100vh - 60px)" ml={{ base: 0, md: '64px' }}>
        <Box as="main" p={{ base: 3, md: 6 }}>
          {children}
        </Box>
      </Box>
    </Flex>
    <CommandPalette />
  </Box>
);

export default Layout;
