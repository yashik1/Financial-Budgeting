// Month-key helpers. A "month key" is the string "YYYY-MM" used to bucket
// budgets and transactions. UTC-based so keys are stable regardless of TZ.

export function monthKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function currentMonthKey(now: Date = new Date()): string {
  return monthKey(now);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function shortMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}

export function addMonthsToKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return monthKey(d);
}

/** True for a well-formed "YYYY-MM" key. */
export function isMonthKey(input: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(input);
}

/**
 * Validate a user-supplied month param, clamping to at most `max` (default the
 * current month, so the UI can't browse into the future). Falls back to `max`.
 */
export function safeMonthKey(input: string | undefined, max: string = currentMonthKey()): string {
  if (!input || !isMonthKey(input)) return max;
  return input > max ? max : input;
}

/** Last `count` month keys, oldest first, ending at (and including) `end`. */
export function lastMonths(count: number, end: string = currentMonthKey()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) keys.push(addMonthsToKey(end, -i));
  return keys;
}

export function monthRange(key: string): { start: Date; end: Date } {
  const [y, m] = key.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)),
    end: new Date(Date.UTC(y, m, 0, 23, 59, 59)), // day 0 of next month = last day
  };
}
