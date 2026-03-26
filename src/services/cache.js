import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

class CacheService {
  constructor() {
    this.store = new Map();
    this.ttl = config.cache.ttlMs;

    // Auto-cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60_000);
  }

  _key(query, topK) {
    return `${query.toLowerCase().trim()}::${topK}`;
  }

  get(query, topK) {
    const key = this._key(query, topK);
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    logger.info("Cache hit", { query: query.slice(0, 60) });
    return entry.value;
  }

  set(query, topK, value) {
    const key = this._key(query, topK);
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttl,
    });
  }

  invalidate() {
    this.store.clear();
    logger.info("Cache cleared");
  }

  cleanup() {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        removed++;
      }
    }
    if (removed > 0) logger.info(`Cache cleanup: removed ${removed} expired entries`);
  }

  stats() {
    return {
      size: this.store.size,
      ttlMs: this.ttl,
    };
  }
}

export const cache = new CacheService();