"use client";

import { useTransition } from "react";
import { recategorizeTransaction } from "@/app/(app)/actions";

export type CatOption = { id: string; name: string; icon: string; parentId: string | null };

/** Renders parents as <optgroup>s with their subcategories nested underneath. */
export function CategoryOptionGroups({ categories }: { categories: CatOption[] }) {
  const tops = categories.filter((c) => !c.parentId);
  const childrenOf = new Map<string, CatOption[]>();
  for (const c of categories) {
    if (!c.parentId) continue;
    const list = childrenOf.get(c.parentId) ?? [];
    list.push(c);
    childrenOf.set(c.parentId, list);
  }
  return (
    <>
      {tops.map((t) => {
        const kids = childrenOf.get(t.id) ?? [];
        if (kids.length === 0) {
          return (
            <option key={t.id} value={t.id}>
              {t.icon} {t.name}
            </option>
          );
        }
        return (
          <optgroup key={t.id} label={`${t.icon} ${t.name}`}>
            <option value={t.id}>{t.icon} {t.name} (all)</option>
            {kids.map((c) => (
              <option key={c.id} value={c.id}>
                &nbsp;&nbsp;{c.icon} {c.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}

export function CategorySelect({
  txnId,
  value,
  categories,
  className,
}: {
  txnId: string;
  value: string | null;
  categories: CatOption[];
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={value ?? ""}
      disabled={pending}
      onChange={(e) => start(() => recategorizeTransaction(txnId, e.target.value))}
      className={
        className ??
        "max-w-[12rem] rounded-lg border border-border bg-surface px-2 py-1 text-xs font-medium text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:opacity-50"
      }
    >
      <option value="">❓ Uncategorized</option>
      <CategoryOptionGroups categories={categories} />
    </select>
  );
}
