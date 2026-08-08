import { SignJWT, jwtVerify } from "jose";

// Lightweight session tokens (signed JWT in an httpOnly cookie). This is
// intentionally simple for v1; swap for Auth.js/OAuth when adding real
// bank connectivity. No `next` imports here so it stays edge/runtime-agnostic.

export const SESSION_COOKIE = "finbud_session";
const ALG = "HS256";

/** Sessions last a week; `tokenVersion` lets us revoke them early. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

// Placeholders that have shipped in .env.example. They're public knowledge, so
// anyone could forge a session cookie if a deployment kept one — refuse them.
const KNOWN_PLACEHOLDERS = new Set([
  "dev-only-insecure-secret-change-me-in-production",
  "change-me",
  "secret",
]);

export type SessionClaims = { userId: string; tokenVersion: number };

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short (need at least 32 chars). Generate one with:\n" +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  if (KNOWN_PLACEHOLDERS.has(s.trim().toLowerCase())) {
    throw new Error(
      "AUTH_SECRET is still the example placeholder. That value is public in the repo, " +
        "so anyone could forge a session — set a real random secret.",
    );
  }
  return new TextEncoder().encode(s);
}

/** Throws if the signing secret is unusable. Called at boot so misconfiguration
 *  fails loudly on deploy instead of on a user's first login. */
export function assertAuthSecret(): void {
  secret();
}

export async function createSessionToken(userId: string, tokenVersion: number): Promise<string> {
  return new SignJWT({ v: tokenVersion })
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.sub !== "string") return null;
    // Tokens minted before tokenVersion existed have no `v`; treat them as 0 so
    // they stay valid until the user's version is bumped.
    const v = typeof payload.v === "number" ? payload.v : 0;
    return { userId: payload.sub, tokenVersion: v };
  } catch {
    return null;
  }
}
