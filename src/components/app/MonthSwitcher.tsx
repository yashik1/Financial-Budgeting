"use client";

import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonthsToKey, currentMonthKey, monthLabel } from "@/lib/dates";

/**
 * Prev/next month pager. Navigates by rewriting the `?month=` query param, so
 * the server component re-renders for the chosen month. "Next" is disabled at
 * the current month (we don't browse the future). Selecting the current month
 * drops the param to keep dashboard URLs clean.
 */
export function MonthSwitcher({ month, basePath }: { month: string; basePath?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const path = basePath ?? pathname;
  const atCurrent = month >= currentMonthKey();

  const go = (delta: number) => {
    const next = addMonthsToKey(month, delta);
    router.push(next >= currentMonthKey() ? path : `${path}?month=${next}`);
  };

  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl border border-border bg-surface p-1">
      <button
        onClick={() => go(-1)}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[8.5rem] px-1 text-center text-sm font-semibold">{monthLabel(month)}</span>
      <button
        onClick={() => go(1)}
        disabled={atCurrent}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted transition enabled:hover:bg-surface-2 enabled:hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
