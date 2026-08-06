// Multi-month reporting math. Pure over plain shapes so it's unit-testable and
// reusable by the reports page, exports, and the AI coach's context builder.
//
// Transactions arriving here have already had their category resolved to a
// top-level ancestor, so a report never double-counts a parent and its child.

import { merchantKey } from "./recurring";

export type ReportTxn = {
  month: string; // "YYYY-MM"
  amountCents: number; // signed: negative = spend
  categoryId: string | null; // already rolled up to top level
  merchant: string;
  isTransfer?: boolean;
  excludeFromBudget?: boolean;
};

const reportable = (t: ReportTxn) => !t.isTransfer && !t.excludeFromBudget;

export type MonthRow = {
  month: string;
  incomeCents: number;
  spendingCents: number; // positive
  netCents: number;
  savingsRate: number; // 0..1; 0 when there's no income
};

/** Per-month income/spending/net for exactly `months`, in the order given. */
export function monthlyRows(txns: ReportTxn[], months: string[]): MonthRow[] {
  const rows = new Map<string, MonthRow>();
  for (const month of months) {
    rows.set(month, { month, incomeCents: 0, spendingCents: 0, netCents: 0, savingsRate: 0 });
  }
  for (const t of txns) {
    if (!reportable(t)) continue;
    const row = rows.get(t.month);
    if (!row) continue;
    if (t.amountCents > 0) row.incomeCents += t.amountCents;
    else row.spendingCents += -t.amountCents;
  }
  for (const row of rows.values()) {
    row.netCents = row.incomeCents - row.spendingCents;
    row.savingsRate = row.incomeCents > 0 ? row.netCents / row.incomeCents : 0;
  }
  return months.map((m) => rows.get(m)!);
}

export type PeriodTotals = {
  incomeCents: number;
  spendingCents: number;
  netCents: number;
  savingsRate: number;
  avgIncomeCents: number;
  avgSpendingCents: number;
  avgNetCents: number;
  bestMonth: MonthRow | null; // highest net
  worstMonth: MonthRow | null; // lowest net
};

export function periodTotals(rows: MonthRow[]): PeriodTotals {
  const incomeCents = rows.reduce((s, r) => s + r.incomeCents, 0);
  const spendingCents = rows.reduce((s, r) => s + r.spendingCents, 0);
  const netCents = incomeCents - spendingCents;
  const n = rows.length || 1;
  // Months with no activity at all would drag the averages down misleadingly.
  const active = rows.filter((r) => r.incomeCents !== 0 || r.spendingCents !== 0);
  const activeN = active.length || 1;
  const sorted = [...active].sort((a, b) => a.netCents - b.netCents);
  return {
    incomeCents,
    spendingCents,
    netCents,
    savingsRate: incomeCents > 0 ? netCents / incomeCents : 0,
    avgIncomeCents: Math.round(incomeCents / activeN),
    avgSpendingCents: Math.round(spendingCents / activeN),
    avgNetCents: Math.round(netCents / activeN),
    bestMonth: sorted.length ? sorted[sorted.length - 1] : null,
    worstMonth: sorted.length ? sorted[0] : null,
  };
}

export type CategoryTrendRow = {
  categoryId: string; // "__uncategorized__" when the txn had no category
  totalCents: number; // positive spend across the period
  avgCents: number; // per active month
  byMonth: number[]; // aligned to the `months` argument
  /** Latest month vs the mean of the earlier months; null when there's no baseline. */
  changePct: number | null;
};

/**
 * Spend per category per month, biggest spender first. `limit` keeps the report
 * readable; everything past it is the caller's problem to summarise.
 */
export function categoryTrend(
  txns: ReportTxn[],
  months: string[],
  { limit = 8 }: { limit?: number } = {},
): CategoryTrendRow[] {
  const index = new Map(months.map((m, i) => [m, i]));
  const byCat = new Map<string, number[]>();

  for (const t of txns) {
    if (!reportable(t) || t.amountCents >= 0) continue;
    const i = index.get(t.month);
    if (i === undefined) continue;
    const key = t.categoryId ?? "__uncategorized__";
    let arr = byCat.get(key);
    if (!arr) {
      arr = new Array(months.length).fill(0);
      byCat.set(key, arr);
    }
    arr[i] += -t.amountCents;
  }

  const rows: CategoryTrendRow[] = [...byCat.entries()].map(([categoryId, byMonth]) => {
    const totalCents = byMonth.reduce((s, c) => s + c, 0);
    const activeMonths = byMonth.filter((c) => c > 0).length || 1;
    const earlier = byMonth.slice(0, -1);
    const baseline = earlier.length ? earlier.reduce((s, c) => s + c, 0) / earlier.length : 0;
    const latest = byMonth[byMonth.length - 1] ?? 0;
    return {
      categoryId,
      totalCents,
      byMonth,
      avgCents: Math.round(totalCents / activeMonths),
      changePct: baseline > 0 ? Math.round(((latest - baseline) / baseline) * 100) : null,
    };
  });

  return rows.sort((a, b) => b.totalCents - a.totalCents).slice(0, limit);
}

export type MerchantRow = {
  merchant: string; // the most frequently-seen spelling
  totalCents: number; // positive spend
  count: number;
};

/** Where the money actually goes, grouped so "SHELL 04821" and "Shell" are one row. */
export function topMerchants(txns: ReportTxn[], limit = 10): MerchantRow[] {
  const groups = new Map<string, { totalCents: number; count: number; names: Map<string, number> }>();

  for (const t of txns) {
    if (!reportable(t) || t.amountCents >= 0) continue;
    const key = merchantKey(t.merchant);
    if (!key) continue;
    let g = groups.get(key);
    if (!g) {
      g = { totalCents: 0, count: 0, names: new Map() };
      groups.set(key, g);
    }
    g.totalCents += -t.amountCents;
    g.count += 1;
    g.names.set(t.merchant, (g.names.get(t.merchant) ?? 0) + 1);
  }

  return [...groups.values()]
    .map((g) => {
      const merchant = [...g.names.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { merchant, totalCents: g.totalCents, count: g.count };
    })
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, limit);
}
