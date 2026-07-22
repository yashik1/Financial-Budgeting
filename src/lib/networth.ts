// Reconstruct an end-of-month net-worth series from the current total and each
// month's net cash flow. Pure + testable.
//
// Identity: netWorth(endOf month i) = netWorth(endOf month i-1) + netFlow(i).
// So walking backward from today's known total yields history for free.

export type MonthlyNet = { month: string; netCents: number };

export function netWorthSeries(
  currentCents: number,
  monthly: MonthlyNet[], // oldest → newest
): { month: string; cents: number }[] {
  const out = monthly.map((m) => ({ month: m.month, cents: 0 }));
  if (out.length === 0) return out;
  out[out.length - 1].cents = currentCents;
  for (let i = out.length - 2; i >= 0; i--) {
    out[i].cents = out[i + 1].cents - monthly[i + 1].netCents;
  }
  return out;
}
