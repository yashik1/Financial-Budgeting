"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X, ChevronDown } from "lucide-react";
import { addManualTransaction } from "@/app/(app)/actions";
import { currencySymbol } from "@/lib/money";
import { CategoryOptionGroups, type CatOption } from "./CategorySelect";

export type AccountOption = { id: string; label: string };
export type GoalOption = { id: string; emoji: string; name: string };

const TYPES = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer_out", label: "Transfer — money out" },
  { value: "transfer_in", label: "Transfer — money in" },
];

export function AddTransactionForm({
  accounts,
  categories,
  goals,
  currency = "USD",
}: {
  accounts: AccountOption[];
  categories: CatOption[];
  goals: GoalOption[];
  currency?: string;
}) {
  const [open, setOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="h-4 w-4" /> Add transaction
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={(fd) =>
        start(async () => {
          await addManualTransaction(fd);
          formRef.current?.reset();
          setOpen(false);
          setAdvanced(false);
        })
      }
      className="card space-y-3 p-4"
      aria-label="Add a transaction"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="label" htmlFor="atx-account">Account</label>
          <select id="atx-account" name="accountId" required className="input">
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="atx-type">Type</label>
          <select id="atx-type" name="type" defaultValue="expense" className="input">
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="atx-merchant">Description</label>
          <input id="atx-merchant" name="merchant" placeholder="e.g. Whole Foods" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="atx-category">Category</label>
          <select id="atx-category" name="categoryId" defaultValue="" className="input">
            <option value="">Auto-detect</option>
            <CategoryOptionGroups categories={categories} />
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="atx-amount">Amount ({currencySymbol(currency)})</label>
            <input id="atx-amount" name="amount" inputMode="decimal" placeholder="0.00" className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="atx-date">Date</label>
            <input id="atx-date" type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
          </div>
        </div>
      </div>

      <details className="group" open={advanced} onToggle={(e) => setAdvanced(e.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-brand [&::-webkit-details-marker]:hidden">
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
          Advanced options
        </summary>
        <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="atx-tags">Tags <span className="normal-case text-muted">(comma-separated)</span></label>
            <input id="atx-tags" name="tags" placeholder="e.g. work, reimbursable" className="input" autoComplete="off" />
          </div>
          <div>
            <label className="label" htmlFor="atx-notes">Notes</label>
            <input id="atx-notes" name="notes" placeholder="Add a note…" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="atx-goal">Goal contribution</label>
            <select id="atx-goal" name="goalId" defaultValue="" className="input">
              <option value="">None</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="excludeFromBudget" className="h-4 w-4 rounded border-border accent-brand" />
              Exclude from budget
            </label>
          </div>
        </div>
      </details>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          <Plus className="h-4 w-4" /> {pending ? "Adding…" : "Add transaction"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
          <X className="h-4 w-4" /> Cancel
        </button>
      </div>
    </form>
  );
}
