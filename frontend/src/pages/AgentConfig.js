import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box, Flex, Heading, Text, Select, Slider, SliderTrack, SliderFilledTrack, SliderThumb,
  HStack, Checkbox, Input, Button, SimpleGrid, Badge, useToast, Spinner,
  Menu, MenuButton, MenuList, MenuItem, IconButton, FormControl, FormLabel, Divider, Tooltip,
} from '@chakra-ui/react';
import { FiSave, FiRotateCcw, FiChevronDown, FiTrash2, FiBookmark } from 'react-icons/fi';
import { useAppData } from '../context/AppDataContext';
import * as api from '../api';

const formFromAgent = (agent) => ({
  parameters: { ...agent.parameters },
  capabilities: agent.capabilities.map((c) => ({ ...c })),
  knowledgeBases: agent.knowledgeBases.map((k) => ({ ...k })),
  escalationThresholds: { ...agent.escalationThresholds },
  status: agent.status,
});

const AgentConfig = () => {
  const { agents, loading, refreshAgents } = useAppData();
  const toast = useToast();

  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null); // last-saved snapshot, used to detect unsaved changes + reset
  const [metrics, setMetrics] = useState(null);
  const [presets, setPresets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState(null); // toggles the "save as preset" mini-form

  const agent = agents.find((a) => a.id === selectedId) || null;

  useEffect(() => {
    if (agents.length && !selectedId) setSelectedId(agents[0].id);
  }, [agents, selectedId]);

  useEffect(() => {
    if (!agent) return;
    const snapshot = formFromAgent(agent);
    setForm(snapshot);
    setSaved(snapshot);
    api.getAgentMetrics(agent.id).then(setMetrics).catch(() => setMetrics(null));
  }, [agent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPresets = useCallback(() => { api.getPresets().then(setPresets).catch(() => {}); }, []);
  useEffect(() => { loadPresets(); }, [loadPresets]);

  const isDirty = useMemo(() => form && saved && JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  if (loading.agents || !form) {
    return <Flex justify="center" py={20}><Spinner color="brand.500" /></Flex>;
  }

  const setParam = (key, value) => setForm((prev) => ({ ...prev, parameters: { ...prev.parameters, [key]: value } }));
  const setThreshold = (key, value) => setForm((prev) => ({ ...prev, escalationThresholds: { ...prev.escalationThresholds, [key]: value } }));
  const toggleItem = (group, id) =>
    setForm((prev) => ({ ...prev, [group]: prev[group].map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item)) }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { agent: updated } = await api.updateAgentConfig(agent.id, form);
      setSaved(formFromAgent(updated));
      await refreshAgents();
      toast({ status: 'success', title: 'Configuration saved' });
    } catch (err) {
      toast({ status: 'error', title: 'Save failed', description: err.friendlyMessage || err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => setForm(saved);

  const applyPreset = (preset) => {
    setForm((prev) => ({
      parameters: { ...prev.parameters, ...preset.config.parameters },
      escalationThresholds: { ...prev.escalationThresholds, ...preset.config.escalationThresholds },
      capabilities: prev.capabilities.map((c) => {
        const match = preset.config.capabilities?.find((p) => p.id === c.id);
        return match ? { ...c, enabled: match.enabled } : c;
      }),
      knowledgeBases: prev.knowledgeBases.map((k) => {
        const match = preset.config.knowledgeBases?.find((p) => p.id === k.id);
        return match ? { ...k, enabled: match.enabled } : k;
      }),
      status: prev.status,
    }));
    toast({ status: 'info', title: `"${preset.name}" loaded — review and Save to apply` });
  };

  const saveAsPreset = async () => {
    const name = (presetNameInput || '').trim();
    if (!name) return;
    try {
      const preset = await api.createPreset({ name, agentId: agent.id, config: form });
      setPresets((prev) => [...prev, preset]);
      setPresetNameInput(null);
      toast({ status: 'success', title: 'Preset saved' });
    } catch (err) {
      toast({ status: 'error', title: 'Could not save preset', description: err.friendlyMessage || err.message });
    }
  };

  const deletePreset = async (id) => {
    try {
      await api.deletePreset(id);
      setPresets((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      toast({ status: 'error', title: 'Could not delete preset', description: err.friendlyMessage || err.message });
    }
  };

  return (
    <Box maxW="1100px" mx="auto">
      <Flex justify="space-between" align="center" mb={6} flexWrap="wrap" gap={3}>
        <Box>
          <Heading size="lg" color="navy.800">Agent Configuration</Heading>
          <Text color="gray.500" fontSize="sm">Tune parameters, capabilities and escalation rules per agent</Text>
        </Box>
        <HStack>
          <Menu>
            <MenuButton as={Button} size="sm" variant="outline" rightIcon={<FiChevronDown />} leftIcon={<FiBookmark />}>Presets</MenuButton>
            <MenuList>
              {presets.length === 0 && <MenuItem isDisabled>No presets saved yet</MenuItem>}
              {presets.map((preset) => (
                <MenuItem key={preset.id} closeOnSelect={false} justifyContent="space-between" onClick={() => applyPreset(preset)}>
                  <Box>
                    <Text fontSize="sm">{preset.name}</Text>
                    {preset.description && <Text fontSize="xs" color="gray.400">{preset.description}</Text>}
                  </Box>
                  <IconButton aria-label="Delete preset" icon={<FiTrash2 />} size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); deletePreset(preset.id); }} />
                </MenuItem>
              ))}
              <Divider my={1} />
              {presetNameInput === null ? (
                <MenuItem onClick={(e) => { e.preventDefault(); setPresetNameInput(''); }}>+ Save current as preset</MenuItem>
              ) : (
                <Box px={3} py={2}>
                  <Input size="sm" placeholder="Preset name" value={presetNameInput} onChange={(e) => setPresetNameInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveAsPreset()} mb={2} autoFocus />
                  <Button size="xs" colorScheme="brand" onClick={saveAsPreset}>Save</Button>
                </Box>
              )}
            </MenuList>
          </Menu>
          <Button size="sm" variant="outline" leftIcon={<FiRotateCcw />} onClick={handleReset} isDisabled={!isDirty}>Reset</Button>
          <Button size="sm" leftIcon={<FiSave />} onClick={handleSave} isLoading={saving} isDisabled={!isDirty}>Save Changes</Button>
        </HStack>
      </Flex>

      <Box layerStyle="glass" p={{ base: 4, md: 8 }}>
        <form data-testid="agent-config-form" onSubmit={(e) => e.preventDefault()}>
          <Flex justify="space-between" align="end" mb={8} flexWrap="wrap" gap={4}>
            <FormControl maxW="320px">
              <FormLabel fontSize="sm" fontWeight="semibold">Agent</FormLabel>
              <Select data-testid="agent-selector" size="lg" value={selectedId || ''} onChange={(e) => setSelectedId(e.target.value)}>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </FormControl>
            <FormControl maxW="200px">
              <FormLabel fontSize="sm" fontWeight="semibold">Status</FormLabel>
              <Select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
              </Select>
            </FormControl>
            {metrics && (
              <HStack spacing={5} fontSize="sm" color="gray.500">
                <Text>Satisfaction: <b>{Math.round((metrics.satisfaction || 0) * 100)}%</b></Text>
                <Text>Escalation: <b>{Math.round((metrics.escalationRate || 0) * 100)}%</b></Text>
              </HStack>
            )}
          </Flex>

          <Text fontSize="lg" fontWeight="semibold" mb={4} color="navy.800">Model Parameters</Text>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8} mb={8}>
            <SliderField label="Temperature" value={form.parameters.temperature} min={0} max={1} step={0.01} onChange={(v) => setParam('temperature', v)} help="Higher = more varied, less predictable replies" />
            <SliderField label="Top-p" value={form.parameters.top_p} min={0} max={1} step={0.01} onChange={(v) => setParam('top_p', v)} help="Nucleus sampling cutoff" />
            <FormControl>
              <FormLabel fontSize="sm">Max Tokens</FormLabel>
              <Input type="number" min={16} max={4096} value={form.parameters.max_tokens} onChange={(e) => setParam('max_tokens', Number(e.target.value))} />
              <Text fontSize="xs" color="gray.400" mt={1}>Hard cap on reply length</Text>
            </FormControl>
          </SimpleGrid>

          <Text fontSize="lg" fontWeight="semibold" mb={3} color="navy.800">Capabilities</Text>
          <SimpleGrid columns={{ base: 2, md: 3 }} spacing={3} mb={8}>
            {form.capabilities.map((cap) => (
              <Checkbox key={cap.id} isChecked={cap.enabled} onChange={() => toggleItem('capabilities', cap.id)}>{cap.name}</Checkbox>
            ))}
          </SimpleGrid>

          <Text fontSize="lg" fontWeight="semibold" mb={3} color="navy.800">Knowledge Bases</Text>
          <SimpleGrid columns={{ base: 2, md: 3 }} spacing={3} mb={8}>
            {form.knowledgeBases.map((kb) => (
              <Checkbox key={kb.id} isChecked={kb.enabled} onChange={() => toggleItem('knowledgeBases', kb.id)}>{kb.name}</Checkbox>
            ))}
          </SimpleGrid>

          <Text fontSize="lg" fontWeight="semibold" mb={4} color="navy.800">Escalation Thresholds</Text>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8}>
            <SliderField label="Low Confidence Below" value={form.escalationThresholds.lowConfidence} min={0} max={1} step={0.01} onChange={(v) => setThreshold('lowConfidence', v)} help="Escalate when AI confidence drops below this" />
            <SliderField label="Negative Sentiment Below" value={form.escalationThresholds.negativeSentiment} min={0} max={1} step={0.01} onChange={(v) => setThreshold('negativeSentiment', v)} help="Escalate when sentiment drops below this" />
            <FormControl>
              <FormLabel fontSize="sm">Response Time Above (sec)</FormLabel>
              <Input type="number" min={1} max={600} value={form.escalationThresholds.responseTime} onChange={(e) => setThreshold('responseTime', Number(e.target.value))} />
            </FormControl>
          </SimpleGrid>

          {isDirty && (
            <Badge colorScheme="orange" mt={6}>Unsaved changes</Badge>
          )}
        </form>
      </Box>
    </Box>
  );
};

const SliderField = ({ label, value, min, max, step, onChange, help }) => (
  <FormControl>
    <Flex justify="space-between">
      <FormLabel fontSize="sm" mb={1}>{label}</FormLabel>
      <Text fontSize="sm" color="gray.500">{value?.toFixed(2)}</Text>
    </Flex>
    <Slider value={value} min={min} max={max} step={step} onChange={onChange}>
      <SliderTrack><SliderFilledTrack bg="brand.500" /></SliderTrack>
      <Tooltip label={value?.toFixed(2)} placement="top">
        <SliderThumb />
      </Tooltip>
    </Slider>
    {help && <Text fontSize="xs" color="gray.400" mt={1}>{help}</Text>}
  </FormControl>
);

export default AgentConfig;
