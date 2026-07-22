// Budget & cash-flow math. Pure functions over plain transaction/line shapes so
// they can be unit-tested without a database and reused on server and client.

export type Txn = {
  amountCents: number; // signed: negative = spend, positive = income
  categoryId: string | null;
  isTransfer?: boolean;
};

export type BudgetLineInput = {
  categoryId: string;
  limitCents: number;
};

const spendable = (t: Txn) => !t.isTransfer;

/** Total income (sum of inflows), as positive cents. */
export function totalIncome(txns: Txn[]): number {
  return txns
    .filter((t) => spendable(t) && t.amountCents > 0)
    .reduce((sum, t) => sum + t.amountCents, 0);
}

/** Total spending (sum of outflows), returned as a positive number. */
export function totalSpending(txns: Txn[]): number {
  return txns
    .filter((t) => spendable(t) && t.amountCents < 0)
    .reduce((sum, t) => sum - t.amountCents, 0);
}

/** Net cash flow = income − spending (signed). */
export function netCashFlow(txns: Txn[]): number {
  return totalIncome(txns) - totalSpending(txns);
}

/** Map of categoryId → positive spend cents (outflows only). */
export function spendingByCategory(txns: Txn[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (!spendable(t) || t.amountCents >= 0) continue;
    const key = t.categoryId ?? "__uncategorized__";
    map.set(key, (map.get(key) ?? 0) + -t.amountCents);
  }
  return map;
}

export type LineProgress = {
  categoryId: string;
  limitCents: number;
  spentCents: number;
  remainingCents: number; // can be negative when over budget
  pct: number; // 0..100+ (clamped only for display by caller)
  over: boolean;
};

export function budgetProgress(
  lines: BudgetLineInput[],
  spendByCat: Map<string, number>,
): LineProgress[] {
  return lines.map((line) => {
    const spentCents = spendByCat.get(line.categoryId) ?? 0;
    const remainingCents = line.limitCents - spentCents;
    const pct = line.limitCents > 0 ? (spentCents / line.limitCents) * 100 : 0;
    return {
      categoryId: line.categoryId,
      limitCents: line.limitCents,
      spentCents,
      remainingCents,
      pct,
      over: spentCents > line.limitCents,
    };
  });
}

export type BudgetSummary = {
  budgetedCents: number;
  spentCents: number;
  remainingCents: number;
  pctUsed: number;
  overCount: number;
};

export function budgetSummary(progress: LineProgress[]): BudgetSummary {
  const budgetedCents = progress.reduce((s, p) => s + p.limitCents, 0);
  const spentCents = progress.reduce((s, p) => s + p.spentCents, 0);
  const remainingCents = budgetedCents - spentCents;
  return {
    budgetedCents,
    spentCents,
    remainingCents,
    pctUsed: budgetedCents > 0 ? (spentCents / budgetedCents) * 100 : 0,
    overCount: progress.filter((p) => p.over).length,
  };
}

/** A gentle 0..100 "financial health" score from savings rate + budget adherence. */
export function healthScore(input: {
  incomeCents: number;
  spendingCents: number;
  budget: BudgetSummary;
}): number {
  const { incomeCents, spendingCents, budget } = input;
  const savingsRate =
    incomeCents > 0 ? (incomeCents - spendingCents) / incomeCents : 0;
  // 60% weight on savings rate (target ~20%), 40% on staying within budget.
  const savingsScore = Math.max(0, Math.min(1, savingsRate / 0.2));
  const adherence =
    budget.budgetedCents > 0
      ? Math.max(0, 1 - Math.max(0, budget.spentCents - budget.budgetedCents) / budget.budgetedCents)
      : savingsScore;
  return Math.round((savingsScore * 0.6 + adherence * 0.4) * 100);
}
