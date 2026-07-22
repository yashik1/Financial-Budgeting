import { requireUser } from "@/lib/session";
import { isAiEnabled } from "@/lib/ai";
import { AiCoach } from "@/components/app/AiCoach";
import { Sparkles } from "lucide-react";

export default async function InsightsPage() {
  await requireUser();
  const enabled = isAiEnabled();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          AI Coach <Sparkles className="h-5 w-5 text-brand" />
        </h1>
        <p className="text-sm text-muted">Ask questions and get plain-English insights about your money.</p>
      </header>

      {enabled ? (
        <AiCoach />
      ) : (
        <div className="card space-y-3 p-6">
          <div className="flex items-center gap-2 font-bold">🦊 Meet your AI money coach</div>
          <p className="text-sm text-muted">
            Fitch can answer questions about your spending and surface insights — powered by the Claude API.
            It’s off until you add a key so the app runs free by default.
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Get a key at <span className="font-mono">console.anthropic.com</span>.</li>
            <li>
              Add <code className="rounded bg-surface-2 px-1">ANTHROPIC_API_KEY=…</code> to your <code className="rounded bg-surface-2 px-1">.env</code>.
            </li>
            <li>Restart the app — this page turns into a live chat.</li>
          </ol>
          <p className="text-xs text-muted">Uses the <span className="font-medium">claude-opus-4-8</span> model. Your financial context is sent only at question time and never stored by FinBud.</p>
        </div>
      )}
    </div>
  );
}
