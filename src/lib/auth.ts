import { SignJWT, jwtVerify } from "jose";

// Lightweight session tokens (signed JWT in an httpOnly cookie). This is
// intentionally simple for v1; swap for Auth.js/OAuth when adding real
// bank connectivity. No `next` imports here so it stays edge/runtime-agnostic.

export const SESSION_COOKIE = "finbud_session";
const ALG = "HS256";

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short (set it in .env).");
  }
  return new TextEncoder().encode(s);
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
