// The "fun" layer: levels, a reactive mascot, monthly challenges, streaks, and
// achievement definitions. Pure functions — the DB only persists unlocks/points.

export type AchievementDef = {
  key: string;
  name: string;
  description: string;
  emoji: string;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "first_budget", name: "Budget Baby Steps", description: "Create your first budget.", emoji: "🍼" },
  { key: "on_budget_month", name: "In the Green", description: "Finish a month under budget.", emoji: "🟢" },
  { key: "streak_3", name: "Hat Trick", description: "Stay on budget 3 months in a row.", emoji: "🎩" },
  { key: "streak_6", name: "Half-Year Hero", description: "Six on-budget months straight.", emoji: "🦸" },
  { key: "goal_funded", name: "Goal Getter", description: "Fully fund a savings goal.", emoji: "🏆" },
  { key: "saver_20", name: "One-Fifth Club", description: "Save 20%+ of income in a month.", emoji: "💎" },
  { key: "no_coffee_week", name: "Home Barista", description: "A week with no coffee-shop spend.", emoji: "☕" },
  { key: "networth_up", name: "Up and to the Right", description: "Grow net worth 3 months running.", emoji: "📈" },
  { key: "categorizer", name: "Neat Freak", description: "Categorize 100% of a month's transactions.", emoji: "🧹" },
  { key: "investor", name: "Future You", description: "Make an investment contribution.", emoji: "🌱" },
];

// ---- Levels ---------------------------------------------------------------

export const LEVELS = [
  { level: 1, title: "Sprout", at: 0 },
  { level: 2, title: "Saver", at: 250 },
  { level: 3, title: "Budget Boss", at: 750 },
  { level: 4, title: "Money Ninja", at: 1500 },
  { level: 5, title: "Wealth Wizard", at: 3000 },
  { level: 6, title: "Finance Legend", at: 6000 },
] as const;

export function levelForPoints(points: number) {
  let current: (typeof LEVELS)[number] = LEVELS[0];
  for (const l of LEVELS) if (points >= l.at) current = l;
  const next = LEVELS.find((l) => l.at > current.at && points < l.at);
  const spanStart = current.at;
  const spanEnd = next?.at ?? current.at;
  const progressPct =
    next ? Math.round(((points - spanStart) / (spanEnd - spanStart)) * 100) : 100;
  return {
    level: current.level,
    title: current.title,
    points,
    nextTitle: next?.title ?? null,
    pointsToNext: next ? next.at - points : 0,
    progressPct,
  };
}

// ---- Mascot ---------------------------------------------------------------

export type MascotMood = "thriving" | "happy" | "caution" | "worried";

export type MascotState = {
  name: string;
  mood: MascotMood;
  face: string; // emoji expression
  message: string;
  accent: "positive" | "brand" | "warning" | "negative";
};

/** Fitch the fox reacts to how the month is going. */
export function mascot(input: {
  healthScore: number;
  pctBudgetUsed: number;
  overCount: number;
}): MascotState {
  const { healthScore, pctBudgetUsed, overCount } = input;
  if (healthScore >= 75 && overCount === 0) {
    return {
      name: "Fitch",
      mood: "thriving",
      face: "🤩",
      message: "You're absolutely crushing it this month!",
      accent: "positive",
    };
  }
  if (healthScore >= 50 && overCount <= 1) {
    return {
      name: "Fitch",
      mood: "happy",
      face: "😊",
      message: "Nice and steady — you're on track.",
      accent: "brand",
    };
  }
  if (pctBudgetUsed > 90 || overCount >= 2) {
    return {
      name: "Fitch",
      mood: "worried",
      face: "😰",
      message: "A few categories are running hot. Let's rein it in.",
      accent: "negative",
    };
  }
  return {
    name: "Fitch",
    mood: "caution",
    face: "🧐",
    message: "Keep an eye on spending — you're close to the edge.",
    accent: "warning",
  };
}

// ---- Streaks --------------------------------------------------------------

/**
 * Consecutive on-budget months ending at the most recent, where a month is
 * "on budget" when income exceeds spending.
 */
export function savingsStreak(
  months: { incomeCents: number; spendingCents: number }[],
): number {
  let streak = 0;
  for (let i = months.length - 1; i >= 0; i--) {
    const m = months[i];
    if (m.incomeCents > m.spendingCents && m.incomeCents > 0) streak++;
    else break;
  }
  return streak;
}

// ---- Monthly challenge ----------------------------------------------------

export type Challenge = {
  key: string;
  title: string;
  description: string;
  emoji: string;
  spentCents: number;
  targetCents: number;
  pct: number; // spend vs target, clamped 0..100
  onTrack: boolean;
};

export function makeChallenge(input: {
  key: string;
  title: string;
  emoji: string;
  spentCents: number;
  targetCents: number;
  unit?: string;
}): Challenge {
  const { key, title, emoji, spentCents, targetCents } = input;
  const pct = targetCents > 0 ? Math.min(100, Math.round((spentCents / targetCents) * 100)) : 0;
  const remaining = Math.max(0, targetCents - spentCents);
  return {
    key,
    title,
    emoji,
    spentCents,
    targetCents,
    pct,
    onTrack: spentCents <= targetCents,
    description:
      spentCents <= targetCents
        ? `${(remaining / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} of headroom left`
        : `Over by ${((spentCents - targetCents) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}`,
  };
}
