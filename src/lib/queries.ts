import "server-only";
import { prisma } from "./db";
import { addMonthsToKey, currentMonthKey, lastMonths, monthKey, monthRange } from "./dates";
import {
  budgetProgress,
  budgetSummary,
  healthScore,
  netCashFlow,
  rollUpSpend,
  spendingByCategory,
  totalIncome,
  totalSpending,
  type Txn,
} from "./budget";
import { netWorthSeries } from "./networth";
import { detectRecurring, merchantKey, upcomingOccurrences } from "./recurring";
import { forecastMonth } from "./forecast";
import { categoryTrend, monthlyRows, periodTotals, topMerchants, type ReportTxn } from "./reports";
import { contributionRate, projectGoal, type GoalProjection } from "./goals";
import {
  ACHIEVEMENTS,
  levelForPoints,
  makeChallenge,
  mascot,
} from "./gamification";

export type CategoryMeta = {
  id: string;
  name: string;
  icon: string;
  color: string;
  group: string;
  parentId: string | null;
};

export async function getCategoryMap(userId: string): Promise<Map<string, CategoryMeta>> {
  const cats = await prisma.category.findMany({ where: { userId } });
  const map = new Map<string, CategoryMeta>();
  for (const c of cats)
    map.set(c.id, { id: c.id, name: c.name, icon: c.icon, color: c.color, group: c.group, parentId: c.parentId });
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
  const spendByCat = spendingByCategory(asTxn); // exact (leaf) spend per category

  // Roll subcategory spend up to parents, so a parent budget includes its subs.
  const parentOf = new Map<string, string | null>();
  for (const c of catMap.values()) parentOf.set(c.id, c.parentId);
  const { rolled: rolledSpend, byTopLevel } = rollUpSpend(spendByCat, parentOf);

  const progress = budgetProgress(
    budgetLines.map((l) => ({ categoryId: l.categoryId, limitCents: l.limitCents })),
    rolledSpend,
  );
  const summary = budgetSummary(progress);
  const health = healthScore({ incomeCents, spendingCents, budget: summary });

  // Overview donut: bucket spending by top-level category (subs roll up).
  const categorySpend = [...byTopLevel.entries()]
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

  return { month, txns, budgetLines, catMap, incomeCents, spendingCents, netCents, spendByCat, rolledSpend, progress, summary, health, categorySpend };
}

export async function getNetWorthTrend(userId: string, months = 6, endMonth: string = currentMonthKey()) {
  const keys = lastMonths(months, endMonth);
  const { start } = monthRange(keys[0]);
  const { end } = monthRange(keys[keys.length - 1]);
  const [txns, overview, laterFlows] = await Promise.all([
    prisma.transaction.findMany({ where: { userId, date: { gte: start, lte: end }, isTransfer: false } }),
    getAccountsOverview(userId),
    // Flows after the window's end let us anchor net worth at the selected month
    // rather than today (matters when browsing a past month).
    prisma.transaction.aggregate({ where: { userId, isTransfer: false, date: { gt: end } }, _sum: { amountCents: true } }),
  ]);
  const netWorthAtEnd = overview.netWorthCents - (laterFlows._sum.amountCents ?? 0);

  const netByMonth = new Map<string, number>();
  for (const k of keys) netByMonth.set(k, 0);
  for (const t of txns) {
    const k = monthKey(t.date);
    if (netByMonth.has(k)) netByMonth.set(k, netByMonth.get(k)! + t.amountCents);
  }
  const monthly = keys.map((month) => ({ month, netCents: netByMonth.get(month) ?? 0 }));
  return netWorthSeries(netWorthAtEnd, monthly);
}

