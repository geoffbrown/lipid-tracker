"use client";

import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import MetricReadout from "@/components/MetricReadout";
import ReadingRow from "@/components/ReadingRow";
import TrendChart from "@/components/TrendChart";
import BottomNav from "@/components/BottomNav";
import { useAppData } from "@/lib/use-app-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { BM } from "@/lib/biomarkers";

export default function DashboardPage() {
  const router = useRouter();
  const {
    loading, needsOnboarding, readings, profile, descending,
    latestFor, trendFor, provenanceFor, rowMetrics,
  } = useAppData();

  // First run: nothing saved and nothing recorded. Anyone with data already goes
  // straight to it — a wizard should never stand in front of it.
  if (needsOnboarding) router.replace("/onboarding");

  if (loading) {
    return <main className="grid min-h-screen place-items-center text-ink-soft">Loading…</main>;
  }

  return (
    <>
      <main className="mx-auto max-w-[600px] px-3 pb-24">
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
            {/* The panel readout: ruled columns on the page, not a row of cards. */}
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
                      /* Metric picker — ported with the remaining sheets. */
                    }}
                  />
                );
              })}
            </div>

            <TrendChart
              enriched={descending}
              ldlMethod={profile.ldlMethod}
              onPickMetric={() => {
                /* Metric picker — ported with the remaining sheets. */
              }}
            />

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
      <BottomNav />
    </>
  );
}
