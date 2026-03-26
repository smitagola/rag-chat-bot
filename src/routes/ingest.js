import { Router } from "express";
import multer from "multer";
import { mkdirSync, renameSync, unlinkSync } from "fs";
import { config } from "../config/index.js";
import { loadFile, loadUrl } from "../services/loader.js";
import { ingestText } from "../services/vectorStore.js";
import { cache } from "../services/cache.js";
import { ingestLimiter } from "../middleware/rateLimiter.js";
import { validate, ingestUrlSchema } from "../middleware/validate.js";
import { logger } from "../utils/logger.js";

mkdirSync(config.upload.dest, { recursive: true });
mkdirSync("logs", { recursive: true });

const upload = multer({
  dest: config.upload.dest,
  limits: { fileSize: config.upload.maxFileSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".txt", ".pdf", ".docx"];
    const ext = "." + file.originalname.split(".").pop().toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error(`File type "${ext}" not allowed. Use: ${allowed.join(", ")}`));
  },
});

const router = Router();

// POST /api/v1/ingest/file
router.post(
  "/file",
  ingestLimiter,
  upload.any(),
  async (req, res, next) => {
    const file = req.files?.[0];
    try {
      if (!file) return res.status(400).json({ error: "No file uploaded" });

      const originalName = file.originalname;
      const ext = originalName.split(".").pop().toLowerCase();
      const tmpPath = file.path + "." + ext;

      renameSync(file.path, tmpPath);
      const text = await loadFile(tmpPath);
      unlinkSync(tmpPath);

      const result = await ingestText(text, { source: originalName });

      // Invalidate cache since new data was added
      cache.invalidate();

      res.status(201).json({
        message: `Ingested "${originalName}" successfully`,
        chunks: result.chunks,
        source: result.source,
      });
    } catch (err) {
      // Clean up temp file on error
      if (file?.path) {
        try { unlinkSync(file.path); } catch {}
      }
      next(err);
    }
  }
);

// POST /api/v1/ingest/url
router.post(
  "/url",
  ingestLimiter,
  validate(ingestUrlSchema),
  async (req, res, next) => {
    try {
      const { url } = req.body;
      const text = await loadUrl(url);
      const result = await ingestText(text, { source: url });

      cache.invalidate();

      res.status(201).json({
        message: `Ingested URL successfully`,
        url,
        chunks: result.chunks,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;