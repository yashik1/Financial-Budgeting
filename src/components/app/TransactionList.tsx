"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckSquare, Tag, Trash2, X } from "lucide-react";
import { TransactionItem, type TxnItem } from "./TransactionItem";
import { CategoryOptionGroups, type CatOption } from "./CategorySelect";
import type { AccountOption, GoalOption } from "./AddTransactionForm";
import { AddTransactionForm } from "./AddTransactionForm";
import { bulkCategorize, bulkAddTag, bulkDeleteTransactions } from "@/app/(app)/actions";

export function TransactionList({
  txns,
  categories,
  accounts,
  goals,
  currency,
  knownTags,
}: {
  txns: TxnItem[];
  categories: CatOption[];
  accounts: AccountOption[];
  goals: GoalOption[];
  currency?: string;
  knownTags: string[];
}) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tag, setTag] = useState("");
  const [pending, start] = useTransition();

  const ids = useMemo(() => txns.map((t) => t.id), [txns]);
  const allSelected = selected.size > 0 && selected.size === ids.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const clear = () => setSelected(new Set());
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(ids));
  const done = () => { clear(); setTag(""); };

  const chosen = [...selected];
  const runCategorize = (categoryId: string) => start(async () => { await bulkCategorize(chosen, categoryId); done(); });
  const runAddTag = () => {
    const t = tag.trim();
    if (!t) return;
    start(async () => { await bulkAddTag(chosen, t); done(); });
  };
  const runDelete = () => {
    if (confirm(`Delete ${selected.size} transaction${selected.size === 1 ? "" : "s"}? This can't be undone.`))
      start(async () => { await bulkDeleteTransactions(chosen); done(); });
  };

  return (
    <div className="space-y-3">
      <AddTransactionForm accounts={accounts} categories={categories} goals={goals} currency={currency} />

      {/* Select toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{txns.length} shown · tap a category to recategorize, ✏️ to edit</p>
        <button
          onClick={() => { setSelectMode((v) => !v); clear(); }}
          className={`chip transition ${selectMode ? "bg-brand text-white" : "bg-surface-2 text-fg hover:bg-surface"}`}
          aria-pressed={selectMode}
        >
          <CheckSquare className="h-3.5 w-3.5" /> {selectMode ? "Done" : "Select"}
        </button>
      </div>

      {/* Bulk action bar */}
      {selectMode && selected.size > 0 && (
        <div className="card sticky top-2 z-20 flex flex-wrap items-center gap-2 p-3 shadow-pop">
          <span className="chip bg-brand-soft text-brand">{selected.size} selected</span>
          <button onClick={toggleAll} className="btn-ghost px-2.5 py-1 text-xs">
            {allSelected ? "Unselect all" : "Select all"}
          </button>

          <label className="sr-only" htmlFor="bulk-cat">Set category</label>
          <select
            id="bulk-cat"
            defaultValue=""
            disabled={pending}
            onChange={(e) => { if (e.target.value !== "__") runCategorize(e.target.value); e.target.value = "__"; }}
            className="input h-9 w-auto py-1 text-sm"
          >
            <option value="__">Set category…</option>
            <option value="">❓ Uncategorized</option>
            <CategoryOptionGroups categories={categories} />
          </select>

          <div className="flex items-center gap-1">
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runAddTag(); } }}
              list="bulk-tags"
              placeholder="add tag…"
              className="input h-9 w-28 py-1 text-sm"
            />
            {knownTags.length > 0 && (
              <datalist id="bulk-tags">{knownTags.map((t) => <option key={t} value={t} />)}</datalist>
            )}
            <button onClick={runAddTag} disabled={pending || !tag.trim()} className="btn-ghost px-2.5 py-1 text-xs">
              <Tag className="h-3.5 w-3.5" /> Tag
            </button>
          </div>

          <button onClick={runDelete} disabled={pending} className="btn-ghost px-2.5 py-1 text-xs text-negative">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button onClick={done} className="btn-ghost ml-auto px-2.5 py-1 text-xs">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      )}

      {/* List */}
      <div className="card overflow-hidden">
        <div className="divide-y divide-border">
          {txns.map((t) => (
            <TransactionItem
              key={t.id}
              txn={t}
              categories={categories}
              goals={goals}
              currency={currency}
              knownTags={knownTags}
              selected={selectMode ? selected.has(t.id) : undefined}
              onToggleSelect={selectMode ? () => toggle(t.id) : undefined}
            />
          ))}
          {txns.length === 0 && (
            <p className="px-4 py-12 text-center text-sm text-muted">No transactions match your filters.</p>
          )}
        </div>
      </div>
    </div>
  );
}
