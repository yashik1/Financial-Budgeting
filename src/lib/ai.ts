import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAccountsOverview, getMonthOverview, getGamification, getGoals } from "./queries";
import { formatCents } from "./money";
import { monthLabel } from "./dates";

// AI Coach — powered by the Claude API (model claude-opus-4-8). Disabled unless
// ANTHROPIC_API_KEY is set, so the app runs fine without it.

export function isAiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const SYSTEM = `You are Fitch, FinBud's friendly money coach (a cheerful fox mascot).
Speak warmly, plainly, and briefly. Be specific to the user's actual numbers from the
CONTEXT. Prefer short paragraphs and at most a few bullet points. Never invent figures
that aren't in the context — if something isn't there, say you don't have it. Offer
encouragement plus one or two concrete, doable next steps. This is general budgeting
guidance, not regulated financial, tax, or investment advice.`;

/** Compact, model-friendly snapshot of the user's current finances. */
export async function buildFinancialContext(userId: string): Promise<string> {
  const [accounts, ov, game, goals] = await Promise.all([
    getAccountsOverview(userId),
    getMonthOverview(userId),
    getGamification(userId),
    getGoals(userId),
  ]);

  const currency = accounts.accounts[0]?.currency ?? "USD";

  const topCats = ov.categorySpend
    .slice(0, 6)
    .map((c) => `  - ${c.name}: ${formatCents(c.cents, { currency })}`)
    .join("\n");

  const overBudget = ov.progress
    .filter((p) => p.over)
    .map((p) => `  - ${ov.catMap.get(p.categoryId)?.name ?? "?"}: ${formatCents(p.spentCents, { currency })} spent of ${formatCents(p.limitCents, { currency })}`)
    .join("\n") || "  (none over budget)";

  const goalLines = goals
    .map((g) => `  - ${g.name}: ${formatCents(g.fundedCents, { currency })} of ${formatCents(g.targetCents, { currency })} (${Math.round((g.fundedCents / g.targetCents) * 100)}%)`)
    .join("\n");

  return `CONTEXT — the user's money for ${monthLabel(ov.month)}:
Net worth: ${formatCents(accounts.netWorthCents, { currency })} (assets ${formatCents(accounts.assetsCents, { currency })}, liabilities ${formatCents(accounts.liabilitiesCents, { currency })})
This month — income: ${formatCents(ov.incomeCents, { currency })}, spending: ${formatCents(ov.spendingCents, { currency })}, net saved: ${formatCents(ov.netCents, { currency })}
Financial-health score: ${ov.health}/100. On-budget streak: ${game.stats.savingsStreak} months.
Budgeted ${formatCents(ov.summary.budgetedCents, { currency })}, spent ${formatCents(ov.summary.spentCents, { currency })} (${Math.round(ov.summary.pctUsed)}% used).
Top spending categories:
${topCats}
Over budget:
${overBudget}
Goals:
${goalLines || "  (no goals yet)"}`;
}

function client(): Anthropic {
  return new Anthropic(); // reads ANTHROPIC_API_KEY from env
}

function textOf(msg: Anthropic.Message): string {
  return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

/** Answer a free-form question about the user's money. */
export async function askCoach(userId: string, question: string): Promise<string> {
  const context = await buildFinancialContext(userId);
  const msg = await client().messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1200,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system: SYSTEM,
    messages: [{ role: "user", content: `${context}\n\nQuestion: ${question}` }],
  });
  return textOf(msg) || "I couldn't come up with an answer just now — try rephrasing?";
}

/** Generate a few proactive insights about this month. */
export async function generateInsights(userId: string): Promise<string> {
  const context = await buildFinancialContext(userId);
  const msg = await client().messages.create({
    model: "claude-opus-4-8",
    max_tokens: 900,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `${context}\n\nGive me 3 short, punchy insights about my month — each a single sentence starting with a relevant emoji. Focus on what's going well, what to watch, and one concrete suggestion. No preamble.`,
      },
    ],
  });
  return textOf(msg) || "No insights right now — check back after a bit more activity.";
}
