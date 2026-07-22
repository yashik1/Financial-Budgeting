"use client";

import { useState } from "react";
import { COUNTRIES, KINDS, countryName, kindLabel, subtypesFor } from "@/lib/accountTypes";

/**
 * Cascading country → kind → subtype picker. Emits three form fields
 * (`country`, `type`, `subtype`) so `addManualAccount` / `updateAccount` can
 * read them directly. Subtypes are filtered to the chosen country + kind, so
 * e.g. Canada + Investment surfaces RRSP/TFSA/FHSA.
 */
export function AccountTypeSelect({
  country,
  type,
  subtype,
  idPrefix = "acct",
}: {
  country?: string | null;
  type?: string | null;
  subtype?: string | null;
  idPrefix?: string;
}) {
  const [c, setC] = useState(country ?? "");
  const [kind, setKind] = useState(type ?? "checking");
  const [sub, setSub] = useState(subtype ?? "");

  const subs = subtypesFor(c || null, kind);
  const subValue = subs.some((s) => s.code === sub) ? sub : "";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <label className="label" htmlFor={`${idPrefix}-country`}>Country</label>
        <select
          id={`${idPrefix}-country`}
          name="country"
          value={c}
          onChange={(e) => setC(e.target.value)}
          className="input"
        >
          <option value="">🌐 Global / none</option>
          {COUNTRIES.map((code) => (
            <option key={code} value={code}>
              {countryName(code)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor={`${idPrefix}-type`}>Type</label>
        <select
          id={`${idPrefix}-type`}
          name="type"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setSub(""); // subtype list changes with kind
          }}
          className="input"
        >
          {KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.icon} {k.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor={`${idPrefix}-subtype`}>
          Product <span className="normal-case text-muted">(optional)</span>
        </label>
        <select
          id={`${idPrefix}-subtype`}
          name="subtype"
          value={subValue}
          onChange={(e) => setSub(e.target.value)}
          className="input"
          disabled={subs.length === 0}
        >
          <option value="">Plain {kindLabel(kind).toLowerCase()}</option>
          {subs.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
