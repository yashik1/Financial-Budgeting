import { requireUser } from "@/lib/session";
import { safeCurrency, formatCents } from "@/lib/money";
import { CurrencyPicker } from "@/components/app/CurrencyPicker";
import { Coins } from "lucide-react";

export default async function SettingsPage() {
  const user = await requireUser();
  const currency = safeCurrency(user.currency);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-sm text-muted">Make FinBud yours.</p>
      </header>

      <section className="card space-y-4 p-5" aria-label="Currency">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
            <Coins className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold">Currency</h2>
            <p className="text-sm text-muted">Pick from every currency your device supports.</p>
          </div>
        </div>

        <CurrencyPicker current={currency} />

        <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
          Amounts show in this currency everywhere — for example{" "}
          <span className="font-semibold text-fg">{formatCents(123456, { currency })}</span>. FinBud doesn’t convert
          exchange rates, so this changes how figures are displayed, not their underlying value.
        </p>
      </section>
    </div>
  );
}
