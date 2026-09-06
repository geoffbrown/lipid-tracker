"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import MetricReadout, { type Biomarker, type Trend } from "@/components/MetricReadout";
import ReadingRow, { type RowMetric } from "@/components/ReadingRow";
import { getProfileStore, getReadingStore } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEFAULT_PROFILE, type Profile, type Reading } from "@/lib/types";
import { calcDerived, getDispLDL, metricValue } from "@/lib/calc.js";

/* Scales and marks come from the reference ranges the app already displays
   (ATP III-style, informational). The marks are the thresholds a reading is
   read against; the scale is the domain the rail spans. */
const BMS: Biomarker[] = [
  { key: "ldl",   label: "LDL",    unit: "mg/dL", color: "var(--color-bm-ldl)",
    lowerBetter: true,  scale: [0, 220], marks: [100, 160] },
  { key: "hdl",   label: "HDL",    unit: "mg/dL", color: "var(--color-bm-hdl)",
    lowerBetter: false, scale: [0, 100], marks: [40, 60] },
  { key: "tc",    label: "TC",     unit: "mg/dL", color: "var(--color-bm-tc)",
    lowerBetter: true,  scale: [0, 320], marks: [200, 240] },
  { key: "tg",    label: "TG",     unit: "mg/dL", color: "var(--color-bm-tg)",
    lowerBetter: true,  scale: [0, 300], marks: [150, 200] },
  { key: "apob",  label: "ApoB",   unit: "mg/dL", color: "var(--color-bm-apob)",
    lowerBetter: true,  scale: [0, 180], marks: [90, 130] },
  { key: "tcHdl", label: "TC/HDL", unit: "",      color: "var(--color-bm-tchdl)",
    lowerBetter: true,  scale: [0, 7],   marks: [3.5] },
  { key: "tgHdl", label: "TG/HDL", unit: "",      color: "var(--color-bm-tghdl)",
    lowerBetter: true,  scale: [0, 5],   marks: [2] },
];
const BM = (k: string): Biomarker | undefined => BMS.find((b) => b.key === k);
const fmtShort = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** A reading with its derived values attached. The shape comes from the
 *  calculator itself rather than being restated here, so the two cannot drift. */
type Derived = ReturnType<typeof calcDerived>;
type Enriched = Reading & { d: Derived };

export default function DashboardPage() {
  const router = useRouter();
  const [readings, setReadings] = useState<Reading[] | null>(null);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);

  useEffect(() => {
    (async () => {
      const [rows, saved] = await Promise.all([
        getReadingStore().list(),
        getProfileStore().get(),
      ]);
      const merged = { ...DEFAULT_PROFILE, ...(saved ?? {}) };
      // First run: nothing saved and nothing recorded. Anyone with data already
      // goes straight to it — a wizard should never stand in front of it.
      if (!merged.onboardedAt && rows.length === 0) {
        router.replace("/onboarding");
        return;
      }
      setProfile(merged);
      setReadings(rows);
    })();
  }, [router]);

  const enriched: Enriched[] = useMemo(
    () => (readings ?? []).map((r) => ({ ...r, d: calcDerived(r, profile.apobMethod) })),
    [readings, profile.apobMethod],
  );
  // Newest first, which is what both the cards and the list want.
  const descending = useMemo(
    () => [...enriched].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
    [enriched],
  );

  /* Cards read the whole history, not just the newest reading: a pinned metric
     should still show its last known value when the latest reading omitted it. */
  const latestFor = useCallback(
    (key: string) => {
      for (const r of descending) {
        const v = metricValue(r, key, profile.ldlMethod);
        if (v != null) return { value: v as number, reading: r };
      }
      return null;
    },
    [descending, profile.ldlMethod],
  );

  const trendFor = useCallback(
    (key: string): Trend | null => {
      const found: Enriched[] = [];
      for (const r of descending) {
        if (metricValue(r, key, profile.ldlMethod) != null) {
          found.push(r);
          if (found.length === 2) break;
        }
      }
      if (found.length !== 2) return null;
      const [now, prev] = found;
      const delta =
        (metricValue(now, key, profile.ldlMethod) as number) -
        (metricValue(prev, key, profile.ldlMethod) as number);
      return {
        delta: +delta.toFixed(1),
        since: fmtShort(prev.timestamp),
        crossSource: (now.source === "Lab") !== (prev.source === "Lab"),
        prevSource: prev.source === "Lab" ? "Lab" : "Home",
      };
    },
    [descending, profile.ldlMethod],
  );

  /* Where a number came from is the point of this app, so every card says it. */
  const provenanceFor = useCallback(
    (key: string, r: Enriched) => {
      if (key === "ldl") return getDispLDL(r, r.d, profile.ldlMethod)?.label ?? "Reported";
      if (key === "apob") return r.d.apobLabel ?? "Estimated";
      if (key === "tcHdl" || key === "tgHdl") return "Derived";
      return "Measured";
    },
    [profile.ldlMethod],
  );

  const rowMetrics = useCallback(
    (r: Enriched): RowMetric[] =>
      profile.cards
        .map((k) => {
          const v = metricValue(r, k, profile.ldlMethod);
          return v == null ? null : { key: k, label: BM(k)?.label ?? k, value: v as number };
        })
        .filter((m): m is RowMetric => m !== null),
    [profile.cards, profile.ldlMethod],
  );

  if (readings === null) {
    return (
      <main className="grid min-h-screen place-items-center text-ink-soft">Loading…</main>
    );
  }

  return (
    <main className="mx-auto max-w-[600px] px-3 pb-16">
      <header className="flex items-center justify-between py-4">
        <h1 className="text-xl font-extrabold tracking-tight">LipidLog</h1>
        {!isSupabaseConfigured() && (
          <span className="rounded-full border border-line px-2.5 py-1 text-ink-soft">
            This device only
          </span>
        )}
      </header>

      {readings.length === 0 ? (
        <div className="card mt-4 p-9 text-center">
          <Activity size={30} strokeWidth={1.5} className="mx-auto text-ink-faint" aria-hidden />
          <h2 className="mt-3 font-semibold">No readings yet</h2>
          <p className="mt-1.5 text-ink-soft">Add your first cholesterol reading to get started.</p>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 divide-x divide-line border-y border-line">
            {profile.cards.map((key, idx) => {
              const bm = BM(key);
              const found = latestFor(key);
              if (!bm) return <div key={idx} />;
              return (
                <MetricReadout
                  key={idx}
                  bm={bm}
                  value={found?.value ?? null}
                  provenance={found ? provenanceFor(key, found.reading) : "No readings yet"}
                  trend={found ? trendFor(key) : null}
                  onPress={() => {
                    /* Metric picker — ported with the rest of the sheets. */
                  }}
                />
              );
            })}
          </div>

          <h2 className="mt-8 mb-1 px-3 text-[13px] font-semibold tracking-[0.04em] text-ink-faint">
            Recent readings
          </h2>
          <div className="divide-y divide-line border-y border-line">
            {descending.slice(0, 5).map((r) => (
              <ReadingRow key={r.id} reading={r} metrics={rowMetrics(r)} onSelect={() => {}} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
