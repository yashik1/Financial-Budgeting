// Recurring-transaction detection. Pure and testable: given a list of
// transactions, find the merchants that repeat on a regular cadence (rent,
// subscriptions, paycheques) and predict when each is next due.
//
// Approach: group by a normalized merchant key, sort by date, measure the gaps
// between consecutive charges, and match the median gap to a known cadence
// within a tolerance. Confidence reflects how consistent the gaps are — a
// subscription billed every 30 ± 1 days scores high; scattered coffee runs
// score low and are dropped.

export type RecurringInput = {
  id: string;
  date: Date;
  amountCents: number;
  merchant: string;
  categoryId: string | null;
  isTransfer: boolean;
};

export type Cadence = "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";

export const CADENCE_LABEL: Record<Cadence, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export type RecurringSeries = {
  key: string;
  merchant: string;
  cadence: Cadence;
  /** Average signed amount (negative = a bill, positive = income). */
  amountCents: number;
  categoryId: string | null;
  occurrences: number;
  lastDate: Date;
  nextDate: Date;
  /** 0–1: how regular the spacing is. */
  confidence: number;
};

const CADENCES: { cadence: Cadence; days: number; tolerance: number }[] = [
  { cadence: "weekly", days: 7, tolerance: 2 },
  { cadence: "biweekly", days: 14, tolerance: 3 },
  { cadence: "monthly", days: 30.4, tolerance: 5 },
  { cadence: "quarterly", days: 91.3, tolerance: 10 },
  { cadence: "yearly", days: 365, tolerance: 20 },
];

const DAY_MS = 86_400_000;

/** Merchant key: lowercase, strip digits/punctuation so "Netflix #123" groups. */
export function merchantKey(merchant: string): string {
  return merchant
    .toLowerCase()
    .replace(/[0-9]+/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Add one cadence step to a date (calendar-aware for month/quarter/year). */
export function advance(date: Date, cadence: Cadence): Date {
  const d = new Date(date.getTime());
  switch (cadence) {
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "biweekly":
      d.setUTCDate(d.getUTCDate() + 14);
      break;
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case "quarterly":
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
    case "yearly":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
  }
  return d;
}

/**
 * Detect recurring series. `minOccurrences` guards against calling two charges
 * a pattern; `minConfidence` drops irregular spending.
 */
export function detectRecurring(
  txns: RecurringInput[],
  opts: { minOccurrences?: number; minConfidence?: number } = {},
): RecurringSeries[] {
  const { minOccurrences = 3, minConfidence = 0.6 } = opts;

  const groups = new Map<string, RecurringInput[]>();
  for (const t of txns) {
    if (t.isTransfer) continue;
    const key = merchantKey(t.merchant);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const out: RecurringSeries[] = [];
  for (const [key, list] of groups) {
    if (list.length < minOccurrences) continue;
    const sorted = [...list].sort((a, b) => a.date.getTime() - b.date.getTime());

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / DAY_MS);
    }
    const med = median(gaps);
    if (med <= 0) continue;

    const match = CADENCES.find((c) => Math.abs(med - c.days) <= c.tolerance);
    if (!match) continue;

    // Confidence: share of gaps that land inside the cadence tolerance.
    const withinTolerance = gaps.filter((g) => Math.abs(g - match.days) <= match.tolerance).length;
    const confidence = withinTolerance / gaps.length;
    if (confidence < minConfidence) continue;

    const last = sorted[sorted.length - 1];
    const amountCents = Math.round(sorted.reduce((s, t) => s + t.amountCents, 0) / sorted.length);

    out.push({
      key,
      merchant: last.merchant,
      cadence: match.cadence,
      amountCents,
      categoryId: last.categoryId,
      occurrences: sorted.length,
      lastDate: last.date,
      nextDate: advance(last.date, match.cadence),
      confidence,
    });
  }

  // Biggest commitments first (by absolute monthly weight).
  return out.sort((a, b) => Math.abs(b.amountCents) - Math.abs(a.amountCents));
}

/** Roughly how much this series costs per month (for totals). */
export function monthlyCents(s: Pick<RecurringSeries, "amountCents" | "cadence">): number {
  const perMonth: Record<Cadence, number> = {
    weekly: 52 / 12,
    biweekly: 26 / 12,
    monthly: 1,
    quarterly: 1 / 3,
    yearly: 1 / 12,
  };
  return Math.round(s.amountCents * perMonth[s.cadence]);
}

/**
 * Upcoming occurrences of each series within [from, to] — used by the calendar
 * and the forecast. Walks forward from each series' next due date.
 */
export function upcomingOccurrences(
  series: RecurringSeries[],
  from: Date,
  to: Date,
): { date: Date; series: RecurringSeries }[] {
  const out: { date: Date; series: RecurringSeries }[] = [];
  for (const s of series) {
    let d = new Date(s.nextDate.getTime());
    // Fast-forward into the window (guard against runaway loops).
    let guard = 0;
    while (d < from && guard++ < 400) d = advance(d, s.cadence);
    while (d <= to && guard++ < 400) {
      if (d >= from) out.push({ date: new Date(d.getTime()), series: s });
      d = advance(d, s.cadence);
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}
