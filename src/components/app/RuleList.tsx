"use client";

import { useState, useTransition } from "react";
import { Trash2, Wand2 } from "lucide-react";
import { applyRulesToUncategorized, deleteRule } from "@/app/(app)/actions";

export type RuleRow = {
  id: string;
  matcher: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
};

export function RuleList({ rules }: { rules: RuleRow[] }) {
  const [pending, start] = useTransition();
  const [applied, setApplied] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() =>
            start(async () => {
              const res = await applyRulesToUncategorized();
              setApplied(res?.updated ?? 0);
            })
          }
          disabled={pending}
          className="btn-primary"
        >
          <Wand2 className="h-4 w-4" /> {pending ? "Sorting…" : "Apply to uncategorized"}
        </button>
        {applied !== null && !pending && (
          <span className="chip bg-positive/10 text-positive" role="status">
            {applied === 0 ? "Nothing left to sort" : `Categorized ${applied} transaction${applied === 1 ? "" : "s"}`}
          </span>
        )}
      </div>

      {rules.length === 0 ? (
        <p className="card p-8 text-center text-sm text-muted">
          No rules of your own yet. Add one above — every import from then on gets sorted automatically.
        </p>
      ) : (
        <ul className="card divide-y divide-border">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3">
              <span className="text-sm text-muted">Contains</span>
              <code className="rounded-lg bg-surface-2 px-2 py-1 text-sm font-medium">{r.matcher}</code>
              <span className="text-sm text-muted">→</span>
              <span className="chip" style={{ background: `${r.categoryColor}1a`, color: r.categoryColor }}>
                {r.categoryIcon} {r.categoryName}
              </span>
              <button
                onClick={() => start(() => deleteRule(r.id))}
                disabled={pending}
                aria-label={`Delete the rule for “${r.matcher}”`}
                className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-negative"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
