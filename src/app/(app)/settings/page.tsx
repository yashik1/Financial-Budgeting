import { requireUser } from "@/lib/session";
import { safeCurrency, formatCents } from "@/lib/money";
import { countryName } from "@/lib/accountTypes";
import { CurrencyPicker } from "@/components/app/CurrencyPicker";
import { CountryPicker } from "@/components/app/CountryPicker";
import { ThemePicker } from "@/components/app/ThemePicker";
import { Coins, Globe, Palette } from "lucide-react";

export default async function SettingsPage() {
  const user = await requireUser();
  const currency = safeCurrency(user.currency);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-sm text-muted">Make FinBud yours.</p>
      </header>

      <section className="card space-y-4 p-5" aria-label="Appearance">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
            <Palette className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold">Theme</h2>
            <p className="text-sm text-muted">Pick a look. Each works in light and dark (use the ☀/☾ toggle).</p>
          </div>
        </div>
        <ThemePicker />
      </section>

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

      <section className="card space-y-4 p-5" aria-label="Country">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
            <Globe className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold">Home country</h2>
            <p className="text-sm text-muted">Sets which account types you see first (RRSP, 401(k), ISA…).</p>
          </div>
        </div>

        <CountryPicker current={user.country ?? ""} />

        <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
          {user.country
            ? `New accounts default to ${countryName(user.country)} — you can still pick any country per account.`
            : "Pick a country to surface its registered accounts. You can always choose a different country on any single account."}
        </p>
      </section>
    </div>
  );
}
