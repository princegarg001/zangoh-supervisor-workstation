// Knowledge retrieval (RAG) over the markdown knowledge bases in src/data/knowledge.
//
// Documents are chunked by heading and embedded with a deterministic hashed
// bag-of-words vector (no external embedding API needed). Chunks are indexed in
// Qdrant when it is reachable; otherwise an in-memory index with the same
// embedding is used, so retrieval keeps working in every environment.

const fs = require('fs');
const path = require('path');
const { QdrantClient } = require('@qdrant/js-client-rest');
const config = require('../config');

const KNOWLEDGE_DIR = path.join(__dirname, '..', 'data', 'knowledge');
const COLLECTION = 'knowledge_base';
const DIM = 384;
const STOPWORDS = new Set('a an and are as at be by for from has have i in is it its of on or our that the this to we with you your can will my me do does what when how'.split(' '));

const state = { chunks: [], documents: new Map(), backend: 'memory', qdrant: null };

// ---------- embedding ----------
function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function hash(token) {
  let h = 2166136261; // FNV-1a
  for (let i = 0; i < token.length; i += 1) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function embed(text) {
  const vector = new Array(DIM).fill(0);
  for (const token of tokenize(text)) {
    // Light stemming so "delays" matches "delay".
    const stem = token.replace(/(ing|ed|es|s)$/, '');
    vector[hash(stem) % DIM] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

const cosine = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);

// ---------- chunking ----------
function chunkMarkdown(content, kbId) {
  const chunks = [];
  const trail = [];
  let buffer = [];

  const flush = () => {
    const text = buffer.join('\n').trim();
    if (text.replace(/[#*\s-]/g, '').length > 40) {
      chunks.push({ kbId, section: trail.filter(Boolean).join(' > '), text });
    }
    buffer = [];
  };

  for (const line of content.split('\n')) {
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flush();
      const depth = heading[1].length;
      trail.length = depth - 1;
      trail[depth - 1] = heading[2].trim();
      continue;
    }
    buffer.push(line);
  }
  flush();
  return chunks;
}

// ---------- lifecycle ----------
async function init() {
  const files = fs.existsSync(KNOWLEDGE_DIR) ? fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith('.md')) : [];
  state.chunks = [];
  for (const file of files) {
    const kbId = file.replace(/\.md$/, '');
    const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), 'utf8');
    const title = (content.match(/^#\s+(.*)$/m) || [])[1] || kbId;
    state.documents.set(kbId, { id: kbId, name: title, content });
    state.chunks.push(...chunkMarkdown(content, kbId));
  }
  state.chunks.forEach((chunk, i) => { chunk.pointId = i + 1; chunk.vector = embed(`${chunk.section} ${chunk.text}`); });

  try {
    const client = new QdrantClient({ url: config.qdrantUrl, checkCompatibility: false });
    const { collections } = await client.getCollections();
    if (collections.some((c) => c.name === COLLECTION)) await client.deleteCollection(COLLECTION);
    await client.createCollection(COLLECTION, { vectors: { size: DIM, distance: 'Cosine' } });
    await client.createPayloadIndex(COLLECTION, { field_name: 'knowledge_base_id', field_schema: 'keyword', wait: true });
    await client.upsert(COLLECTION, {
      wait: true,
      points: state.chunks.map((c) => ({
        id: c.pointId, // Qdrant requires unsigned integers or UUIDs as point ids
        vector: c.vector,
        payload: { text: c.text, knowledge_base_id: c.kbId, section_path: c.section },
      })),
    });
    state.qdrant = client;
    state.backend = 'qdrant';
  } catch (err) {
    state.backend = 'memory';
    console.warn(`[knowledge] Qdrant unavailable (${err.message}); using in-memory vector index`);
  }
  console.log(`[knowledge] Indexed ${state.chunks.length} chunks from ${files.length} documents (${state.backend})`);
}

/**
 * @param {string} query
 * @param {string[]} [knowledgeBases] - restrict to these KB ids (all when empty)
 * @param {number} [limit]
 */
async function search(query, knowledgeBases = [], limit = 3) {
  const vector = embed(query);
  const kbFilter = knowledgeBases && knowledgeBases.length ? knowledgeBases : null;

  if (state.backend === 'qdrant') {
    try {
      const hits = await state.qdrant.search(COLLECTION, {
        vector,
        limit,
        with_payload: true,
        ...(kbFilter && { filter: { must: [{ key: 'knowledge_base_id', match: { any: kbFilter } }] } }),
      });
      return hits.filter((h) => h.score > 0).map((h) => formatResult(h.payload.knowledge_base_id, h.payload.section_path, h.payload.text, h.score));
    } catch (err) {
      console.warn(`[knowledge] Qdrant search failed (${err.message}); falling back to memory`);
    }
  }

  return state.chunks
    .filter((c) => !kbFilter || kbFilter.includes(c.kbId))
    .map((c) => ({ c, score: cosine(vector, c.vector) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ c, score }) => formatResult(c.kbId, c.section, c.text, score));
}

function formatResult(kbId, section, text, score) {
  return {
    text,
    source: state.documents.get(kbId)?.name || kbId,
    knowledgeBase: kbId,
    section,
    relevance: Number(score.toFixed(2)),
  };
}

const getDocument = (kbId) => state.documents.get(kbId) || null;
const backend = () => state.backend;

module.exports = { init, search, getDocument, backend, embed, chunkMarkdown };
