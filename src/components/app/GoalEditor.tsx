"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X, Trash2 } from "lucide-react";
import { updateGoal, deleteGoal } from "@/app/(app)/actions";
import { centsToInput, currencySymbol } from "@/lib/money";
import { accountTypeLabel } from "@/lib/accountTypes";

export type EditableGoal = {
  id: string;
  name: string;
  emoji: string;
  targetCents: number;
  deadline: string | null; // ISO date (yyyy-mm-dd) or null
  accountId: string | null;
};

export type GoalAccountOption = { id: string; name: string; institution: string; type: string; subtype: string | null };

/** Every account (bank or broker), grouped by institution, labeled with its product type. */
export function GoalAccountOptions({ accounts }: { accounts: GoalAccountOption[] }) {
  const byInstitution = new Map<string, GoalAccountOption[]>();
  for (const a of accounts) byInstitution.set(a.institution, [...(byInstitution.get(a.institution) ?? []), a]);
  return (
    <>
      {[...byInstitution.entries()].map(([institution, accts]) => (
        <optgroup key={institution} label={institution}>
          {accts.map((a) => (
            <option key={a.id} value={a.id}>{a.name} — {accountTypeLabel(a)}</option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

export function GoalEditor({
  goal,
  accounts,
  currency = "USD",
}: {
  goal: EditableGoal;
  accounts: GoalAccountOption[];
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
          <option value="">Not linked — fund by tagging transactions instead</option>
          <GoalAccountOptions accounts={accounts} />
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
