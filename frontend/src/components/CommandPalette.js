// Lightweight command palette (Ctrl/Cmd+K) — jump to a page, conversation, agent or
// template without hunting through the sidebar. Opens via keyboard shortcut or by
// dispatching a `zangoh:open-command-palette` window event (used by the header search bar).
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ModalOverlay, ModalContent, ModalBody, Input, InputGroup, InputLeftElement, Icon, VStack, Box, Flex, Text, Kbd, Divider } from '@chakra-ui/react';
import { FiSearch, FiMessageCircle, FiUser, FiFileText, FiGrid } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../context/AppDataContext';

const PAGES = [
  { label: 'Dashboard', path: '/', icon: FiGrid },
  { label: 'Templates', path: '/templates', icon: FiFileText },
  { label: 'Agent Config', path: '/agent-config', icon: FiUser },
  { label: 'Analytics', path: '/analytics', icon: FiGrid },
];

const CommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { conversations, templates, agents } = useAppData();
  const navigate = useNavigate();

  useEffect(() => {
    const onKeydown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    const onExternalOpen = () => setIsOpen(true);
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('zangoh:open-command-palette', onExternalOpen);
    return () => {
      window.removeEventListener('keydown', onKeydown);
      window.removeEventListener('zangoh:open-command-palette', onExternalOpen);
    };
  }, []);

  useEffect(() => { if (!isOpen) setQuery(''); }, [isOpen]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    const pages = PAGES.filter((p) => !term || p.label.toLowerCase().includes(term));
    if (!term) {
      return { pages, conversations: [], templates: [], agents: [] };
    }
    return {
      pages,
      conversations: conversations.filter((c) => c.customer?.name?.toLowerCase().includes(term) || c.id.toLowerCase().includes(term)).slice(0, 6),
      templates: templates.filter((t) => t.name.toLowerCase().includes(term)).slice(0, 6),
      agents: agents.filter((a) => a.name.toLowerCase().includes(term)).slice(0, 4),
    };
  }, [query, conversations, templates, agents]);

  const go = (path) => { navigate(path); setIsOpen(false); };
  const hasResults = results.pages.length || results.conversations.length || results.templates.length || results.agents.length;

  return (
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} size="lg">
      <ModalOverlay />
      <ModalContent mt="12vh">
        <ModalBody p={0}>
          <InputGroup size="lg">
            <InputLeftElement pointerEvents="none">
              <Icon as={FiSearch} color="gray.400" />
            </InputLeftElement>
            <Input
              autoFocus
              border="none"
              placeholder="Search conversations, agents, templates…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              _focusVisible={{ boxShadow: 'none' }}
            />
          </InputGroup>
          <Divider />
          <VStack align="stretch" spacing={0} maxH="360px" overflowY="auto" py={2}>
            {!hasResults && <Text px={4} py={6} textAlign="center" color="gray.400" fontSize="sm">No matches</Text>}

            {results.pages.map((p) => (
              <PaletteRow key={p.path} icon={p.icon} label={p.label} onClick={() => go(p.path)} />
            ))}
            {results.conversations.map((c) => (
              <PaletteRow key={c.id} icon={FiMessageCircle} label={c.customer?.name} sub={`${c.id} · ${c.status}`} onClick={() => go(`/conversation/${c.id}`)} />
            ))}
            {results.templates.map((t) => (
              <PaletteRow key={t.id} icon={FiFileText} label={t.name} sub={t.category} onClick={() => go('/templates')} />
            ))}
            {results.agents.map((a) => (
              <PaletteRow key={a.id} icon={FiUser} label={a.name} sub={a.model} onClick={() => go('/agent-config')} />
            ))}
          </VStack>
          <Divider />
          <Flex px={4} py={2} fontSize="xs" color="gray.400" gap={3}>
            <Text><Kbd>Ctrl</Kbd> + <Kbd>K</Kbd> to open</Text>
            <Text><Kbd>Esc</Kbd> to close</Text>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

const PaletteRow = ({ icon, label, sub, onClick }) => (
  <Flex align="center" gap={3} px={4} py={2.5} cursor="pointer" _hover={{ bg: 'gray.50' }} onClick={onClick}>
    <Flex align="center" justify="center" boxSize="32px" borderRadius="md" bg="brand.50" color="brand.600" flexShrink={0}>
      <Icon as={icon} boxSize={4} />
    </Flex>
    <Box minW={0}>
      <Text fontSize="sm" fontWeight="medium" noOfLines={1}>{label}</Text>
      {sub && <Text fontSize="xs" color="gray.400" noOfLines={1}>{sub}</Text>}
    </Box>
  </Flex>
);

export default CommandPalette;
