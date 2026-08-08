import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// `server-only` throws outside a server component; stub it for the test run.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { check, reset, retryMessage } = await import("@/lib/rateLimit");

const WINDOW = { limit: 3, windowMs: 1000 };

describe("rate limiter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("allows attempts up to the limit", () => {
    const key = `allow-${Math.random()}`;
    expect(check(key, WINDOW).ok).toBe(true);
    expect(check(key, WINDOW).ok).toBe(true);
    expect(check(key, WINDOW).ok).toBe(true);
  });

  it("blocks once the limit is exceeded", () => {
    const key = `block-${Math.random()}`;
    for (let i = 0; i < WINDOW.limit; i++) check(key, WINDOW);
    const blocked = check(key, WINDOW);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keys are independent, so one actor can't lock out another", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    for (let i = 0; i < WINDOW.limit; i++) check(a, WINDOW);
    expect(check(a, WINDOW).ok).toBe(false);
    expect(check(b, WINDOW).ok).toBe(true);
  });

  it("lets attempts through again once the window slides past", () => {
    const key = `slide-${Math.random()}`;
    for (let i = 0; i < WINDOW.limit; i++) check(key, WINDOW);
    expect(check(key, WINDOW).ok).toBe(false);
    vi.advanceTimersByTime(WINDOW.windowMs + 1);
    expect(check(key, WINDOW).ok).toBe(true);
  });

  it("reset clears an actor's history", () => {
    const key = `reset-${Math.random()}`;
    for (let i = 0; i < WINDOW.limit; i++) check(key, WINDOW);
    expect(check(key, WINDOW).ok).toBe(false);
    reset(key);
    expect(check(key, WINDOW).ok).toBe(true);
  });

  it("phrases the retry delay in seconds or minutes", () => {
    expect(retryMessage(30)).toContain("30 seconds");
    expect(retryMessage(120)).toContain("2 minutes");
    expect(retryMessage(60)).toContain("1 minute");
  });
});
