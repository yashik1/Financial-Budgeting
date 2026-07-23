import { requireUser } from "@/lib/session";
import { getGoals } from "@/lib/queries";
import { formatCents, safeCurrency, currencySymbol } from "@/lib/money";
import { createGoal, deleteGoal } from "@/app/(app)/actions";
import { GoalFund } from "@/components/app/GoalFund";
import { Trash2, Sparkles } from "lucide-react";

export default async function GoalsPage() {
  const user = await requireUser();
  const currency = safeCurrency(user.currency);
  const goals = await getGoals(user.id);

  const totalTarget = goals.reduce((s, g) => s + g.targetCents, 0);
  const totalSaved = goals.reduce((s, g) => s + g.savedCents, 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Goals</h1>
          <p className="text-sm text-muted">
            {formatCents(totalSaved, { currency, compact: true })} saved toward {formatCents(totalTarget, { currency, compact: true })}
          </p>
        </div>
      </header>

      {/* Create goal */}
      <form action={createGoal} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="w-16">
          <label className="label" htmlFor="emoji">Icon</label>
          <input id="emoji" name="emoji" defaultValue="🎯" maxLength={2} className="input text-center text-lg" />
        </div>
        <div className="min-w-[10rem] flex-1">
          <label className="label" htmlFor="name">Goal name</label>
          <input id="name" name="name" placeholder="e.g. Emergency Fund" className="input" required />
        </div>
        <div className="w-36">
          <label className="label" htmlFor="target">Target ({currencySymbol(currency)})</label>
          <input id="target" name="target" inputMode="decimal" placeholder="5000" className="input" required />
        </div>
        <button className="btn-primary">
          <Sparkles className="h-4 w-4" /> Add goal
        </button>
      </form>

      {/* Goal cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((g) => {
          const pct = Math.min(100, Math.round((g.savedCents / g.targetCents) * 100));
          const done = g.savedCents >= g.targetCents;
          return (
            <div key={g.id} className="card animate-fade-up p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl text-2xl" style={{ background: `${g.color}22` }}>
                    {g.emoji}
                  </span>
                  <div>
                    <div className="font-bold">{g.name}</div>
                    {done ? (
                      <span className="chip bg-positive/10 text-positive">Funded 🎉</span>
                    ) : (
                      <span className="text-xs text-muted">{pct}% there</span>
                    )}
                  </div>
                </div>
                <form action={deleteGoal.bind(null, g.id)}>
                  <button className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:text-negative" aria-label="Delete goal">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="font-semibold tabular">{formatCents(g.savedCents, { currency })}</span>
                  <span className="text-muted tabular">of {formatCents(g.targetCents, { currency })}</span>
                </div>
                <div className="goal-bar h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: g.color }} />
                </div>
                {/* Almanac theme: a filling jar instead of a bar (CSS-toggled). */}
                <div className="goal-jar mt-1">
                  <svg width="80" height="98" viewBox="0 0 88 108" role="img" aria-label={`${g.name} jar, ${pct}% full`}>
                    <rect x="30" y="4" width="28" height="9" rx="3" fill="rgb(var(--muted))" />
                    <clipPath id={`jar-${g.id}`}>
                      <path d="M20 20 h48 a6 6 0 0 1 6 6 v66 a10 10 0 0 1 -10 10 h-40 a10 10 0 0 1 -10 -10 v-66 a6 6 0 0 1 6 -6 Z" />
                    </clipPath>
                    <path d="M20 20 h48 a6 6 0 0 1 6 6 v66 a10 10 0 0 1 -10 10 h-40 a10 10 0 0 1 -10 -10 v-66 a6 6 0 0 1 6 -6 Z" fill="rgb(var(--surface-2))" stroke="rgb(var(--fg))" strokeWidth="2" />
                    <rect clipPath={`url(#jar-${g.id})`} x="18" y={20 + 78 * (1 - pct / 100)} width="52" height={78 * (pct / 100)} fill={g.color} opacity="0.85" />
                    <path d="M20 20 h48 a6 6 0 0 1 6 6 v66 a10 10 0 0 1 -10 10 h-40 a10 10 0 0 1 -10 -10 v-66 a6 6 0 0 1 6 -6 Z" fill="none" stroke="rgb(var(--fg))" strokeWidth="2" />
                  </svg>
                </div>
              </div>

              {!done && (
                <div className="mt-4">
                  <GoalFund goalId={g.id} currency={currency} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {goals.length === 0 && (
        <div className="card p-12 text-center text-sm text-muted">No goals yet — add your first one above.</div>
      )}
    </div>
  );
}
