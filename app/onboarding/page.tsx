"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getProfileStore } from "@/lib/store";
import { DEFAULT_PROFILE, SEED_HOME, SEED_LAB, type Source } from "@/lib/types";

/**
 * Onboarding, per Cholesterol_PRD_v3_3.md — minus the HealthKit step, which has
 * no web equivalent.
 *
 * Layout follows the convention people already know from native first-runs,
 * which also solves the crowding: secondary actions live in the top bar (back
 * on the left, skip on the right) so the bottom holds a single full-width
 * primary. Three actions competing in one row was the previous arrangement and
 * it made none of them read as the obvious next step.
 *
 * Nothing here blocks: every choice has a default and the whole flow can be
 * skipped, because a first-run wizard should not stand between someone and
 * their own data.
 */
const STEPS = 3;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [source, setSource] = useState<Source>(DEFAULT_PROFILE.defaultSource);
  const [name, setName] = useState<string>(SEED_HOME[0]);
  const [saving, setSaving] = useState(false);

  const pool = source === "POC" ? SEED_HOME : SEED_LAB;

  function chooseSource(next: Source) {
    setSource(next);
    setName(next === "POC" ? SEED_HOME[0] : SEED_LAB[0]);
  }

  async function finish() {
    setSaving(true);
    await getProfileStore().save({
      defaultSource: source,
      ...(source === "POC" ? { defaultDevice: name } : { defaultLabSource: name }),
      onboardedAt: new Date().toISOString(),
    });
    router.push("/");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[600px] flex-col px-4">
      <header className="flex h-14 shrink-0 items-center justify-between">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
          aria-label="Back"
          className="pressable -ml-2 grid h-10 w-10 place-items-center rounded-full disabled:invisible"
        >
          <ChevronLeft size={22} aria-hidden />
        </button>
        {step < STEPS - 1 && (
          <button onClick={finish} className="pressable -mr-2 px-2 py-2 text-ink-soft">
            Skip
          </button>
        )}
      </header>

      {/* Progress reads as position: three steps, this is which. */}
      <ol className="flex shrink-0 gap-1.5" aria-label={`Step ${step + 1} of ${STEPS}`}>
        {Array.from({ length: STEPS }, (_, i) => (
          <li
            key={i}
            aria-current={i === step ? "step" : undefined}
            className={`h-[3px] flex-1 rounded-full transition-colors duration-[var(--dur-fast)] ${
              i <= step ? "bg-strong" : "bg-line"
            }`}
          />
        ))}
      </ol>

      <div key={step} className="step-in flex-1 pt-9">
        {step === 0 && (
          <section>
            <h1 className="text-[30px] font-extrabold leading-[1.15] tracking-[-0.02em] text-balance">
              Your numbers, understood
            </h1>
            <p className="mt-3 max-w-[34ch] text-[17px] leading-relaxed text-ink-soft">
              Most home devices under-report LDL and skip ApoB entirely. LipidLog stores
              exactly what your device said, then calculates the rest.
            </p>

            {/* Show it rather than describe it: this is the readout, with real
                numbers, including the line that names where they came from. */}
            <div className="tile mt-7 px-4 py-4">
              <div className="flex items-center justify-between">
                <span
                  className="text-[13px] font-semibold tracking-[0.04em]"
                  style={{ color: "var(--color-bm-ldl)" }}
                >
                  LDL
                </span>
                <span className="text-[12px] text-ink-faint">mg/dL</span>
              </div>
              <div className="tabular mt-1.5 text-[27px] font-semibold leading-none tracking-[-0.01em]">
                99.6
              </div>
              <div className="relative mt-3.5 h-[9px] w-full" aria-hidden>
                <span className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-line-strong" />
                <span className="absolute top-0 h-full w-px bg-line-strong" style={{ left: "45%" }} />
                <span className="absolute top-0 h-full w-px bg-line-strong" style={{ left: "73%" }} />
                <span
                  className="absolute top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ left: "45%", background: "var(--color-bm-ldl)" }}
                />
              </div>
              <p className="mt-3 text-[13px] text-ink-soft">Martin-Hopkins</p>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">
              Every value says which method produced it. Your reported LDL is never
              overwritten.
            </p>
          </section>
        )}

        {step === 1 && (
          <section>
            <h1 className="text-[30px] font-extrabold leading-[1.15] tracking-[-0.02em] text-balance">
              Where do you test?
            </h1>
            <p className="mt-3 max-w-[34ch] text-[17px] leading-relaxed text-ink-soft">
              Just the default for new readings. You can change it on any reading.
            </p>

            {/* The marks are the ones the chart draws, so the distinction is
                learned here and recognised there. */}
            <div className="mt-7 grid grid-cols-2 gap-2">
              {(
                [
                  ["POC", "At home", "A point-of-care device", true],
                  ["Lab", "At a lab", "A drawn blood panel", false],
                ] as const
              ).map(([value, title, sub, filled]) => {
                const on = source === value;
                return (
                  <button
                    key={value}
                    onClick={() => chooseSource(value)}
                    aria-pressed={on}
                    className={`pressable tile px-4 py-4 text-left transition-shadow ${
                      on ? "shadow-[inset_0_0_0_2px_var(--color-strong)]" : ""
                    }`}
                  >
                    <svg width="10" height="10" aria-hidden className="text-ink-soft">
                      {filled ? (
                        <circle cx="5" cy="5" r="4.2" fill="currentColor" />
                      ) : (
                        <circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
                      )}
                    </svg>
                    <span className="mt-2 block font-bold">{title}</span>
                    <span className="mt-0.5 block text-[15px] leading-snug text-ink-soft">{sub}</span>
                  </button>
                );
              })}
            </div>

            <h2 className="mt-7 mb-2.5 text-[13px] font-semibold tracking-[0.04em] text-ink-faint">
              {source === "POC" ? "Which device" : "Which lab"}
            </h2>
            <div className="flex flex-col gap-2">
              {pool.map((option) => {
                const on = name === option;
                return (
                  <button
                    key={option}
                    onClick={() => setName(option)}
                    aria-pressed={on}
                    className={`pressable tile flex items-center justify-between px-4 py-3.5 text-left transition-shadow ${
                      on ? "shadow-[inset_0_0_0_2px_var(--color-strong)] font-semibold" : ""
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="text-[30px] font-extrabold leading-[1.15] tracking-[-0.02em] text-balance">
              You&rsquo;re set
            </h1>
            <p className="mt-3 max-w-[34ch] text-[17px] leading-relaxed text-ink-soft">
              New readings will default to{" "}
              <span className="font-semibold text-ink">{name}</span>.
            </p>

            <dl className="mt-7 flex flex-col gap-2">
              {[
                ["Home and lab are marked differently",
                 "They disagree systematically, so the chart shows which is which."],
                ["A trend line needs three readings",
                 "Two points are a line already — a fit only means something past that."],
                ["Lp(a) is set once, in Settings",
                 "It is genetic and does not meaningfully change."],
              ].map(([term, desc]) => (
                <div key={term} className="tile px-4 py-3.5">
                  <dt className="font-semibold">{term}</dt>
                  <dd className="mt-0.5 text-[15px] leading-snug text-ink-soft">{desc}</dd>
                </div>
              ))}
            </dl>

            {/* PRD §Legal: the disclaimer appears during onboarding and in Settings. */}
            <p className="mt-6 text-[13px] leading-relaxed text-ink-faint">
              For informational purposes only. This app does not replace professional
              medical advice, and nothing in it is a diagnosis. Always consult a qualified
              healthcare provider about your cardiovascular health.
            </p>
          </section>
        )}
      </div>

      <div
        className="sticky bottom-0 shrink-0 bg-canvas pb-5 pt-4"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={() => (step < STEPS - 1 ? setStep((s) => s + 1) : finish())}
          disabled={saving}
          className="pressable w-full rounded-xl bg-strong py-4 text-[17px] font-bold text-on-strong disabled:opacity-50"
        >
          {saving ? "Saving…" : step < STEPS - 1 ? "Continue" : "Add my first reading"}
        </button>
      </div>
    </main>
  );
}
