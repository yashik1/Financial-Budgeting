"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { setBudgetLimit } from "@/app/(app)/actions";
import { currencySymbol } from "@/lib/money";

export type UnallocatedOption = { id: string; name: string; icon: string };

export function AddBudgetAllocation({
  month,
  options,
  currency = "USD",
}: {
  month: string;
  options: UnallocatedOption[];
  currency?: string;
}) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (options.length === 0) return null;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="h-4 w-4" /> Add allocation
      </button>
    );
  }

  const submit = () => {
    if (!categoryId) {
      setError("Pick a category first.");
      return;
    }
    start(async () => {
      const res = await setBudgetLimit(categoryId, month, amount || "0");
      if (res && res.ok === false) {
        setError(res.error ?? "Couldn’t save that limit.");
        return;
      }
      setError(null);
      setOpen(false);
      setCategoryId("");
      setAmount("");
    });
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      className="card flex flex-wrap items-end gap-3 p-4"
      aria-label="Add a budget allocation"
    >
      <div className="min-w-[12rem] flex-1">
        <label className="label" htmlFor="alloc-cat">Category</label>
        <select
          id="alloc-cat"
          value={categoryId}
          onChange={(e) => { setCategoryId(e.target.value); setError(null); }}
          className="input"
        >
          <option value="" disabled>Choose a category…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.icon} {o.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="alloc-amount">Monthly limit ({currencySymbol(currency)})</label>
        <input
          id="alloc-amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0"
          className="input w-32"
        />
      </div>
      <button type="submit" disabled={pending} className="btn-primary">
        <Plus className="h-4 w-4" /> {pending ? "Adding…" : "Add"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
        <X className="h-4 w-4" /> Cancel
      </button>
      {error && <p role="alert" className="w-full text-xs text-negative">{error}</p>}
    </form>
  );
}
