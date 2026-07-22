import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getDashboard, getGoals } from "@/lib/queries";
import { formatCents } from "@/lib/money";
import { monthLabel } from "@/lib/dates";
import { StatTile, SectionHeader } from "@/components/ui/StatTile";
import { MascotCard } from "@/components/app/MascotCard";
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

export default async function DashboardPage() {
  const user = await requireUser();
  const [dash, goals] = await Promise.all([getDashboard(user.id), getGoals(user.id)]);
  const { accounts, overview, trend, cashflow, game, mascot, challenge } = dash;

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
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {greeting()}, {firstName} 👋
          </h1>
          <p className="text-sm text-muted">Here’s your money at a glance · {monthLabel(overview.month)}</p>
        </div>
        <div className="chip bg-brand-soft text-brand">Health score {overview.health}/100</div>
      </header>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Net worth" value={formatCents(accounts.netWorthCents)} accent="brand" icon={<Wallet className="h-4 w-4" />} sub={`${accounts.accounts.length} accounts`} />
        <StatTile label="Income" value={formatCents(overview.incomeCents)} accent="positive" icon={<TrendingUp className="h-4 w-4" />} sub="this month" />
        <StatTile label="Spending" value={formatCents(overview.spendingCents)} accent="negative" icon={<TrendingDown className="h-4 w-4" />} sub="this month" />
        <StatTile
          label="Saved"
          value={formatCents(overview.netCents, { signed: true })}
          accent={overview.netCents >= 0 ? "positive" : "negative"}
          icon={<PiggyBank className="h-4 w-4" />}
          sub={overview.incomeCents > 0 ? `${Math.round((overview.netCents / overview.incomeCents) * 100)}% of income` : "—"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left / main column */}
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <SectionHeader title="Net worth" hint="Last 6 months" />
            <NetWorthChart data={trend} />
          </section>

          <section className="card p-5">
            <SectionHeader title="Cash flow" hint="Income vs spending" />
            <CashflowChart data={cashflow} />
          </section>

          <section className="card p-5">
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
                budgetRows.map((r) => <BudgetRow key={r.categoryId} row={r} />)
              ) : (
                <p className="py-6 text-center text-sm text-muted">No budgets yet.</p>
              )}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <MascotCard mascot={mascot} streak={game.stats.savingsStreak} challenge={challenge} />

          <section className="card p-5">
            <SectionHeader title="Where it went" hint={monthLabel(overview.month)} />
            <CategoryDonut data={overview.categorySpend} />
            <ul className="mt-3 space-y-1.5">
              {overview.categorySpend.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                  <span>{c.icon} {c.name}</span>
                  <span className="ml-auto tabular font-medium">{formatCents(c.cents, { compact: true })}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5">
            <SectionHeader
              title="Achievements"
              action={<span className="chip bg-surface-2 text-muted">{game.unlockedCount}/{game.totalCount}</span>}
            />
            <div className="flex flex-wrap gap-2">
              {game.achievements.map((a) => (
                <span
                  key={a.key}
                  title={`${a.name} — ${a.description}`}
                  className={`grid h-11 w-11 place-items-center rounded-xl text-xl ${a.unlocked ? "bg-brand-soft" : "bg-surface-2 opacity-40 grayscale"}`}
                >
                  {a.emoji}
                </span>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <SectionHeader
              title="Goals"
              action={<Link href="/goals" className="chip text-brand hover:underline">All <ArrowRight className="h-3.5 w-3.5" /></Link>}
            />
            <ul className="space-y-3">
              {goals.slice(0, 3).map((g) => {
                const pct = Math.min(100, Math.round((g.savedCents / g.targetCents) * 100));
                return (
                  <li key={g.id}>
                    <div className="mb-1 flex items-center gap-2 text-sm">
                      <span>{g.emoji} {g.name}</span>
                      <span className="ml-auto tabular text-muted">{pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: g.color }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
