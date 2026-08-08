"use server";

import { requireUser } from "@/lib/session";
import { isAiEnabled, askCoach, generateInsights } from "@/lib/ai";
import { check, AI_LIMIT, retryMessage } from "@/lib/rateLimit";

/** Coach calls bill against our Anthropic key, so cap them per account. */
function gate(userId: string): string | null {
  const r = check(`ai:${userId}`, AI_LIMIT);
  return r.ok ? null : retryMessage(r.retryAfterSeconds);
}

export async function askCoachAction(question: string): Promise<{ answer?: string; error?: string }> {
  const user = await requireUser();
  if (!isAiEnabled()) return { error: "The AI Coach isn't configured yet." };
  const q = question.trim();
  if (!q) return { error: "Ask me something about your money!" };
  if (q.length > 2000) return { error: "That question is a bit long — try trimming it down." };
  const limited = gate(user.id);
  if (limited) return { error: limited };
  try {
    return { answer: await askCoach(user.id, q) };
  } catch (e) {
    // Upstream errors can carry request details; log them but don't echo back.
    console.error("askCoach failed", e);
    return { error: "The coach is unavailable right now." };
  }
}

export async function generateInsightsAction(): Promise<{ text?: string; error?: string }> {
  const user = await requireUser();
  if (!isAiEnabled()) return { error: "The AI Coach isn't configured yet." };
  const limited = gate(user.id);
  if (limited) return { error: limited };
  try {
    return { text: await generateInsights(user.id) };
  } catch (e) {
    console.error("generateInsights failed", e);
    return { error: "Couldn't generate insights right now." };
  }
}
