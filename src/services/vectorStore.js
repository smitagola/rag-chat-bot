import path from "path";
import { pipeline } from "@xenova/transformers";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { LocalIndex } from "vectra";

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

export async function ingestText(text, metadata = {}) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 80,
  });

  const docs = await splitter.splitDocuments([
    { pageContent: text, metadata },
  ]);

  const sourceName = metadata.source ?? "unknown";
  const sourceType = metadata.type ?? "file";

  const sourceResult = await query(
    `INSERT INTO sources (name, type, chunk_count)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [sourceName, sourceType, docs.length]
  );
  const sourceId = sourceResult.rows[0].id;

  for (let i = 0; i < docs.length; i++) {
    const content = docs[i].pageContent;
    const vector = await embedText(content);
    const vectorStr = `[${vector.join(",")}]`;

    await query(
      `INSERT INTO chunks (source_id, content, embedding, chunk_index)
       VALUES ($1, $2, $3::vector, $4)`,
      [sourceId, content, vectorStr, i]
    );
  }

  console.log(`Ingested ${docs.length} chunks from "${sourceName}"`);
  return { chunks: docs.length, sourceId, source: sourceName };
}

export async function queryChunks(queryText, topK = 5) {
  const vector = await embedText(queryText);
  const vectorStr = `[${vector.join(",")}]`;

  const result = await query(
    `SELECT
       c.content,
       c.chunk_index,
       s.name AS source,
       1 - (c.embedding <=> $1::vector) AS score
     FROM chunks c
     JOIN sources s ON s.id = c.source_id
     ORDER BY c.embedding <=> $1::vector
     LIMIT $2`,
    [vectorStr, topK]
  );

  return result.rows.map((row) => ({
    text: row.content,
    source: row.source,
    score: Math.round(parseFloat(row.score) * 100) / 100,
  }));
}

export async function listSources() {
  const result = await query(
    `SELECT name, type, ingested_at, chunk_count
     FROM sources
     ORDER BY ingested_at DESC`
  );
  return result.rows;
}

export async function deleteSource(sourceName) {
  const result = await query(
    `DELETE FROM sources WHERE name = $1 RETURNING id, name`,
    [sourceName]
  );
  return result.rows[0] ?? null;
}

export async function clearIndex() {
  await query(`TRUNCATE sources CASCADE`);
  console.log("All sources and chunks cleared");
}

export async function initVectorStore() {
  console.log("Vector store ready (PostgreSQL + pgvector)");
}