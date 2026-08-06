"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil, Trash2, StickyNote, Check, X, ChevronDown, Target, EyeOff } from "lucide-react";
import { CategorySelect, CategoryOptionGroups, type CatOption } from "./CategorySelect";
import { updateTransaction, deleteTransaction } from "@/app/(app)/actions";
import { formatCents, centsToInput, currencySymbol } from "@/lib/money";
import type { GoalOption } from "./AddTransactionForm";

export type TxnItem = {
  id: string;
  merchant: string;
  dateISO: string;
  amountCents: number;
  categoryId: string | null;
  categoryIcon: string;
  categoryColor: string;
  accountName: string;
  isTransfer: boolean;
  notes: string | null;
  tags: string[];
  goalId: string | null;
  goalName: string | null;
  goalEmoji: string | null;
  excludeFromBudget: boolean;
};

const TYPES = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer_out", label: "Transfer — money out" },
  { value: "transfer_in", label: "Transfer — money in" },
];

function typeFor(txn: TxnItem): string {
  if (txn.isTransfer) return txn.amountCents >= 0 ? "transfer_in" : "transfer_out";
  return txn.amountCents >= 0 ? "income" : "expense";
}

export function TransactionItem({
  txn,
  categories,
  goals = [],
  currency,
  knownTags = [],
  selected,
  onToggleSelect,
}: {
  txn: TxnItem;
  categories: CatOption[];
  goals?: GoalOption[];
  currency?: string;
  knownTags?: string[];
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [pending, start] = useTransition();
  const tagsRef = useRef<HTMLInputElement>(null);
  const dateVal = txn.dateISO.slice(0, 10);
  const income = txn.amountCents >= 0;

  // Append an existing tag to the comma-separated input (no duplicates).
  const addTag = (tag: string) => {
    const input = tagsRef.current;
    if (!input) return;
    const have = input.value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!have.includes(tag)) have.push(tag);
    input.value = have.join(", ");
    input.focus();
  };

  // A goal already linked elsewhere still needs to appear as the current selection.
  const goalOptions = txn.goalId && !goals.some((g) => g.id === txn.goalId)
    ? [{ id: txn.goalId, name: txn.goalName ?? "Goal", emoji: txn.goalEmoji ?? "🎯" }, ...goals]
    : goals;

  return (
    <div className={`px-4 py-3 hover:bg-surface-2/40 ${selected ? "bg-brand-soft/50" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={onToggleSelect}
            aria-label={`Select ${txn.merchant}`}
            className="h-4 w-4 shrink-0 rounded border-border accent-brand"
          />
        )}
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${txn.categoryColor}1f` }}>
          {txn.categoryIcon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="truncate">{txn.merchant}</span>
            {txn.notes && <StickyNote className="h-3.5 w-3.5 shrink-0 text-muted" />}
          </div>
          <div className="truncate text-xs text-muted">
            {new Date(txn.dateISO).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {txn.accountName}
            {txn.isTransfer && <span className="ml-1 chip bg-surface-2 text-muted">transfer</span>}
            {txn.goalName && (
              <span className="ml-1 chip bg-brand-soft text-brand">
                <Target className="h-3 w-3" /> {txn.goalEmoji} {txn.goalName}
              </span>
            )}
            {txn.excludeFromBudget && (
              <span className="ml-1 chip bg-surface-2 text-muted">
                <EyeOff className="h-3 w-3" /> off-budget
              </span>
            )}
          </div>
          {txn.notes && !editing && <div className="mt-0.5 truncate text-xs italic text-muted">“{txn.notes}”</div>}
          {txn.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {txn.tags.map((t) => (
                <span key={t} className="chip bg-brand-soft px-2 py-0.5 text-[10px] text-brand">#{t}</span>
              ))}
            </div>
          )}
        </div>
        <CategorySelect txnId={txn.id} value={txn.categoryId} categories={categories} />
        <div className={`w-24 shrink-0 text-right font-semibold tabular ${income ? "text-positive" : "text-fg"}`}>
          {formatCents(txn.amountCents, { currency, signed: true })}
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
          aria-label="Edit transaction"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      {editing && (
        <form
          action={(fd) => start(async () => { await updateTransaction(fd); setEditing(false); })}
          className="mt-3 space-y-3 rounded-xl bg-surface-2 p-3"
        >
          <input type="hidden" name="id" value={txn.id} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="label">Description</label>
              <input name="merchant" defaultValue={txn.merchant} className="input" />
            </div>
            <div>
              <label className="label">Type</label>
              <select name="type" defaultValue={typeFor(txn)} className="input">
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount ({currencySymbol(currency ?? "USD")})</label>
              <input name="amount" inputMode="decimal" defaultValue={centsToInput(txn.amountCents)} className="input" />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" name="date" defaultValue={dateVal} className="input" />
            </div>
            <div>
              <label className="label">Category</label>
              <select name="categoryId" defaultValue={txn.categoryId ?? ""} className="input">
                <option value="">❓ Uncategorized</option>
                <CategoryOptionGroups categories={categories} />
              </select>
            </div>
          </div>

          <details className="group" open={advanced} onToggle={(e) => setAdvanced(e.currentTarget.open)}>
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-brand [&::-webkit-details-marker]:hidden">
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
              Advanced options
            </summary>
            <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="label">Notes</label>
                <input name="notes" defaultValue={txn.notes ?? ""} placeholder="Add a note…" className="input" />
              </div>
              <div className="lg:col-span-2">
                <label className="label">Tags <span className="normal-case text-muted">(comma-separated)</span></label>
                <input
                  ref={tagsRef}
                  name="tags"
                  defaultValue={txn.tags.join(", ")}
                  placeholder="e.g. work, reimbursable, vacation"
                  className="input"
                  autoComplete="off"
                />
                {knownTags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <span className="text-[11px] text-muted">Reuse:</span>
                    {knownTags.slice(0, 12).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => addTag(t)}
                        className="chip bg-surface px-2 py-0.5 text-[11px] text-brand ring-1 ring-border transition hover:bg-brand-soft"
                      >
                        #{t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="label">Goal contribution</label>
                <select name="goalId" defaultValue={txn.goalId ?? ""} className="input">
                  <option value="">None</option>
                  {goalOptions.map((g) => (
                    <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="excludeFromBudget" defaultChecked={txn.excludeFromBudget} className="h-4 w-4 rounded border-border accent-brand" />
                  Exclude from budget
                </label>
              </div>
            </div>
          </details>

          <div className="flex items-center gap-2">
            <button type="submit" disabled={pending} className="btn-primary">
              <Check className="h-4 w-4" /> Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost">
              <X className="h-4 w-4" /> Cancel
            </button>
            <button
              type="button"
              onClick={() => start(() => deleteTransaction(txn.id))}
              disabled={pending}
              className="btn-ghost ml-auto text-negative"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
