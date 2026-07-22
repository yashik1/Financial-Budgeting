"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { setAccountShared, setGoalShared } from "@/app/(app)/household/actions";
import { cn } from "@/lib/cn";

export function PrivacyToggle({
  id,
  shared,
  kind,
}: {
  id: string;
  shared: boolean;
  kind: "account" | "goal";
}) {
  const [on, setOn] = useState(shared);
  const [pending, start] = useTransition();

  const toggle = () => {
    const next = !on;
    setOn(next);
    start(async () => {
      if (kind === "account") await setAccountShared(id, next);
      else await setGoalShared(id, next);
    });
  };

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={cn(
        "chip transition disabled:opacity-60",
        on ? "bg-positive/10 text-positive" : "bg-surface-2 text-muted",
      )}
      title={on ? "Shared with your household" : "Private to you"}
    >
      {on ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      {on ? "Shared" : "Private"}
    </button>
  );
}
