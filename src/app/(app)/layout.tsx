import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getGamification } from "@/lib/queries";
import { logout } from "@/app/login/actions";
import { Nav } from "@/components/app/Nav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogOut } from "lucide-react";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const game = await getGamification(user.id);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-surface p-4 lg:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2 text-lg font-extrabold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white">💸</span>
          FinBud
        </Link>

        <Nav />

        <div className="mt-auto space-y-3">
          <div className="rounded-2xl border border-border bg-surface-2 p-3">
            <div className="flex items-center justify-between">
              <span className="chip bg-brand-soft text-brand">Lv {game.level.level}</span>
              <span className="text-xs text-muted">{game.stats.points} pts</span>
            </div>
            <div className="mt-1 text-sm font-semibold">{game.level.title}</div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-brand" style={{ width: `${game.level.progressPct}%` }} />
            </div>
            {game.level.nextTitle && (
              <div className="mt-1.5 text-[11px] text-muted">
                {game.level.pointsToNext} pts to {game.level.nextTitle}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{user.name}</div>
              <div className="truncate text-xs text-muted">{user.email}</div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <form action={logout}>
                <button className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface text-muted transition hover:text-negative" aria-label="Log out">
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface/80 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 font-extrabold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">💸</span>
          FinBud
        </Link>
        <div className="flex items-center gap-2">
          <span className="chip bg-brand-soft text-brand">Lv {game.level.level}</span>
          <ThemeToggle />
          <form action={logout}>
            <button className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface text-muted" aria-label="Log out">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 lg:px-8 lg:pb-10">{children}</main>

      {/* Bottom nav (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/90 p-2 backdrop-blur lg:hidden">
        <Nav orientation="horizontal" />
      </div>
    </div>
  );
}
