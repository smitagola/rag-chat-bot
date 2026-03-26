import { logger } from "../utils/logger.js";

export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const isOperational = status < 500;

  logger.error(err.message, {
    status,
    path: req.path,
    method: req.method,
    stack: isOperational ? undefined : err.stack,
  });

  res.status(status).json({
    error: isOperational ? err.message : "Internal server error",
    ...(process.env.NODE_ENV === "development" && !isOperational
      ? { stack: err.stack }
      : {}),
  });
}

export function notFound(req, res) {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      "POST /api/v1/ingest/file",
      "POST /api/v1/ingest/url",
      "POST /api/v1/chat",
      "GET  /api/v1/history/:sessionId",
      "DELETE /api/v1/history/:sessionId",
      "GET  /api/v1/sources",
      "DELETE /api/v1/clear",
      "GET  /api/v1/health",
    ],
  });
}