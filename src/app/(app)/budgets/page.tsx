import { requireUser } from "@/lib/session";
import { getBudgetView, type BudgetRow } from "@/lib/queries";
import { formatCents } from "@/lib/money";
import { monthLabel } from "@/lib/dates";
import { BudgetLimitForm } from "@/components/app/BudgetLimitForm";
import { AddSubcategory } from "@/components/app/AddSubcategory";
import { cn } from "@/lib/cn";

function Row({ row, month, child }: { row: BudgetRow; month: string; child?: boolean }) {
  const remaining = row.limitCents - row.spentCents;
  const barColor = row.over ? "bg-negative" : row.pct > 85 ? "bg-warning" : "bg-positive";
  return (
    <div className={cn("flex flex-wrap items-center gap-3 py-2.5", child && "pl-6")}>
      <span
        className={cn("grid place-items-center rounded-lg", child ? "h-7 w-7 text-sm" : "h-9 w-9")}
        style={{ background: `${row.color}1f` }}
      >
        {row.icon}
      </span>
      <div className="min-w-[8rem] flex-1">
        <div className={cn("font-medium", child && "text-sm")}>{row.name}</div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${Math.min(100, row.pct)}%` }} />
        </div>
        <div className={cn("mt-1 text-[11px]", row.over ? "text-negative" : "text-muted")}>
          {formatCents(row.spentCents, { compact: true })} spent
          {row.limitCents > 0 &&
            (row.over
              ? ` · ${formatCents(-remaining, { compact: true })} over`
              : ` · ${formatCents(remaining, { compact: true })} left`)}
        </div>
      </div>
      <BudgetLimitForm categoryId={row.categoryId} month={month} limitCents={row.limitCents} />
    </div>
  );
}

export default async function BudgetsPage() {
  const user = await requireUser();
  const view = await getBudgetView(user.id);
  const s = view.summary;
  const leftover = view.incomeCents - s.budgetedCents;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted">Envelope budgeting with subcategories · {monthLabel(view.month)}</p>
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
          {s.overCount > 0
            ? `${s.overCount} categor${s.overCount === 1 ? "y is" : "ies are"} over budget.`
            : "Everything within budget — nice."}
        </p>
      </div>

      {/* Category groups (parents with subcategories) */}
      <div className="space-y-3">
        {view.groups.map((g) => (
          <div key={g.parent.categoryId} className="card px-4 py-2">
            <Row row={g.parent} month={view.month} />
            {g.children.length > 0 && (
              <div className="divide-y divide-border border-t border-border">
                {g.children.map((c) => (
                  <Row key={c.categoryId} row={c} month={view.month} child />
                ))}
              </div>
            )}
            <div className="border-t border-border py-2 pl-6">
              <AddSubcategory parentId={g.parent.categoryId} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
