"use client";

import { useEffect, useState } from "react";
import { Download, FileText, KeyRound, LogOut, Monitor, UserRound } from "lucide-react";
import Header from "@/components/Header";
import Segmented from "@/components/Segmented";
import Sheet from "@/components/Sheet";
import { clearAppCache, useAppData } from "@/lib/use-app-data";
import ScreenState from "@/components/ScreenState";
import { SettingsSkeleton } from "@/components/Skeleton";
import { getReadingStore } from "@/lib/store";
import { downloadCSV } from "@/lib/csv";
import { getTheme, setTheme, type ThemeChoice } from "@/lib/theme";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { MH_TABLE_IS_APPROXIMATE } from "@/lib/calc.js";
import type { ApobMethod, LdlMethod, LpaUnit } from "@/lib/types";

const LDL_OPTS: { value: LdlMethod; label: string; sub: string }[] = [
  { value: "none", label: "Off", sub: "Use the reported LDL exactly as entered" },
  { value: "friedewald", label: "Friedewald", sub: "TC − HDL − TG/5, the classic estimate" },
  { value: "martin-hopkins", label: "Martin-Hopkins", sub: "Adjustable divisor, more accurate at normal TG" },
];
const APOB_OPTS: { value: ApobMethod; label: string; sub: string }[] = [
  { value: "interheart", label: "INTERHEART", sub: "Conservative, validated regression estimate" },
  { value: "aggressive", label: "Aggressive", sub: "Risk-weighted, yields a higher estimate" },
];

/**
 * Change password.
 *
 * This is the only way the password is ever set after the account is created —
 * there is no reset-by-email flow, deliberately (see app/login/page.tsx). It
 * requires an active session, which is why it lives here and not on /login.
 */
function PasswordSheet({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState("");

  async function save() {
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      setStatus("done");
      window.setTimeout(onClose, 900);
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Couldn't update password.");
    }
  }

  const inputCls =
    "w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-base outline-none transition-colors focus:border-ink";

  return (
    <Sheet title="Change password" onClose={onClose}>
      <label htmlFor="new-password" className="mt-2 mb-1.5 block text-ink-soft">
        New password
      </label>
      <input
        id="new-password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputCls}
      />

      <label htmlFor="confirm-password" className="mt-3 mb-1.5 block text-ink-soft">
        Confirm new password
      </label>
      <input
        id="confirm-password"
        type="password"
        autoComplete="new-password"
        placeholder="Type it again"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        className={inputCls}
      />

      {error && (
        <p role="alert" className="mt-2 text-danger">
          {error}
        </p>
      )}
      {status === "done" && <p className="mt-2 text-success">Password updated.</p>}

      <button
        type="button"
        onClick={save}
        disabled={status !== "idle"}
        className="pressable mt-4 w-full rounded-lg bg-strong py-3 font-bold text-on-strong disabled:opacity-50"
      >
        {status === "saving" ? "Saving…" : status === "done" ? "Saved" : "Update password"}
      </button>
    </Sheet>
  );
}

