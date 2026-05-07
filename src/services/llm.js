import Groq from "groq-sdk";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const groq = new Groq({ apiKey: config.groqApiKey });

const SYSTEM_PROMPT = `You are the FoodDesk Support Guru, a dedicated assistant for restaurant owners and administrators using the FoodDesk platform.

YOUR MISSION:
Help users solve operational problems directly and simply. Focus ONLY on the steps they need to take in the Admin Dashboard UI.

STRICT RULES:
- NEVER mention APIs, routes, databases, code, or technical architecture.
- NEVER mention file names or backend logic.
- Speak in plain, friendly language that a restaurant owner understands.
- Provide step-by-step instructions on how to solve issues using the buttons and menus they see on their screen.
- If a problem cannot be solved via the dashboard, guide them to use the "Human Support" option.
- Never use meta-phrases like "According to the context".
- Keep answers professional, concise, and solution-oriented.`;

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