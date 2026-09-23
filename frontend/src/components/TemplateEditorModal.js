// "Template Creation Modal" — create or edit a response template. Variables are
// derived live from `{{placeholders}}` in the content as the author types.
import React, { useEffect, useState } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
  FormControl, FormLabel, Input, Textarea, Select, Checkbox, Button, VStack, Box, Text,
  Wrap, WrapItem, Alert, AlertIcon, useToast,
} from '@chakra-ui/react';
import * as api from '../api';
import { extractVariables, validateContent } from '../utils/templateEngine';
import TemplatePreview, { VariableLegend } from './TemplatePreview';

const CATEGORIES = ['shipping', 'returns', 'billing', 'product', 'general'];
const EMPTY = { name: '', category: 'general', content: '', isShared: false };

/** @param {object|null} template - null for create, a template object to edit */
const TemplateEditorModal = ({ isOpen, onClose, template, onSaved }) => {
  const [form, setForm] = useState(EMPTY);
  const [descriptions, setDescriptions] = useState({}); // name -> description, keyed while editing
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const toast = useToast();

  useEffect(() => {
    if (!isOpen) return;
    if (template) {
      setForm({ name: template.name, category: template.category, content: template.content, isShared: template.isShared });
      setDescriptions(Object.fromEntries(template.variables.map((v) => [v.name, v.description])));
    } else {
      setForm(EMPTY);
      setDescriptions({});
    }
    setErrors([]);
  }, [isOpen, template]);

  const variables = extractVariables(form.content);
  const previewValues = Object.fromEntries(variables.map((name) => [name, `{example}`.replace('example', name)]));

  const handleSave = async () => {
    const validation = validateContent(form.content);
    if (!form.name.trim()) validation.push('Name is required');
    if (validation.length) { setErrors(validation); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        variables: variables.map((name) => ({ name, description: descriptions[name] || '' })),
      };
      if (template) await api.updateTemplate(template.id, payload);
      else await api.createTemplate(payload);
      toast({ status: 'success', title: template ? 'Template updated' : 'Template created' });
      onSaved?.();
      onClose();
    } catch (err) {
      setErrors(err.response?.data?.details || [err.friendlyMessage || err.message]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{template ? 'Edit Template' : 'Create Template'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            {errors.length > 0 && (
              <Alert status="error" borderRadius="md" flexDirection="column" alignItems="start">
                <Box display="flex" alignItems="center"><AlertIcon />Please fix the following:</Box>
                <VStack align="start" spacing={0} mt={1} pl={6}>
                  {errors.map((e) => <Text key={e} fontSize="sm">• {e}</Text>)}
                </VStack>
              </Alert>
            )}

            <FormControl isRequired>
              <FormLabel fontSize="sm">Name</FormLabel>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Shipping Delay Apology" />
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">Category</FormLabel>
              <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </FormControl>

            <FormControl isRequired>
              <FormLabel fontSize="sm">
                Content <Text as="span" fontWeight="normal" color="gray.400">— use {'{{variable_name}}'} for placeholders</Text>
              </FormLabel>
              <Textarea rows={6} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder={"Hi {{customer_name}}, your order #{{order_number}} ..."} fontFamily="mono" fontSize="sm" />
            </FormControl>

            {variables.length > 0 && (
              <Box>
                <FormLabel fontSize="sm" mb={2}>Variable descriptions (optional, shown to whoever fills this in)</FormLabel>
                <Wrap spacing={3}>
                  {variables.map((name) => (
                    <WrapItem key={name} minW="200px" flex="1">
                      <FormControl>
                        <FormLabel fontSize="xs" color="gray.500" mb={1}>{name}</FormLabel>
                        <Input size="sm" value={descriptions[name] || ''} onChange={(e) => setDescriptions((d) => ({ ...d, [name]: e.target.value }))} placeholder="What is this variable for?" />
                      </FormControl>
                    </WrapItem>
                  ))}
                </Wrap>
              </Box>
            )}

            {form.content.trim() && (
              <Box>
                <Box display="flex" justifyContent="space-between" mb={2}>
                  <FormLabel fontSize="sm" mb={0}>Preview</FormLabel>
                  <VariableLegend />
                </Box>
                <Box p={3} bg="gray.50" borderRadius="md" borderWidth="1px">
                  <TemplatePreview content={form.content} values={previewValues} />
                </Box>
              </Box>
            )}

            <Checkbox isChecked={form.isShared} onChange={(e) => setForm((f) => ({ ...f, isShared: e.target.checked }))}>
              Share with all supervisors
            </Checkbox>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
          <Button colorScheme="brand" onClick={handleSave} isLoading={saving}>{template ? 'Save Changes' : 'Create Template'}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default TemplateEditorModal;
