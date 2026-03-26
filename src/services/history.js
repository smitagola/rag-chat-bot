class HistoryService {
  constructor() {
    // sessions: Map<sessionId, { messages: [], createdAt, updatedAt }>
    this.sessions = new Map();
    this.maxMessagesPerSession = 20;
    this.maxSessions = 500;

    // Prune old sessions every 10 minutes
    setInterval(() => this.prune(), 600_000);
  }

  getOrCreate(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    return this.sessions.get(sessionId);
  }

  append(sessionId, role, content) {
    const session = this.getOrCreate(sessionId);
    session.messages.push({ role, content });
    session.updatedAt = Date.now();

    // Keep last N messages to avoid token overflow
    if (session.messages.length > this.maxMessagesPerSession) {
      session.messages = session.messages.slice(-this.maxMessagesPerSession);
    }
  }

  getMessages(sessionId) {
    return this.sessions.get(sessionId)?.messages ?? [];
  }

  clear(sessionId) {
    this.sessions.delete(sessionId);
  }

  clearAll() {
    this.sessions.clear();
  }

  list() {
    return [...this.sessions.entries()].map(([id, s]) => ({
      sessionId: id,
      messageCount: s.messages.length,
      createdAt: new Date(s.createdAt).toISOString(),
      updatedAt: new Date(s.updatedAt).toISOString(),
    }));
  }

  prune() {
    // Remove sessions older than 2 hours with no activity
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const [id, session] of this.sessions.entries()) {
      if (session.updatedAt < cutoff) this.sessions.delete(id);
    }

    // If still too many, remove oldest
    if (this.sessions.size > this.maxSessions) {
      const sorted = [...this.sessions.entries()].sort(
        (a, b) => a[1].updatedAt - b[1].updatedAt
      );
      sorted.slice(0, this.sessions.size - this.maxSessions).forEach(([id]) =>
        this.sessions.delete(id)
      );
    }
  }
}

export const history = new HistoryService();