import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "@/components/auth/LoginForm";

const HIGHLIGHTS = [
  { emoji: "🎮", title: "Fun by design", text: "Streaks, challenges, and a mascot that reacts to your spending." },
  { emoji: "📊", title: "Genuinely deep", text: "Envelope budgeting, cash-flow, net worth, and rich visuals." },
  { emoji: "🔌", title: "Connect anything", text: "CSV import today; banks & brokers via Plaid/SnapTrade next." },
];

const PAGE_ERRORS: Record<string, string> = {
  demo: "The demo dataset hasn't been seeded yet. Run `npm run seed` and try again.",
  rate: "That's a lot of demo sessions from your network. Give it a few minutes.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const { error } = await searchParams;
  const notice = error ? PAGE_ERRORS[error] : undefined;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand / marketing panel */}
      <section className="relative hidden overflow-hidden bg-brand p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/20">💸</span>
            FinBud
          </div>
        </div>
        <div className="relative space-y-8">
          <h1 className="text-4xl font-extrabold leading-tight">
            Budgeting that’s<br />actually <span className="underline decoration-white/40">fun</span>.
          </h1>
          <ul className="space-y-4">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 text-lg">{h.emoji}</span>
                <div>
                  <div className="font-semibold">{h.title}</div>
                  <div className="text-sm text-white/80">{h.text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative text-sm text-white/70">Meet Fitch, your money mascot 🦊</div>
      </section>

      {/* Auth panel */}
      <section className="flex flex-col items-center justify-center p-8">
        <div className="mb-8 flex items-center gap-2 text-lg font-extrabold lg:hidden">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">💸</span>
          FinBud
        </div>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold">Welcome 👋</h2>
          <p className="mt-1 text-sm text-muted">Jump in with the demo, or sign in.</p>
        </div>
        <LoginForm notice={notice} />
      </section>
    </main>
  );
}
