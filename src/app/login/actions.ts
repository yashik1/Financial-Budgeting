"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { setSession, clearSession } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/password";
import { provisionUserDefaults } from "@/lib/provision";
import { cloneDemoUser, reapExpiredDemoUsers } from "@/lib/demo";
import { signInSchema, signUpSchema, firstError, field } from "@/lib/validation";
import { check, reset, clientIp, retryMessage, AUTH_LIMIT, DEMO_LIMIT } from "@/lib/rateLimit";

export async function loginDemo() {
  const ip = await clientIp();
  const gate = check(`demo:${ip}`, DEMO_LIMIT);
  if (!gate.ok) redirect("/login?error=rate");

  // Opportunistic cleanup — no cron needed for a single-instance deploy.
  await reapExpiredDemoUsers();

  // Each visitor gets a private, expiring copy of the seeded dataset so demo
  // sessions can't see or overwrite one another.
  const userId = await cloneDemoUser();
  if (!userId) redirect("/login?error=demo"); // template missing: run `npm run seed`
  await setSession(userId);
  redirect("/dashboard");
}

export async function signIn(_prev: { error?: string } | undefined, formData: FormData) {
  const parsed = signInSchema.safeParse({
    email: field(formData, "email"),
    password: field(formData, "password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { email, password } = parsed.data;

  // Limit per IP and per account: one stops a broad sweep, the other stops a
  // distributed attack from converging on a single inbox.
  const ip = await clientIp();
  for (const key of [`signin:ip:${ip}`, `signin:email:${email}`]) {
    const gate = check(key, AUTH_LIMIT);
    if (!gate.ok) return { error: retryMessage(gate.retryAfterSeconds) };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Demo clones are session-only; they have no password and must not be
  // reachable by guessing their generated address.
  if (!user || user.isDemo || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return { error: "Invalid email or password." };
  }

  reset(`signin:ip:${ip}`);
  reset(`signin:email:${email}`);
  await setSession(user.id);
  redirect("/dashboard");
}

export async function signUp(_prev: { error?: string } | undefined, formData: FormData) {
  const parsed = signUpSchema.safeParse({
    name: field(formData, "name"),
    email: field(formData, "email"),
    password: field(formData, "password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { name, email, password } = parsed.data;

  const ip = await clientIp();
  const gate = check(`signup:ip:${ip}`, AUTH_LIMIT);
  if (!gate.ok) return { error: retryMessage(gate.retryAfterSeconds) };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };

  const user = await prisma.user.create({
    data: { name, email, passwordHash: hashPassword(password) },
  });
  await provisionUserDefaults(user.id);
  await setSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}
