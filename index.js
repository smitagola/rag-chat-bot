export const config = {
  port: parseInt(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  groqApiKey: process.env.GROQ_API_KEY,

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 60,
  },

  cache: {
    ttlMs: parseInt(process.env.CACHE_TTL_MS) || 300_000,
  },

  groq: {
    model: "llama-3.3-70b-versatile",
    maxTokens: 1024,
  },

  vectorStore: {
    indexPath: "./rag-index",
    chunkSize: 500,
    chunkOverlap: 80,
    defaultTopK: 5,
  },

  upload: {
    dest: "uploads/",
    maxFileSizeMb: 50,
  },
};