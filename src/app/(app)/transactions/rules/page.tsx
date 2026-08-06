import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createRule } from "@/app/(app)/actions";
import { RuleList, type RuleRow } from "@/components/app/RuleList";
import { ArrowLeft, Plus } from "lucide-react";

export default async function RulesPage() {
  const user = await requireUser();
  const [rules, categories] = await Promise.all([
    prisma.rule.findMany({
      where: { userId: user.id },
      include: { category: { select: { name: true, icon: true, color: true } } },
      orderBy: { matcher: "asc" },
    }),
    prisma.category.findMany({ where: { userId: user.id }, orderBy: { sort: "asc" } }),
  ]);

  const toRow = (r: (typeof rules)[number]): RuleRow => ({
    id: r.id,
    matcher: r.matcher,
    categoryName: r.category.name,
    categoryIcon: r.category.icon,
    categoryColor: r.category.color,
  });
  const mine = rules.filter((r) => !r.builtIn).map(toRow);
  const builtIn = rules.filter((r) => r.builtIn).map(toRow);

  const tops = categories.filter((c) => !c.parentId);
  const childrenOf = new Map<string, typeof categories>();
  for (const c of categories) if (c.parentId) childrenOf.set(c.parentId, [...(childrenOf.get(c.parentId) ?? []), c]);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href="/transactions" className="chip text-brand hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Transactions
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">Categorization rules</h1>
        <p className="text-sm text-muted">
          Teach FinBud where things belong. If a merchant name contains your keyword, the category sticks — on every
          import, sync, and manual entry from then on.
        </p>
      </header>

      <form action={createRule} className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="label" htmlFor="matcher">When the merchant contains</label>
          <input id="matcher" name="matcher" placeholder="e.g. shell" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="categoryId">Categorize it as</label>
          <select id="categoryId" name="categoryId" className="input" required defaultValue="">
            <option value="" disabled>Choose a category…</option>
            {tops.map((t) => {
              const kids = childrenOf.get(t.id) ?? [];
              return (
                <optgroup key={t.id} label={`${t.icon} ${t.name}`}>
                  <option value={t.id}>{t.icon} {t.name}</option>
                  {kids.map((c) => (
                    <option key={c.id} value={c.id}>&nbsp;&nbsp;{c.icon} {c.name}</option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn-primary w-full">
            <Plus className="h-4 w-4" /> Add rule
          </button>
        </div>
      </form>

      <RuleList rules={mine} />

      {builtIn.length > 0 && (
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            {builtIn.length} built-in rules
            <span className="ml-2 font-normal text-muted">FinBud ships with these — your own rules win over them</span>
          </summary>
          <ul className="mt-3 flex flex-wrap gap-2">
            {builtIn.map((r) => (
              <li key={r.id} className="chip bg-surface-2 text-muted">
                <code>{r.matcher}</code> → {r.categoryIcon} {r.categoryName}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
