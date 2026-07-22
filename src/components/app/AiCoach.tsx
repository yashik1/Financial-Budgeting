"use client";

import { useState, useTransition } from "react";
import { Sparkles, Send, RefreshCw, Bot } from "lucide-react";
import { askCoachAction, generateInsightsAction } from "@/app/(app)/insights/actions";

const SUGGESTIONS = [
  "How am I doing this month?",
  "Where can I cut back?",
  "Am I on track for my goals?",
  "What should I do with my leftover money?",
];

type Turn = { role: "user" | "coach"; text: string };

export function AiCoach() {
  const [insights, setInsights] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pendingInsights, startInsights] = useTransition();
  const [pendingChat, startChat] = useTransition();

  const genInsights = () =>
    startInsights(async () => {
      const res = await generateInsightsAction();
      setInsights(res.text ?? res.error ?? "");
    });

  const ask = (q: string) => {
    if (!q.trim() || pendingChat) return;
    setTurns((t) => [...t, { role: "user", text: q }]);
    setInput("");
    startChat(async () => {
      const res = await askCoachAction(q);
      setTurns((t) => [...t, { role: "coach", text: res.answer ?? res.error ?? "…" }]);
    });
  };

  return (
    <div className="space-y-6">
      {/* Insights */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-soft text-lg">🦊</span>
            <div>
              <h2 className="font-bold leading-tight">Fitch’s insights</h2>
              <p className="text-xs text-muted">AI-generated from your month</p>
            </div>
          </div>
          <button onClick={genInsights} disabled={pendingInsights} className="btn-ghost">
            <RefreshCw className={`h-4 w-4 ${pendingInsights ? "animate-spin" : ""}`} />
            {insights ? "Refresh" : "Generate"}
          </button>
        </div>
        {insights ? (
          <div className="whitespace-pre-wrap rounded-xl bg-surface-2 p-4 text-sm leading-relaxed">{insights}</div>
        ) : (
          <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">
            Tap <span className="font-semibold text-fg">Generate</span> and I’ll spot a few things about your spending.
          </p>
        )}
      </section>

      {/* Chat */}
      <section className="card flex min-h-[24rem] flex-col p-5">
        <div className="mb-3 flex items-center gap-2">
          <Bot className="h-4 w-4 text-brand" />
          <h2 className="font-bold">Ask your money anything</h2>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto">
          {turns.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} className="chip bg-surface-2 text-fg hover:bg-brand-soft hover:text-brand">
                  <Sparkles className="h-3.5 w-3.5" /> {s}
                </button>
              ))}
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className={t.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                  t.role === "user" ? "bg-brand text-white" : "bg-surface-2 text-fg"
                }`}
              >
                {t.text}
              </div>
            </div>
          ))}
          {pendingChat && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-surface-2 px-4 py-2.5 text-sm text-muted">Fitch is thinking…</div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="mt-3 flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Can I afford a $600 flight this month?"
            className="input"
          />
          <button type="submit" disabled={pendingChat || !input.trim()} className="btn-primary shrink-0">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </section>
    </div>
  );
}
