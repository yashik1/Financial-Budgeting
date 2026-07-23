"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type Skin = "refined" | "almanac" | "midnight" | "sunset" | "grape" | "ocean";

// swatch = [surface/paper, brand, accent] purely for the preview chip.
const OPTIONS: { skin: Skin; name: string; blurb: string; swatch: string[] }[] = [
  { skin: "refined", name: "Refined", blurb: "Clean porcelain & indigo — the default.", swatch: ["#f8f7f5", "#5850ec", "#0f8a62"] },
  { skin: "almanac", name: "Almanac", blurb: "A warm money journal, in Fitch's handwriting.", swatch: ["#f4eddf", "#1e5c48", "#d15f36"] },
  { skin: "midnight", name: "Midnight", blurb: "Cool slate with an electric sky accent.", swatch: ["#0b1020", "#38bdf8", "#e8eefc"] },
  { skin: "sunset", name: "Sunset", blurb: "Warm sand and persimmon.", swatch: ["#fbf6f1", "#de622c", "#f2814f"] },
  { skin: "grape", name: "Grape", blurb: "Soft porcelain with a violet pop.", swatch: ["#f7f6fb", "#7c3aed", "#a78bfa"] },
  { skin: "ocean", name: "Ocean", blurb: "Calm, coastal teal.", swatch: ["#f2f8f7", "#0d8a7e", "#2dd4bf"] },
];

function applySkin(skin: Skin) {
  const d = document.documentElement;
  if (skin === "refined") d.removeAttribute("data-skin");
  else d.setAttribute("data-skin", skin);
  try {
    localStorage.setItem("finbud-skin", skin);
  } catch {}
}

export function ThemePicker() {
  const [skin, setSkin] = useState<Skin>("refined");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-skin") as Skin | null;
    setSkin(current ?? "refined");
  }, []);

  const choose = (next: Skin) => {
    setSkin(next);
    applySkin(next);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Theme">
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
