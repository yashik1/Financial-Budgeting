import { requireUser } from "@/lib/session";
import { getCalendarMonth, getForecast } from "@/lib/queries";
import { formatCents, safeCurrency } from "@/lib/money";
import { monthLabel, safeMonthKey } from "@/lib/dates";
import Link from "next/link";
import { monthlyCents, CADENCE_LABEL } from "@/lib/recurring";
import { MonthSwitcher } from "@/components/app/MonthSwitcher";
import { SummaryStat } from "@/components/ui/StatTile";
import { cn } from "@/lib/cn";
import { CalendarDays, Repeat, TrendingUp, ArrowRight } from "lucide-react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const currency = safeCurrency(user.currency);
  const sp = await searchParams;
  const month = safeMonthKey(sp.month);

  const [cal, forecast] = await Promise.all([getCalendarMonth(user.id, month), getForecast(user.id, month)]);

  // Bucket actual + projected items by day-of-month.
  type DayItem = { label: string; amountCents: number; projected: boolean };
  const byDay = new Map<number, DayItem[]>();
  const push = (day: number, item: DayItem) => byDay.set(day, [...(byDay.get(day) ?? []), item]);

  for (const t of cal.txns) {
    push(new Date(t.date).getUTCDate(), {
      label: t.merchant,
      amountCents: t.amountCents,
      projected: false,
    });
  }
  for (const p of cal.projected) {
    push(p.date.getUTCDate(), {
      label: p.series.merchant,
      amountCents: p.series.amountCents,
      projected: true,
    });
  }

  const daysInMonth = cal.end.getUTCDate();
  const firstWeekday = cal.start.getUTCDay();
  const today = new Date();
  const isThisMonth = today.getUTCFullYear() === cal.start.getUTCFullYear() && today.getUTCMonth() === cal.start.getUTCMonth();
  const todayDate = isThisMonth ? today.getUTCDate() : -1;

  const bills = cal.series.filter((s) => s.amountCents < 0);
  const income = cal.series.filter((s) => s.amountCents > 0);
  const monthlyBills = bills.reduce((s, r) => s + Math.abs(monthlyCents(r)), 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted">Bills, subscriptions, and income across {monthLabel(month)}</p>
        </div>
        <MonthSwitcher month={month} basePath="/calendar" />
      </header>

      {/* Forecast strip */}
      <section className="card grid grid-cols-1 gap-2 p-5 sm:grid-cols-4 sm:gap-4" aria-label="Cash-flow forecast">
        <div className="flex items-baseline justify-between gap-3 sm:block">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted">
            <TrendingUp className="h-3.5 w-3.5" /> Projected month end
          </div>
          <div className={cn("figure-sm sm:mt-0.5", forecast.projectedNetCents >= 0 ? "text-positive" : "text-negative")}>
            {formatCents(forecast.projectedNetCents, { currency, signed: true })}
          </div>
        </div>
        <SummaryStat label="Projected income" value={formatCents(forecast.projectedIncomeCents, { currency })} />
        <SummaryStat label="Projected spending" value={formatCents(forecast.projectedSpendingCents, { currency })} />
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">Still to come</div>
          <div className="text-sm">
            <div className="tabular">{formatCents(forecast.upcomingBillsCents, { currency, compact: true })} in bills</div>
            <div className="tabular text-muted">
              + {formatCents(forecast.estimatedVariableCents, { currency, compact: true })} typical spending
            </div>
          </div>
        </div>
      </section>

      {/* Month grid */}
      <section className="card overflow-x-auto p-4" aria-label={`Calendar for ${monthLabel(month)}`}>
        <div className="grid min-w-[44rem] grid-cols-7 gap-1.5">
          {WEEKDAYS.map((d) => (
            <div key={d} className="pb-1 text-center text-xs font-semibold uppercase tracking-wide text-muted">
              {d}
            </div>
          ))}
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const items = byDay.get(day) ?? [];
            const net = items.reduce((s, it) => s + it.amountCents, 0);
            return (
              <div
                key={day}
                className={cn(
                  "min-h-[5.5rem] rounded-lg border p-1.5",
                  day === todayDate ? "border-brand bg-brand-soft/40" : "border-border bg-surface-2/40",
                )}
              >
                <div className="flex items-baseline justify-between">
                  <span className={cn("text-xs font-semibold", day === todayDate && "text-brand")}>{day}</span>
                  {items.length > 0 && (
                    <span className={cn("tabular text-[10px]", net >= 0 ? "text-positive" : "text-muted")}>
                      {formatCents(net, { currency, compact: true, signed: true })}
                    </span>
                  )}
                </div>
                <ul className="mt-1 space-y-0.5">
                  {items.slice(0, 3).map((it, idx) => (
                    <li
                      key={`${day}-${idx}`}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[10px]",
                        it.projected
                          ? "border border-dashed border-border text-muted"
                          : it.amountCents >= 0
                            ? "bg-positive/10 text-positive"
                            : "bg-surface text-fg",
                      )}
                      title={`${it.label} ${formatCents(it.amountCents, { currency, signed: true })}${it.projected ? " (expected)" : ""}`}
                    >
                      {it.label}
                    </li>
                  ))}
                  {items.length > 3 && <li className="px-1 text-[10px] text-muted">+{items.length - 3} more</li>}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-surface ring-1 ring-border" /> Spent
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-positive/30" /> Income
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded border border-dashed border-border" /> Expected (recurring)
          </span>
        </p>
      </section>

      {/* Detected recurring items */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5" aria-label="Recurring bills">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-brand" />
              <h2 className="text-lg font-bold">Bills &amp; subscriptions</h2>
            </div>
            <Link href="/subscriptions" className="chip text-brand hover:underline">
              See all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <p className="mb-3 text-sm text-muted">
            Spotted automatically from your history · about {formatCents(monthlyBills, { currency, compact: true })}/month
          </p>
          <ul className="divide-y divide-border">
            {bills.slice(0, 10).map((s) => (
              <li key={s.key} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.merchant}</div>
                  <div className="text-xs text-muted">
                    {CADENCE_LABEL[s.cadence]} · next {s.nextDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                  </div>
                </div>
                <div className="shrink-0 text-right text-sm font-semibold tabular">
                  {formatCents(s.amountCents, { currency })}
                </div>
              </li>
            ))}
            {bills.length === 0 && <li className="py-6 text-center text-sm text-muted">No recurring bills detected yet.</li>}
          </ul>
        </section>

        <section className="card p-5" aria-label="Recurring income">
          <div className="mb-1 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-positive" />
            <h2 className="text-lg font-bold">Regular income</h2>
          </div>
          <p className="mb-3 text-sm text-muted">Paycheques and other repeating deposits.</p>
          <ul className="divide-y divide-border">
            {income.slice(0, 6).map((s) => (
              <li key={s.key} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.merchant}</div>
                  <div className="text-xs text-muted">
                    {CADENCE_LABEL[s.cadence]} · next {s.nextDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                  </div>
                </div>
                <div className="shrink-0 text-right text-sm font-semibold tabular text-positive">
                  {formatCents(s.amountCents, { currency, signed: true })}
                </div>
              </li>
            ))}
            {income.length === 0 && <li className="py-6 text-center text-sm text-muted">No regular income detected yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
