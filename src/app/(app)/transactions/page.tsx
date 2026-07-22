import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getTransactions } from "@/lib/queries";
import { formatCents } from "@/lib/money";
import { CategorySelect } from "@/components/app/CategorySelect";
import { Upload, Search } from "lucide-react";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; account?: string; q?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const [txns, categories, accounts] = await Promise.all([
    getTransactions(user.id, { categoryId: sp.category, accountId: sp.account, search: sp.q, limit: 300 }),
    prisma.category.findMany({ where: { userId: user.id }, orderBy: { sort: "asc" } }),
    prisma.account.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
  ]);

  const catOptions = categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon }));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted">{txns.length} shown · tap a category to recategorize</p>
        </div>
        <Link href="/accounts/import" className="btn-primary">
          <Upload className="h-4 w-4" /> Import CSV
        </Link>
      </header>

      {/* Filters */}
      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="min-w-[12rem] flex-1">
          <label className="label" htmlFor="q">Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted" />
            <input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Merchant or description" className="input pl-8" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue={sp.category ?? ""} className="input">
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="account">Account</label>
          <select id="account" name="account" defaultValue={sp.account ?? ""} className="input">
            <option value="">All</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <button className="btn-ghost">Apply</button>
      </form>

      {/* List */}
      <div className="card overflow-hidden">
        <div className="divide-y divide-border">
          {txns.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface-2/50">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${t.category?.color ?? "#7A879C"}22` }}>
                {t.category?.icon ?? "❓"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{t.merchant}</div>
                <div className="truncate text-xs text-muted">
                  {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {t.account.name}
                  {t.isTransfer && <span className="ml-1 chip bg-surface-2 text-muted">transfer</span>}
                </div>
              </div>
              <CategorySelect txnId={t.id} value={t.categoryId} categories={catOptions} />
              <div className={`w-24 shrink-0 text-right font-semibold tabular ${t.amountCents >= 0 ? "text-positive" : "text-fg"}`}>
                {formatCents(t.amountCents, { signed: true })}
              </div>
            </div>
          ))}
          {txns.length === 0 && (
            <p className="px-4 py-12 text-center text-sm text-muted">No transactions match your filters.</p>
          )}
        </div>
      </div>
    </div>
  );
}
