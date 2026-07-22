import "server-only";
import { prisma } from "./db";
import { currentMonthKey, lastMonths, monthKey, monthRange } from "./dates";
import {
  budgetProgress,
  budgetSummary,
  healthScore,
  netCashFlow,
  spendingByCategory,
  totalIncome,
  totalSpending,
  type Txn,
} from "./budget";
import { netWorthSeries } from "./networth";
import {
  ACHIEVEMENTS,
  levelForPoints,
  makeChallenge,
  mascot,
} from "./gamification";

export type CategoryMeta = { id: string; name: string; icon: string; color: string; group: string };

export async function getCategoryMap(userId: string): Promise<Map<string, CategoryMeta>> {
  const cats = await prisma.category.findMany({ where: { userId } });
  const map = new Map<string, CategoryMeta>();
  for (const c of cats) map.set(c.id, { id: c.id, name: c.name, icon: c.icon, color: c.color, group: c.group });
  return map;
}

export async function getAccountsOverview(userId: string) {
  const accounts = await prisma.account.findMany({
    where: { userId },
    orderBy: [{ isAsset: "desc" }, { createdAt: "asc" }],
  });
  const assetsCents = accounts.filter((a) => a.isAsset).reduce((s, a) => s + a.balanceCents, 0);
  const liabilitiesCents = accounts
    .filter((a) => !a.isAsset)
    .reduce((s, a) => s + Math.abs(a.balanceCents), 0);
  const netWorthCents = accounts.reduce((s, a) => s + a.balanceCents, 0);
  return { accounts, assetsCents, liabilitiesCents, netWorthCents };
}

export async function getMonthOverview(userId: string, month: string = currentMonthKey()) {
  const { start, end } = monthRange(month);
  const [txns, budgetLines, catMap] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: start, lte: end } },
      orderBy: { date: "desc" },
    }),
    prisma.budgetLine.findMany({ where: { userId, month } }),
    getCategoryMap(userId),
  ]);

  const asTxn: Txn[] = txns.map((t) => ({
    amountCents: t.amountCents,
    categoryId: t.categoryId,
    isTransfer: t.isTransfer,
  }));

  const incomeCents = totalIncome(asTxn);
  const spendingCents = totalSpending(asTxn);
  const netCents = netCashFlow(asTxn);
  const spendByCat = spendingByCategory(asTxn);

  const progress = budgetProgress(
    budgetLines.map((l) => ({ categoryId: l.categoryId, limitCents: l.limitCents })),
    spendByCat,
  );
  const summary = budgetSummary(progress);
  const health = healthScore({ incomeCents, spendingCents, budget: summary });

  // Spending broken down by category, with display metadata, largest first.
  const categorySpend = [...spendByCat.entries()]
    .map(([id, cents]) => {
      const meta = catMap.get(id);
      return {
        id,
        cents,
        name: meta?.name ?? "Uncategorized",
        icon: meta?.icon ?? "❓",
        color: meta?.color ?? "#7A879C",
      };
    })
    .sort((a, b) => b.cents - a.cents);

  return { month, txns, budgetLines, catMap, incomeCents, spendingCents, netCents, spendByCat, progress, summary, health, categorySpend };
}

export async function getNetWorthTrend(userId: string, months = 6) {
  const keys = lastMonths(months);
  const { start } = monthRange(keys[0]);
  const { end } = monthRange(keys[keys.length - 1]);
  const [txns, overview] = await Promise.all([
    prisma.transaction.findMany({ where: { userId, date: { gte: start, lte: end }, isTransfer: false } }),
    getAccountsOverview(userId),
  ]);

  const netByMonth = new Map<string, number>();
  for (const k of keys) netByMonth.set(k, 0);
  for (const t of txns) {
    const k = monthKey(t.date);
    if (netByMonth.has(k)) netByMonth.set(k, netByMonth.get(k)! + t.amountCents);
  }
  const monthly = keys.map((month) => ({ month, netCents: netByMonth.get(month) ?? 0 }));
  return netWorthSeries(overview.netWorthCents, monthly);
}

