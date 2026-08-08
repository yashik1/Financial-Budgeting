import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken, verifySessionToken } from "./auth";

export async function setSession(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } });
  const token = await createSessionToken(userId, user?.tokenVersion ?? 0);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** The signed claims, if the cookie is present and the signature checks out.
 *  Does not yet prove the session wasn't revoked — see `getCurrentUser`. */
async function claims() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getUserId(): Promise<string | null> {
  return (await claims())?.userId ?? null;
}

export async function getCurrentUser() {
  const c = await claims();
  if (!c) return null;
  const user = await prisma.user.findUnique({ where: { id: c.userId } });
  if (!user) return null;
  // A stale token version means the session was revoked (signed out everywhere,
  // password changed) after this cookie was minted.
  if (user.tokenVersion !== c.tokenVersion) return null;
  // An expired demo clone is gone as far as the app is concerned; the reaper
  // deletes the rows separately.
  if (user.demoExpiresAt && user.demoExpiresAt.getTime() < Date.now()) return null;
  return user;
}

/** Redirects to /login if there's no valid session. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Invalidate every outstanding token for this user. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}
