"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { setBudgetLimit } from "@/app/(app)/actions";
import { centsToInput } from "@/lib/money";

export function BudgetLimitForm({
  categoryId,
  month,
  limitCents,
}: {
  categoryId: string;
  month: string;
  limitCents: number;
}) {
  const [value, setValue] = useState(limitCents ? centsToInput(limitCents) : "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const submit = () => {
    start(async () => {
      await setBudgetLimit(categoryId, month, value || "0");
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-center gap-1"
    >
      <span className="text-muted">$</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={submit}
        placeholder="0"
        className="w-20 rounded-lg border border-border bg-surface px-2 py-1 text-right text-sm tabular focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
      />
      <button
        type="submit"
        disabled={pending}
        aria-label="Save limit"
        className={`grid h-7 w-7 place-items-center rounded-lg border border-border transition ${saved ? "bg-positive text-white" : "bg-surface text-muted hover:text-fg"}`}
      >
        <Check className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
