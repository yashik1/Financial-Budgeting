import { cn } from "@/lib/cn";

export function StatTile({
  label,
  value,
  sub,
  accent = "brand",
  icon,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  accent?: "brand" | "positive" | "negative" | "warning";
  icon?: React.ReactNode;
}) {
  const accentClass = {
    brand: "text-brand",
    positive: "text-positive",
    negative: "text-negative",
    warning: "text-warning",
  }[accent];

  return (
    <div className="card animate-fade-up p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
        {icon && <span className={cn("opacity-80", accentClass)}>{icon}</span>}
      </div>
      <div className="figure mt-2">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

/**
 * One label + amount inside a summary strip (net worth, budget totals, the
 * month forecast).
 *
 * Those strips keep three or four columns across, which leaves each amount
 * about 70px on a small phone — not enough for a real balance. Below `sm` the
 * pair sits on one line with the amount pushed right, so it has the full width
 * of the card; from `sm` up it stacks as before.
 */
export function SummaryStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}) {
  const toneClass = { default: "", positive: "text-positive", negative: "text-negative" }[tone];
  return (
    <div className="flex items-baseline justify-between gap-3 sm:block">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={cn("figure-sm sm:mt-0.5", toneClass)}>{value}</div>
    </div>
  );
}

export function SectionHeader({
  title,
  action,
  hint,
}: {
  title: string;
  action?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
