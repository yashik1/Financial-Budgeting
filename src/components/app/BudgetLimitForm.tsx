"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { setBudgetLimit } from "@/app/(app)/actions";
import { centsToInput, currencySymbol } from "@/lib/money";

export function BudgetLimitForm({
  categoryId,
  month,
  limitCents,
  currency = "USD",
}: {
  categoryId: string;
  month: string;
  limitCents: number;
  currency?: string;
}) {
  const [value, setValue] = useState(limitCents ? centsToInput(limitCents) : "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    start(async () => {
      const res = await setBudgetLimit(categoryId, month, value || "0");
      if (res && res.ok === false) {
        setError(res.error ?? "Couldn’t save that limit.");
        setSaved(false);
        return;
      }
      setError(null);
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
      className="relative flex items-center gap-1"
    >
      <span className="text-muted">{currencySymbol(currency)}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        onBlur={submit}
        placeholder="0"
        aria-invalid={error ? true : undefined}
        className={`w-20 rounded-lg border bg-surface px-2 py-1 text-right text-sm tabular focus:outline-none focus-visible:ring-2 ${
          error ? "border-negative focus-visible:ring-negative/50" : "border-border focus-visible:ring-brand/50"
        }`}
      />
      <button
        type="submit"
        disabled={pending}
        aria-label="Save limit"
        className={`grid h-7 w-7 place-items-center rounded-lg border border-border transition ${saved ? "bg-positive text-white" : "bg-surface text-muted hover:text-fg"}`}
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      {error && (
        <p role="alert" className="absolute right-0 top-full z-10 mt-1 w-60 rounded-lg border border-negative/40 bg-surface px-2.5 py-1.5 text-[11px] leading-snug text-negative shadow-pop">
          {error}
        </p>
      )}
    </form>
  );
}