export async function getCashflowTrend(userId: string, months = 6, endMonth: string = currentMonthKey()) {
  const keys = lastMonths(months, endMonth);
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

export type MoneyDelta = { currentCents: number; previousCents: number; deltaCents: number };
export type CategoryMover = {
  id: string;
  name: string;
  icon: string;
  color: string;
  currentCents: number;
  previousCents: number;
  deltaCents: number;
};
export type MonthComparison = {
  month: string;
  prevMonth: string;
  income: MoneyDelta;
  spending: MoneyDelta;
  net: MoneyDelta;
  movers: CategoryMover[];
};

/** This month vs the previous month: headline deltas + biggest category movers. */
function buildComparison(
  cur: Awaited<ReturnType<typeof getMonthOverview>>,
  prev: Awaited<ReturnType<typeof getMonthOverview>>,
): MonthComparison {
  const delta = (currentCents: number, previousCents: number): MoneyDelta => ({
    currentCents,
    previousCents,
    deltaCents: currentCents - previousCents,
  });

  const curByCat = new Map(cur.categorySpend.map((c) => [c.id, c]));
  const prevByCat = new Map(prev.categorySpend.map((c) => [c.id, c]));
  const ids = new Set([...curByCat.keys(), ...prevByCat.keys()]);
  const movers: CategoryMover[] = [...ids]
    .map((id) => {
      const meta = curByCat.get(id) ?? prevByCat.get(id)!;
      const currentCents = curByCat.get(id)?.cents ?? 0;
      const previousCents = prevByCat.get(id)?.cents ?? 0;
      return { id, name: meta.name, icon: meta.icon, color: meta.color, currentCents, previousCents, deltaCents: currentCents - previousCents };
    })
    .filter((m) => m.deltaCents !== 0)
    .sort((a, b) => Math.abs(b.deltaCents) - Math.abs(a.deltaCents));

  return {
    month: cur.month,
    prevMonth: prev.month,
    income: delta(cur.incomeCents, prev.incomeCents),
    spending: delta(cur.spendingCents, prev.spendingCents),
    net: delta(cur.netCents, prev.netCents),
    movers,
  };
}

/**
 * Everything the dashboard needs, composed. Defaults to the current month,
 * compared against the month before it; `compareWith` swaps the baseline
 * (e.g. same month last year).
 */
export async function getDashboard(
  userId: string,
  month: string = currentMonthKey(),
  compareWith?: string,
  currency = "USD",
) {
  const prevMonth = compareWith && compareWith !== month ? compareWith : addMonthsToKey(month, -1);
  const [accounts, overview, prevOverview, trend, cashflow, game] = await Promise.all([
    getAccountsOverview(userId),
    getMonthOverview(userId, month),
    getMonthOverview(userId, prevMonth),
    getNetWorthTrend(userId, 6, month),
    getCashflowTrend(userId, 6, month),
    getGamification(userId),
  ]);
  const comparison = buildComparison(overview, prevOverview);

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
      challenge = makeChallenge({ key: name, title: `${name} under control`, emoji, spentCents: spent, targetCents: target, currency });
    }
  }

  return { month, prevMonth, accounts, overview, trend, cashflow, game, mascot: mascotState, challenge, comparison };
}

export type TxnFilters = {
  categoryId?: string;
  accountId?: string;
  accountType?: string; // checking | savings | credit | investment | ...
  search?: string;
  tag?: string;
  type?: "in" | "out" | "transfer";
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  limit?: number;
};

export async function getTransactions(userId: string, opts: TxnFilters = {}) {
  const { categoryId, accountId, accountType, search, tag, type, from, to, limit = 200 } = opts;

  const typeWhere =
    type === "in"
      ? { amountCents: { gt: 0 }, isTransfer: false }
      : type === "out"
        ? { amountCents: { lt: 0 }, isTransfer: false }
        : type === "transfer"
          ? { isTransfer: true }
          : {};

  const dateWhere =
    from || to
      ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}) } }
      : {};

  const txns = await prisma.transaction.findMany({
    where: {
      userId,
      ...(categoryId ? { categoryId } : {}),
      ...(accountId ? { accountId } : {}),
      ...(accountType ? { account: { type: accountType } } : {}),
      ...(tag ? { tags: { has: tag } } : {}),
      ...typeWhere,
      ...dateWhere,
      ...(search ? { OR: [{ merchant: { contains: search, mode: "insensitive" } }, { rawDescription: { contains: search, mode: "insensitive" } }] } : {}),
    },
    include: { account: true, category: true },
    orderBy: { date: "desc" },
    take: limit,
  });
  return txns;
}

