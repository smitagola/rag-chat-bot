import { Router } from "express";
import { history } from "../services/history.js";
import { clearIndex, listSources } from "../services/vectorStore.js";
import { cache } from "../services/cache.js";

const router = Router();

// GET /api/v1/history/:sessionId
router.get("/history/:sessionId", (req, res) => {
  const messages = history.getMessages(req.params.sessionId);
  res.json({ sessionId: req.params.sessionId, messages });
});

// DELETE /api/v1/history/:sessionId
router.delete("/history/:sessionId", (req, res) => {
  history.clear(req.params.sessionId);
  res.json({ message: `Session "${req.params.sessionId}" cleared` });
});

// GET /api/v1/history  — list all active sessions
router.get("/history", (_req, res) => {
  res.json({ sessions: history.list() });
});

// GET /api/v1/sources  — list all ingested sources
router.get("/sources", async (_req, res, next) => {
  try {
    const sources = await listSources();
    res.json({ sources, count: sources.length });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/clear  — wipe vector store + cache + all history
router.delete("/clear", async (_req, res, next) => {
  try {
    await clearIndex();
    cache.invalidate();
    history.clearAll();
    res.json({ message: "Vector store, cache and all sessions cleared" });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/health
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    cache: cache.stats(),
    sessions: history.list().length,
    timestamp: new Date().toISOString(),
  });
});

export default router;