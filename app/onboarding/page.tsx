"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Check, ChevronRight } from "lucide-react";
import { getProfileStore } from "@/lib/store";
import { DEFAULT_PROFILE, SEED_HOME, SEED_LAB, type Source } from "@/lib/types";

/**
 * Onboarding, per Cholesterol_PRD_v3_3.md — minus the HealthKit step, which has
 * no web equivalent. Three steps: what this is (with the disclaimer the Legal
 * section requires at first run), which source you usually test with, and done.
 *
 * Nothing here blocks: every choice has a default and the whole flow can be
 * skipped, because a first-run wizard should not stand between someone and
 * their own data.
 */
const STEPS = ["What this is", "Your usual source", "Ready"] as const;

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
    <main className="mx-auto flex min-h-screen max-w-[600px] flex-col px-3 py-6">
      {/* Progress reads as position, not decoration: three steps, this is which. */}
      <ol className="mb-8 flex gap-2" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <div
              className={`h-1 rounded-full ${i <= step ? "bg-strong" : "bg-line"}`}
              aria-current={i === step ? "step" : undefined}
            />
            <span className="sr-only">{label}</span>
          </li>
        ))}
      </ol>

      <div className="flex-1">
        {step === 0 && (
          <section>
            <Activity size={30} strokeWidth={1.5} aria-hidden />
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
              Cholesterol, tracked properly
            </h1>
            <p className="mt-3 leading-relaxed text-ink-soft">
              LipidLog stores what your device or lab actually reported, then calculates
              the values most home tests leave out — ApoB, non-HDL, and an LDL estimate
              that is usually closer than the one printed on the device.
            </p>
            <p className="mt-3 leading-relaxed text-ink-soft">
              Your reported LDL is never overwritten. Calculated values are shown
              alongside it, and every number says which method produced it.
            </p>
            {/* PRD §Legal: the disclaimer appears during onboarding and in Settings. */}
            <div className="card mt-6 p-4">
              <h2 className="font-semibold">Before you start</h2>
              <p className="mt-2 leading-relaxed text-ink-soft">
                This app is for informational purposes only. It does not replace
                professional medical advice, and nothing in it is a diagnosis. Always
                consult a qualified healthcare provider about your cardiovascular health.
              </p>
            </div>
          </section>
        )}

        {step === 1 && (
          <section>
            <h1 className="text-2xl font-extrabold tracking-tight">Where do you test?</h1>
            <p className="mt-3 leading-relaxed text-ink-soft">
              This only sets the default for new readings — you can change the source on
              any reading as you enter it, and changing this later never alters readings
              you have already saved.
            </p>

            <div className="mt-5 flex gap-2">
              {(
                [
                  ["POC", "At home", "A point-of-care device"],
                  ["Lab", "At a lab", "A drawn blood panel"],
                ] as const
              ).map(([value, title, sub]) => (
                <button
                  key={value}
                  onClick={() => chooseSource(value)}
                  aria-pressed={source === value}
                  className={`flex-1 rounded-xl border p-4 text-left ${
                    source === value ? "border-strong bg-paper-2" : "border-line bg-paper"
                  }`}
                >
                  <span className="block font-bold">{title}</span>
                  <span className="mt-0.5 block text-ink-soft">{sub}</span>
                </button>
              ))}
            </div>

            <h2 className="mt-6 mb-2 font-semibold">
              {source === "POC" ? "Which device?" : "Which lab?"}
            </h2>
            <div className="card divide-y divide-line overflow-hidden">
              {pool.map((option) => (
                <button
                  key={option}
                  onClick={() => setName(option)}
                  className="flex w-full items-center justify-between px-4 py-4 text-left"
                >
                  <span className={name === option ? "font-semibold" : ""}>{option}</span>
                  {name === option && <Check size={17} aria-label="Selected" />}
                </button>
              ))}
            </div>
            <p className="mt-3 leading-relaxed text-ink-faint">
              Home devices and labs are kept as separate lists, so a device can never be
              recorded as a lab result. You can add your own in Settings.
            </p>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="text-2xl font-extrabold tracking-tight">You&rsquo;re set</h1>
            <p className="mt-3 leading-relaxed text-ink-soft">
              New readings will default to{" "}
              <span className="font-semibold text-ink">{name}</span>. Add your first one and
              the dashboard will start showing trends — a fitted trend line needs three
              readings.
            </p>
            <div className="card mt-5 p-4">
              <h2 className="font-semibold">Two things worth knowing</h2>
              <ul className="mt-2 space-y-2 leading-relaxed text-ink-soft">
                <li>
                  Home devices and labs disagree systematically, so the chart marks which
                  is which — a filled dot is a home reading, a ring is a lab draw.
                </li>
                <li>
                  Lp(a) is set once in Settings rather than per reading. It is genetic and
                  does not meaningfully change.
                </li>
              </ul>
            </div>
          </section>
        )}
      </div>

      <div className="mt-8 flex items-center gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="rounded-lg border border-line px-4 py-3 font-semibold"
          >
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <>
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-strong py-3 font-bold text-on-strong"
            >
              Continue <ChevronRight size={17} aria-hidden />
            </button>
            <button onClick={finish} className="px-2 py-3 text-ink-soft">
              Skip
            </button>
          </>
        ) : (
          <button
            onClick={finish}
            disabled={saving}
            className="flex-1 rounded-lg bg-strong py-3 font-bold text-on-strong disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add my first reading"}
          </button>
        )}
      </div>
    </main>
  );
}
