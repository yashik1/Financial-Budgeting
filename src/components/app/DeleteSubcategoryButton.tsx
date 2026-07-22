"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteSubcategory } from "@/app/(app)/actions";

export function DeleteSubcategoryButton({ categoryId, name }: { categoryId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(`Delete the “${name}” subcategory? Its transactions become uncategorized.`)) {
          start(() => deleteSubcategory(categoryId));
        }
      }}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-negative/10 hover:text-negative disabled:opacity-50"
      aria-label={`Delete ${name} subcategory`}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
