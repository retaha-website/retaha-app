/**
 * Einfaches In-Memory-Rate-Limit für Magic-Link-Send.
 *
 * Pro Email: max N Requests pro Window. Bei Limit-Überschreitung → block.
 *
 * Limitation: Vercel-Serverless-Instanzen sind isoliert → Limit gilt nur
 * pro Instanz. Für striktes globales Limit wäre Supabase-Tabelle nötig.
 * Für MVP-Anti-Spam reicht das hier.
 *
 * Sprint G/H Backlog: Migration auf Supabase-Table `rate_limits`
 * mit (key, window_start) UNIQUE, count integer.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Max Requests pro Window. Default: 5 */
  max?: number;
  /** Window in ms. Default: 60 * 60 * 1000 (1h) */
  windowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, options: RateLimitOptions = {}): RateLimitResult {
  const max = options.max ?? 5;
  const windowMs = options.windowMs ?? 60 * 60 * 1000;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count++;

  return {
    allowed: bucket.count <= max,
    remaining: Math.max(0, max - bucket.count),
    resetAt: bucket.resetAt,
  };
}
