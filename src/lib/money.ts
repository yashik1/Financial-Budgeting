// All money in FinBud is stored as signed integer cents.
// Negative = outflow (spending), positive = inflow (income).

export function formatCents(
  cents: number,
  opts: { currency?: string; signed?: boolean; compact?: boolean } = {},
): string {
  const { currency = "USD", signed = false, compact = false } = opts;
  const value = cents / 100;
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 0 : 2,
    notation: compact && Math.abs(value) >= 10000 ? "compact" : "standard",
  });
  const formatted = formatter.format(Math.abs(value));
  const sign = value < 0 ? "−" : signed ? "+" : "";
  return `${sign}${formatted}`;
}

/** Absolute dollar amount, no currency symbol — for inputs. */
export function centsToInput(cents: number): string {
  return (Math.abs(cents) / 100).toFixed(2);
}

export function dollarsToCents(dollars: number | string): number {
  const n = typeof dollars === "string" ? parseFloat(dollars) : dollars;
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
