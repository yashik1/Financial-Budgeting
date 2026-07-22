import { describe, it, expect } from "vitest";
import {
  totalIncome,
  totalSpending,
  netCashFlow,
  spendingByCategory,
  budgetProgress,
  budgetSummary,
  healthScore,
  type Txn,
} from "@/lib/budget";

const txns: Txn[] = [
  { amountCents: 420_000, categoryId: "inc", isTransfer: false }, // income
  { amountCents: -185_000, categoryId: "rent", isTransfer: false },
  { amountCents: -5_000, categoryId: "coffee", isTransfer: false },
  { amountCents: -3_000, categoryId: "coffee", isTransfer: false },
  { amountCents: -50_000, categoryId: "sav", isTransfer: true }, // transfer excluded
];

describe("budget math", () => {
  it("sums income and spending, ignoring transfers", () => {
    expect(totalIncome(txns)).toBe(420_000);
    expect(totalSpending(txns)).toBe(193_000);
    expect(netCashFlow(txns)).toBe(227_000);
  });

  it("groups spending by category", () => {
    const map = spendingByCategory(txns);
    expect(map.get("coffee")).toBe(8_000);
    expect(map.get("rent")).toBe(185_000);
    expect(map.has("sav")).toBe(false); // transfer excluded
  });

  it("computes budget progress and over state", () => {
    const map = spendingByCategory(txns);
    const progress = budgetProgress(
      [
        { categoryId: "coffee", limitCents: 6_000 },
        { categoryId: "rent", limitCents: 200_000 },
      ],
      map,
    );
    const coffee = progress.find((p) => p.categoryId === "coffee")!;
    expect(coffee.spentCents).toBe(8_000);
    expect(coffee.over).toBe(true);
    expect(coffee.remainingCents).toBe(-2_000);

    const summary = budgetSummary(progress);
    expect(summary.budgetedCents).toBe(206_000);
    expect(summary.overCount).toBe(1);
  });

  it("health score rewards saving and budget adherence", () => {
    const good = healthScore({ incomeCents: 100_000, spendingCents: 70_000, budget: { budgetedCents: 80_000, spentCents: 70_000, remainingCents: 10_000, pctUsed: 87.5, overCount: 0 } });
    const bad = healthScore({ incomeCents: 100_000, spendingCents: 100_000, budget: { budgetedCents: 80_000, spentCents: 100_000, remainingCents: -20_000, pctUsed: 125, overCount: 3 } });
    expect(good).toBeGreaterThan(bad);
    expect(good).toBeGreaterThanOrEqual(0);
    expect(good).toBeLessThanOrEqual(100);
  });
});
