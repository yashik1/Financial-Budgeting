// Canonical account-type taxonomy — the account-side companion to categories.ts.
//
// Two levels: a universal **kind** the whole app relies on (asset/liability,
// filtering, icons) and an optional country-specific **subtype** (the tax
// wrapper / product, e.g. Canada's TFSA, the US 401(k), the UK ISA). Country is
// stored per account, defaulting to the user's country. This is reference data,
// so it lives in code (easy to version/localize/extend) while the DB keeps flat
// string columns — no lookup tables, no joins.

export type Kind = "checking" | "savings" | "credit" | "investment" | "cash" | "loan";

export const KINDS: { kind: Kind; label: string; icon: string; isAsset: boolean }[] = [
  { kind: "checking", label: "Checking", icon: "🏦", isAsset: true },
  { kind: "savings", label: "Savings", icon: "🐖", isAsset: true },
  { kind: "credit", label: "Credit card", icon: "💳", isAsset: false },
  { kind: "investment", label: "Investment", icon: "📈", isAsset: true },
  { kind: "cash", label: "Cash", icon: "💵", isAsset: true },
  { kind: "loan", label: "Loan", icon: "📄", isAsset: false },
];

export const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.kind, k.label]));

export function isAssetForKind(kind: string): boolean {
  return !(kind === "credit" || kind === "loan");
}

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}

export type AccountSubtype = {
  code: string;
  label: string; // "TFSA — Tax-Free Savings"; short form is the part before " — "
  kind: Kind;
  country: string; // ISO 3166-1 alpha-2, or "*" for any country
  taxAdvantaged?: boolean;
};

// "*" subtypes appear for every country; the rest are jurisdiction-specific.
export const ACCOUNT_SUBTYPES: AccountSubtype[] = [
  // Generic (any country)
  { code: "brokerage", label: "Brokerage", kind: "investment", country: "*" },
  { code: "retirement", label: "Retirement", kind: "investment", country: "*", taxAdvantaged: true },
  { code: "money_market", label: "Money market", kind: "savings", country: "*" },
  { code: "hysa", label: "High-yield savings", kind: "savings", country: "*" },
  { code: "crypto", label: "Crypto wallet", kind: "investment", country: "*" },

  // Canada 🇨🇦
  { code: "tfsa", label: "TFSA — Tax-Free Savings", kind: "investment", country: "CA", taxAdvantaged: true },
  { code: "rrsp", label: "RRSP — Registered Retirement", kind: "investment", country: "CA", taxAdvantaged: true },
  { code: "fhsa", label: "FHSA — First Home Savings", kind: "investment", country: "CA", taxAdvantaged: true },
  { code: "resp", label: "RESP — Education Savings", kind: "investment", country: "CA", taxAdvantaged: true },
  { code: "rrif", label: "RRIF — Retirement Income", kind: "investment", country: "CA", taxAdvantaged: true },
  { code: "ca_nonreg", label: "Non-registered", kind: "investment", country: "CA" },

  // United States 🇺🇸
  { code: "401k", label: "401(k)", kind: "investment", country: "US", taxAdvantaged: true },
  { code: "roth_ira", label: "Roth IRA", kind: "investment", country: "US", taxAdvantaged: true },
  { code: "trad_ira", label: "Traditional IRA", kind: "investment", country: "US", taxAdvantaged: true },
  { code: "hsa", label: "HSA — Health Savings", kind: "savings", country: "US", taxAdvantaged: true },
  { code: "529", label: "529 — Education", kind: "investment", country: "US", taxAdvantaged: true },

  // United Kingdom 🇬🇧
  { code: "isa", label: "ISA — Individual Savings", kind: "investment", country: "GB", taxAdvantaged: true },
  { code: "lisa", label: "Lifetime ISA", kind: "investment", country: "GB", taxAdvantaged: true },
  { code: "sipp", label: "SIPP — Personal Pension", kind: "investment", country: "GB", taxAdvantaged: true },

  // Australia 🇦🇺
  { code: "super", label: "Superannuation", kind: "investment", country: "AU", taxAdvantaged: true },
];

// Countries offered in the pickers. The first group has tailored subtypes;
// the rest fall back to the generic ("*") set. Extend freely.
export const COUNTRIES: string[] = [
  "US", "CA", "GB", "AU", // catalog countries first
  "IE", "NZ", "IN", "SG", "DE", "FR", "ES", "IT", "NL", "SE", "CH",
  "JP", "HK", "AE", "ZA", "BR", "MX",
];

/** Subtypes available for a country: generics plus that country's own. */
export function subtypesForCountry(country?: string | null): AccountSubtype[] {
  const c = (country ?? "").toUpperCase();
  return ACCOUNT_SUBTYPES.filter((s) => s.country === "*" || s.country === c);
}

/** Subtypes for a country, narrowed to a single kind (for a cascading picker). */
export function subtypesFor(country: string | null | undefined, kind: string): AccountSubtype[] {
  return subtypesForCountry(country).filter((s) => s.kind === kind);
}

export function findSubtype(code?: string | null): AccountSubtype | undefined {
  return code ? ACCOUNT_SUBTYPES.find((s) => s.code === code) : undefined;
}

export function kindForSubtype(code?: string | null): Kind | undefined {
  return findSubtype(code)?.kind;
}

/** Short display label: the subtype's short name if set, else the kind. */
export function accountTypeLabel(a: { type: string; subtype?: string | null }): string {
  const sub = findSubtype(a.subtype);
  if (sub) return sub.label.split(" — ")[0];
  return kindLabel(a.type);
}

/** Human country name via the platform, e.g. "CA" → "Canada". */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
