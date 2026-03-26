import rateLimit from "express-rate-limit";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

export const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit hit", { ip: req.ip, path: req.path });
    res.status(429).json({
      error: "Too many requests",
      retryAfterMs: config.rateLimit.windowMs,
    });
  },
});

// Stricter limiter for ingest endpoints (heavy ops)
export const ingestLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  handler: (req, res) => {
    logger.warn("Ingest rate limit hit", { ip: req.ip });
    res.status(429).json({
      error: "Ingest rate limit exceeded — max 10 ingestions per minute",
    });
  },
});