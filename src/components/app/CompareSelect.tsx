"use client";

import { useRouter } from "next/navigation";
import { addMonthsToKey, currentMonthKey, monthLabel } from "@/lib/dates";

/**
 * "Compared with" month picker for the insights card. Offers the 12 months
 * before the selected month; picking the default (previous month) drops the
 * `compare` param so plain URLs stay clean.
 */
export function CompareSelect({ month, compare }: { month: string; compare: string }) {
  const router = useRouter();
  const prev = addMonthsToKey(month, -1);
  const options = Array.from({ length: 12 }, (_, i) => addMonthsToKey(month, -(i + 1)));
  const lastYear = addMonthsToKey(month, -12);

  const go = (value: string) => {
    const params = new URLSearchParams();
    if (month !== currentMonthKey()) params.set("month", month);
    if (value !== prev) params.set("compare", value);
    const qs = params.toString();
    router.push(qs ? `/dashboard?${qs}` : "/dashboard");
  };

  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span className="shrink-0">Compared with</span>
      <select
        value={compare}
        onChange={(e) => go(e.target.value)}
        className="input h-9 w-auto min-w-0 py-1.5 pr-8 text-sm font-medium text-fg"
        aria-label="Month to compare against"
      >
        {options.map((m) => (
          <option key={m} value={m}>
            {monthLabel(m)}
            {m === prev ? " (previous)" : m === lastYear ? " (last year)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
