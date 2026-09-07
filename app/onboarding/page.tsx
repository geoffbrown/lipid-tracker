"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft } from "lucide-react";
import { getProfileStore } from "@/lib/store";
import { DEFAULT_PROFILE, SEED_HOME, SEED_LAB, type Source } from "@/lib/types";

/**
 * Onboarding, per Cholesterol_PRD_v3_3.md — minus the HealthKit step, which has
 * no web equivalent.
 *
 * Three things carry the presentation, and each replaced something that read as
 * unfinished:
 *
 * 1. The screen is a composition, not a document. A `1fr` middle row centres
 *    short content optically, so a step no longer sits jammed under the header
 *    with a quarter-screen of dead space above the button.
 * 2. Repeated choices are one object with rows, not a stack of identical
 *    rounded rectangles. Four device pills and three fact cards were the
 *    "everything is a card" look; a grouped list divided by hairlines says the
 *    same thing as one thing.
 * 3. Selection is a fill, not a ring. An inset outline on a tile reads as a
 *    focus or error state — an inverted row is unambiguous at a glance.
 *
 * Secondary actions live in the top bar so the bottom holds a single
 * full-width primary. Nothing here blocks: every choice has a default and the
 * whole flow can be skipped, because a first-run wizard should not stand
 * between someone and their own data.
 */
const STEPS = 3;

