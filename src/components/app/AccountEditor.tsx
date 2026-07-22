"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Check, X, Trash2 } from "lucide-react";
import { AccountTypeSelect } from "./AccountTypeSelect";
import { updateAccount, deleteAccount } from "@/app/(app)/actions";
import { centsToInput, currencySymbol } from "@/lib/money";

export type EditableAccount = {
  id: string;
  name: string;
  institution: string;
  type: string;
  subtype: string | null;
  country: string | null;
  balanceCents: number;
  currency: string;
  shared: boolean;
};

function useCurrencyCodes(): string[] {
  return useMemo(() => {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    return typeof fn === "function" ? fn("currency") : ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "INR"];
  }, []);
}

export function AccountEditor({ account }: { account: EditableAccount }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const currencyCodes = useCurrencyCodes();

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
        aria-label={`Edit ${account.name}`}
      >
        <Pencil className="h-4 w-4" />
      </button>
    );
  }

  return (
    <form
      action={(fd) => start(async () => { await updateAccount(fd); setEditing(false); })}
      className="mt-2 grid w-full gap-3 rounded-xl bg-surface-2 p-3 sm:grid-cols-2"
    >
      <input type="hidden" name="id" value={account.id} />
      <div>
        <label className="label">Account name</label>
        <input name="name" defaultValue={account.name} className="input" />
      </div>
      <div>
        <label className="label">Institution</label>
        <input name="institution" defaultValue={account.institution} className="input" />
      </div>

      <div className="sm:col-span-2">
        <AccountTypeSelect
          idPrefix={`edit-${account.id}`}
          country={account.country}
          type={account.type}
          subtype={account.subtype}
        />
      </div>

      <div>
        <label className="label">Current balance ({currencySymbol(account.currency)})</label>
        <input name="balance" inputMode="decimal" defaultValue={centsToInput(account.balanceCents)} className="input" />
      </div>
      <div>
        <label className="label">Currency</label>
        <select name="currency" defaultValue={account.currency} className="input">
          {currencyCodes.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="shared" defaultChecked={account.shared} className="h-4 w-4 rounded border-border accent-brand" />
        Shared with household
      </label>

      <div className="flex items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className="btn-primary">
          <Check className="h-4 w-4" /> Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className="btn-ghost">
          <X className="h-4 w-4" /> Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete “${account.name}” and its transactions? This can’t be undone.`)) {
              start(() => deleteAccount(account.id));
            }
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
