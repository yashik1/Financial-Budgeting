import { requireUser } from "@/lib/session";
import { getMonthOverview } from "@/lib/queries";
import { formatCents } from "@/lib/money";
import { monthLabel } from "@/lib/dates";
import { BudgetLimitForm } from "@/components/app/BudgetLimitForm";
import { cn } from "@/lib/cn";

export default async function BudgetsPage() {
  const user = await requireUser();
  const ov = await getMonthOverview(user.id);

  const limitByCat = new Map(ov.budgetLines.map((l) => [l.categoryId, l.limitCents]));
  const categories = [...ov.catMap.values()].filter((c) => c.group !== "Income");

  const rows = categories
    .map((c) => {
      const limitCents = limitByCat.get(c.id) ?? 0;
      const spentCents = ov.spendByCat.get(c.id) ?? 0;
      const pct = limitCents > 0 ? (spentCents / limitCents) * 100 : 0;
      return { ...c, limitCents, spentCents, pct, over: limitCents > 0 && spentCents > limitCents };
    })
    .sort((a, b) => (b.limitCents > 0 ? 1 : 0) - (a.limitCents > 0 ? 1 : 0) || b.spentCents - a.spentCents);

  const s = ov.summary;
  const leftover = ov.incomeCents - s.budgetedCents;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted">Envelope budgeting · {monthLabel(ov.month)}</p>
        </div>
      </header>

      {/* Summary */}
      <div className="card p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Budgeted</div>
            <div className="text-xl font-extrabold tabular">{formatCents(s.budgetedCents)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Spent</div>
            <div className="text-xl font-extrabold tabular">{formatCents(s.spentCents)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Remaining</div>
            <div className={cn("text-xl font-extrabold tabular", s.remainingCents < 0 ? "text-negative" : "text-positive")}>
              {formatCents(s.remainingCents)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Unbudgeted income</div>
            <div className="text-xl font-extrabold tabular">{formatCents(leftover)}</div>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-surface-2">
          <div
            className={cn("h-full rounded-full", s.pctUsed > 100 ? "bg-negative" : s.pctUsed > 85 ? "bg-warning" : "bg-brand")}
            style={{ width: `${Math.min(100, s.pctUsed)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          {s.overCount > 0 ? `${s.overCount} categor${s.overCount === 1 ? "y is" : "ies are"} over budget.` : "Everything within budget — nice."}
        </p>
      </div>

      {/* Category rows */}
      <div className="card divide-y divide-border">
        {rows.map((r) => {
          const remaining = r.limitCents - r.spentCents;
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${r.color}22` }}>{r.icon}</span>
              <div className="min-w-[8rem] flex-1">
                <div className="font-medium">{r.name}</div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={cn("h-full rounded-full", r.over ? "bg-negative" : r.pct > 85 ? "bg-warning" : "bg-positive")}
                    style={{ width: `${Math.min(100, r.pct)}%` }}
                  />
                </div>
                <div className={cn("mt-1 text-[11px]", r.over ? "text-negative" : "text-muted")}>
                  {formatCents(r.spentCents, { compact: true })} spent
                  {r.limitCents > 0 && (r.over ? ` · ${formatCents(-remaining, { compact: true })} over` : ` · ${formatCents(remaining, { compact: true })} left`)}
                </div>
              </div>
              <BudgetLimitForm categoryId={r.id} month={ov.month} limitCents={r.limitCents} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
