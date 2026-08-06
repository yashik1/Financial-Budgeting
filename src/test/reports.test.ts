import { describe, it, expect } from "vitest";
import { monthlyRows, periodTotals, categoryTrend, topMerchants, type ReportTxn } from "@/lib/reports";
import { projectGoal, contributionRate } from "@/lib/goals";

const MONTHS = ["2026-05", "2026-06", "2026-07"];

function t(month: string, amountCents: number, merchant: string, categoryId: string | null = "food"): ReportTxn {
  return { month, amountCents, merchant, categoryId };
}

describe("monthlyRows", () => {
  it("splits income and spending per month and keeps the requested order", () => {
    const rows = monthlyRows(
      [t("2026-05", 500000, "Payroll", "income"), t("2026-05", -120000, "Rent", "housing"), t("2026-07", -80000, "Rent", "housing")],
      MONTHS,
    );
    expect(rows.map((r) => r.month)).toEqual(MONTHS);
    expect(rows[0].incomeCents).toBe(500000);
    expect(rows[0].spendingCents).toBe(120000);
    expect(rows[0].netCents).toBe(380000);
    expect(rows[0].savingsRate).toBeCloseTo(0.76);
    expect(rows[1].incomeCents).toBe(0); // month with no activity still appears
    expect(rows[2].netCents).toBe(-80000);
  });

  it("ignores transfers and months outside the window", () => {
    const rows = monthlyRows(
      [
        { ...t("2026-05", -100000, "To savings", null), isTransfer: true },
        t("2026-01", -999999, "Ancient", "food"),
      ],
      MONTHS,
    );
    expect(rows.every((r) => r.spendingCents === 0)).toBe(true);
  });
});

describe("periodTotals", () => {
  it("averages over active months only and finds the best/worst", () => {
    const rows = monthlyRows(
      [t("2026-05", 400000, "Payroll", "income"), t("2026-05", -100000, "Rent", "housing"), t("2026-07", 400000, "Payroll", "income"), t("2026-07", -300000, "Rent", "housing")],
      MONTHS,
    );
    const totals = periodTotals(rows);
    expect(totals.incomeCents).toBe(800000);
    expect(totals.netCents).toBe(400000);
    // June was empty, so averages divide by the 2 months that had activity.
    expect(totals.avgNetCents).toBe(200000);
    expect(totals.bestMonth?.month).toBe("2026-05");
    expect(totals.worstMonth?.month).toBe("2026-07");
  });

  it("has a zero savings rate with no income", () => {
    expect(periodTotals(monthlyRows([t("2026-05", -5000, "Coffee")], MONTHS)).savingsRate).toBe(0);
  });
});

describe("categoryTrend", () => {
  it("ranks categories by spend and tracks the latest month against the baseline", () => {
    const txns = [
      t("2026-05", -10000, "Grocer", "food"),
      t("2026-06", -10000, "Grocer", "food"),
      t("2026-07", -20000, "Grocer", "food"), // double the $100 baseline
      t("2026-05", -5000, "Bus", "transport"),
    ];
    const [food, transport] = categoryTrend(txns, MONTHS);
    expect(food.categoryId).toBe("food");
    expect(food.totalCents).toBe(40000);
    expect(food.byMonth).toEqual([10000, 10000, 20000]);
    expect(food.changePct).toBe(100);
    expect(transport.changePct).toBe(-100); // spent in May, nothing in July
  });

  it("buckets missing categories and respects the limit", () => {
    const rows = categoryTrend([t("2026-05", -1000, "Mystery", null)], MONTHS, { limit: 1 });
    expect(rows).toHaveLength(1);
    expect(rows[0].categoryId).toBe("__uncategorized__");
  });

  it("has no baseline to compare when there is only one month", () => {
    expect(categoryTrend([t("2026-07", -1000, "Grocer", "food")], ["2026-07"])[0].changePct).toBeNull();
  });
});

describe("topMerchants", () => {
  it("groups store numbers together and labels with the commonest spelling", () => {
    const [shell] = topMerchants([
      t("2026-05", -4000, "Shell"),
      t("2026-06", -5000, "Shell"),
      t("2026-07", -6000, "SHELL 04821"),
    ]);
    expect(shell.merchant).toBe("Shell");
    expect(shell.count).toBe(3);
    expect(shell.totalCents).toBe(15000);
  });

  it("counts spending only, never income or transfers", () => {
    expect(
      topMerchants([t("2026-05", 500000, "Payroll", "income"), { ...t("2026-05", -100, "Move", null), isTransfer: true }]),
    ).toHaveLength(0);
  });
});

describe("projectGoal", () => {
  const base = { targetCents: 1000000, fromMonth: "2026-08" };

  it("projects the finish month from the contribution rate", () => {
    const p = projectGoal({ ...base, fundedCents: 400000, monthlyRateCents: 100000 });
    expect(p.monthsRemaining).toBe(6); // $6,000 left at $1,000/mo
    expect(p.etaMonth).toBe("2027-02");
    expect(p.onTrack).toBeNull(); // no deadline to judge against
  });

  it("is already done when the account covers the target", () => {
    const p = projectGoal({ ...base, fundedCents: 1200000, monthlyRateCents: 0 });
    expect(p.monthsRemaining).toBe(0);
    expect(p.etaMonth).toBe("2026-08");
    expect(p.onTrack).toBe(true);
  });

  it("reports no ETA when the account isn't growing", () => {
    const p = projectGoal({ ...base, fundedCents: 400000, monthlyRateCents: -5000, deadline: new Date("2027-01-01T00:00:00Z") });
    expect(p.monthsRemaining).toBeNull();
    expect(p.etaMonth).toBeNull();
    expect(p.onTrack).toBe(false); // a deadline it provably can't hit
  });

  it("treats a rate that takes lifetimes as unreachable", () => {
    expect(projectGoal({ ...base, fundedCents: 0, monthlyRateCents: 1 }).etaMonth).toBeNull();
  });

  it("compares the ETA against a deadline", () => {
    const onTime = projectGoal({ ...base, fundedCents: 900000, monthlyRateCents: 100000, deadline: new Date("2026-12-31T00:00:00Z") });
    expect(onTime.etaMonth).toBe("2026-09");
    expect(onTime.onTrack).toBe(true);

    const late = projectGoal({ ...base, fundedCents: 0, monthlyRateCents: 50000, deadline: new Date("2026-10-31T00:00:00Z") });
    expect(late.onTrack).toBe(false);
  });
});

describe("contributionRate", () => {
  it("averages net flows across the window", () => {
    expect(contributionRate([50000, 50000, -20000], 3)).toBe(26667);
    expect(contributionRate([], 6)).toBe(0);
    expect(contributionRate([100], 0)).toBe(0);
  });
});
