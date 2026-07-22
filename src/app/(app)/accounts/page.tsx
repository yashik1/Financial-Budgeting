import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getAccountsOverview } from "@/lib/queries";
import { formatCents } from "@/lib/money";
import { addManualAccount, addDemoAccounts } from "@/app/(app)/actions";
import { isPlaidEnabled } from "@/lib/aggregation/plaid";
import { isSnapTradeEnabled } from "@/lib/aggregation/snaptrade";
import { ConnectPanel } from "@/components/app/ConnectPanel";
import { cn } from "@/lib/cn";
import { Upload, Sparkles, PlusCircle } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  credit: "Credit card",
  investment: "Investment",
  cash: "Cash",
  loan: "Loan",
};

export default async function AccountsPage() {
  const user = await requireUser();
  const { accounts, assetsCents, liabilitiesCents, netWorthCents } = await getAccountsOverview(user.id);
  const [plaidCount, snapConn] = await Promise.all([
    prisma.plaidItem.count({ where: { userId: user.id } }),
    prisma.snapTradeConnection.findUnique({ where: { userId: user.id } }),
  ]);

  const byInstitution = new Map<string, typeof accounts>();
  for (const a of accounts) {
    const list = byInstitution.get(a.institution) ?? [];
    list.push(a);
    byInstitution.set(a.institution, list);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted">{accounts.length} connected · demo + CSV today, banks & brokers next</p>
        </div>
        <Link href="/accounts/import" className="btn-ghost"><Upload className="h-4 w-4" /> Import CSV</Link>
      </header>

      {/* Net worth summary */}
      <div className="card grid grid-cols-3 gap-4 p-5">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">Assets</div>
          <div className="text-xl font-extrabold tabular text-positive">{formatCents(assetsCents)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">Liabilities</div>
          <div className="text-xl font-extrabold tabular text-negative">{formatCents(liabilitiesCents)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">Net worth</div>
          <div className="text-xl font-extrabold tabular">{formatCents(netWorthCents)}</div>
        </div>
      </div>

      {/* Accounts grouped by institution */}
      <div className="space-y-4">
        {[...byInstitution.entries()].map(([institution, list]) => (
          <div key={institution} className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-surface-2/50 px-4 py-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-xs font-bold text-white">
                {institution.slice(0, 1)}
              </span>
              <span className="font-semibold">{institution}</span>
            </div>
            <div className="divide-y divide-border">
              {list.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="h-8 w-1.5 rounded-full" style={{ background: a.color }} />
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-muted">{TYPE_LABEL[a.type] ?? a.type} ···· {a.mask}</div>
                  </div>
                  <div className={cn("ml-auto text-right font-semibold tabular", a.balanceCents < 0 ? "text-negative" : "text-fg")}>
                    {formatCents(a.balanceCents)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {accounts.length === 0 && (
          <div className="card p-10 text-center">
            <p className="text-sm text-muted">No accounts yet.</p>
            <form action={addDemoAccounts} className="mt-4">
              <button className="btn-primary"><Sparkles className="h-4 w-4" /> Load demo accounts</button>
            </form>
          </div>
        )}
      </div>

      {/* Connect real institutions (sandbox-ready) */}
      <div>
        <h2 className="mb-1 text-lg font-bold">Connect your institutions</h2>
        <p className="mb-3 text-sm text-muted">
          Same provider interface, real data. Sandbox works with free keys — see the README.
          {!isPlaidEnabled() && !isSnapTradeEnabled() && " Add keys to .env to turn these on."}
        </p>
        <ConnectPanel
          plaidEnabled={isPlaidEnabled()}
          snapEnabled={isSnapTradeEnabled()}
          hasPlaidItems={plaidCount > 0}
          hasSnapConn={!!snapConn}
        />
      </div>

      {/* Add account manually / demo */}
      <div className="grid gap-4 lg:grid-cols-2">
        <form action={addManualAccount} className="card space-y-3 p-5">
          <div className="flex items-center gap-2 font-bold"><PlusCircle className="h-4 w-4 text-brand" /> Add an account manually</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label" htmlFor="name">Account name</label>
              <input id="name" name="name" className="input" placeholder="Everyday Checking" required />
            </div>
            <div>
              <label className="label" htmlFor="institution">Institution</label>
              <input id="institution" name="institution" className="input" placeholder="Chase" />
            </div>
            <div>
              <label className="label" htmlFor="type">Type</label>
              <select id="type" name="type" className="input">
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="credit">Credit card</option>
                <option value="investment">Investment</option>
                <option value="cash">Cash</option>
                <option value="loan">Loan</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label" htmlFor="balance">Current balance ($)</label>
              <input id="balance" name="balance" inputMode="decimal" className="input" placeholder="1000" />
            </div>
          </div>
          <button className="btn-primary w-full">Add account</button>
        </form>

        <div className="card space-y-3 p-5">
          <div className="font-bold">One interface, every source</div>
          <p className="text-sm text-muted">
            Demo, CSV, manual, Plaid, and SnapTrade all implement the same
            <code className="mx-1 rounded bg-surface-2 px-1">AggregationProvider</code>
            seam — so nothing about the app changes when you switch sources.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="chip bg-surface-2 text-muted">🏦 Plaid — banks</span>
            <span className="chip bg-surface-2 text-muted">📈 SnapTrade — brokers</span>
            <span className="chip bg-surface-2 text-muted">📄 CSV / OFX</span>
            <span className="chip bg-surface-2 text-muted">✍️ Manual</span>
          </div>
          <form action={addDemoAccounts}>
            <button className="btn-ghost w-full"><Sparkles className="h-4 w-4" /> Add sample demo accounts</button>
          </form>
        </div>
      </div>
    </div>
  );
}
