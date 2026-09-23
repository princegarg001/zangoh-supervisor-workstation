// Dark violet top bar — matches the Figma reference. Search opens the command
// palette; the avatar menu switches the acting supervisor (see SupervisorContext).
import React from 'react';
import {
  Box, Flex, Text, Avatar, Menu, MenuButton, MenuList, MenuItem, MenuDivider, IconButton,
  Badge, Input, InputGroup, InputLeftElement, Tooltip, useDisclosure,
  Drawer, DrawerOverlay, DrawerContent, DrawerBody, DrawerCloseButton, VStack, Image,
} from '@chakra-ui/react';
import { FiSearch, FiBell, FiCheck, FiWifi, FiWifiOff, FiMenu, FiGrid, FiMessageSquare, FiCpu, FiZap } from 'react-icons/fi';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAppData } from '../context/AppDataContext';
import { useSupervisor } from '../context/SupervisorContext';
import { useWebSocket } from '../context/WebSocketContext';
import { timeAgo } from '../utils/dateUtils';

const MOBILE_NAV_ITEMS = [
  { name: 'Dashboard', icon: FiGrid, path: '/' },
  { name: 'Conversations', icon: FiMessageSquare, path: '/' },
  { name: 'Agent Config', icon: FiCpu, path: '/agent-config' },
  { name: 'Templates', icon: FiZap, path: '/templates' },
];

const TopBar = () => {
  const { alerts, unreadAlertCount, markAlertsRead } = useAppData();
  const { supervisorId, supervisorName, setSupervisorId, knownSupervisors } = useSupervisor();
  const { isConnected } = useWebSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const mobileNav = useDisclosure();

  const openSearch = () => window.dispatchEvent(new Event('zangoh:open-command-palette'));

  return (
    <Box as="header" position="sticky" top={0} zIndex={40} bg="#241B4D" color="white" h="60px" px={{ base: 3, md: 5 }} display="flex" alignItems="center">
      <Flex align="center" gap={{ base: 2, md: 4 }} w="100%">
        <IconButton
          aria-label="Open menu"
          icon={<FiMenu />}
          variant="ghost"
          color="white"
          size="sm"
          display={{ base: 'inline-flex', md: 'none' }}
          onClick={mobileNav.onOpen}
        />
        <Image src="/logo.svg" alt="Zangoh" boxSize="24px" display={{ base: 'none', sm: 'block' }} />
        <Text fontWeight="bold" fontSize="md" whiteSpace="nowrap" display={{ base: 'none', sm: 'block' }}>Zangoh</Text>
        <Tooltip label={isConnected ? 'Live' : 'Reconnecting…'}>
          <Box color={isConnected ? 'green.300' : 'red.300'} display="flex" alignItems="center">
            {isConnected ? <FiWifi /> : <FiWifiOff />}
          </Box>
        </Tooltip>

        <InputGroup size="sm" maxW="360px" ml={{ base: 2, md: 8 }} onClick={openSearch} cursor="pointer" display={{ base: 'none', sm: 'flex' }}>
          <InputLeftElement pointerEvents="none"><FiSearch color="rgba(255,255,255,0.5)" /></InputLeftElement>
          <Input
            placeholder="Search conversations, agents…"
            readOnly
            cursor="pointer"
            bg="whiteAlpha.100"
            border="1px solid"
            borderColor="whiteAlpha.200"
            _placeholder={{ color: 'whiteAlpha.600' }}
            _hover={{ bg: 'whiteAlpha.200' }}
          />
        </InputGroup>
        <IconButton
          aria-label="Search"
          icon={<FiSearch />}
          variant="ghost"
          color="white"
          size="sm"
          display={{ base: 'inline-flex', sm: 'none' }}
          onClick={openSearch}
          ml="auto"
        />

        <Flex align="center" gap={2} ml={{ base: 1, sm: 'auto' }}>
          <Menu onOpen={markAlertsRead}>
            <Box position="relative">
              <MenuButton as={IconButton} aria-label="Alerts" icon={<FiBell />} variant="ghost" color="white" _hover={{ bg: 'whiteAlpha.200' }} size="sm" />
              {unreadAlertCount > 0 && (
                <Badge position="absolute" top="-2px" right="-2px" borderRadius="full" bg="red.400" color="white" fontSize="9px" minW={4} h={4} display="flex" alignItems="center" justifyContent="center">
                  {unreadAlertCount}
                </Badge>
              )}
            </Box>
            <MenuList maxW="360px" maxH="400px" overflowY="auto" color="navy.800">
              {alerts.length === 0 && <MenuItem isDisabled>No alerts yet</MenuItem>}
              {alerts.map((alert) => (
                <MenuItem key={alert.id} onClick={() => navigate(`/conversation/${alert.conversationId}`)} whiteSpace="normal">
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold">High alert · {alert.customerName || alert.conversationId}</Text>
                    <Text fontSize="xs" color="gray.500">{alert.reasons?.join(', ')} · {timeAgo(alert.timestamp)}</Text>
                  </Box>
                </MenuItem>
              ))}
            </MenuList>
          </Menu>

          <Menu>
            <MenuButton>
              <Avatar size="sm" name={supervisorName} bg="brand.400" color="white" />
            </MenuButton>
            <MenuList color="navy.800">
              <MenuItem isDisabled fontSize="xs" color="gray.500">Switch supervisor (demo)</MenuItem>
              <MenuDivider />
              {knownSupervisors.map((s) => (
                <MenuItem key={s.id} icon={s.id === supervisorId ? <FiCheck /> : <Box w="14px" />} onClick={() => setSupervisorId(s.id)}>
                  {s.name}
                  <Text as="span" fontSize="xs" color="gray.400" ml={2}>{s.id}</Text>
                </MenuItem>
              ))}
            </MenuList>
          </Menu>
        </Flex>
      </Flex>

      <Drawer isOpen={mobileNav.isOpen} placement="left" onClose={mobileNav.onClose}>
        <DrawerOverlay />
        <DrawerContent bg="#241B4D" color="white" maxW="240px">
          <DrawerCloseButton color="white" />
          <DrawerBody pt={12}>
            <Flex align="center" gap={2} mb={8}>
              <Image src="/logo.svg" alt="Zangoh" boxSize="28px" />
              <Text fontWeight="bold">Zangoh</Text>
            </Flex>
            <VStack align="stretch" spacing={1}>
              {MOBILE_NAV_ITEMS.map((item) => {
                const active = location.pathname === item.path || (item.path === '/' && location.pathname.startsWith('/conversation'));
                return (
                  <Flex
                    key={item.name}
                    as={Link}
                    to={item.path}
                    onClick={mobileNav.onClose}
                    align="center"
                    gap={3}
                    px={3}
                    py={2.5}
                    borderRadius="lg"
                    bg={active ? 'whiteAlpha.200' : 'transparent'}
                    color={active ? 'white' : 'whiteAlpha.700'}
                  >
                    <item.icon /> <Text fontSize="sm" fontWeight="medium">{item.name}</Text>
                  </Flex>
                );
              })}
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
  );
};

export default TopBar;
