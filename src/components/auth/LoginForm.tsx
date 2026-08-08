"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Sparkles, LogIn } from "lucide-react";
import { loginDemo, signIn, signUp } from "@/app/login/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation";

function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "One sec…" : children}
    </button>
  );
}

export function LoginForm({ notice }: { notice?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction] = useActionState(action, undefined);

  return (
    <div className="w-full max-w-sm">
      {notice && (
        <p className="mb-4 rounded-lg bg-negative/10 px-3 py-2 text-sm text-negative">{notice}</p>
      )}

      <form action={loginDemo}>
        <SubmitButton className="btn-primary w-full text-base shadow-glow">
          <Sparkles className="h-4 w-4" />
          Try the demo — no signup
        </SubmitButton>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        or use an account
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="space-y-3">
        {mode === "signup" && (
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input id="name" name="name" className="input" placeholder="Alex Rivera" autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="input" placeholder="you@example.com" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            className="input"
            placeholder="••••••••"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            {...(mode === "signup" && { minLength: MIN_PASSWORD_LENGTH, "aria-describedby": "password-hint" })}
          />
          {mode === "signup" && (
            <p id="password-hint" className="mt-1 text-xs text-muted">
              At least {MIN_PASSWORD_LENGTH} characters. A short phrase beats a short jumble.
            </p>
          )}
        </div>

        {state?.error && (
          <p className="rounded-lg bg-negative/10 px-3 py-2 text-sm text-negative">{state.error}</p>
        )}

        <SubmitButton className="btn-ghost w-full">
          <LogIn className="h-4 w-4" />
          {mode === "signin" ? "Sign in" : "Create account"}
        </SubmitButton>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        {mode === "signin" ? "New to FinBud?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="font-semibold text-brand hover:underline"
        >
          {mode === "signin" ? "Create one" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
