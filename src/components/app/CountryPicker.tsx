"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { setUserCountry } from "@/app/(app)/actions";
import { COUNTRIES, countryName } from "@/lib/accountTypes";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      <Check className="h-4 w-4" /> {pending ? "Saving…" : "Save country"}
    </button>
  );
}

export function CountryPicker({ current }: { current: string }) {
  const [value, setValue] = useState(current);
  return (
    <form action={setUserCountry} className="flex flex-wrap items-end gap-3">
      <div className="w-full flex-1 sm:w-auto sm:min-w-[16rem]">
        <label className="label" htmlFor="country">Home country</label>
        <select
          id="country"
          name="country"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input"
        >
          <option value="">🌐 Not set</option>
          {COUNTRIES.map((code) => (
            <option key={code} value={code}>
              {countryName(code)}
            </option>
          ))}
        </select>
      </div>
      <SaveButton />
    </form>
  );
}
