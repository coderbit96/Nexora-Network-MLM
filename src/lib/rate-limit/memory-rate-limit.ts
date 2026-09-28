import { errors } from "@/lib/errors/app-error";

type Entry = { count: number; resetAt: number };
const buckets = new Map<string, Entry>();

/** Process-local protection for development and single-instance deployments. Replace with Redis before horizontal scaling. */
export function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const existing = buckets.get(key);
  const entry = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + windowMs } : existing;
  entry.count += 1;
  buckets.set(key, entry);

  if (entry.count > limit) {
    throw errors.tooManyRequests();
  }
}
