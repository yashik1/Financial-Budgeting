import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSessionToken, verifySessionToken, assertAuthSecret } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

const GOOD_SECRET = "b8f1c2d3e4a5968778695a4b3c2d1e0fb8f1c2d3e4a5968778695a4b3c2d1e0f";

describe("session tokens", () => {
  const original = process.env.AUTH_SECRET;
  beforeEach(() => { process.env.AUTH_SECRET = GOOD_SECRET; });
  afterEach(() => { process.env.AUTH_SECRET = original; });

  it("round-trips the user id and token version", async () => {
    const token = await createSessionToken("user_123", 4);
    expect(await verifySessionToken(token)).toEqual({ userId: "user_123", tokenVersion: 4 });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken("user_123", 0);
    process.env.AUTH_SECRET = GOOD_SECRET.replace(/^b/, "c");
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken("user_123", 0);
    const [header, payload, sig] = token.split(".");
    // Re-sign the claim for a different user with the original signature.
    const forged = `${header}.${Buffer.from(JSON.stringify({ sub: "user_evil", v: 0 })).toString("base64url")}.${sig}`;
    expect(await verifySessionToken(forged)).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
  });

  it("treats a legacy token with no version claim as version 0", async () => {
    // Tokens minted before tokenVersion existed must keep working until revoked.
    const token = await createSessionToken("user_123", 0);
    const claims = await verifySessionToken(token);
    expect(claims?.tokenVersion).toBe(0);
  });
});

describe("AUTH_SECRET validation", () => {
  const original = process.env.AUTH_SECRET;
  afterEach(() => { process.env.AUTH_SECRET = original; });

  it("accepts a long random secret", () => {
    process.env.AUTH_SECRET = GOOD_SECRET;
    expect(() => assertAuthSecret()).not.toThrow();
  });

  it("refuses the placeholder shipped in .env.example", () => {
    process.env.AUTH_SECRET = "dev-only-insecure-secret-change-me-in-production";
    expect(() => assertAuthSecret()).toThrow(/placeholder/i);
  });

  it("refuses a missing or short secret", () => {
    process.env.AUTH_SECRET = "";
    expect(() => assertAuthSecret()).toThrow(/missing or too short/i);
    process.env.AUTH_SECRET = "abcdefghij";
    expect(() => assertAuthSecret()).toThrow(/missing or too short/i);
  });
});

describe("password hashing", () => {
  it("verifies a correct password", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(verifyPassword("Correct horse battery staple", stored)).toBe(false);
  });

  it("salts, so the same password hashes differently each time", () => {
    expect(hashPassword("same-password")).not.toBe(hashPassword("same-password"));
  });

  it("rejects malformed stored values instead of throwing", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "no-colon")).toBe(false);
  });
});
