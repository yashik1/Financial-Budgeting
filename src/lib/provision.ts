import "server-only";
import { prisma } from "./db";
import { CATEGORIES, SUBCATEGORIES, DEFAULT_RULES } from "./categories";

// Give a brand-new (non-demo) user the default category taxonomy + rules so
// they can immediately import a CSV or add accounts manually.
export async function provisionUserDefaults(userId: string): Promise<void> {
  const byName = new Map<string, string>();
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i];
    const created = await prisma.category.create({
      data: {
        userId,
        name: c.name,
        group: c.group,
        icon: c.icon,
        color: c.color,
        isIncome: !!c.isIncome,
        sort: i,
      },
    });
    byName.set(c.name, created.id);
  }
  for (const s of SUBCATEGORIES) {
    const parent = CATEGORIES.find((c) => c.name === s.parent);
    const sub = await prisma.category.create({
      data: {
        userId,
        name: s.name,
        group: parent?.group ?? "Essentials",
        icon: s.icon,
        color: parent?.color ?? "#635BFF",
        parentId: byName.get(s.parent) ?? null,
        sort: 100,
      },
    });
    byName.set(s.name, sub.id);
  }
  const fallback = byName.get("Uncategorized")!;
  await prisma.rule.createMany({
    data: DEFAULT_RULES.map((r) => ({
      userId,
      matcher: r.matcher,
      categoryId: byName.get(r.category) ?? fallback,
      priority: r.matcher.length,
    })),
  });
  await prisma.userStats.create({ data: { userId, points: 0, level: 1 } });
}
