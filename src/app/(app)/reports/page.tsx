import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getReports } from "@/lib/queries";
import { formatCents, safeCurrency } from "@/lib/money";
import { monthLabel, shortMonthLabel } from "@/lib/dates";
import { StatTile, SectionHeader } from "@/components/ui/StatTile";
import { CashflowChart } from "@/components/charts/CashflowChart";
import { NetWorthChart } from "@/components/charts/NetWorthChart";
import { TrendingUp, TrendingDown, PiggyBank, Scale, ArrowUpRight, ArrowDownRight } from "lucide-react";

const RANGES = [3, 6, 12] as const;

function safeMonths(input: string | undefined): number {
  const n = Number(input);
  return (RANGES as readonly number[]).includes(n) ? n : 6;
}

/** "▲ 18%" / "▼ 4%" / "new" for a category's latest month vs its baseline. */
function ChangeChip({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="chip bg-surface-2 text-muted">—</span>;
  if (pct === 0) return <span className="chip bg-surface-2 text-muted">flat</span>;
  const up = pct > 0;
  return (
    <span className={`chip ${up ? "bg-negative/10 text-negative" : "bg-positive/10 text-positive"}`}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {Math.abs(pct)}%
    </span>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ months?: string }> }) {
  const user = await requireUser();
  const currency = safeCurrency(user.currency);
  const sp = await searchParams;
  const months = safeMonths(sp.months);

  const { rows, totals, trend, merchants, netWorthTrend, assetsCents, liabilitiesCents, netWorthCents } = await getReports(
    user.id,
    months,
  );

  const savingsPct = Math.round(totals.savingsRate * 100);
  const worthMax = Math.max(1, assetsCents, liabilitiesCents);
  const merchantMax = Math.max(1, ...merchants.map((m) => m.totalCents));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Reports</h1>
          <p className="text-sm text-muted">
            {rows.length ? `${monthLabel(rows[0].month)} — ${monthLabel(rows[rows.length - 1].month)}` : "No data yet"}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1" role="group" aria-label="Report range">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/reports?months=${r}`}
              aria-current={r === months ? "true" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                r === months ? "bg-brand text-white shadow-glow" : "text-muted hover:text-fg"
              }`}
            >
              {r}m
            </Link>
          ))}
        </div>
      </header>

      {/* Period totals */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={`Income · ${months}m`}
          value={formatCents(totals.incomeCents, { currency, compact: true })}
          accent="positive"
          icon={<TrendingUp className="h-4 w-4" />}
          sub={`${formatCents(totals.avgIncomeCents, { currency, compact: true })}/mo avg`}
        />
        <StatTile
          label={`Spending · ${months}m`}
          value={formatCents(totals.spendingCents, { currency, compact: true })}
          accent="negative"
          icon={<TrendingDown className="h-4 w-4" />}
          sub={`${formatCents(totals.avgSpendingCents, { currency, compact: true })}/mo avg`}
        />
        <StatTile
          label="Saved"
          value={formatCents(totals.netCents, { currency, signed: true, compact: true })}
          accent={totals.netCents >= 0 ? "positive" : "negative"}
          icon={<PiggyBank className="h-4 w-4" />}
          sub={`${savingsPct}% savings rate`}
        />
        <StatTile
          label="Net worth"
          value={formatCents(netWorthCents, { currency, compact: true })}
          accent="brand"
          icon={<Scale className="h-4 w-4" />}
          sub="assets − liabilities"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5" aria-label="Income versus spending">
            <SectionHeader title="Income vs spending" hint={`Last ${months} months`} />
            <CashflowChart data={rows} currency={currency} />
          </section>

          <section className="card p-5" aria-label="Net worth trend">
            <SectionHeader title="Net worth over time" hint={`Last ${months} months`} />
            <NetWorthChart data={netWorthTrend} currency={currency} />
          </section>

          <section className="card p-5" aria-label="Category trends">
            <SectionHeader title="Where it goes" hint="Latest month vs the period average" />
            {trend.length ? (
              <ul className="space-y-3">
                {trend.map((c) => {
                  // Scaled to the category's own peak: a small category's shape
                  // stays readable next to a big one. Absolute size is in the numbers.
                  const rowMax = Math.max(1, ...c.byMonth);
                  return (
                  <li key={c.categoryId}>
                    <div className="mb-1.5 flex items-center gap-2 text-sm">
                      <span className="truncate">{c.icon} {c.name}</span>
                      <ChangeChip pct={c.changePct} />
                      <span className="ml-auto tabular font-medium">
                        {formatCents(c.totalCents, { currency, compact: true })}
                      </span>
                      <span className="tabular text-xs text-muted">
                        {formatCents(c.avgCents, { currency, compact: true })}/mo
                      </span>
                    </div>
                    {/* Per-month spend, so a spike is visible without a chart library. */}
                    <div className="flex h-8 items-end gap-1" aria-hidden>
                      {c.byMonth.map((cents, i) => (
                        <div
                          key={rows[i]?.month ?? i}
                          title={`${shortMonthLabel(rows[i].month)}: ${formatCents(cents, { currency })}`}
                          className="flex-1 rounded-t transition-all"
                          style={{
                            height: `${Math.max(3, (cents / rowMax) * 100)}%`,
                            background: c.color,
                            opacity: i === c.byMonth.length - 1 ? 1 : 0.45,
                          }}
                        />
                      ))}
                    </div>
                  </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted">No spending in this range.</p>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5" aria-label="Monthly summary">
            <SectionHeader title="Month by month" hint="Saved per month" />
            <ul className="divide-y divide-border text-sm">
              {rows.map((r) => (
                <li key={r.month} className="flex items-center justify-between py-2">
                  <span>{monthLabel(r.month)}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted">
                      {r.incomeCents > 0 ? `${Math.round(r.savingsRate * 100)}%` : "—"}
                    </span>
                    <span className={`tabular font-medium ${r.netCents >= 0 ? "text-positive" : "text-negative"}`}>
                      {formatCents(r.netCents, { currency, signed: true, compact: true })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {totals.bestMonth && totals.worstMonth && (
              <p className="mt-3 text-xs text-muted">
                Best month {monthLabel(totals.bestMonth.month)} · toughest {monthLabel(totals.worstMonth.month)}
              </p>
            )}
          </section>

          <section className="card p-5" aria-label="Assets versus liabilities">
            <SectionHeader title="Assets vs liabilities" />
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="text-muted">Assets</span>
                  <span className="tabular font-semibold text-positive">
                    {formatCents(assetsCents, { currency, compact: true })}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-positive" style={{ width: `${(assetsCents / worthMax) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="text-muted">Liabilities</span>
                  <span className="tabular font-semibold text-negative">
                    {formatCents(liabilitiesCents, { currency, compact: true })}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-negative"
                    style={{ width: `${(liabilitiesCents / worthMax) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <p className="mt-3 border-t border-border pt-3 text-sm">
              <span className="text-muted">Net worth</span>
              <span className="float-right tabular font-bold">{formatCents(netWorthCents, { currency })}</span>
            </p>
          </section>

          <section className="card p-5" aria-label="Top merchants">
            <SectionHeader title="Top merchants" hint={`Last ${months} months`} />
            {merchants.length ? (
              <ul className="space-y-2.5">
                {merchants.map((m) => (
                  <li key={m.merchant}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="truncate pr-2">{m.merchant}</span>
                      <span className="tabular font-medium">{formatCents(m.totalCents, { currency, compact: true })}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${(m.totalCents / merchantMax) * 100}%` }} />
                      </div>
                      <span className="text-xs text-muted">{m.count}×</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted">No spending in this range.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
