import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getSubscriptions } from "@/lib/queries";
import { formatCents, safeCurrency } from "@/lib/money";
import { monthlyCents, CADENCE_LABEL } from "@/lib/recurring";
import { CategoryDonut } from "@/components/charts/CategoryDonut";
import { SectionHeader } from "@/components/ui/StatTile";
import { ArrowLeft, Repeat } from "lucide-react";

export default async function SubscriptionsPage() {
  const user = await requireUser();
  const currency = safeCurrency(user.currency);
  const { subscriptions, upcoming, monthlyTotalCents, groups } = await getSubscriptions(user.id);

  const donutData = groups.map((g) => ({ id: g.categoryId, name: g.name, icon: g.icon, color: g.color, cents: g.monthlyCents }));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/calendar" className="chip text-brand hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Calendar
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">Subscriptions</h1>
        <p className="text-sm text-muted">
          {subscriptions.length} tracked · about {formatCents(monthlyTotalCents, { currency, compact: true })}/month —
          spotted automatically from your history, no setup needed.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5" aria-label="All tracked subscriptions">
            <SectionHeader title="All subscriptions" hint={`${subscriptions.length} tracked`} />
            {subscriptions.length ? (
              <ul className="divide-y divide-border">
                {subscriptions.map((s) => (
                  <li key={s.key} className="flex items-center gap-3 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2">
                      <Repeat className="h-4 w-4 text-muted" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{s.merchant}</div>
                      <div className="text-xs text-muted">
                        {CADENCE_LABEL[s.cadence]} · next {s.nextDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold tabular">{formatCents(s.amountCents, { currency })}</div>
                      <div className="text-[11px] text-muted tabular">
                        {formatCents(Math.abs(monthlyCents(s)), { currency, compact: true })}/mo
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-muted">
                Nothing detected yet — subscriptions show up once a charge repeats a few times.
              </p>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5" aria-label="Upcoming charges">
            <SectionHeader title="Upcoming charges" hint="Next 60 days" />
            {upcoming.length ? (
              <ul className="divide-y divide-border text-sm">
                {upcoming.map((u, i) => (
                  <li key={`${u.series.key}-${i}`} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{u.series.merchant}</div>
                      <div className="text-xs text-muted">{u.date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</div>
                    </div>
                    <span className="shrink-0 tabular font-medium">{formatCents(u.series.amountCents, { currency, compact: true })}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted">No charges due in the next 60 days.</p>
            )}
          </section>

          <section className="card p-5" aria-label="Spending groups">
            <SectionHeader title="Spending groups" hint="By category" />
            {groups.length ? (
              <>
                <CategoryDonut data={donutData} currency={currency} />
                <ul className="mt-3 space-y-1.5">
                  {groups.map((g) => (
                    <li key={g.categoryId} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} aria-hidden />
                      <span>{g.icon} {g.name}</span>
                      <span className="text-xs text-muted">{g.count}×</span>
                      <span className="ml-auto tabular font-medium">{formatCents(g.monthlyCents, { currency, compact: true })}/mo</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="py-6 text-center text-sm text-muted">No subscriptions to group yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
