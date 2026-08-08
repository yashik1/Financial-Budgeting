// All money in FinBud is stored as signed integer minor units (e.g. cents).
// Negative = outflow (spending), positive = inflow (income).
//
// Display currency is a per-user preference. We don't do FX conversion (the
// demo is single-currency), so switching currency re-labels the same figures
// with the right symbol, grouping, and decimal rules for that currency.

export const DEFAULT_CURRENCY = "USD";

// The runtime's real ISO 4217 allow-list (Intl accepts any 3-letter code, so we
// enumerate the supported set instead of just try/catching a format call).
let SUPPORTED: Set<string> | null | undefined;
function supportedCurrencies(): Set<string> | null {
  if (SUPPORTED !== undefined) return SUPPORTED;
  const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
  if (typeof fn === "function") {
    try {
      SUPPORTED = new Set(fn("currency"));
      return SUPPORTED;
    } catch {
      /* fall through */
    }
  }
  SUPPORTED = null; // can't enumerate on this runtime
  return SUPPORTED;
}

/** True only for a real ISO 4217 code this runtime knows how to format. */
export function isSupportedCurrency(code: string | null | undefined): boolean {
  if (!code || !/^[A-Za-z]{3}$/.test(code)) return false;
  const up = code.toUpperCase();
  const set = supportedCurrencies();
  if (set) return set.has(up);
  // Runtime can't enumerate — accept any well-formed code it can format.
  try {
    new Intl.NumberFormat("en-US", { style: "currency", currency: up }).format(1);
    return true;
  } catch {
    return false;
  }
}

/** Normalize to a usable currency code, defaulting to USD. */
export function safeCurrency(code: string | null | undefined): string {
  return isSupportedCurrency(code) ? code!.toUpperCase() : DEFAULT_CURRENCY;
}

export function formatCents(
  cents: number,
  opts: { currency?: string; signed?: boolean; compact?: boolean } = {},
): string {
  const { currency = DEFAULT_CURRENCY, signed = false, compact = false } = opts;
  const code = safeCurrency(currency);
  const value = cents / 100;
  // For non-compact we let Intl pick the currency's own fraction digits
  // (USD → 2, JPY → 0, BHD → 3). Compact always drops the decimals.
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    ...(compact ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
    notation: compact && Math.abs(value) >= 10000 ? "compact" : "standard",
  });
  const formatted = formatter.format(Math.abs(value));
  const sign = value < 0 ? "−" : signed ? "+" : "";
  return `${sign}${formatted}`;
}

/** The currency's symbol alone (e.g. "$", "€", "¥"), for compact inputs. */
export function currencySymbol(currency: string): string {
  const code = safeCurrency(currency);
  const parts = new Intl.NumberFormat("en-US", { style: "currency", currency: code }).formatToParts(0);
  return parts.find((p) => p.type === "currency")?.value ?? code;
}

/** Absolute dollar amount, no currency symbol — for inputs. */
export function centsToInput(cents: number): string {
  return (Math.abs(cents) / 100).toFixed(2);
}

// Money columns are Postgres `Int` (int4), so a value outside this range makes
// the driver throw rather than storing anything. Amounts are in cents, giving a
// ceiling of ±$21,474,836.47 — far past any plausible transaction, and the
// clamp turns a hostile or fat-fingered input into a saturated value instead of
// a 500.
export const MAX_CENTS = 2_147_483_647;
export const MIN_CENTS = -2_147_483_648;

export function dollarsToCents(dollars: number | string): number {
  const n = typeof dollars === "string" ? parseFloat(dollars) : dollars;
  // Catches NaN plus the Infinity that "1e400" parses to.
  if (!Number.isFinite(n)) return 0;
  return clamp(Math.round(n * 100), MIN_CENTS, MAX_CENTS);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
