"use client";

import { useTransition } from "react";
import { recategorizeTransaction } from "@/app/(app)/actions";

type Cat = { id: string; name: string; icon: string };

export function CategorySelect({
  txnId,
  value,
  categories,
}: {
  txnId: string;
  value: string | null;
  categories: Cat[];
}) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={value ?? ""}
      disabled={pending}
      onChange={(e) => start(() => recategorizeTransaction(txnId, e.target.value))}
      className="max-w-[11rem] rounded-lg border border-border bg-surface px-2 py-1 text-xs font-medium text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:opacity-50"
    >
      <option value="">❓ Uncategorized</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.icon} {c.name}
        </option>
      ))}
    </select>
  );
}
