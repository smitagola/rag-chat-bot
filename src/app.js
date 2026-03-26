import "dotenv/config";
import express from "express";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { initVectorStore } from "./services/vectorStore.js";
import { globalLimiter } from "./middleware/rateLimiter.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import ingestRouter from "./routes/ingest.js";
import chatRouter from "./routes/chat.js";
import systemRouter from "./routes/system.js";

// ---- Validate required env vars ----
if (!config.groqApiKey) {
  logger.error("GROQ_API_KEY is missing from .env");
  process.exit(1);
}

const app = express();

// ---- Core middleware ----
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);
app.use(globalLimiter);

// ---- API v1 routes ----
app.use("/api/v1/ingest", ingestRouter);
app.use("/api/v1/chat", chatRouter);
app.use("/api/v1", systemRouter);

// ---- 404 + error handlers (must be last) ----
app.use(notFound);
app.use(errorHandler);

// ---- Boot sequence ----
async function start() {
  try {
    await initVectorStore();

    app.listen(config.port, () => {
      logger.info(`RAG server running`, {
        port: config.port,
        env: config.nodeEnv,
        docs: `http://localhost:${config.port}/api/v1/health`,
      });
    });
  } catch (err) {
    logger.error("Failed to start server", { error: err.message });
    process.exit(1);
  }
}

// ---- Graceful shutdown ----
process.on("SIGTERM", () => {
  logger.info("SIGTERM received — shutting down gracefully");
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason });
});

start();