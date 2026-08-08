import "server-only";
import { headers } from "next/headers";

// Sliding-window rate limiting, kept in process memory.
//
// SCALING NOTE: this counts per app instance, so N instances behind a load
// balancer allow up to N x the limit. That's still a ~1000x improvement over no
// limit at all, and it needs no extra infrastructure. To make it global, swap
// the `hits` Map for Redis (e.g. Upstash `@upstash/ratelimit`) — `check()` is
// the only call site and its signature doesn't change.

type Window = { limit: number; windowMs: number };

/** Login/signup: strict, because these gate account access. */
export const AUTH_LIMIT: Window = { limit: 8, windowMs: 15 * 60_000 };
/** The demo clones a dataset per visitor, so it's expensive to spam. */
export const DEMO_LIMIT: Window = { limit: 5, windowMs: 60 * 60_000 };
/** AI coach: each call costs real money against our Anthropic key. */
export const AI_LIMIT: Window = { limit: 20, windowMs: 60 * 60_000 };

const hits = new Map<string, number[]>();
let lastSweep = Date.now();

/** Drop keys whose newest hit is older than any window we use, so the map
 *  doesn't grow without bound on a long-running instance. */
function sweep(now: number) {
  if (now - lastSweep < 10 * 60_000) return;
  lastSweep = now;
  const cutoff = now - 60 * 60_000;
  for (const [key, times] of hits) {
    if (!times.length || times[times.length - 1] < cutoff) hits.delete(key);
  }
}

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

/**
 * Record an attempt and report whether it's allowed.
 * `key` should scope the actor and the action, e.g. `signin:1.2.3.4`.
 */
export function check(key: string, { limit, windowMs }: Window): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const cutoff = now - windowMs;
  const times = (hits.get(key) ?? []).filter((t) => t > cutoff);

  if (times.length >= limit) {
    hits.set(key, times);
    const retryAfterSeconds = Math.max(1, Math.ceil((times[0] + windowMs - now) / 1000));
    return { ok: false, retryAfterSeconds };
  }
  times.push(now);
  hits.set(key, times);
  return { ok: true, retryAfterSeconds: 0 };
}

/** Forget an actor's attempts — call after a success so a legitimate user
 *  isn't punished for typos earlier in the window. */
export function reset(key: string): void {
  hits.delete(key);
}

/**
 * Best-effort client IP. Behind a proxy this trusts `x-forwarded-for`, which a
 * client can spoof when the app is exposed directly — so deploy behind a proxy
 * that overwrites the header (Railway, Vercel, and nginx with `proxy_set_header`
 * all do).
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

/** Human-readable "try again in ..." for a blocked attempt. */
export function retryMessage(seconds: number): string {
  if (seconds < 60) return `Too many attempts. Try again in ${seconds} seconds.`;
  const mins = Math.ceil(seconds / 60);
  return `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
}