export async function getCashflowTrend(userId: string, months = 6) {
  const keys = lastMonths(months);
  const { start } = monthRange(keys[0]);
  const { end } = monthRange(keys[keys.length - 1]);
  const txns = await prisma.transaction.findMany({
    where: { userId, date: { gte: start, lte: end }, isTransfer: false },
  });
  const map = new Map<string, { incomeCents: number; spendingCents: number }>();
  for (const k of keys) map.set(k, { incomeCents: 0, spendingCents: 0 });
  for (const t of txns) {
    const k = monthKey(t.date);
    const row = map.get(k);
    if (!row) continue;
    if (t.amountCents > 0) row.incomeCents += t.amountCents;
    else row.spendingCents += -t.amountCents;
  }
  return keys.map((month) => ({ month, ...map.get(month)! }));
}

export async function getGamification(userId: string) {
  const [stats, unlocked] = await Promise.all([
    prisma.userStats.findUnique({ where: { userId } }),
    prisma.achievement.findMany({ where: { userId } }),
  ]);
  const points = stats?.points ?? 0;
  const unlockedKeys = new Set(unlocked.map((a) => a.key));
  const achievements = ACHIEVEMENTS.map((a) => ({ ...a, unlocked: unlockedKeys.has(a.key) }));
  return {
    stats: stats ?? { points: 0, level: 1, savingsStreak: 0, longestStreak: 0 },
    level: levelForPoints(points),
    achievements,
    unlockedCount: unlockedKeys.size,
    totalCount: ACHIEVEMENTS.length,
  };
}

/** Everything the dashboard needs, composed. */
export async function getDashboard(userId: string) {
  const [accounts, overview, trend, cashflow, game] = await Promise.all([
    getAccountsOverview(userId),
    getMonthOverview(userId),
    getNetWorthTrend(userId, 6),
    getCashflowTrend(userId, 6),
    getGamification(userId),
  ]);

  const mascotState = mascot({
    healthScore: overview.health,
    pctBudgetUsed: overview.summary.pctUsed,
    overCount: overview.summary.overCount,
  });

  // Pick the discretionary category with the tightest headroom for a challenge.
  const CHALLENGE_CATS = ["Dining & Takeout", "Coffee", "Shopping", "Entertainment"];
  let challenge = null as ReturnType<typeof makeChallenge> | null;
  const byName = new Map([...overview.catMap.values()].map((c) => [c.name, c.id]));
  let bestPct = -1;
  for (const name of CHALLENGE_CATS) {
    const id = byName.get(name);
    if (!id) continue;
    const line = overview.budgetLines.find((l) => l.categoryId === id);
    const target = line?.limitCents ?? 30_000;
    const spent = overview.spendByCat.get(id) ?? 0;
    const pct = target > 0 ? spent / target : 0;
    if (pct > bestPct) {
      bestPct = pct;
      const emoji = overview.catMap.get(id)?.icon ?? "🎯";
      challenge = makeChallenge({ key: name, title: `${name} under control`, emoji, spentCents: spent, targetCents: target });
    }
  }

  return { accounts, overview, trend, cashflow, game, mascot: mascotState, challenge };
}

export async function getTransactions(
  userId: string,
  opts: { categoryId?: string; accountId?: string; search?: string; limit?: number } = {},
) {
  const { categoryId, accountId, search, limit = 200 } = opts;
  const txns = await prisma.transaction.findMany({
    where: {
      userId,
      ...(categoryId ? { categoryId } : {}),
      ...(accountId ? { accountId } : {}),
      ...(search ? { OR: [{ merchant: { contains: search } }, { rawDescription: { contains: search } }] } : {}),
    },
    include: { account: true, category: true },
    orderBy: { date: "desc" },
    take: limit,
  });
  return txns;
}

export async function getBudgetView(userId: string, month: string = currentMonthKey()) {
  const overview = await getMonthOverview(userId, month);
  const rows = overview.budgetLines
    .map((line) => {
      const meta = overview.catMap.get(line.categoryId);
      const spent = overview.spendByCat.get(line.categoryId) ?? 0;
      return {
        id: line.id,
        categoryId: line.categoryId,
        name: meta?.name ?? "Category",
        icon: meta?.icon ?? "💸",
        color: meta?.color ?? "#635BFF",
        limitCents: line.limitCents,
        spentCents: spent,
        remainingCents: line.limitCents - spent,
        pct: line.limitCents > 0 ? (spent / line.limitCents) * 100 : 0,
        over: spent > line.limitCents,
      };
    })
    .sort((a, b) => b.pct - a.pct);
  return { month, rows, summary: overview.summary, incomeCents: overview.incomeCents };
}

export async function getGoals(userId: string) {
  return prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}
