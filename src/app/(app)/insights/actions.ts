"use server";

import { requireUser } from "@/lib/session";
import { isAiEnabled, askCoach, generateInsights } from "@/lib/ai";

export async function askCoachAction(question: string): Promise<{ answer?: string; error?: string }> {
  const user = await requireUser();
  if (!isAiEnabled()) return { error: "The AI Coach isn't configured yet." };
  const q = question.trim();
  if (!q) return { error: "Ask me something about your money!" };
  try {
    return { answer: await askCoach(user.id, q) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The coach is unavailable right now." };
  }
}

export async function generateInsightsAction(): Promise<{ text?: string; error?: string }> {
  const user = await requireUser();
  if (!isAiEnabled()) return { error: "The AI Coach isn't configured yet." };
  try {
    return { text: await generateInsights(user.id) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't generate insights right now." };
  }
}