/** Distinct tags this user has applied, most-used first. */
export async function getUsedTags(userId: string): Promise<{ tag: string; count: number }[]> {
  const rows = await prisma.transaction.findMany({
    where: { userId, NOT: { tags: { isEmpty: true } } },
    select: { tags: true },
  });
  const counts = new Map<string, number>();
  for (const r of rows) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

// A transaction is "uncategorized" if it has no category, or sits in the
// built-in catch-all category named "Uncategorized".
const UNCATEGORIZED_WHERE = {
  OR: [{ categoryId: null }, { category: { is: { name: "Uncategorized" } } }],
};

/** Spending transactions in a month that don't fall under any real category. */
export async function getUncategorizedForMonth(userId: string, month: string = currentMonthKey()) {
  const { start, end } = monthRange(month);
  const txns = await prisma.transaction.findMany({
    where: { userId, isTransfer: false, date: { gte: start, lte: end }, ...UNCATEGORIZED_WHERE },
    include: { account: true },
    orderBy: { date: "desc" },
  });
  const spentCents = txns
    .filter((t) => t.amountCents < 0)
    .reduce((s, t) => s - t.amountCents, 0);
  return { txns, spentCents, count: txns.length };
}

export type BudgetRow = {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  limitCents: number;
  spentCents: number; // rolled (includes subcategories)
  remainingCents: number;
  pct: number;
  over: boolean;
};

export type BudgetGroup = { parent: BudgetRow; children: BudgetRow[] };

export async function getBudgetView(userId: string, month: string = currentMonthKey()) {
  const overview = await getMonthOverview(userId, month);
  const limitByCat = new Map(overview.budgetLines.map((l) => [l.categoryId, l.limitCents]));

  const rowFor = (c: CategoryMeta): BudgetRow => {
    const limitCents = limitByCat.get(c.id) ?? 0;
    const spentCents = overview.rolledSpend.get(c.id) ?? 0;
    return {
      categoryId: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      limitCents,
      spentCents,
      remainingCents: limitCents - spentCents,
      pct: limitCents > 0 ? (spentCents / limitCents) * 100 : 0,
      over: limitCents > 0 && spentCents > limitCents,
    };
  };

  // The catch-all "Uncategorized" category is surfaced in its own section, not
  // as a budget envelope.
  const cats = [...overview.catMap.values()].filter((c) => c.group !== "Income" && c.name !== "Uncategorized");
  const childrenByParent = new Map<string, CategoryMeta[]>();
  for (const c of cats) {
    if (!c.parentId) continue;
    const list = childrenByParent.get(c.parentId) ?? [];
    list.push(c);
    childrenByParent.set(c.parentId, list);
  }

  const groups: BudgetGroup[] = cats
    .filter((c) => !c.parentId)
    .map((p) => ({
      parent: rowFor(p),
      children: (childrenByParent.get(p.id) ?? [])
        .map(rowFor)
        .sort((a, b) => b.spentCents - a.spentCents),
    }))
    .sort((a, b) => {
      // Budgeted or active groups first, then by spend.
      const score = (g: BudgetGroup) => (g.parent.limitCents > 0 ? 1_000_000 : 0) + g.parent.spentCents;
      return score(b) - score(a);
    });

  return { month, groups, summary: overview.summary, incomeCents: overview.incomeCents };
}

/** Recurring series detected from the last `months` of history. */
export async function getRecurring(userId: string, months = 6) {
  const keys = lastMonths(months);
  const { start } = monthRange(keys[0]);
  const txns = await prisma.transaction.findMany({
    where: { userId, date: { gte: start } },
    select: { id: true, date: true, amountCents: true, merchant: true, categoryId: true, isTransfer: true },
    orderBy: { date: "asc" },
  });
  return detectRecurring(txns);
}

/**
 * Everything the calendar needs for a month: each day's actual transactions
 * plus projected recurring items for days still to come.
 */
export async function getCalendarMonth(userId: string, month: string = currentMonthKey()) {
  const { start, end } = monthRange(month);
  const [txns, series, catMap] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: start, lte: end } },
      include: { account: true, category: true },
      orderBy: { date: "asc" },
    }),
    getRecurring(userId),
    getCategoryMap(userId),
  ]);

  // Project recurring items from tomorrow (or the month start, for future
  // months) through the end of the month.
  const now = new Date();
  const projectFrom = now > start ? new Date(Math.min(now.getTime() + 86_400_000, end.getTime())) : start;
  const projected = projectFrom <= end ? upcomingOccurrences(series, projectFrom, end) : [];

  return { month, start, end, txns, series, projected, catMap };
}