export default function SettingsPage() {
  const { loading, error, readings, profile, saveProfile } = useAppData();
  const [theme, setThemeState] = useState<ThemeChoice>("auto");
  const [lpa, setLpa] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [passwordSheet, setPasswordSheet] = useState(false);
  const configured = isSupabaseConfigured();

  useEffect(() => setThemeState(getTheme()), []);
  useEffect(() => setLpa(profile.lpa == null ? "" : String(profile.lpa)), [profile.lpa]);

  useEffect(() => {
    if (!configured) return;
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, [configured]);

  async function signOut() {
    await createClient().auth.signOut();
    /* Hard navigation, and drop the cached readings first: the cache is keyed
       to nothing but this document, so it must not survive into whoever signs
       in next. */
    clearAppCache();
    window.location.assign("/login");
  }

  if (error) return <ScreenState error={error} />;
  if (loading)
    return (
      <>
        <Header />
        <SettingsSkeleton />
      </>
    );

  const Row = ({ label, sub, right }: { label: React.ReactNode; sub?: string; right?: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4 px-4 py-4">
      <div className="min-w-0">
        <div>{label}</div>
        {sub && <div className="mt-0.5 text-ink-soft">{sub}</div>}
      </div>
      {right}
    </div>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h2 className="mt-8 mb-2.5 px-1 text-[13px] font-semibold tracking-[0.04em] text-ink-faint">
        {title}
      </h2>
      <div className="tile divide-y divide-line overflow-hidden">{children}</div>
    </section>
  );

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-28 sm:px-6 sm:pb-14 sm:pt-2">
        <h1 className="py-4 text-xl font-extrabold tracking-tight sm:pb-5 sm:pt-6 sm:text-3xl">Settings</h1>

        <Section title="Appearance">
          <Row
            label="Theme"
            right={
              <Segmented
                options={[
                  { value: "auto" as const, label: "Auto" },
                  { value: "light" as const, label: "Light" },
                  { value: "dark" as const, label: "Dark" },
                ]}
                value={theme}
                onChange={(v) => { setThemeState(v); setTheme(v); }}
                ariaLabel="Theme"
              />
            }
          />
        </Section>

        <Section title="Calculations">
          {LDL_OPTS.map((o) => (
            <button
              key={o.value}
              onClick={() => saveProfile({ ldlMethod: o.value })}
              className="pressable-row flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors"
            >
              <span className="min-w-0">
                <span className={`block ${profile.ldlMethod === o.value ? "font-bold" : ""}`}>
                  {o.label}
                </span>
                <span className="mt-0.5 block text-ink-soft">{o.sub}</span>
              </span>
              {profile.ldlMethod === o.value && <span aria-label="Selected">✓</span>}
            </button>
          ))}
        </Section>

        {MH_TABLE_IS_APPROXIMATE && (
          <p className="mt-2 px-4 leading-relaxed text-ink-soft">
            The published Martin-Hopkins method selects its divisor from triglycerides and
            non-HDL cholesterol together. This build selects on triglycerides alone, so its
            values are close to the method but not identical to it. Neither estimate is shown
            above 400&nbsp;mg/dL triglycerides, where both are invalid.
          </p>
        )}

        <Section title="ApoB method">
          {APOB_OPTS.map((o) => (
            <button
              key={o.value}
              onClick={() => saveProfile({ apobMethod: o.value })}
              className="pressable-row flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors"
            >
              <span className="min-w-0">
                <span className={`block ${profile.apobMethod === o.value ? "font-bold" : ""}`}>
                  {o.label}
                </span>
                <span className="mt-0.5 block text-ink-soft">{o.sub}</span>
              </span>
              {profile.apobMethod === o.value && <span aria-label="Selected">✓</span>}
            </button>
          ))}
        </Section>

        <Section title="Lp(a)">
          <div className="px-4 py-4">
            <p className="leading-relaxed text-ink-soft">
              Lp(a) is genetic and stable over time, so it is stored once here rather than per
              reading. It appears as context on every reading.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="number" inputMode="decimal" value={lpa} placeholder="e.g. 30"
                onChange={(e) => setLpa(e.target.value)}
                aria-label="Lp(a) value"
                className="w-full min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2.5 text-base outline-none"
              />
              <Segmented
                options={[
                  { value: "mg/dL" as LpaUnit, label: "mg/dL" },
                  { value: "nmol/L" as LpaUnit, label: "nmol/L" },
                ]}
                value={profile.lpaUnit}
                onChange={(v) => saveProfile({ lpaUnit: v })}
                ariaLabel="Lp(a) unit"
              />
              <button
                onClick={() => saveProfile({ lpa: lpa === "" ? null : Number(lpa) })}
                className="pressable shrink-0 rounded-lg bg-strong px-4 font-bold text-on-strong"
              >
                Save
              </button>
            </div>
          </div>
        </Section>

        <Section title="Export">
          <button
            onClick={() => downloadCSV(readings, profile.apobMethod)}
            disabled={readings.length === 0}
            className="pressable-row flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              <Download size={17} aria-hidden /> Export CSV
            </span>
            <span className="text-ink-soft">{readings.length} readings</span>
          </button>
        </Section>

        <Section title="Account">
          {configured ? (
            <>
              <Row
                label={
                  <span className="inline-flex items-center gap-2">
                    <UserRound size={17} aria-hidden /> Signed in
                  </span>
                }
                sub={email ?? "Loading…"}
              />
              <button
                onClick={() => setPasswordSheet(true)}
                className="pressable-row flex w-full items-center gap-2 px-4 py-4 text-left transition-colors"
              >
                <KeyRound size={17} aria-hidden /> Change password
              </button>
              <button
                onClick={signOut}
                className="pressable-row flex w-full items-center gap-2 px-4 py-4 text-left transition-colors"
              >
                <LogOut size={17} aria-hidden /> Sign out
              </button>
            </>
          ) : (
            <Row
              label={
                <span className="inline-flex items-center gap-2">
                  <Monitor size={17} aria-hidden /> This device only
                </span>
              }
              sub="No backend configured. Export CSV as a backup."
            />
          )}
        </Section>

        <Section title="Data">
          <button
            onClick={() => setConfirmClear(true)}
            className="pressable-row flex w-full items-center justify-between px-4 py-4 text-left text-danger transition-colors"
          >
            Clear all data
          </button>
        </Section>

        <Section title="Legal">
          <div className="flex gap-3 px-4 py-4 text-ink-soft">
            <FileText size={17} className="mt-0.5 shrink-0" aria-hidden />
            <p className="leading-relaxed">
              For informational purposes only. Does not replace professional medical advice.
              Always consult a qualified healthcare provider regarding your cardiovascular health.
            </p>
          </div>
        </Section>
      </main>

      {confirmClear && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-6">
          <div className="card w-full max-w-sm p-5">
            <h2 className="font-bold">Clear all data?</h2>
            <p className="mt-2 leading-relaxed text-ink-soft">
              This permanently deletes every reading. It cannot be undone.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmClear(false)}
                className="flex-1 rounded-lg border border-line py-2.5 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={async () => { await getReadingStore().clear(); location.reload(); }}
                className="flex-1 rounded-lg bg-danger py-2.5 font-bold text-white"
              >
                Delete everything
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordSheet && <PasswordSheet onClose={() => setPasswordSheet(false)} />}

    </>
  );
}
