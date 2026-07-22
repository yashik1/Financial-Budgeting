"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { fundGoal } from "@/app/(app)/actions";
import { currencySymbol } from "@/lib/money";

export function GoalFund({ goalId, currency = "USD" }: { goalId: string; currency?: string }) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!value) return;
        start(async () => {
          await fundGoal(goalId, value);
          setValue("");
        });
      }}
      className="flex items-center gap-2"
    >
      <div className="relative flex-1">
        <span className="absolute left-2.5 top-1.5 text-sm text-muted">{currencySymbol(currency)}</span>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add funds"
          className="w-full rounded-lg border border-border bg-surface py-1.5 pl-6 pr-2 text-sm tabular focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        />
      </div>
      <button type="submit" disabled={pending || !value} className="btn-primary px-3 py-1.5 text-sm">
        <Plus className="h-4 w-4" />
      </button>
    </form>
  );
}
