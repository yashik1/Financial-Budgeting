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
      <div className="mt-2 text-2xl font-extrabold tabular">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
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
