import { describe, it, expect } from "vitest";
import { levelForPoints, mascot, savingsStreak, makeChallenge } from "@/lib/gamification";

describe("levels", () => {
  it("maps points to level and progress", () => {
    expect(levelForPoints(0).level).toBe(1);
    expect(levelForPoints(300).title).toBe("Saver");
    const l = levelForPoints(1500);
    expect(l.level).toBe(4);
    expect(l.title).toBe("Money Ninja");
  });

  it("reports progress toward the next level", () => {
    const l = levelForPoints(500); // between Saver(250) and Budget Boss(750)
    expect(l.pointsToNext).toBe(250);
    expect(l.progressPct).toBe(50);
  });
});

describe("mascot", () => {
  it("is thriving when healthy and nothing over budget", () => {
    expect(mascot({ healthScore: 90, pctBudgetUsed: 60, overCount: 0 }).mood).toBe("thriving");
  });
  it("is worried when several categories are over", () => {
    expect(mascot({ healthScore: 40, pctBudgetUsed: 95, overCount: 3 }).mood).toBe("worried");
  });
});

describe("savingsStreak", () => {
  it("counts consecutive on-budget months ending at the latest", () => {
    const months = [
      { incomeCents: 100, spendingCents: 120 }, // over
      { incomeCents: 100, spendingCents: 80 },
      { incomeCents: 100, spendingCents: 90 },
    ];
    expect(savingsStreak(months)).toBe(2);
  });
  it("is zero when the latest month overspent", () => {
    expect(savingsStreak([{ incomeCents: 100, spendingCents: 80 }, { incomeCents: 100, spendingCents: 130 }])).toBe(0);
  });
});

describe("makeChallenge", () => {
  it("flags on-track vs over", () => {
    const ok = makeChallenge({ key: "x", title: "t", emoji: "☕", spentCents: 3000, targetCents: 9000 });
    expect(ok.onTrack).toBe(true);
    expect(ok.pct).toBe(33);
    const over = makeChallenge({ key: "x", title: "t", emoji: "☕", spentCents: 12000, targetCents: 9000 });
    expect(over.onTrack).toBe(false);
    expect(over.pct).toBe(100);
  });
});
