import { Flame } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/money";
import type { MascotState, Challenge } from "@/lib/gamification";

const ACCENT: Record<MascotState["accent"], { ring: string; glow: string; text: string }> = {
  positive: { ring: "ring-positive/30", glow: "from-positive/20", text: "text-positive" },
  brand: { ring: "ring-brand/30", glow: "from-brand/20", text: "text-brand" },
  warning: { ring: "ring-warning/30", glow: "from-warning/20", text: "text-warning" },
  negative: { ring: "ring-negative/30", glow: "from-negative/20", text: "text-negative" },
};

export function MascotCard({
  mascot,
  streak,
  challenge,
}: {
  mascot: MascotState;
  streak: number;
  challenge: Challenge | null;
}) {
  const a = ACCENT[mascot.accent];
  return (
    <div className={cn("card relative overflow-hidden p-5 ring-1", a.ring)}>
      <div className={cn("pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-b blur-2xl", a.glow)} />
      <div className="relative flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="grid h-20 w-20 animate-float place-items-center rounded-3xl bg-surface-2 text-5xl shadow-card">
            🦊
          </div>
          <div className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-surface text-lg shadow-card ring-1 ring-border">
            {mascot.face}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold">{mascot.name}</span>
            <span className={cn("chip bg-surface-2", a.text)}>{mascot.mood}</span>
          </div>
          <p className="mt-1 text-sm text-fg/90">{mascot.message}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="chip bg-warning/10 text-warning">
              <Flame className="h-3.5 w-3.5" /> {streak}-month streak
            </span>
            {challenge && (
              <span className={cn("chip", challenge.onTrack ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative")}>
                {challenge.emoji} {challenge.title}
              </span>
            )}
          </div>
        </div>
      </div>

      {challenge && (
        <div className="relative mt-4 rounded-xl bg-surface-2 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">Monthly challenge · {challenge.title}</span>
            <span className="text-muted">
              {formatCents(challenge.spentCents, { compact: true })} / {formatCents(challenge.targetCents, { compact: true })}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
            <div
              className={cn("h-full rounded-full", challenge.onTrack ? "bg-positive" : "bg-negative")}
              style={{ width: `${challenge.pct}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-muted">{challenge.description}</div>
        </div>
      )}
    </div>
  );
}
