// Deterministic auto-categorization: match a transaction description against a
// set of rules. Pure and dependency-free so it's trivially unit-testable and
// reusable by the seed, the CSV importer, and the live app.

export type MatchRule = {
  matcher: string;
  category: string;
  priority?: number;
};

/**
 * Return the best-matching category name for a description, or null.
 * Specificity wins: the longest matching keyword takes precedence, with
 * `priority` as a tie-breaker (higher first).
 */
export function categorize(description: string, rules: MatchRule[]): string | null {
  const haystack = description.toLowerCase();
  let best: { category: string; score: number; priority: number } | null = null;

  for (const rule of rules) {
    const needle = rule.matcher.toLowerCase().trim();
    if (!needle) continue;
    if (!haystack.includes(needle)) continue;

    const score = needle.length;
    const priority = rule.priority ?? 0;
    if (
      !best ||
      score > best.score ||
      (score === best.score && priority > best.priority)
    ) {
      best = { category: rule.category, score, priority };
    }
  }

  return best?.category ?? null;
}
