"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { setUserCurrency } from "@/app/(app)/actions";

/** Every currency the runtime can format, labeled with its display name. */
function useCurrencies() {
  return useMemo(() => {
    const codes: string[] =
      typeof (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf === "function"
        ? (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("currency")
        : ["USD", "EUR", "GBP", "JPY", "INR", "CAD", "AUD", "CHF", "CNY", "BRL", "ZAR"];
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames(["en"], { type: "currency" });
    } catch {
      names = null;
    }
    return codes.map((code) => ({ code, name: names?.of(code) ?? code }));
  }, []);
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      <Check className="h-4 w-4" /> {pending ? "Saving…" : "Save currency"}
    </button>
  );
}

export function CurrencyPicker({ current }: { current: string }) {
  const currencies = useCurrencies();
  const [value, setValue] = useState(current);

  return (
    <form action={setUserCurrency} className="flex flex-wrap items-end gap-3">
      <div className="w-full flex-1 sm:w-auto sm:min-w-[16rem]">
        <label className="label" htmlFor="currency">Display currency</label>
        <select
          id="currency"
          name="currency"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input"
        >
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      </div>
      <SaveButton />
    </form>
  );
}
