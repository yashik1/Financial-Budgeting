// Goal projection: when will this goal actually be funded?
//
// Progress tracks the linked account's balance, so the honest estimate of the
// finish line comes from how fast that account has been growing — not from a
// number the user typed in.

import { addMonthsToKey } from "./dates";

/** Past this we're guessing, not projecting, so we call it unreachable instead. */
const MAX_PROJECTED_MONTHS = 600; // 50 years

export type GoalProjection = {
  monthlyRateCents: number;
  /** Months until funded; 0 if already there, null when the rate can't get there. */
  monthsRemaining: number | null;
  /** "YYYY-MM" the goal is projected to land, or null when unreachable. */
  etaMonth: string | null;
  /** Whether the ETA beats the deadline. Null with no deadline or no ETA. */
  onTrack: boolean | null;
};

export function projectGoal(input: {
  fundedCents: number;
  targetCents: number;
  monthlyRateCents: number;
  fromMonth: string;
  deadline?: Date | null;
}): GoalProjection {
  const { fundedCents, targetCents, monthlyRateCents, fromMonth, deadline } = input;
  const remaining = targetCents - fundedCents;

  if (remaining <= 0) {
    return { monthlyRateCents, monthsRemaining: 0, etaMonth: fromMonth, onTrack: true };
  }
  if (monthlyRateCents <= 0) {
    return { monthlyRateCents, monthsRemaining: null, etaMonth: null, onTrack: deadline ? false : null };
  }

  const monthsRemaining = Math.ceil(remaining / monthlyRateCents);
  if (monthsRemaining > MAX_PROJECTED_MONTHS) {
    return { monthlyRateCents, monthsRemaining: null, etaMonth: null, onTrack: deadline ? false : null };
  }

  const etaMonth = addMonthsToKey(fromMonth, monthsRemaining);
  const onTrack = deadline ? etaMonth <= monthKeyOf(deadline) : null;
  return { monthlyRateCents, monthsRemaining, etaMonth, onTrack };
}

function monthKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Average monthly change in an account's balance, from the flows that hit it.
 * Transfers count: moving money into savings is exactly how a goal gets funded.
 */
export function contributionRate(flowsCents: number[], months: number): number {
  if (months <= 0) return 0;
  const net = flowsCents.reduce((s, c) => s + c, 0);
  return Math.round(net / months);
}
