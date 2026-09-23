// "Template Management Screen" — browse, filter, create, edit and delete response
// templates. Visibility (shared vs. mine) is enforced by the backend; this page just
// renders what it's given and gates edit/delete controls to the author.
import React, { useState } from 'react';
import {
  Box, Flex, Heading, Text, SimpleGrid, Input, InputGroup, InputLeftElement, Select, Button,
  Tag, Icon, IconButton, useDisclosure, useToast, Tabs, TabList, Tab, Badge, HStack,
} from '@chakra-ui/react';
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiUsers, FiLock } from 'react-icons/fi';
import { useAppData } from '../context/AppDataContext';
import { useSupervisor } from '../context/SupervisorContext';
import * as api from '../api';
import TemplateEditorModal from '../components/TemplateEditorModal';
import TemplatePreview from '../components/TemplatePreview';

const TABS = ['all', 'shared', 'mine'];

const Templates = () => {
  const { templates, loading, refreshTemplates } = useAppData();
  const { supervisorId } = useSupervisor();
  const toast = useToast();
  const editor = useDisclosure();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [tab, setTab] = useState(0);
  const [editing, setEditing] = useState(null);

  const categories = ['all', ...new Set(templates.map((t) => t.category))];

  const filtered = templates.filter((t) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || t.name.toLowerCase().includes(term) || t.content.toLowerCase().includes(term);
    const matchesCategory = category === 'all' || t.category === category;
    const matchesTab = TABS[tab] === 'all' || (TABS[tab] === 'shared' ? t.isShared : t.createdBy === supervisorId);
    return matchesSearch && matchesCategory && matchesTab;
  });

  const openCreate = () => { setEditing(null); editor.onOpen(); };
  const openEdit = (template) => { setEditing(template); editor.onOpen(); };

  const remove = async (template) => {
    if (!window.confirm(`Delete "${template.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteTemplate(template.id);
      toast({ status: 'success', title: 'Template deleted' });
      refreshTemplates();
    } catch (err) {
      toast({ status: 'error', title: 'Could not delete', description: err.friendlyMessage || err.message });
    }
  };

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={5} flexWrap="wrap" gap={3}>
        <Box>
          <Heading size="lg" color="navy.800">Response Templates</Heading>
          <Text color="gray.500" fontSize="sm">Reusable, variable-driven replies for consistent, fast responses</Text>
        </Box>
        <Button leftIcon={<FiPlus />} onClick={openCreate}>New Template</Button>
      </Flex>

      <Flex gap={3} mb={4} flexWrap="wrap" align="center">
        <Tabs index={tab} onChange={setTab} size="sm" variant="soft-rounded" colorScheme="brand">
          <TabList>
            <Tab>All</Tab>
            <Tab>Shared</Tab>
            <Tab>Mine</Tab>
          </TabList>
        </Tabs>
        <InputGroup size="sm" maxW="260px">
          <InputLeftElement pointerEvents="none"><Icon as={FiSearch} color="gray.400" /></InputLeftElement>
          <Input placeholder="Search templates…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </InputGroup>
        <Select size="sm" maxW="180px" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
        </Select>
        <Text fontSize="xs" color="gray.400" ml="auto">{filtered.length} template{filtered.length !== 1 ? 's' : ''}</Text>
      </Flex>

      {loading.templates ? (
        <Text color="gray.400">Loading…</Text>
      ) : filtered.length === 0 ? (
        <Box textAlign="center" py={16} color="gray.400">No templates match your filters.</Box>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4}>
          {filtered.map((template) => (
            <Box key={template.id} layerStyle="glass" p={4} display="flex" flexDirection="column">
              <Flex justify="space-between" align="start" mb={2}>
                <Box minW={0}>
                  <Text fontWeight="semibold" noOfLines={1}>{template.name}</Text>
                  <HStack spacing={2} mt={1}>
                    <Tag size="sm" colorScheme="brand">{template.category}</Tag>
                    {template.createdBy === supervisorId && <Badge fontSize="9px" colorScheme="gray">mine</Badge>}
                  </HStack>
                </Box>
                <Icon as={template.isShared ? FiUsers : FiLock} color="gray.400" boxSize={4} flexShrink={0} title={template.isShared ? 'Shared' : 'Private'} />
              </Flex>

              <Box flex="1" fontSize="sm" color="gray.600" noOfLines={4} mb={3}>
                <TemplatePreview content={template.content} values={{}} fontSize="xs" />
              </Box>

              <Flex justify="space-between" align="center" mt="auto">
                <Text fontSize="xs" color="gray.400">Used {template.usageCount || 0}×</Text>
                {template.createdBy === supervisorId && (
                  <HStack spacing={1}>
                    <IconButton aria-label="Edit template" icon={<FiEdit2 />} size="xs" variant="ghost" onClick={() => openEdit(template)} />
                    <IconButton aria-label="Delete template" icon={<FiTrash2 />} size="xs" variant="ghost" colorScheme="red" onClick={() => remove(template)} />
                  </HStack>
                )}
              </Flex>
            </Box>
          ))}
        </SimpleGrid>
      )}

      <TemplateEditorModal isOpen={editor.isOpen} onClose={editor.onClose} template={editing} onSaved={refreshTemplates} />
    </Box>
  );
};

export default Templates;
