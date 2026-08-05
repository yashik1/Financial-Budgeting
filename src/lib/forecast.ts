// Cash-flow forecast: where the month is likely to end up.
//
// Actuals so far + the recurring items still due this month + a typical-day
// estimate for everything else (variable spending like groceries and coffee).
// Pure so it can be unit tested.

import { upcomingOccurrences, type RecurringSeries } from "./recurring";

export type ForecastInput = {
  /** Income already received this month (positive cents). */
  incomeSoFarCents: number;
  /** Spending already made this month (positive cents). */
  spendingSoFarCents: number;
  /** Non-recurring ("variable") spending so far, positive cents. */
  variableSpendSoFarCents: number;
  daysElapsed: number;
  daysInMonth: number;
  series: RecurringSeries[];
  /** Window for remaining recurring items (usually tomorrow → month end). */
  from: Date;
  to: Date;
};

export type Forecast = {
  projectedIncomeCents: number;
  projectedSpendingCents: number;
  projectedNetCents: number;
  /** Recurring bills still expected before month end (positive cents). */
  upcomingBillsCents: number;
  /** Estimated remaining variable spending (positive cents). */
  estimatedVariableCents: number;
  daysLeft: number;
};

export function forecastMonth(input: ForecastInput): Forecast {
  const {
    incomeSoFarCents,
    spendingSoFarCents,
    variableSpendSoFarCents,
    daysElapsed,
    daysInMonth,
    series,
    from,
    to,
  } = input;

  const daysLeft = Math.max(0, daysInMonth - daysElapsed);

  // Recurring items still due: bills add to spending, income adds to income.
  let upcomingBillsCents = 0;
  let upcomingIncomeCents = 0;
  for (const { series: s } of upcomingOccurrences(series, from, to)) {
    if (s.amountCents < 0) upcomingBillsCents += -s.amountCents;
    else upcomingIncomeCents += s.amountCents;
  }

  // Variable spending continues at the pace set so far this month.
  const perDay = daysElapsed > 0 ? variableSpendSoFarCents / daysElapsed : 0;
  const estimatedVariableCents = Math.round(perDay * daysLeft);

  const projectedIncomeCents = incomeSoFarCents + upcomingIncomeCents;
  const projectedSpendingCents = spendingSoFarCents + upcomingBillsCents + estimatedVariableCents;

  return {
    projectedIncomeCents,
    projectedSpendingCents,
    projectedNetCents: projectedIncomeCents - projectedSpendingCents,
    upcomingBillsCents,
    estimatedVariableCents,
    daysLeft,
  };
}
