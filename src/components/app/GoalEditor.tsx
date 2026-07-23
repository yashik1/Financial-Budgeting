"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X, Trash2 } from "lucide-react";
import { updateGoal, deleteGoal } from "@/app/(app)/actions";
import { centsToInput, currencySymbol } from "@/lib/money";

export type EditableGoal = {
  id: string;
  name: string;
  emoji: string;
  targetCents: number;
  deadline: string | null; // ISO date (yyyy-mm-dd) or null
  accountId: string | null;
};

export function GoalEditor({
  goal,
  accounts,
  currency = "USD",
}: {
  goal: EditableGoal;
  accounts: { id: string; name: string }[];
  currency?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
        aria-label={`Edit ${goal.name}`}
      >
        <Pencil className="h-4 w-4" />
      </button>
    );
  }

  return (
    <form
      action={(fd) => start(async () => { await updateGoal(fd); setEditing(false); })}
      className="mt-4 grid gap-3 rounded-xl bg-surface-2 p-3"
    >
      <input type="hidden" name="id" value={goal.id} />
      <div className="grid grid-cols-[3.5rem_1fr] gap-2">
        <div>
          <label className="label">Icon</label>
          <input name="emoji" defaultValue={goal.emoji} maxLength={2} className="input text-center text-lg" />
        </div>
        <div>
          <label className="label">Goal name</label>
          <input name="name" defaultValue={goal.name} className="input" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Target ({currencySymbol(currency)})</label>
          <input name="target" inputMode="decimal" defaultValue={centsToInput(goal.targetCents)} className="input" />
        </div>
        <div>
          <label className="label">Target date</label>
          <input type="date" name="deadline" defaultValue={goal.deadline ?? ""} className="input" />
        </div>
      </div>
      <div>
        <label className="label">Funded by account</label>
        <select name="accountId" defaultValue={goal.accountId ?? ""} className="input">
          <option value="">Not linked</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          <Check className="h-4 w-4" /> Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className="btn-ghost">
          <X className="h-4 w-4" /> Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete the “${goal.name}” goal?`)) start(() => deleteGoal(goal.id));
          }}
          disabled={pending}
          className="btn-ghost ml-auto text-negative"
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>
    </form>
  );
}
