import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getBudgetView, getUncategorizedForMonth, type BudgetRow } from "@/lib/queries";
import { formatCents, safeCurrency } from "@/lib/money";
import { monthLabel, safeMonthKey } from "@/lib/dates";
import { BudgetLimitForm } from "@/components/app/BudgetLimitForm";
import { AddBudgetAllocation } from "@/components/app/AddBudgetAllocation";
import { RemoveBudgetAllocationButton } from "@/components/app/RemoveBudgetAllocationButton";
import { AddSubcategory } from "@/components/app/AddSubcategory";
import { DeleteSubcategoryButton } from "@/components/app/DeleteSubcategoryButton";
import { MonthSwitcher } from "@/components/app/MonthSwitcher";
import { CategorySelect, type CatOption } from "@/components/app/CategorySelect";
import { cn } from "@/lib/cn";
import { ChevronRight } from "lucide-react";

function Row({
  row,
  month,
  currency,
  child,
  compact,
}: {
  row: BudgetRow;
  month: string;
  currency: string;
  child?: boolean;
  /** No inline limit editor — just spend, for the "not yet allocated" list. */
  compact?: boolean;
}) {
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
        {!compact && (
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${Math.min(100, row.pct)}%` }} />
          </div>
        )}
        <div className={cn("mt-1 text-[11px]", row.over ? "text-negative" : "text-muted")}>
          {formatCents(row.spentCents, { currency, compact: true })} spent
          {row.limitCents > 0 &&
            (row.over
              ? ` · ${formatCents(-remaining, { currency, compact: true })} over`
              : ` · ${formatCents(remaining, { currency, compact: true })} left`)}
        </div>
      </div>
      <BudgetLimitForm categoryId={row.categoryId} month={month} limitCents={row.limitCents} currency={currency} />
      {row.hasLine && <RemoveBudgetAllocationButton categoryId={row.categoryId} month={month} name={row.name} />}
      {child && <DeleteSubcategoryButton categoryId={row.categoryId} name={row.name} />}
    </div>
  );
}

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const currency = safeCurrency(user.currency);
  const sp = await searchParams;
  const month = safeMonthKey(sp.month);

  const [view, uncategorized, cats] = await Promise.all([
    getBudgetView(user.id, month),
    getUncategorizedForMonth(user.id, month),
    prisma.category.findMany({ where: { userId: user.id }, orderBy: { sort: "asc" } }),
  ]);
  const catOptions: CatOption[] = cats.map((c) => ({ id: c.id, name: c.name, icon: c.icon, parentId: c.parentId }));
  const s = view.summary;
  const leftover = view.incomeCents - s.budgetedCents;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted">Envelope budgeting — allocate a category to start tracking it</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddBudgetAllocation month={month} options={view.unallocated} currency={currency} />
          <MonthSwitcher month={month} basePath="/budgets" />
        </div>
      </header>

      {/* Summary */}
      <div className="card p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Budgeted</div>
            <div className="text-xl font-extrabold tabular">{formatCents(s.budgetedCents, { currency })}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Spent</div>
            <div className="text-xl font-extrabold tabular">{formatCents(s.spentCents, { currency })}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Remaining</div>
            <div className={cn("text-xl font-extrabold tabular", s.remainingCents < 0 ? "text-negative" : "text-positive")}>
              {formatCents(s.remainingCents, { currency })}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Unbudgeted income</div>
            <div className="text-xl font-extrabold tabular">{formatCents(leftover, { currency })}</div>
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

      {/* Category groups (parents with collapsible subcategories) */}
      <div className="space-y-3">
        {view.groups.map((g) => {
          const childTotal = g.children.reduce((sum, c) => sum + c.limitCents, 0);
          const overParent = g.parent.limitCents > 0 && childTotal > g.parent.limitCents;
          return (
            <div key={g.parent.categoryId} className="budget-group card px-4 py-2">
              <Row row={g.parent} month={month} currency={currency} />

              {g.children.length > 0 ? (
                <details className="group border-t border-border">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 py-2 pl-6 text-sm font-medium text-brand [&::-webkit-details-marker]:hidden">
                    <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden />
                    {g.children.length} subcategor{g.children.length === 1 ? "y" : "ies"}
                    <span className="ml-1 font-normal text-muted">
                      · {formatCents(childTotal, { currency, compact: true })} budgeted
                    </span>
                  </summary>
                  <div className="divide-y divide-border border-t border-border">
                    {g.children.map((c) => (
                      <Row key={c.categoryId} row={c} month={month} currency={currency} child />
                    ))}
                  </div>
                  {overParent && (
                    <p role="alert" className="mt-1 pl-6 text-xs text-negative">
                      Subcategories total {formatCents(childTotal, { currency })}, over this budget of{" "}
                      {formatCents(g.parent.limitCents, { currency })}.
                    </p>
                  )}
                  <div className="border-t border-border py-2 pl-6">
                    <AddSubcategory parentId={g.parent.categoryId} />
                  </div>
                </details>
              ) : (
                <div className="border-t border-border py-2 pl-6">
                  <AddSubcategory parentId={g.parent.categoryId} />
                </div>
              )}
            </div>
          );
        })}
        {view.groups.length === 0 && (
          <p className="card p-8 text-center text-sm text-muted">
            No allocations yet — click <strong>Add allocation</strong> above to budget your first category.
          </p>
        )}
      </div>

      {/* Categories with spending this month but no allocation yet */}
      {view.unbudgeted.length > 0 && (
        <div className="card px-4 py-2">
          <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted">Spending without a budget</p>
          <div className="divide-y divide-border">
            {view.unbudgeted.map((row) => (
              <Row key={row.categoryId} row={row} month={month} currency={currency} compact />
            ))}
          </div>
        </div>
      )}

      {/* Uncategorized spending for the month */}
      {uncategorized.count > 0 && (
        <div className="card px-4 py-2">
          <div className="flex flex-wrap items-center gap-3 py-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2 text-lg">❓</span>
            <div className="min-w-[8rem] flex-1">
              <div className="font-medium">Uncategorized</div>
              <div className="mt-0.5 text-[11px] text-muted">
                {formatCents(uncategorized.spentCents, { currency, compact: true })} across {uncategorized.count} transaction
                {uncategorized.count === 1 ? "" : "s"} — not counted in any budget
              </div>
            </div>
          </div>
          <details className="group border-t border-border">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 py-2 pl-6 text-sm font-medium text-brand [&::-webkit-details-marker]:hidden">
              <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden />
              Show &amp; sort these transactions
            </summary>
            <ul className="divide-y divide-border border-t border-border">
              {uncategorized.txns.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-2.5 pl-6">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.merchant}</div>
                    <div className="truncate text-xs text-muted">
                      {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {t.account.name}
                    </div>
                  </div>
                  <div className="w-24 shrink-0 text-right text-sm font-semibold tabular">
                    {formatCents(t.amountCents, { currency, signed: true })}
                  </div>
                  <CategorySelect txnId={t.id} value={t.categoryId} categories={catOptions} />
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
