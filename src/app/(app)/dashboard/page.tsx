import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getDashboard, getGoals, getForecast, type MoneyDelta } from "@/lib/queries";
import { formatCents, safeCurrency } from "@/lib/money";
import { addMonthsToKey, monthLabel, safeMonthKey } from "@/lib/dates";
import { StatTile, SectionHeader } from "@/components/ui/StatTile";
import { MascotCard } from "@/components/app/MascotCard";
import { MonthSwitcher } from "@/components/app/MonthSwitcher";
import { MonthComparison } from "@/components/app/MonthComparison";
import { BudgetRow, type BudgetRowData } from "@/components/app/BudgetRow";
import { NetWorthChart } from "@/components/charts/NetWorthChart";
import { CashflowChart } from "@/components/charts/CashflowChart";
import { CategoryDonut } from "@/components/charts/CategoryDonut";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, ArrowRight } from "lucide-react";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Short "▲ 12% vs baseline" sub-label for a stat tile. */
function deltaSub(d: MoneyDelta, baseline: string): string {
  if (d.previousCents === 0) return d.currentCents === 0 ? "—" : "new this month";
  const pct = Math.round((d.deltaCents / Math.abs(d.previousCents)) * 100);
  if (pct === 0) return `same as ${baseline}`;
  return `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs ${baseline}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; compare?: string }>;
}) {
  const user = await requireUser();
  const currency = safeCurrency(user.currency);
  const sp = await searchParams;
  const month = safeMonthKey(sp.month);
  // Baseline for the comparison; anything invalid falls back to the previous month.
  const compare = safeMonthKey(sp.compare, addMonthsToKey(month, -1));
  const [dash, goals, forecast] = await Promise.all([
    getDashboard(user.id, month, compare, currency),
    getGoals(user.id),
    getForecast(user.id, month),
  ]);
  const { accounts, overview, trend, cashflow, game, mascot, challenge, comparison } = dash;
  const baselineLabel = comparison.prevMonth === addMonthsToKey(month, -1) ? "last month" : monthLabel(comparison.prevMonth);

  const budgetRows: BudgetRowData[] = overview.progress
    .map((p) => {
      const meta = overview.catMap.get(p.categoryId);
      return {
        categoryId: p.categoryId,
        name: meta?.name ?? "Category",
        icon: meta?.icon ?? "💸",
        color: meta?.color ?? "#635BFF",
        spentCents: p.spentCents,
        limitCents: p.limitCents,
        pct: p.pct,
        over: p.over,
      };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {greeting()}, {firstName} 👋
          </h1>
          <p className="text-sm text-muted">Here’s your money at a glance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip bg-brand-soft text-brand">Health score {overview.health}/100</span>
          <MonthSwitcher month={month} basePath="/dashboard" />
        </div>
      </header>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Net worth" value={formatCents(accounts.netWorthCents, { currency })} accent="brand" icon={<Wallet className="h-4 w-4" />} sub={`${accounts.accounts.length} accounts`} />
        <StatTile label="Income" value={formatCents(overview.incomeCents, { currency })} accent="positive" icon={<TrendingUp className="h-4 w-4" />} sub={deltaSub(comparison.income, baselineLabel)} />
        <StatTile label="Spending" value={formatCents(overview.spendingCents, { currency })} accent="negative" icon={<TrendingDown className="h-4 w-4" />} sub={deltaSub(comparison.spending, baselineLabel)} />
        <StatTile
          label="Saved"
          value={formatCents(overview.netCents, { currency, signed: true })}
          accent={overview.netCents >= 0 ? "positive" : "negative"}
          icon={<PiggyBank className="h-4 w-4" />}
          sub={overview.incomeCents > 0 ? `${Math.round((overview.netCents / overview.incomeCents) * 100)}% of income` : "—"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left / main column: analysis */}
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5" aria-label="Net worth trend">
            <SectionHeader title="Net worth" hint="Last 6 months" />
            <NetWorthChart data={trend} currency={currency} />
          </section>

          <section className="card p-5" aria-label="Cash flow">
            <SectionHeader title="Cash flow" hint="Income vs spending" />
            <CashflowChart data={cashflow} currency={currency} />
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="card p-5" aria-label="Budget progress">
              <SectionHeader
                title="Budget progress"
                action={
                  <Link href="/budgets" className="chip text-brand hover:underline">
                    All budgets <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
              <div className="divide-y divide-border">
                {budgetRows.length ? (
                  budgetRows.map((r) => <BudgetRow key={r.categoryId} row={r} currency={currency} />)
                ) : (
                  <p className="py-6 text-center text-sm text-muted">No budgets yet.</p>
                )}
              </div>
            </section>

            <section className="card p-5" aria-label="Spending by category">
              <SectionHeader title="Where it went" hint={monthLabel(overview.month)} />
              <CategoryDonut data={overview.categorySpend} currency={currency} />
              <ul className="mt-3 space-y-1.5">
                {overview.categorySpend.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
                    <span>{c.icon} {c.name}</span>
                    <span className="ml-auto tabular font-medium">{formatCents(c.cents, { currency, compact: true })}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        {/* Right column: coach, insights, motivation */}
        <div className="space-y-6">
          <MascotCard mascot={mascot} streak={game.stats.savingsStreak} challenge={challenge} currency={currency} />

          <section className="card p-5" aria-label="Monthly insights">
            <SectionHeader title="Monthly insights" hint={monthLabel(overview.month)} />
            <MonthComparison data={comparison} currency={currency} />
          </section>

          <section className="card p-5" aria-label="Month-end forecast">
            <SectionHeader
              title="Where you'll land"
              hint={forecast.daysLeft > 0 ? `${forecast.daysLeft} days left in ${monthLabel(overview.month)}` : monthLabel(overview.month)}
              action={
                <Link href="/calendar" className="chip text-brand hover:underline">
                  Calendar <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <p className={`text-2xl font-extrabold tabular ${forecast.projectedNetCents >= 0 ? "text-positive" : "text-negative"}`}>
              {formatCents(forecast.projectedNetCents, { currency, signed: true })}
            </p>
            <p className="mt-1 text-xs text-muted">projected saved at month end</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-muted">Bills still due</span>
                <span className="tabular font-medium">{formatCents(forecast.upcomingBillsCents, { currency, compact: true })}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted">Typical spending left</span>
                <span className="tabular font-medium">{formatCents(forecast.estimatedVariableCents, { currency, compact: true })}</span>
              </li>
            </ul>
          </section>

          <section className="card p-5" aria-label="Goals">
            <SectionHeader
              title="Goals"
              action={<Link href="/goals" className="chip text-brand hover:underline">All <ArrowRight className="h-3.5 w-3.5" /></Link>}
            />
            <ul className="space-y-3">
              {goals.slice(0, 3).map((g) => {
                const pct = Math.min(100, Math.round((g.fundedCents / g.targetCents) * 100));
                return (
                  <li key={g.id}>
                    <div className="mb-1 flex items-center gap-2 text-sm">
                      <span>{g.emoji} {g.name}</span>
                      <span className="ml-auto tabular text-muted">{pct}%</span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-surface-2"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${g.name} progress`}
                    >
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: g.color }} />
                    </div>
                    {g.projection?.etaMonth && pct < 100 && (
                      <p className="mt-1 text-xs text-muted">Projected {monthLabel(g.projection.etaMonth)}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card p-5" aria-label="Achievements">
            <SectionHeader
              title="Achievements"
              action={<span className="chip bg-surface-2 text-muted">{game.unlockedCount}/{game.totalCount}</span>}
            />
            <div className="flex flex-wrap gap-2">
              {game.achievements.map((a) => (
                <span
                  key={a.key}
                  title={`${a.name} — ${a.description}`}
                  aria-label={`${a.name}${a.unlocked ? ", unlocked" : ", locked"}: ${a.description}`}
                  role="img"
                  className={`grid h-11 w-11 place-items-center rounded-xl text-xl ${a.unlocked ? "bg-brand-soft" : "bg-surface-2 opacity-40 grayscale"}`}
                >
                  {a.emoji}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
