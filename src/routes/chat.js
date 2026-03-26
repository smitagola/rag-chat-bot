import { Router } from "express";
import { validate, chatSchema } from "../middleware/validate.js";
import { queryChunks } from "../services/vectorStore.js";
import { callGroq } from "../services/llm.js";
import { cache } from "../services/cache.js";
import { history } from "../services/history.js";
import { logger } from "../utils/logger.js";

const router = Router();

// POST /api/v1/chat
router.post("/", validate(chatSchema), async (req, res, next) => {
  try {
    const { query, topK, sessionId } = req.body;

    // 1. Check cache (only for stateless queries without session history)
    const sessionMessages = history.getMessages(sessionId);
    const isFirstMessage = sessionMessages.length === 0;

    if (isFirstMessage) {
      const cached = cache.get(query, topK);
      if (cached) {
        return res.json({ ...cached, cached: true });
      }
    }

    // 2. Retrieve relevant chunks with source info
    const chunks = await queryChunks(query, topK);

    if (chunks.length === 0) {
      return res.json({
        answer: "I don't have that information. Please ingest some documents first.",
        chunks_used: 0,
        sources: [],
        sessionId,
      });
    }

    // 3. Build context with source attribution
    const context = chunks
      .map((c, i) => `[${i + 1}] (source: ${c.source})\n${c.text}`)
      .join("\n\n");

    // 4. Build message history for multi-turn support
    const userMessage = {
      role: "user",
      content: `Context:\n\n${context}\n\n---\nQuestion: ${query}`,
    };

    const messages = [...sessionMessages, userMessage];

    // 5. Call LLM with retry
    const answer = await callGroq(messages);

    // 6. Save turn to history
    history.append(sessionId, "user", userMessage.content);
    history.append(sessionId, "assistant", answer);

    // 7. Build unique sources list
    const sources = [...new Set(chunks.map((c) => c.source))];

    const responsePayload = {
      answer,
      chunks_used: chunks.length,
      sources,
      sessionId,
      cached: false,
    };

    // 8. Cache only stateless (first-turn) responses
    if (isFirstMessage) {
      cache.set(query, topK, responsePayload);
    }

    logger.info("Chat answered", {
      sessionId,
      query: query.slice(0, 60),
      chunks: chunks.length,
      sources,
    });

    res.json(responsePayload);
  } catch (err) {
    next(err);
  }
});

export default router;