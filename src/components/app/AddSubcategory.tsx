"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { addSubcategory } from "@/app/(app)/actions";

export function AddSubcategory({ parentId }: { parentId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="chip text-brand transition hover:bg-brand-soft">
        <Plus className="h-3.5 w-3.5" /> Add subcategory
      </button>
    );
  }

  return (
    <form action={addSubcategory} onSubmit={() => setOpen(false)} className="flex items-center gap-2">
      <input type="hidden" name="parentId" value={parentId} />
      <input name="icon" defaultValue="•" maxLength={2} className="input w-12 text-center" aria-label="Icon" />
      <input name="name" placeholder="e.g. Oil change" required className="input h-9 py-1 text-sm" />
      <button className="btn-primary px-3 py-1.5 text-sm">Add</button>
      <button type="button" onClick={() => setOpen(false)} className="btn-ghost px-2 py-1.5 text-sm">Cancel</button>
    </form>
  );
}
