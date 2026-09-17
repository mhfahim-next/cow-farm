import type { RequestHandler } from './router';
import { ApiError } from './http';
// Development/single-process limiter. Use a shared rate limiter when scaling.
const buckets = new Map<string, { count: number; endsAt: number }>();
let globalBucket = { count: 0, endsAt: 0 };
export function rateLimit(options: {
  windowMs: number;
  limit: number;
  standardHeaders?: string;
  legacyHeaders?: boolean;
}): RequestHandler {
  return (req, _res, next) => {
    const now = Date.now();
    if (now >= globalBucket.endsAt) globalBucket = { count: 0, endsAt: now + options.windowMs };
    if (++globalBucket.count > 500)
      throw new ApiError(429, 'Too many login attempts. Try again later.');
    const body = req.body as { email?: unknown } | null;
    const key =
      typeof body?.email === 'string'
        ? body.email.trim().toLowerCase().slice(0, 254)
        : 'invalid-input';
    for (const [id, b] of buckets) if (b.endsAt <= now) buckets.delete(id);
    const bucket = buckets.get(key) ?? { count: 0, endsAt: now + options.windowMs };
    bucket.count++;
    buckets.set(key, bucket);
    if (bucket.count > options.limit)
      throw new ApiError(429, 'Too many login attempts for this account. Try again later.');
    next();
  };
}
