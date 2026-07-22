"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Receipt, Wallet, Target, Landmark, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/budgets", label: "Budgets", icon: Wallet },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/household", label: "Household", icon: Users },
  { href: "/insights", label: "AI Coach", icon: Sparkles },
];

export function Nav({ orientation = "vertical" }: { orientation?: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  return (
    <nav
      className={cn(
        orientation === "vertical" ? "flex flex-col gap-1" : "flex items-center justify-around",
      )}
    >
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + "/");
        const Icon = l.icon;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
              orientation === "horizontal" && "flex-col gap-0.5 px-2 text-xs",
              active
                ? "bg-brand text-white shadow-glow"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon className={cn("h-4 w-4", orientation === "horizontal" && "h-5 w-5")} />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
