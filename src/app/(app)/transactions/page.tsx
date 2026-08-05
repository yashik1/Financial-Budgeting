import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getTransactions, getUsedTags, type TxnFilters } from "@/lib/queries";
import { safeCurrency } from "@/lib/money";
import { kindLabel } from "@/lib/accountTypes";
import { TransactionList } from "@/components/app/TransactionList";
import type { TxnItem } from "@/components/app/TransactionItem";
import type { CatOption } from "@/components/app/CategorySelect";
import { Upload, Download, Search, X, Tag } from "lucide-react";

type SP = {
  category?: string;
  account?: string;
  atype?: string;
  q?: string;
  tag?: string;
  type?: string;
  from?: string;
  to?: string;
};

function qs(sp: SP, patch: Partial<SP>): string {
  const merged: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) merged[k] = String(v);
  const s = new URLSearchParams(merged).toString();
  return s ? `/transactions?${s}` : "/transactions";
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const currency = safeCurrency(user.currency);
  const sp = await searchParams;

  const filters: TxnFilters = {
    categoryId: sp.category || undefined,
    accountId: sp.account || undefined,
    accountType: sp.atype || undefined,
    search: sp.q || undefined,
    tag: sp.tag || undefined,
    type: (sp.type as TxnFilters["type"]) || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
    limit: 300,
  };

  const [txns, categories, accounts, usedTags] = await Promise.all([
    getTransactions(user.id, filters),
    prisma.category.findMany({ where: { userId: user.id }, orderBy: { sort: "asc" } }),
    prisma.account.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    getUsedTags(user.id),
  ]);

  const catOptions: CatOption[] = categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon, parentId: c.parentId }));
  const tops = categories.filter((c) => !c.parentId);
  const childrenOf = new Map<string, typeof categories>();
  for (const c of categories) if (c.parentId) childrenOf.set(c.parentId, [...(childrenOf.get(c.parentId) ?? []), c]);
  const accountTypes = [...new Set(accounts.map((a) => a.type))];
  const tagNames = usedTags.map((t) => t.tag);
  const activeFilters = Object.values(sp).filter(Boolean).length;

  const txnItems: TxnItem[] = txns.map((t) => ({
    id: t.id,
    merchant: t.merchant,
    dateISO: new Date(t.date).toISOString(),
    amountCents: t.amountCents,
    categoryId: t.categoryId,
    categoryIcon: t.category?.icon ?? "❓",
    categoryColor: t.category?.color ?? "#7A879C",
    accountName: t.account.name,
    isTransfer: t.isTransfer,
    notes: t.notes,
    tags: t.tags,
  }));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted">Filter, edit, tag — or <strong>Select</strong> to edit many at once</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={qs(sp, {}).replace("/transactions", "/transactions/export")} className="btn-ghost">
            <Download className="h-4 w-4" /> Export CSV
          </a>
          <Link href="/accounts/import" className="btn-primary">
            <Upload className="h-4 w-4" /> Import CSV
          </Link>
        </div>
      </header>

      {/* Filters */}
      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" method="get">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="label" htmlFor="q">Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted" />
            <input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Merchant or description" className="input pl-8" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="type">Type</label>
          <select id="type" name="type" defaultValue={sp.type ?? ""} className="input">
            <option value="">All</option>
            <option value="out">Expenses</option>
            <option value="in">Income</option>
            <option value="transfer">Transfers</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue={sp.category ?? ""} className="input">
            <option value="">All categories</option>
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
        <div>
          <label className="label" htmlFor="tag">Tag</label>
          <input id="tag" name="tag" defaultValue={sp.tag ?? ""} placeholder="e.g. reimbursable" className="input" />
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
        <div>
          <label className="label" htmlFor="atype">Account type</label>
          <select id="atype" name="atype" defaultValue={sp.atype ?? ""} className="input">
            <option value="">All</option>
            {accountTypes.map((t) => (
              <option key={t} value={t}>{kindLabel(t)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="from">From</label>
          <input id="from" name="from" type="date" defaultValue={sp.from ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="to">To</label>
          <input id="to" name="to" type="date" defaultValue={sp.to ?? ""} className="input" />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button className="btn-primary">Apply filters</button>
          {activeFilters > 0 && (
            <Link href="/transactions" className="btn-ghost">
              <X className="h-4 w-4" /> Clear ({activeFilters})
            </Link>
          )}
        </div>
      </form>

      {/* Tags in use */}
      {tagNames.length > 0 && (
        <div className="card flex flex-wrap items-center gap-2 p-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <Tag className="h-3.5 w-3.5" /> Tags in use
          </span>
          {usedTags.map((t) => {
            const active = sp.tag === t.tag;
            return (
              <Link
                key={t.tag}
                href={active ? qs(sp, { tag: "" }) : qs(sp, { tag: t.tag })}
                className={`chip transition ${active ? "bg-brand text-white" : "bg-brand-soft text-brand hover:brightness-95"}`}
                aria-pressed={active}
              >
                #{t.tag}
                <span className={active ? "text-white/70" : "text-brand/60"}>{t.count}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* List + bulk edit */}
      <TransactionList txns={txnItems} categories={catOptions} currency={currency} knownTags={tagNames} />
    </div>
  );
}
