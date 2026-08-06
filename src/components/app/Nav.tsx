"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  Target,
  Landmark,
  Sparkles,
  Users,
  Settings,
  CalendarDays,
  BarChart3,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/budgets", label: "Budgets", icon: Wallet },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/household", label: "Household", icon: Users },
  { href: "/insights", label: "AI Coach", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Bottom nav caps at 5 items (4 destinations + More) per mobile nav guidelines.
const PRIMARY_COUNT = 4;

function NavLink({
  link,
  active,
  horizontal,
  onClick,
}: {
  link: (typeof LINKS)[number];
  active: boolean;
  horizontal?: boolean;
  onClick?: () => void;
}) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
        horizontal && "min-h-[44px] flex-1 flex-col justify-center gap-0.5 px-1 text-[11px]",
        active ? "bg-brand text-white shadow-glow" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Icon className={cn("h-4 w-4", horizontal && "h-5 w-5")} aria-hidden />
      {link.label}
    </Link>
  );
}

export function Nav({ orientation = "vertical" }: { orientation?: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  // Close the More sheet on route change or Escape.
  useEffect(() => setMoreOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (orientation === "vertical") {
    return (
      <nav aria-label="Primary" className="flex flex-col gap-1">
        {LINKS.map((l) => (
          <NavLink key={l.href} link={l} active={isActive(l.href)} />
        ))}
      </nav>
    );
  }

  const primary = LINKS.slice(0, PRIMARY_COUNT);
  const overflow = LINKS.slice(PRIMARY_COUNT);
  const overflowActive = overflow.some((l) => isActive(l.href));

  return (
    <nav aria-label="Primary" className="relative flex items-stretch justify-around" ref={moreRef}>
      {primary.map((l) => (
        <NavLink key={l.href} link={l} active={isActive(l.href)} horizontal />
      ))}

      <button
        onClick={() => setMoreOpen((v) => !v)}
        aria-expanded={moreOpen}
        aria-haspopup="menu"
        className={cn(
          "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-medium transition",
          overflowActive || moreOpen ? "bg-brand text-white shadow-glow" : "text-muted hover:bg-surface-2 hover:text-fg",
        )}
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
        More
      </button>

      {moreOpen && (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-30 mb-2 w-48 rounded-2xl border border-border bg-surface p-2 shadow-pop"
        >
          {overflow.map((l) => (
            <NavLink key={l.href} link={l} active={isActive(l.href)} onClick={() => setMoreOpen(false)} />
          ))}
        </div>
      )}
    </nav>
  );
}
