"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Email + password sign-in.
 *
 * There is deliberately no sign-up and no password-reset flow: this is a
 * single-user personal tracker, so the account is created once in the Supabase
 * dashboard and the password is changed from Settings while signed in. That
 * keeps the app from needing to send any email at all in normal use — see
 * SETUP.md.
 */
export default function LoginPage() {
  const configured = isSupabaseConfigured();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      // replace(), not push() — the login page should not sit in history behind
      // a signed-in session.
      router.replace("/");
    } catch (err) {
      setBusy(false);
      setError(
        err instanceof Error ? err.message : "Couldn't sign in. Check your details.",
      );
    }
  }

  const inputCls =
    "w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-base outline-none transition-colors focus:border-ink";

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">LipidLog</h1>
          <p className="mt-1 text-ink-soft">Longitudinal cholesterol tracking</p>
        </div>

        {!configured ? (
          /* No project configured, so there is genuinely nothing to sign in to.
             Saying so is better than presenting a gate that cannot enforce
             anything — which is what the prototype used to do. */
          <div className="card p-5">
            <h2 className="font-bold">No account needed yet</h2>
            <p className="mt-2 leading-relaxed text-ink-soft">
              This build has no backend configured, so your readings are stored in this
              browser only. They are not synced, and clearing site data removes them.
            </p>
            <a
              href="/"
              className="pressable mt-4 block rounded-lg bg-strong px-4 py-3 text-center font-bold text-on-strong"
            >
              Continue
            </a>
          </div>
        ) : (
          <form onSubmit={submit} className="card p-5">
            <h2 className="font-bold">Sign in</h2>

            <label htmlFor="email" className="mt-4 mb-1.5 block text-ink-soft">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoFocus
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputCls}
            />

            <label htmlFor="password" className="mt-3 mb-1.5 block text-ink-soft">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              aria-invalid={error !== ""}
              aria-describedby={error ? "signin-error" : undefined}
              className={inputCls}
            />

            {error && (
              <p id="signin-error" role="alert" className="mt-2 text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !email.trim() || !password}
              className="pressable mt-4 w-full rounded-lg bg-strong py-3 font-bold text-on-strong disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center leading-relaxed text-ink-faint">
          For informational purposes only · not a substitute for medical advice
        </p>
      </div>
    </main>
  );
}