/** Projected end-of-month position for the current month. */
export async function getForecast(userId: string, month: string = currentMonthKey()) {
  const { start, end } = monthRange(month);
  const [txns, series] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: start, lte: end }, isTransfer: false },
      select: { date: true, amountCents: true, merchant: true },
    }),
    getRecurring(userId),
  ]);

  const recurringKeys = new Set(series.map((s) => s.key));
  let incomeSoFarCents = 0;
  let spendingSoFarCents = 0;
  let variableSpendSoFarCents = 0;
  for (const t of txns) {
    if (t.amountCents > 0) incomeSoFarCents += t.amountCents;
    else {
      const spend = -t.amountCents;
      spendingSoFarCents += spend;
      if (!recurringKeys.has(merchantKey(t.merchant))) variableSpendSoFarCents += spend;
    }
  }

  const now = new Date();
  const daysInMonth = end.getUTCDate();
  const inThisMonth = now >= start && now <= end;
  const daysElapsed = inThisMonth ? now.getUTCDate() : daysInMonth;
  const from = inThisMonth ? new Date(now.getTime() + 86_400_000) : end;

  return forecastMonth({
    incomeSoFarCents,
    spendingSoFarCents,
    variableSpendSoFarCents,
    daysElapsed,
    daysInMonth,
    series,
    from,
    to: end,
  });
}

export type GoalView = Awaited<ReturnType<typeof prisma.goal.findMany>>[number] & {
  fundedCents: number;
  accountName: string | null;
  projection: GoalProjection | null;
};

/** How far back we look to work out how fast a goal's account is growing. */
const GOAL_RATE_MONTHS = 6;

/**
 * Goals with their effective funded amount and a projected finish date. When a
 * goal is linked to an account, progress tracks that account's (asset) balance
 * and the ETA comes from that account's recent net inflow; otherwise it falls
 * back to any manually-stored amount and has no projection to offer.
 */
export async function getGoals(userId: string): Promise<GoalView[]> {
  const goals = await prisma.goal.findMany({
    where: { userId },
    include: { account: { select: { id: true, name: true, balanceCents: true, isAsset: true } } },
    orderBy: { createdAt: "asc" },
  });

  const accountIds = [...new Set(goals.map((g) => g.account?.id).filter((id): id is string => !!id))];
  const rateByAccount = new Map<string, number>();
  if (accountIds.length) {
    const months = lastMonths(GOAL_RATE_MONTHS);
    const { start } = monthRange(months[0]);
    const { end } = monthRange(months[months.length - 1]);
    // Transfers count here: moving money into savings is how a goal gets funded.
    const flows = await prisma.transaction.groupBy({
      by: ["accountId"],
      where: { userId, accountId: { in: accountIds }, date: { gte: start, lte: end } },
      _sum: { amountCents: true },
    });
    for (const f of flows) {
      rateByAccount.set(f.accountId, contributionRate([f._sum.amountCents ?? 0], GOAL_RATE_MONTHS));
    }
  }

  const fromMonth = currentMonthKey();
  return goals.map(({ account, ...g }) => {
    const fundedCents = account ? Math.max(0, account.balanceCents) : g.savedCents;
    return {
      ...g,
      fundedCents,
      accountName: account?.name ?? null,
      projection: account
        ? projectGoal({
            fundedCents,
            targetCents: g.targetCents,
            monthlyRateCents: rateByAccount.get(account.id) ?? 0,
            fromMonth,
            deadline: g.deadline,
          })
        : null,
    };
  });
}

/**
 * Everything the /reports page needs: per-month cash flow across the window,
 * period totals, category trends (rolled up to top level), and top merchants.
 */
export async function getReports(userId: string, months = 6, endMonth: string = currentMonthKey()) {
  const keys = lastMonths(months, endMonth);
  const { start } = monthRange(keys[0]);
  const { end } = monthRange(keys[keys.length - 1]);

  const [txns, catMap, accountsOverview] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: start, lte: end } },
      select: { date: true, amountCents: true, categoryId: true, merchant: true, isTransfer: true },
    }),
    getCategoryMap(userId),
    getAccountsOverview(userId),
  ]);

  // Resolve every category to its top-level ancestor so a report never counts a
  // parent and its subcategory as two separate lines.
  const topLevelOf = new Map<string, string>();
  for (const c of catMap.values()) {
    let cur: CategoryMeta | undefined = c;
    const seen = new Set<string>();
    while (cur?.parentId && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = catMap.get(cur.parentId);
    }
    topLevelOf.set(c.id, cur?.id ?? c.id);
  }

  const reportTxns: ReportTxn[] = txns.map((t) => ({
    month: monthKey(t.date),
    amountCents: t.amountCents,
    categoryId: t.categoryId ? topLevelOf.get(t.categoryId) ?? t.categoryId : null,
    merchant: t.merchant,
    isTransfer: t.isTransfer,
  }));

  const rows = monthlyRows(reportTxns, keys);
  const trend = categoryTrend(reportTxns, keys).map((r) => {
    const meta = catMap.get(r.categoryId);
    return {
      ...r,
      name: meta?.name ?? "Uncategorized",
      icon: meta?.icon ?? "❓",
      color: meta?.color ?? "#7A879C",
    };
  });

  return {
    months: keys,
    rows,
    totals: periodTotals(rows),
    trend,
    merchants: topMerchants(reportTxns),
    assetsCents: accountsOverview.assetsCents,
    liabilitiesCents: accountsOverview.liabilitiesCents,
    netWorthCents: accountsOverview.netWorthCents,
  };
}

