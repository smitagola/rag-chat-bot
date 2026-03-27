import path from "path";
import { pipeline } from "@xenova/transformers";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { LocalIndex } from "vectra";

// ── Embedder singleton ────────────────────────────────────────────────────────

let embedder = null;

async function getEmbedder() {
  if (!embedder) {
    console.log("Loading embedding model...");
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("Embedding model ready");
  }
  return embedder;
}

async function embedText(text) {
  const fn = await getEmbedder();
  const output = await fn(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

// ── Vectra index singleton ────────────────────────────────────────────────────

let _index = null;

async function getIndex() {
  if (!_index) {
    _index = new LocalIndex(path.resolve("data", "vectra-index"));
    if (!(await _index.isIndexCreated())) {
      await _index.createIndex();
    }
  }
  return _index;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function ingestText(text, metadata = {}) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 80,
  });

  const docs = await splitter.splitDocuments([
    { pageContent: text, metadata },
  ]);

  const sourceName = metadata.source ?? "unknown";
  const index = await getIndex();

  for (let i = 0; i < docs.length; i++) {
    const content = docs[i].pageContent;
    const vector = await embedText(content);

    await index.insertItem({
      vector,
      metadata: {
        content,
        source: sourceName,
        chunkIndex: i,
      },
    });
  }

  console.log(`Ingested ${docs.length} chunks from "${sourceName}"`);
  return { chunks: docs.length, source: sourceName };
}

export async function queryChunks(queryText, topK = 5) {
  const index = await getIndex();
  const vector = await embedText(queryText);

  const results = await index.queryItems(vector, topK);

  return results.map(({ item, score }) => ({
    text: item.metadata.content,
    source: item.metadata.source,
    score: Math.round(score * 100) / 100,
  }));
}

export async function listSources() {
  const index = await getIndex();
  const items = await index.listItems();

  // Deduplicate by source name
  const seen = new Map();
  for (const item of items) {
    const src = item.metadata.source ?? "unknown";
    if (!seen.has(src)) {
      seen.set(src, { name: src, chunkCount: 0 });
    }
    seen.get(src).chunkCount++;
  }

  return Array.from(seen.values());
}

export async function deleteSource(sourceName) {
  const index = await getIndex();
  const items = await index.listItems();

  let deleted = 0;
  for (const item of items) {
    if (item.metadata.source === sourceName) {
      await index.deleteItem(item.id);
      deleted++;
    }
  }

  if (deleted === 0) return null;
  console.log(`Deleted ${deleted} chunks for source "${sourceName}"`);
  return { name: sourceName, chunksDeleted: deleted };
}

export async function clearIndex() {
  const index = await getIndex();
  const items = await index.listItems();
  for (const item of items) {
    await index.deleteItem(item.id);
  }
  console.log("All sources and chunks cleared");
}

export async function initVectorStore() {
  await getIndex(); // ensures index directory + files are created on startup
  console.log("Vector store ready (vectra local index)");
}