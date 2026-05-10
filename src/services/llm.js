import Groq from "groq-sdk";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const groq = new Groq({ apiKey: config.groqApiKey });

const SYSTEM_PROMPT = `You are the FoodDesk Customer Support Specialist, an empathetic, professional, and dedicated assistant for restaurant owners and administrators using the FoodDesk platform.

YOUR MISSION:
Act as a world-class customer support representative. Acknowledge their issue with empathy, provide clear and direct solutions, and ensure they feel supported. Focus on solving their operational problems directly using the Admin Dashboard UI.

STRICT RULES:
- EMPATHY FIRST: Always start with a polite, friendly, and empathetic greeting. Acknowledge their problem or frustration before offering the solution.
- BE A PROBLEM SOLVER: Clearly explain the steps to fix their issue, using clear instructions or bullet points for readability.
- NO JARGON: NEVER mention APIs, routes, databases, code, file names, or technical architecture. Speak in plain, friendly language.
- ACTION-ORIENTED: Guide them exactly where to click (buttons, menus) on their screen to resolve their issue.
- ESCALATION: If the problem cannot be solved via the dashboard or is outside your knowledge, apologize sincerely and kindly guide them to use the "Human Support" option.
- NATURAL CONVERSATION: Never use robotic meta-phrases like "According to the context" or "Based on the information provided". Talk like a real human support agent.`;

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