import { requireUser } from "@/lib/session";
import { getHouseholdData } from "@/lib/queries";
import { formatCents, safeCurrency } from "@/lib/money";
import { monthLabel, currentMonthKey } from "@/lib/dates";
import { StatTile, SectionHeader } from "@/components/ui/StatTile";
import { CategoryDonut } from "@/components/charts/CategoryDonut";
import { PrivacyToggle } from "@/components/app/PrivacyToggle";
import {
  createHousehold,
  inviteMember,
  acceptInvite,
  declineInvite,
  cancelInvite,
  leaveHousehold,
} from "./actions";
import { Users, UserPlus, LogOut, Wallet, TrendingUp, TrendingDown, PiggyBank, X } from "lucide-react";

export default async function HouseholdPage() {
  const user = await requireUser();
  const currency = safeCurrency(user.currency);
  const data = await getHouseholdData(user.id);
  if (!data) return null;

  // The demo user is shared by every "Try the demo" visitor, so sharing is off.
  if (user.isDemo) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Header />
        <div className="card space-y-2 p-6">
          <div className="flex items-center gap-2 font-bold">👫 Shared households</div>
          <p className="text-sm text-muted">
            Household sharing is disabled for the demo account (it’s shared by everyone trying the
            demo). To try it, <span className="font-semibold text-fg">sign up with a real account</span>,
            create a household, and invite your partner by email — you’ll see a combined view of both
            people’s money, with per-account privacy controls.
          </p>
        </div>
      </div>
    );
  }

  const month = monthLabel(currentMonthKey());

  // ---- Not in a household yet ----
  if (!data.inHousehold) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Header />

        {data.invites.length > 0 && (
          <section className="card p-5">
            <SectionHeader title="Your invitations" />
            <ul className="space-y-2">
              {data.invites.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft">👋</span>
                  <div className="min-w-0 flex-1 text-sm">
                    You’re invited to join <span className="font-semibold">{inv.household.name}</span>.
                  </div>
                  <form action={acceptInvite.bind(null, inv.id)}>
                    <button className="btn-primary px-3 py-1.5 text-sm">Accept</button>
                  </form>
                  <form action={declineInvite.bind(null, inv.id)}>
                    <button className="btn-ghost px-3 py-1.5 text-sm">Decline</button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        <form action={createHousehold} className="card space-y-3 p-5">
          <div className="flex items-center gap-2 font-bold">
            <Users className="h-4 w-4 text-brand" /> Start a household
          </div>
          <p className="text-sm text-muted">
            Share a combined view of your money with a partner. Everyone keeps their own accounts and
            budgets — you choose what’s shared vs. private.
          </p>
          <div>
            <label className="label" htmlFor="name">Household name</label>
            <input id="name" name="name" className="input" placeholder="Our Household" />
          </div>
          <button className="btn-primary w-full">Create household</button>
        </form>
      </div>
    );
  }

  // ---- In a household ----
  const { household, members, perPerson, sharedGoals, myAccounts, myGoals, pendingHouseholdInvites } = data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Users className="h-5 w-5 text-brand" /> {household.name}
          </h1>
          <p className="text-sm text-muted">
            {members.map((m) => m.name).join(" · ")} · combined view for {month}
          </p>
        </div>
        <form action={leaveHousehold}>
          <button className="btn-ghost text-negative"><LogOut className="h-4 w-4" /> Leave</button>
        </form>
      </header>

      {/* Combined stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Household net worth" value={formatCents(data.netWorthCents, { currency })} accent="brand" icon={<Wallet className="h-4 w-4" />} sub={`${data.accounts.length} shared accounts`} />
        <StatTile label="Income" value={formatCents(data.incomeCents, { currency })} accent="positive" icon={<TrendingUp className="h-4 w-4" />} sub="this month" />
        <StatTile label="Spending" value={formatCents(data.spendingCents, { currency })} accent="negative" icon={<TrendingDown className="h-4 w-4" />} sub="this month" />
        <StatTile label="Saved" value={formatCents(data.netCents, { currency, signed: true })} accent={data.netCents >= 0 ? "positive" : "negative"} icon={<PiggyBank className="h-4 w-4" />} sub="together" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <SectionHeader title="Combined spending" hint={month} />
            {data.categorySpend.length ? (
              <>
                <CategoryDonut data={data.categorySpend} currency={currency} />
                <ul className="mt-3 space-y-1.5">
                  {data.categorySpend.slice(0, 6).map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                      <span>{c.icon} {c.name}</span>
                      <span className="ml-auto tabular font-medium">{formatCents(c.cents, { currency, compact: true })}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted">No shared spending yet this month.</p>
            )}
          </section>

          {/* Privacy controls */}
          <section className="card p-5">
            <SectionHeader title="What you share" hint="Toggle any of your accounts or goals private" />
            <div className="divide-y divide-border">
              {myAccounts.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2.5">
                  <span className="h-6 w-1.5 rounded-full" style={{ background: a.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.name}</div>
                    <div className="text-xs text-muted">{a.institution} · {formatCents(a.balanceCents, { currency })}</div>
                  </div>
                  <PrivacyToggle id={a.id} shared={a.shared} kind="account" />
                </div>
              ))}
              {myGoals.map((g) => (
                <div key={g.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `${g.color}22` }}>{g.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{g.name}</div>
                    <div className="text-xs text-muted">Goal · {formatCents(g.savedCents, { currency, compact: true })} saved</div>
                  </div>
                  <PrivacyToggle id={g.id} shared={g.shared} kind="goal" />
                </div>
              ))}
              {myAccounts.length === 0 && myGoals.length === 0 && (
                <p className="py-6 text-center text-sm text-muted">You don’t have any accounts or goals yet.</p>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {/* Per-person */}
          <section className="card p-5">
            <SectionHeader title="Per person" hint={month} />
            <ul className="space-y-3">
              {perPerson.map((p) => {
                const net = p.incomeCents - p.spentCents;
                return (
                  <li key={p.id} className="rounded-xl bg-surface-2 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{p.name}{p.isYou && <span className="ml-1 text-xs text-muted">(you)</span>}</span>
                      <span className={`tabular ${net >= 0 ? "text-positive" : "text-negative"}`}>{formatCents(net, { currency, signed: true })}</span>
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted">
                      <span>In {formatCents(p.incomeCents, { currency, compact: true })}</span>
                      <span>Out {formatCents(p.spentCents, { currency, compact: true })}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Shared goals */}
          <section className="card p-5">
            <SectionHeader title="Shared goals" />
            {sharedGoals.length ? (
              <ul className="space-y-3">
                {sharedGoals.map((g) => {
                  const pct = Math.min(100, Math.round((g.savedCents / g.targetCents) * 100));
                  return (
                    <li key={g.id}>
                      <div className="mb-1 flex items-center gap-2 text-sm">
                        <span>{g.emoji} {g.name}</span>
                        <span className="ml-auto text-xs text-muted">{g.ownerName} · {pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: g.color }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-4 text-center text-sm text-muted">No shared goals.</p>
            )}
          </section>

          {/* Invite */}
          <section className="card p-5">
            <SectionHeader title="Invite someone" />
            <form action={inviteMember} className="flex items-center gap-2">
              <input name="email" type="email" required placeholder="partner@email.com" className="input" />
              <button className="btn-primary shrink-0"><UserPlus className="h-4 w-4" /></button>
            </form>
            {pendingHouseholdInvites.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {pendingHouseholdInvites.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-2 text-sm text-muted">
                    <span className="truncate">{inv.email}</span>
                    <span className="chip bg-surface-2 text-muted">pending</span>
                    <form action={cancelInvite.bind(null, inv.id)} className="ml-auto">
                      <button className="grid h-6 w-6 place-items-center rounded-md text-muted hover:text-negative" aria-label="Cancel invite">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted">They accept from their own account’s Household page.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header>
      <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
        <Users className="h-5 w-5 text-brand" /> Household
      </h1>
      <p className="text-sm text-muted">Share a combined money view with a partner.</p>
    </header>
  );
}
