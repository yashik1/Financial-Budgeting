import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatCents } from "@/lib/money";
import { monthLabel } from "@/lib/dates";
import type { MonthComparison as Comparison, MoneyDelta } from "@/lib/queries";

function pctChange(d: MoneyDelta): number | null {
  if (d.previousCents === 0) return d.currentCents === 0 ? 0 : null; // null = "new" (no base)
  return (d.deltaCents / Math.abs(d.previousCents)) * 100;
}

/** A colored up/down chip. `higherIsBetter` flips what counts as good. */
function DeltaChip({ delta, higherIsBetter }: { delta: MoneyDelta; higherIsBetter: boolean }) {
  const pct = pctChange(delta);
  const up = delta.deltaCents > 0;
  const flat = delta.deltaCents === 0;
  const good = flat ? true : up === higherIsBetter;
  const tone = flat ? "bg-surface-2 text-muted" : good ? "text-positive bg-positive/10" : "text-negative bg-negative/10";
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const label = flat
    ? "no change"
    : pct === null
      ? "new"
      : `${up ? "+" : "−"}${Math.abs(Math.round(pct))}%`;
  return (
    <span className={`chip inline-flex items-center gap-1 ${tone}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

const METRICS: { key: "income" | "spending" | "net"; label: string; higherIsBetter: boolean }[] = [
  { key: "income", label: "Income", higherIsBetter: true },
  { key: "spending", label: "Spending", higherIsBetter: false },
  { key: "net", label: "Saved", higherIsBetter: true },
];

export function MonthComparison({ data }: { data: Comparison }) {
  const movers = data.movers.slice(0, 4);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Compared with {monthLabel(data.prevMonth)}</p>

      <div className="grid grid-cols-3 gap-3">
        {METRICS.map((m) => {
          const d = data[m.key];
          return (
            <div key={m.key} className="rounded-xl bg-surface-2 p-2.5">
              <p className="text-xs text-muted">{m.label}</p>
              <p className="mt-0.5 text-base font-bold tabular">
                {formatCents(d.currentCents, { signed: m.key === "net", compact: true })}
              </p>
              <div className="mt-1.5">
                <DeltaChip delta={d} higherIsBetter={m.higherIsBetter} />
              </div>
            </div>
          );
        })}
      </div>

      {movers.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Biggest movers</p>
          <ul className="space-y-2">
            {movers.map((c) => {
              const up = c.deltaCents > 0;
              return (
                <li key={c.id} className="flex items-center gap-2.5 text-sm">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm" style={{ background: `${c.color}1f` }}>
                    {c.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className={`tabular text-xs font-semibold ${up ? "text-negative" : "text-positive"}`}>
                    {up ? "+" : "−"}
                    {formatCents(Math.abs(c.deltaCents), { compact: true })}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