/**
 * Everything the /household page needs. Aggregates each member's SHARED
 * accounts/transactions/goals (private ones are excluded). Spending is grouped
 * by category *name* since members have distinct category rows sharing one
 * taxonomy.
 */
export async function getHouseholdData(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const pendingInvites = await prisma.householdInvite.findMany({
    where: { email: user.email.toLowerCase(), status: "pending" },
    include: { household: true },
    orderBy: { createdAt: "desc" },
  });

  const myAccounts = await prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  const myGoals = await prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });

  if (!user.householdId) {
    return { inHousehold: false as const, user, invites: pendingInvites, myAccounts, myGoals };
  }

  const household = await prisma.household.findUnique({
    where: { id: user.householdId },
    include: {
      members: { select: { id: true, name: true, email: true } },
      invites: { where: { status: "pending" }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!household) {
    return { inHousehold: false as const, user, invites: pendingInvites, myAccounts, myGoals };
  }

  const memberIds = household.members.map((m) => m.id);
  const { start, end } = monthRange(currentMonthKey());

  const accounts = await prisma.account.findMany({
    where: { userId: { in: memberIds }, shared: true },
    orderBy: [{ isAsset: "desc" }, { createdAt: "asc" }],
  });
  const assetsCents = accounts.filter((a) => a.isAsset).reduce((s, a) => s + a.balanceCents, 0);
  const liabilitiesCents = accounts.filter((a) => !a.isAsset).reduce((s, a) => s + Math.abs(a.balanceCents), 0);
  const netWorthCents = accounts.reduce((s, a) => s + a.balanceCents, 0);

  const txns = await prisma.transaction.findMany({
    where: { userId: { in: memberIds }, date: { gte: start, lte: end }, account: { shared: true } },
    include: { category: true },
  });
  const asTxn = txns.map((t) => ({ amountCents: t.amountCents, categoryId: t.categoryId, isTransfer: t.isTransfer }));
  const incomeCents = totalIncome(asTxn);
  const spendingCents = totalSpending(asTxn);

  const byName = new Map<string, { cents: number; icon: string; color: string }>();
  for (const t of txns) {
    if (t.isTransfer || t.amountCents >= 0) continue;
    const name = t.category?.name ?? "Uncategorized";
    const cur = byName.get(name) ?? { cents: 0, icon: t.category?.icon ?? "❓", color: t.category?.color ?? "#7A879C" };
    cur.cents += -t.amountCents;
    byName.set(name, cur);
  }
  const categorySpend = [...byName.entries()]
    .map(([name, v]) => ({ id: name, name, icon: v.icon, color: v.color, cents: v.cents }))
    .sort((a, b) => b.cents - a.cents);

  const perPerson = household.members.map((m) => {
    const mine = txns.filter((t) => t.userId === m.id && !t.isTransfer);
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      isYou: m.id === userId,
      spentCents: mine.filter((t) => t.amountCents < 0).reduce((s, t) => s - t.amountCents, 0),
      incomeCents: mine.filter((t) => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0),
    };
  });

  const goals = await prisma.goal.findMany({
    where: { userId: { in: memberIds }, shared: true },
    orderBy: { createdAt: "asc" },
  });
  const ownerName = new Map(household.members.map((m) => [m.id, m.name]));
  const sharedGoals = goals.map((g) => ({ ...g, ownerName: ownerName.get(g.userId) ?? "" }));

  return {
    inHousehold: true as const,
    user,
    household,
    members: household.members,
    pendingHouseholdInvites: household.invites,
    accounts,
    assetsCents,
    liabilitiesCents,
    netWorthCents,
    incomeCents,
    spendingCents,
    netCents: incomeCents - spendingCents,
    categorySpend,
    perPerson,
    sharedGoals,
    myAccounts,
    myGoals,
  };
}
