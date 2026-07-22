import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/money";

export type BudgetRowData = {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  spentCents: number;
  limitCents: number;
  pct: number;
  over: boolean;
};

export function BudgetRow({ row, currency }: { row: BudgetRowData; currency?: string }) {
  const width = Math.min(100, row.pct);
  const barColor = row.over ? "bg-negative" : row.pct > 85 ? "bg-warning" : "bg-positive";
  const remaining = row.limitCents - row.spentCents;

  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-center gap-2 text-sm">
        <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `${row.color}22` }}>
          {row.icon}
        </span>
        <span className="font-medium">{row.name}</span>
        <span className="ml-auto tabular text-muted">
          <span className="font-semibold text-fg">{formatCents(row.spentCents, { currency, compact: true })}</span>
          {" / "}
          {formatCents(row.limitCents, { currency, compact: true })}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${width}%` }} />
      </div>
      <div className={cn("mt-1 text-[11px]", row.over ? "text-negative" : "text-muted")}>
        {row.over
          ? `${formatCents(-remaining, { currency, compact: true })} over budget`
          : `${formatCents(remaining, { currency, compact: true })} left`}
      </div>
    </div>
  );
}
