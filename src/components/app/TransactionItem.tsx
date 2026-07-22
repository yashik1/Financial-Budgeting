"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, StickyNote, Check, X } from "lucide-react";
import { CategorySelect, type CatOption } from "./CategorySelect";
import { updateTransaction, deleteTransaction } from "@/app/(app)/actions";
import { formatCents, centsToInput } from "@/lib/money";

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
};

export function TransactionItem({ txn, categories }: { txn: TxnItem; categories: CatOption[] }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const dateVal = txn.dateISO.slice(0, 10);
  const income = txn.amountCents >= 0;

  return (
    <div className="px-4 py-3 hover:bg-surface-2/40">
      <div className="flex flex-wrap items-center gap-3">
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
          {formatCents(txn.amountCents, { signed: true })}
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
          className="mt-3 grid gap-3 rounded-xl bg-surface-2 p-3 sm:grid-cols-2"
        >
          <input type="hidden" name="id" value={txn.id} />
          <div>
            <label className="label">Merchant</label>
            <input name="merchant" defaultValue={txn.merchant} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Type</label>
              <select name="flow" defaultValue={income ? "in" : "out"} className="input">
                <option value="out">Expense</option>
                <option value="in">Income</option>
              </select>
            </div>
            <div>
              <label className="label">Amount ($)</label>
              <input name="amount" inputMode="decimal" defaultValue={centsToInput(txn.amountCents)} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" name="date" defaultValue={dateVal} className="input" />
          </div>
          <div>
            <label className="label">Notes</label>
            <input name="notes" defaultValue={txn.notes ?? ""} placeholder="Add a note…" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Tags <span className="normal-case text-muted">(comma-separated)</span></label>
            <input name="tags" defaultValue={txn.tags.join(", ")} placeholder="e.g. work, reimbursable, vacation" className="input" />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
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
