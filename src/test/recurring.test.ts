import { describe, it, expect } from "vitest";
import { detectRecurring, merchantKey, advance, monthlyCents, upcomingOccurrences, type RecurringInput } from "@/lib/recurring";
import { forecastMonth } from "@/lib/forecast";

const d = (iso: string) => new Date(`${iso}T12:00:00Z`);

function txn(id: string, iso: string, amountCents: number, merchant: string): RecurringInput {
  return { id, date: d(iso), amountCents, merchant, categoryId: null, isTransfer: false };
}

describe("merchantKey", () => {
  it("normalizes so store numbers group together", () => {
    expect(merchantKey("Netflix #1234")).toBe("netflix");
    expect(merchantKey("NETFLIX")).toBe("netflix");
    expect(merchantKey("Shell 04821")).toBe("shell");
  });
});

describe("advance", () => {
  it("steps by cadence, calendar-aware for months", () => {
    expect(advance(d("2026-01-15"), "weekly").toISOString().slice(0, 10)).toBe("2026-01-22");
    expect(advance(d("2026-01-15"), "biweekly").toISOString().slice(0, 10)).toBe("2026-01-29");
    expect(advance(d("2026-01-31"), "monthly").getUTCMonth()).toBe(2); // Jan 31 → Mar 3 (JS rollover)
    expect(advance(d("2026-01-15"), "yearly").toISOString().slice(0, 10)).toBe("2027-01-15");
  });
});

describe("detectRecurring", () => {
  it("finds a monthly subscription and predicts the next charge", () => {
    const txns = [
      txn("1", "2026-04-05", -1599, "Netflix"),
      txn("2", "2026-05-05", -1599, "Netflix"),
      txn("3", "2026-06-05", -1599, "Netflix"),
      txn("4", "2026-07-05", -1599, "Netflix"),
    ];
    const [series] = detectRecurring(txns);
    expect(series.cadence).toBe("monthly");
    expect(series.amountCents).toBe(-1599);
    expect(series.occurrences).toBe(4);
    expect(series.nextDate.toISOString().slice(0, 10)).toBe("2026-08-05");
    expect(series.confidence).toBeGreaterThan(0.9);
  });

  it("detects biweekly income", () => {
    const txns = [
      txn("1", "2026-06-05", 210000, "Acme Payroll"),
      txn("2", "2026-06-19", 210000, "Acme Payroll"),
      txn("3", "2026-07-03", 210000, "Acme Payroll"),
      txn("4", "2026-07-17", 210000, "Acme Payroll"),
    ];
    const [series] = detectRecurring(txns);
    expect(series.cadence).toBe("biweekly");
    expect(series.amountCents).toBeGreaterThan(0);
  });

  it("ignores irregular spending and transfers", () => {
    const irregular = [
      txn("1", "2026-06-01", -500, "Corner Coffee"),
      txn("2", "2026-06-03", -650, "Corner Coffee"),
      txn("3", "2026-06-19", -480, "Corner Coffee"),
      txn("4", "2026-07-14", -520, "Corner Coffee"),
    ];
    expect(detectRecurring(irregular)).toHaveLength(0);

    const transfers = [1, 2, 3, 4].map((i) => ({
      ...txn(String(i), `2026-0${i + 3}-10`, -10000, "Move to savings"),
      isTransfer: true,
    }));
    expect(detectRecurring(transfers)).toHaveLength(0);
  });

  it("needs enough occurrences to call something recurring", () => {
    const two = [txn("1", "2026-06-10", -999, "Spotify"), txn("2", "2026-07-10", -999, "Spotify")];
    expect(detectRecurring(two)).toHaveLength(0);
  });
});

describe("monthlyCents", () => {
  it("normalizes cadences to a monthly figure", () => {
    expect(monthlyCents({ amountCents: -1200, cadence: "monthly" })).toBe(-1200);
    expect(monthlyCents({ amountCents: -1200, cadence: "yearly" })).toBe(-100);
    expect(monthlyCents({ amountCents: -100, cadence: "weekly" })).toBe(-433);
  });
});

describe("upcomingOccurrences", () => {
  it("lists each due date inside the window", () => {
    const [series] = detectRecurring([
      txn("1", "2026-04-05", -1599, "Netflix"),
      txn("2", "2026-05-05", -1599, "Netflix"),
      txn("3", "2026-06-05", -1599, "Netflix"),
      txn("4", "2026-07-05", -1599, "Netflix"),
    ]);
    const hits = upcomingOccurrences([series], d("2026-08-01"), d("2026-10-31"));
    expect(hits.map((h) => h.date.toISOString().slice(0, 10))).toEqual(["2026-08-05", "2026-09-05", "2026-10-05"]);
  });
});

describe("forecastMonth", () => {
  const series = detectRecurring([
    txn("1", "2026-04-05", -100000, "Landlord"),
    txn("2", "2026-05-05", -100000, "Landlord"),
    txn("3", "2026-06-05", -100000, "Landlord"),
    txn("4", "2026-07-05", -100000, "Landlord"),
  ]);

  it("projects remaining bills plus typical spending", () => {
    const f = forecastMonth({
      incomeSoFarCents: 400000,
      spendingSoFarCents: 150000,
      variableSpendSoFarCents: 50000, // $500 over 10 days = $50/day
      daysElapsed: 10,
      daysInMonth: 31,
      series,
      from: d("2026-08-01"),
      to: d("2026-08-31"),
    });
    expect(f.daysLeft).toBe(21);
    expect(f.upcomingBillsCents).toBe(100000); // rent due Aug 5
    expect(f.estimatedVariableCents).toBe(105000); // 21 days × $50
    expect(f.projectedSpendingCents).toBe(150000 + 100000 + 105000);
    expect(f.projectedNetCents).toBe(400000 - f.projectedSpendingCents);
  });

  it("has nothing left to project at month end", () => {
    const f = forecastMonth({
      incomeSoFarCents: 400000,
      spendingSoFarCents: 300000,
      variableSpendSoFarCents: 100000,
      daysElapsed: 31,
      daysInMonth: 31,
      series: [],
      from: d("2026-08-31"),
      to: d("2026-08-31"),
    });
    expect(f.daysLeft).toBe(0);
    expect(f.estimatedVariableCents).toBe(0);
    expect(f.projectedNetCents).toBe(100000);
  });
});
