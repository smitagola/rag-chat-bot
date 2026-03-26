import Groq from "groq-sdk";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const groq = new Groq({ apiKey: config.groqApiKey });

const SYSTEM_PROMPT = `You are a knowledgeable assistant. Answer questions directly and confidently using the provided context.
Rules:
- Never say "based on the context", "the context says", or any similar meta-phrase
- Never mention chunks, documents, or excerpts
- Answer as if you already know this information — speak directly and confidently
- If information is not available, say "I don't have that information" in one short sentence
- No filler phrases like "If you need more", "Let me know", "I hope this helps"
- Keep answers clean, concise and factual`;

/**
 * Call Groq with automatic retry on transient failures.
 * @param {object[]} messages  - Full message history array
 * @param {number}   retries   - Max retry attempts
 */
export async function callGroq(messages, retries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await groq.chat.completions.create({
        model: config.groq.model,
        max_tokens: config.groq.maxTokens,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      });

      return response.choices[0].message.content;
    } catch (err) {
      lastError = err;
      const isRetryable =
        err.status === 429 || err.status === 503 || err.status >= 500;

      if (!isRetryable || attempt === retries) break;

      const delay = attempt * 1000; // 1s, 2s, 3s
      logger.warn(`Groq attempt ${attempt} failed, retrying in ${delay}ms`, {
        status: err.status,
        message: err.message,
      });
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}