// Sprint 0+1 · Schritt 4 — Mews-API Error-Klassen

export class MewsApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'MewsApiError';
  }
}

export class MewsRateLimitError extends MewsApiError {
  constructor(message = 'Mews rate-limit hit (429)') {
    super(message, 429);
    this.name = 'MewsRateLimitError';
  }
}
