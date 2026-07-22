import { PrismaClient } from "@prisma/client";
import { CATEGORIES, SUBCATEGORIES, DEFAULT_RULES } from "../src/lib/categories";
import { categorize } from "../src/lib/categorize";
import { generateDemoFinancials } from "../src/lib/aggregation/demo";
import { currentMonthKey, lastMonths, monthKey } from "../src/lib/dates";
import { savingsStreak, levelForPoints } from "../src/lib/gamification";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@finbud.app";

// Monthly envelope limits (cents) for the current month.
const BUDGET_LIMITS: Record<string, number> = {
  "Rent & Mortgage": 185_000,
  Groceries: 55_000,
  "Dining & Takeout": 35_000,
  Coffee: 9_000,
  Transportation: 22_000,
  Shopping: 25_000,
  Entertainment: 12_000,
  Utilities: 16_000,
  "Phone & Internet": 16_000,
  Subscriptions: 6_000,
  Fitness: 4_000,
  Healthcare: 15_000,
  Insurance: 15_000,
  "Personal Care": 8_000,
};

async function main() {
  console.log("🌱 Seeding FinBud demo data…");

  // Fresh start for the demo user (cascade clears its data).
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  const user = await prisma.user.create({
    data: { email: DEMO_EMAIL, name: "Alex Rivera", isDemo: true },
  });

  // Categories
  const categoryByName = new Map<string, string>();
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i];
    const created = await prisma.category.create({
      data: {
        userId: user.id,
        name: c.name,
        group: c.group,
        icon: c.icon,
        color: c.color,
        isIncome: !!c.isIncome,
        sort: i,
      },
    });
    categoryByName.set(c.name, created.id);
  }
  const uncategorizedId = categoryByName.get("Uncategorized")!;

  // Subcategories (nested under a parent)
  for (const s of SUBCATEGORIES) {
    const parent = CATEGORIES.find((c) => c.name === s.parent);
    const sub = await prisma.category.create({
      data: {
        userId: user.id,
        name: s.name,
        group: parent?.group ?? "Essentials",
        icon: s.icon,
        color: parent?.color ?? "#635BFF",
        parentId: categoryByName.get(s.parent) ?? null,
        sort: 100,
      },
    });
    categoryByName.set(s.name, sub.id);
  }

  // Rules (persisted so the app can re-run categorization + users can add more)
  await prisma.rule.createMany({
    data: DEFAULT_RULES.map((r) => ({
      userId: user.id,
      matcher: r.matcher,
      categoryId: categoryByName.get(r.category) ?? uncategorizedId,
      priority: r.matcher.length,
    })),
  });

  // Accounts + transactions from the demo provider
  const { accounts, transactions } = generateDemoFinancials({ months: 9 });
  const accountIdByExternal = new Map<string, string>();
  for (const a of accounts) {
    const created = await prisma.account.create({
      data: {
        userId: user.id,
        name: a.name,
        type: a.type,
        institution: a.institution,
        mask: a.mask,
        balanceCents: a.balanceCents,
        currency: a.currency,
        isAsset: a.isAsset,
        color: a.color,
        providerId: "demo",
        externalId: a.externalId,
      },
    });
    accountIdByExternal.set(a.externalId, created.id);
  }

  // A few illustrative tags so filtering/chips are alive on first load.
  const demoTags = (catName: string | null): string[] => {
    switch (catName) {
      case "Dining & Takeout":
        return ["eating-out"];
      case "Coffee":
        return ["coffee", "treat"];
      case "Groceries":
        return ["essentials"];
      case "Rideshare":
      case "Gas":
        return ["commute"];
      case "Subscriptions":
        return ["recurring"];
      default:
        return [];
    }
  };

  await prisma.transaction.createMany({
    data: transactions.map((t) => {
      const catName = categorize(t.rawDescription, DEFAULT_RULES);
      return {
        userId: user.id,
        accountId: accountIdByExternal.get(t.accountExternalId)!,
        date: t.date,
        amountCents: t.amountCents,
        merchant: t.merchant,
        rawDescription: t.rawDescription,
        pending: t.pending,
        isTransfer: t.isTransfer,
        categoryId: catName ? categoryByName.get(catName) ?? uncategorizedId : uncategorizedId,
        tags: demoTags(catName),
      };
    }),
  });

  // Budget lines for the last 6 months, so browsing past months stays alive.
  const month = currentMonthKey();
  const budgetMonths = lastMonths(6, month);
  await prisma.budgetLine.createMany({
    data: budgetMonths.flatMap((m) =>
      Object.entries(BUDGET_LIMITS)
        .filter(([name]) => categoryByName.has(name))
        .map(([name, limitCents]) => ({
          userId: user.id,
          categoryId: categoryByName.get(name)!,
          month: m,
          limitCents,
        })),
    ),
  });

  // Goals
  await prisma.goal.createMany({
    data: [
      { userId: user.id, name: "Emergency Fund", emoji: "🛟", targetCents: 1_500_000, savedCents: 980_000, color: "#16A374" },
      { userId: user.id, name: "Trip to Japan", emoji: "🗾", targetCents: 500_000, savedCents: 235_000, color: "#635BFF", deadline: new Date(Date.UTC(new Date().getUTCFullYear() + 1, 3, 1)) },
      { userId: user.id, name: "New Laptop", emoji: "💻", targetCents: 220_000, savedCents: 220_000, color: "#E5A93A" },
    ],
  });

  // Gamification: compute the on-budget streak from generated cash flow.
  const byMonth = new Map<string, { incomeCents: number; spendingCents: number }>();
  for (const t of transactions) {
    if (t.isTransfer) continue;
    const key = monthKey(t.date);
    const acc = byMonth.get(key) ?? { incomeCents: 0, spendingCents: 0 };
    if (t.amountCents > 0) acc.incomeCents += t.amountCents;
    else acc.spendingCents += -t.amountCents;
    byMonth.set(key, acc);
  }
  const orderedMonths = [...byMonth.keys()].sort().map((k) => byMonth.get(k)!);
  const streak = savingsStreak(orderedMonths);
  const points = 400 + streak * 130;
  const level = levelForPoints(points).level;

  await prisma.userStats.create({
    data: {
      userId: user.id,
      points,
      level,
      savingsStreak: streak,
      longestStreak: Math.max(streak, 5),
    },
  });

  const unlocked = ["first_budget", "on_budget_month", "saver_20", "investor", "goal_funded"];
  if (streak >= 3) unlocked.push("streak_3");
  if (streak >= 6) unlocked.push("streak_6");
  await prisma.achievement.createMany({
    data: unlocked.map((key) => ({ userId: user.id, key })),
  });

  console.log(
    `✅ Seeded ${transactions.length} transactions across ${accounts.length} accounts. ` +
      `On-budget streak: ${streak} months. Level ${level}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
