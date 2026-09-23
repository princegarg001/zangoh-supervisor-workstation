// "Template Usage Interface" — browse templates, fill in variables with clear
// visual feedback, and hand the rendered text back to the composer.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
  Flex, Box, Input, InputGroup, InputLeftElement, Icon, VStack, Text, Button,
  FormControl, FormLabel, Divider, useColorModeValue, Tag, Wrap, WrapItem, Tooltip,
} from '@chakra-ui/react';
import { FiSearch, FiUsers, FiLock } from 'react-icons/fi';
import { useAppData } from '../context/AppDataContext';
import { useSupervisor } from '../context/SupervisorContext';
import { render } from '../utils/templateEngine';
import TemplatePreview, { VariableLegend } from './TemplatePreview';

/**
 * @param {boolean} isOpen
 * @param {() => void} onClose
 * @param {(text: string, templateId: string) => void} onInsert
 * @param {object} [autofill] - known values keyed by variable name, e.g. { customer_name, supervisor_name }
 */
const TemplatePicker = ({ isOpen, onClose, onInsert, autofill = {} }) => {
  const { templates, loading } = useAppData();
  const { supervisorId } = useSupervisor();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [values, setValues] = useState({});

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(term) || t.category.toLowerCase().includes(term) || t.content.toLowerCase().includes(term));
  }, [templates, search]);

  const selected = templates.find((t) => t.id === selectedId) || null;

  useEffect(() => {
    if (!isOpen) { setSelectedId(null); setSearch(''); return; }
    if (filtered.length && !filtered.some((t) => t.id === selectedId)) setSelectedId(filtered[0].id);
  }, [isOpen, filtered, selectedId]);

  useEffect(() => {
    if (!selected) return;
    const initial = {};
    for (const variable of selected.variables) initial[variable.name] = autofill[variable.name] || '';
    setValues(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const rendered = selected ? render(selected.content, values) : null;
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const activeBg = useColorModeValue('brand.50', 'gray.700');
  const previewBg = useColorModeValue('gray.50', 'gray.700');

  const handleInsert = () => {
    if (!selected || !rendered) return;
    onInsert(rendered.text, selected.id);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Insert a response template</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Flex gap={4} minH="420px">
            <Box w="280px" flexShrink={0} borderRight="1px" borderColor="chakra-border-color" pr={4}>
              <InputGroup mb={3} size="sm">
                <InputLeftElement pointerEvents="none">
                  <Icon as={FiSearch} color="gray.400" />
                </InputLeftElement>
                <Input placeholder="Search templates…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </InputGroup>

              {loading.templates && <Text fontSize="sm" color="gray.500">Loading…</Text>}
              {!loading.templates && filtered.length === 0 && <Text fontSize="sm" color="gray.500">No templates found.</Text>}

              <VStack align="stretch" spacing={1} maxH="380px" overflowY="auto">
                {filtered.map((t) => (
                  <Box
                    key={t.id}
                    p={2}
                    borderRadius="md"
                    cursor="pointer"
                    bg={t.id === selectedId ? activeBg : 'transparent'}
                    _hover={{ bg: t.id === selectedId ? activeBg : hoverBg }}
                    onClick={() => setSelectedId(t.id)}
                  >
                    <Flex justify="space-between" align="start">
                      <Text fontSize="sm" fontWeight="medium" noOfLines={1}>{t.name}</Text>
                      <Tooltip label={t.isShared ? 'Shared with all supervisors' : 'Private to you'}>
                        <Box><Icon as={t.isShared ? FiUsers : FiLock} color="gray.400" boxSize={3} mt="2px" /></Box>
                      </Tooltip>
                    </Flex>
                    <Flex gap={1} mt={1}>
                      <Tag size="sm" colorScheme="brand">{t.category}</Tag>
                      {t.createdBy === supervisorId && <Tag size="sm" colorScheme="gray">mine</Tag>}
                    </Flex>
                  </Box>
                ))}
              </VStack>
            </Box>

            <Box flex="1" minW={0}>
              {!selected && <Text color="gray.500">Select a template to preview it.</Text>}
              {selected && (
                <VStack align="stretch" spacing={4}>
                  <Box>
                    <Text fontWeight="bold" fontSize="lg">{selected.name}</Text>
                    <Text fontSize="xs" color="gray.500">Used {selected.usageCount || 0} times</Text>
                  </Box>

                  {selected.variables.length > 0 && (
                    <Box>
                      <FormLabel fontSize="sm" mb={2}>Fill in the variables</FormLabel>
                      <Wrap spacing={3}>
                        {selected.variables.map((variable) => (
                          <WrapItem key={variable.name} minW="220px" flex="1">
                            <FormControl>
                              <FormLabel fontSize="xs" color="gray.500" mb={1}>
                                {variable.name}
                                {variable.description && <Text as="span" color="gray.400"> · {variable.description}</Text>}
                              </FormLabel>
                              <Input
                                size="sm"
                                value={values[variable.name] || ''}
                                placeholder={`Value for ${variable.name}`}
                                onChange={(e) => setValues((prev) => ({ ...prev, [variable.name]: e.target.value }))}
                              />
                            </FormControl>
                          </WrapItem>
                        ))}
                      </Wrap>
                    </Box>
                  )}

                  <Divider />

                  <Box>
                    <Flex justify="space-between" align="center" mb={2}>
                      <FormLabel fontSize="sm" mb={0}>Live preview</FormLabel>
                      <VariableLegend />
                    </Flex>
                    <Box p={3} bg={previewBg} borderRadius="md" borderWidth="1px">
                      <TemplatePreview content={selected.content} values={values} />
                    </Box>
                    {!rendered.complete && (
                      <Text fontSize="xs" color="orange.500" mt={2}>
                        Fill in {rendered.missing.join(', ')} before inserting.
                      </Text>
                    )}
                  </Box>
                </VStack>
              )}
            </Box>
          </Flex>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
          <Button colorScheme="brand" onClick={handleInsert} isDisabled={!selected || !rendered?.complete}>
            Insert into message
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default TemplatePicker;
