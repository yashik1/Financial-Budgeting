import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "./db";

// "Try the demo" used to sign everyone into one shared row, so concurrent
// visitors saw — and could edit — each other's money. Instead we keep the
// seeded user as a read-only *template* and give each visitor a private clone
// that expires. Clones are never reachable by password (passwordHash stays
// null) and are deleted by `reapExpiredDemoUsers`.

/** The seeded row from `npm run seed`. Never signed into directly. */
export const DEMO_TEMPLATE_EMAIL = "demo@finbud.app";

const DEMO_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Copy the template user's whole graph into a fresh ephemeral user.
 *
 * Relations are recreated in dependency order, remapping foreign keys through
 * old-id -> new-id maps so nothing points back at the template.
 * Returns the new user's id, or null if the template hasn't been seeded.
 */
export async function cloneDemoUser(): Promise<string | null> {
  const template = await prisma.user.findUnique({
    where: { email: DEMO_TEMPLATE_EMAIL },
    include: {
      categories: { orderBy: { sort: "asc" } },
      accounts: true,
      goals: true,
      transactions: true,
      budgetLines: true,
      rules: true,
      achievements: true,
      stats: true,
    },
  });
  if (!template) return null;

  // Pre-generate the new primary keys so every table can be written with a
  // single bulk insert. Doing a `create()` per row instead meant ~30 sequential
  // round trips inside one interactive transaction — fine against localhost,
  // but slow and timeout-prone when the database is a network hop away.
  const newId = () => randomUUID();
  const catIds = new Map(template.categories.map((c) => [c.id, newId()]));
  const acctIds = new Map(template.accounts.map((a) => [a.id, newId()]));
  const goalIds = new Map(template.goals.map((g) => [g.id, newId()]));

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        // Unique but obviously ephemeral, and never a real inbox we could mail.
        email: `demo+${randomUUID()}@finbud.invalid`,
        name: template.name,
        isDemo: true,
        demoExpiresAt: new Date(Date.now() + DEMO_TTL_MS),
        currency: template.currency,
        country: template.country,
      },
    });

    // Parents before children in the same insert: Postgres checks the
    // self-referencing foreign key row by row, in order.
    const orderedCategories = [
      ...template.categories.filter((c) => !c.parentId),
      ...template.categories.filter((c) => c.parentId),
    ];
    await tx.category.createMany({
      data: orderedCategories.map((c) => ({
        id: catIds.get(c.id)!,
        userId: user.id,
        name: c.name,
        group: c.group,
        icon: c.icon,
        color: c.color,
        isIncome: c.isIncome,
        sort: c.sort,
        parentId: c.parentId ? (catIds.get(c.parentId) ?? null) : null,
      })),
    });

    await tx.account.createMany({
      data: template.accounts.map((a) => ({
        id: acctIds.get(a.id)!,
        userId: user.id,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        country: a.country,
        institution: a.institution,
        mask: a.mask,
        balanceCents: a.balanceCents,
        currency: a.currency,
        isAsset: a.isAsset,
        shared: a.shared,
        color: a.color,
        providerId: a.providerId,
      })),
    });

    await tx.goal.createMany({
      data: template.goals.map((g) => ({
        id: goalIds.get(g.id)!,
        userId: user.id,
        name: g.name,
        emoji: g.emoji,
        targetCents: g.targetCents,
        savedCents: g.savedCents,
        color: g.color,
        shared: g.shared,
        deadline: g.deadline,
        accountId: g.accountId ? (acctIds.get(g.accountId) ?? null) : null,
      })),
    });

    // Transactions are the bulk of the data, so insert them in one statement.
    // `splitParentId` is dropped: createMany can't resolve self-references, and
    // the seeded template has no splits.
    await tx.transaction.createMany({
      data: template.transactions.map((t) => ({
        userId: user.id,
        accountId: acctIds.get(t.accountId)!,
        date: t.date,
        amountCents: t.amountCents,
        merchant: t.merchant,
        rawDescription: t.rawDescription,
        categoryId: t.categoryId ? (catIds.get(t.categoryId) ?? null) : null,
        pending: t.pending,
        isTransfer: t.isTransfer,
        notes: t.notes,
        tags: t.tags,
        goalId: t.goalId ? (goalIds.get(t.goalId) ?? null) : null,
        excludeFromBudget: t.excludeFromBudget,
      })),
    });

    await tx.budgetLine.createMany({
      data: template.budgetLines.flatMap((b) => {
        const categoryId = catIds.get(b.categoryId);
        return categoryId ? [{ userId: user.id, categoryId, month: b.month, limitCents: b.limitCents }] : [];
      }),
    });

    await tx.rule.createMany({
      data: template.rules.flatMap((r) => {
        const categoryId = catIds.get(r.categoryId);
        return categoryId
          ? [{ userId: user.id, matcher: r.matcher, categoryId, priority: r.priority, builtIn: r.builtIn }]
          : [];
      }),
    });

    await tx.achievement.createMany({
      data: template.achievements.map((a) => ({
        userId: user.id,
        key: a.key,
        unlockedAt: a.unlockedAt,
      })),
    });

    await tx.userStats.create({
      data: {
        userId: user.id,
        points: template.stats?.points ?? 0,
        level: template.stats?.level ?? 1,
        savingsStreak: template.stats?.savingsStreak ?? 0,
        longestStreak: template.stats?.longestStreak ?? 0,
      },
    });

    return user.id;
    // maxWait covers acquiring a pooled connection, which is the part that
    // bites on a busy or remote database; timeout covers the inserts.
  }, { maxWait: 15_000, timeout: 30_000 });
}

/**
 * Delete demo clones whose TTL has passed. Cheap enough to call opportunistically
 * on demo login; a cron calling this directly would work the same way.
 * Cascades handle the owned rows (see `onDelete: Cascade` in the schema).
 */
export async function reapExpiredDemoUsers(): Promise<number> {
  const { count } = await prisma.user.deleteMany({
    where: { isDemo: true, demoExpiresAt: { lt: new Date() } },
  });
  return count;
}
