// Slim icon-only navigation rail — matches the Figma reference: light lavender
// column that sits BELOW the dark header bar (not beside/under it), icon + tooltip,
// no labels, settings pinned to the bottom.
import React from 'react';
import { Box, VStack, Icon, Tooltip } from '@chakra-ui/react';
import { Link, useLocation } from 'react-router-dom';
import { FiGrid, FiMessageSquare, FiCpu, FiZap, FiSettings } from 'react-icons/fi';

const NAV_ITEMS = [
  { name: 'Dashboard', icon: FiGrid, path: '/' },
  { name: 'Conversations', icon: FiMessageSquare, path: '/conversations' },
  { name: 'Agent Config', icon: FiCpu, path: '/agent-config' },
  { name: 'Templates', icon: FiZap, path: '/templates' },
];

const HEADER_H = '60px';

const IconRail = () => {
  const location = useLocation();
  const isActive = (path) => (path === '/conversations' ? location.pathname === '/' || location.pathname.startsWith('/conversation') : location.pathname === path);

  return (
    <Box
      as="nav"
      position="fixed"
      left={0}
      top={HEADER_H}
      w="64px"
      h={`calc(100% - ${HEADER_H})`}
      bg="brand.50"
      borderRight="1px solid"
      borderColor="brand.100"
      display={{ base: 'none', md: 'flex' }}
      flexDir="column"
      alignItems="center"
      py={4}
      zIndex={20}
    >
      <VStack spacing={2} flex="1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <Tooltip key={item.path} label={item.name} placement="right">
              <Box
                as={Link}
                to={item.path === '/conversations' ? '/' : item.path}
                display="flex"
                alignItems="center"
                justifyContent="center"
                boxSize="40px"
                borderRadius="12px"
                bg={active ? 'white' : 'transparent'}
                color={active ? 'brand.600' : 'navy.400'}
                boxShadow={active ? 'sm' : 'none'}
                _hover={{ bg: 'white', color: 'brand.600' }}
                transition="all 0.15s"
              >
                <Icon as={item.icon} boxSize={5} />
              </Box>
            </Tooltip>
          );
        })}
      </VStack>
      <Tooltip label="Settings" placement="right">
        <Box display="flex" alignItems="center" justifyContent="center" boxSize="40px" borderRadius="12px" color="navy.400" _hover={{ bg: 'white', color: 'brand.600' }}>
          <Icon as={FiSettings} boxSize={5} />
        </Box>
      </Tooltip>
    </Box>
  );
};

export default IconRail;
