"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

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
              className="mt-4 block rounded-lg bg-strong px-4 py-3 text-center font-bold text-on-strong"
            >
              Continue
            </a>
          </div>
        ) : sent ? (
          <div className="card p-5">
            <h2 className="font-bold">Check your inbox</h2>
            <p className="mt-2 leading-relaxed text-ink-soft">
              We sent a sign-in link to <span className="font-semibold text-ink">{email.trim()}</span>.
              Open it on this device to finish signing in.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 w-full rounded-lg border border-line py-2.5 font-semibold"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="card p-5">
            <h2 className="font-bold">Sign in</h2>
            <p className="mt-1 mb-4 leading-relaxed text-ink-soft">
              We&rsquo;ll email you a one-time link. No password to remember.
            </p>
            <input
              type="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-base outline-none"
            />
            {error && <p className="mt-2 text-danger">{error}</p>}
            <button
              type="submit"
              disabled={!valid || busy}
              className="mt-4 w-full rounded-lg bg-strong py-3 font-bold text-on-strong disabled:opacity-50"
            >
              {busy ? "Sending…" : "Email me a sign-in link"}
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
