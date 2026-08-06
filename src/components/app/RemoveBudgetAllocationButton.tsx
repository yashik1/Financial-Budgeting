"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { removeBudgetAllocation } from "@/app/(app)/actions";

export function RemoveBudgetAllocationButton({ categoryId, month, name }: { categoryId: string; month: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => removeBudgetAllocation(categoryId, month))}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-negative/10 hover:text-negative disabled:opacity-50"
      aria-label={`Remove ${name}'s budget allocation`}
      title="Remove allocation"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}
