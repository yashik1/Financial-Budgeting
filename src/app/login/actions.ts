"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { setSession, clearSession } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/password";
import { provisionUserDefaults } from "@/lib/provision";

export async function loginDemo() {
  const user = await prisma.user.findUnique({ where: { email: "demo@finbud.app" } });
  // The demo user is created by `npm run seed`; if it's missing, bounce back.
  if (!user) redirect("/login?error=demo");
  await setSession(user.id);
  redirect("/dashboard");
}

export async function signIn(_prev: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Email and password are required." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return { error: "Invalid email or password." };
  }
  await setSession(user.id);
  redirect("/dashboard");
}

export async function signUp(_prev: { error?: string } | undefined, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!name || !email || password.length < 6) {
    return { error: "Enter a name, email, and a password of at least 6 characters." };
  }
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