/** The mark, so the first screen of the app says which app it is. */
function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path
          d="M1.5 13.5 L6 8 L10 10.5 L16.5 3"
          fill="none"
          stroke="var(--color-bm-ldl)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[15px] font-bold tracking-[-0.01em]">LipidLog</span>
    </span>
  );
}

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

  const h1 = "text-[31px] font-extrabold leading-[1.12] tracking-[-0.025em] text-balance";
  const lede = "mt-3 max-w-[32ch] text-[17px] leading-[1.45] text-ink-soft";
  const eyebrow = "text-[11px] font-semibold tracking-[0.08em] text-ink-faint";

  return (
    /* svh, not vh: on mobile Safari `vh` measures the viewport without the
       browser chrome, which pushes the primary action under the toolbar. */
    <main className="mx-auto grid min-h-[100svh] max-w-[600px] grid-rows-[auto_auto_1fr_auto] px-4">
      <header className="flex h-14 shrink-0 items-center justify-between">
        {step === 0 ? (
          <Wordmark />
        ) : (
          <button
            onClick={() => setStep((s) => s - 1)}
            aria-label="Back"
            className="pressable -ml-2 grid h-10 w-10 place-items-center rounded-full"
          >
            <ChevronLeft size={22} aria-hidden />
          </button>
        )}
        {step < STEPS - 1 && (
          <button onClick={finish} className="pressable -mr-2 px-2 py-2 text-ink-soft">
            Skip
          </button>
        )}
      </header>

      {/* Progress reads as position: three steps, this is which. */}
      <ol className="flex shrink-0 gap-1.5 pb-1" aria-label={`Step ${step + 1} of ${STEPS}`}>
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

      {/* Top-aligned on purpose: the headline holds the same position across all
          three steps, so moving between them reads as one screen changing rather
          than three unrelated ones. The remaining space is answered by giving
          each step enough to say, not by floating short content in the middle. */}
      <div key={step} className="step-in min-h-0 overflow-y-auto py-8">
        {step === 0 && (
          <section>
            <h1 className={h1}>Your numbers, understood</h1>
            <p className={lede}>
              Home devices under-report LDL, and skip ApoB entirely.
            </p>

            {/* The thesis of the app, demonstrated rather than described: the
                reading as entered on top, what follows from it underneath. The
                two halves answer the two halves of the sentence above. */}
            <div className="tile mt-8 overflow-hidden">
              <div className="px-4 pb-4 pt-4">
                <p className={eyebrow}>YOUR DEVICE SAID</p>
                <dl className="mt-2.5 flex gap-6">
                  {[["LDL", "92"], ["HDL", "60"], ["TG", "130"]].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[12px] text-ink-faint">{k}</dt>
                      <dd className="tabular text-[17px] text-ink-soft">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="border-t border-line px-4 pb-4 pt-4">
                <p className={eyebrow}>LIPIDLOG ADDS</p>
                <dl className="mt-2.5 flex gap-8">
                  {[
                    ["LDL", "99.6", "Martin-Hopkins", "var(--color-bm-ldl)"],
                    ["ApoB", "88", "INTERHEART", "var(--color-bm-apob)"],
                  ].map(([k, v, method, colour]) => (
                    <div key={k}>
                      <dt className="flex items-center gap-1.5 text-[12px] text-ink-soft">
                        <span
                          className="h-[6px] w-[6px] rounded-full"
                          style={{ background: colour }}
                          aria-hidden
                        />
                        {k}
                      </dt>
                      <dd className="tabular mt-0.5 text-[26px] font-semibold leading-none tracking-[-0.02em]">
                        {v}
                      </dd>
                      <p className="mt-1 text-[12px] text-ink-faint">{method}</p>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            <p className="mt-3.5 text-[13px] leading-relaxed text-ink-faint">
              Both are kept. A calculated value never overwrites what you measured,
              and every figure says which method produced it.
            </p>
          </section>
        )}

        {step === 1 && (
          <section>
            <h1 className={h1}>Where do you test?</h1>
            <p className={lede}>The default for new readings. Changeable on any one of them.</p>

            {/* The marks are the ones the chart draws, so the distinction is
                learned here and recognised there. */}
            <div className="mt-8 grid grid-cols-2 gap-2.5">
              {(
                [
                  ["POC", "At home", "Point-of-care", true],
                  ["Lab", "At a lab", "Blood draw", false],
                ] as const
              ).map(([value, title, sub, filled]) => {
                const on = source === value;
                return (
                  <button
                    key={value}
                    onClick={() => chooseSource(value)}
                    aria-pressed={on}
                    className={`pressable rounded-[0.875rem] px-4 py-4 text-left transition-colors duration-[var(--dur-fast)] ${
                      on ? "bg-strong text-on-strong" : "tile"
                    }`}
                  >
                    <svg width="10" height="10" aria-hidden className={on ? "" : "text-ink-soft"}>
                      {filled ? (
                        <circle cx="5" cy="5" r="4.2" fill="currentColor" />
                      ) : (
                        <circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
                      )}
                    </svg>
                    <span className="mt-2.5 block font-bold">{title}</span>
                    <span className={`mt-0.5 block text-[15px] ${on ? "opacity-70" : "text-ink-soft"}`}>
                      {sub}
                    </span>
                  </button>
                );
              })}
            </div>

            <h2 className={`mb-2.5 mt-7 ${eyebrow}`}>
              {source === "POC" ? "WHICH DEVICE" : "WHICH LAB"}
            </h2>
            {/* One object with rows, not four stacked rectangles. */}
            <div className="tile overflow-hidden">
              {pool.map((option, i) => {
                const on = name === option;
                return (
                  <button
                    key={option}
                    onClick={() => setName(option)}
                    aria-pressed={on}
                    className={`pressable-row flex w-full items-center justify-between px-4 py-3.5 text-left ${
                      i > 0 ? "border-t border-line" : ""
                    } ${on ? "font-semibold" : ""}`}
                  >
                    {option}
                    {on && <Check size={18} aria-hidden className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className={h1}>You&rsquo;re set</h1>
            <p className={lede}>
              New readings will default to{" "}
              <span className="font-semibold text-ink">{name}</span>.
            </p>

            <dl className="tile mt-8 overflow-hidden">
              {[
                ["Home and lab are marked differently",
                 "They disagree systematically, so the chart shows which is which."],
                ["A trend line needs three readings",
                 "Two points are a line already — a fit only means something past that."],
                ["Lp(a) is set once, in Settings",
                 "It is genetic and does not meaningfully change."],
              ].map(([term, desc], i) => (
                <div key={term} className={`px-4 py-3.5 ${i > 0 ? "border-t border-line" : ""}`}>
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
        className="shrink-0 bg-canvas pt-3"
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
