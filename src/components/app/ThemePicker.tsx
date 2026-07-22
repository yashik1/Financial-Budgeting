"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type Skin = "refined" | "almanac";

const OPTIONS: { skin: Skin; name: string; blurb: string; swatch: string[] }[] = [
  {
    skin: "refined",
    name: "Refined",
    blurb: "Clean porcelain & indigo — the default.",
    swatch: ["#f8f7f5", "#5850ec", "#0f8a62"],
  },
  {
    skin: "almanac",
    name: "Almanac",
    blurb: "A warm money journal, in Fitch's handwriting.",
    swatch: ["#f4eddf", "#1e5c48", "#d15f36"],
  },
];

export function ThemePicker() {
  const [skin, setSkin] = useState<Skin>("refined");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-skin");
    setSkin(current === "almanac" ? "almanac" : "refined");
  }, []);

  const choose = (next: Skin) => {
    setSkin(next);
    const d = document.documentElement;
    if (next === "almanac") d.setAttribute("data-skin", "almanac");
    else d.removeAttribute("data-skin");
    try {
      localStorage.setItem("finbud-skin", next);
    } catch {}
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Theme">
      {OPTIONS.map((o) => {
        const active = skin === o.skin;
        return (
          <button
            key={o.skin}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(o.skin)}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 text-left transition",
              active ? "border-brand ring-2 ring-brand/40" : "border-border hover:bg-surface-2",
            )}
          >
            <span className="flex shrink-0 overflow-hidden rounded-lg border border-border">
              {o.swatch.map((c) => (
                <span key={c} className="h-9 w-4" style={{ background: c }} />
              ))}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-semibold">
                {o.name}
                {active && <span className="chip bg-brand-soft text-brand">Active</span>}
              </span>
              <span className="block text-xs text-muted">{o.blurb}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
