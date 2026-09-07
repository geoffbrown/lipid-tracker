"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import MetricReadout from "./MetricReadout";
import ReadingRow from "./ReadingRow";
import TrendChart from "./TrendChart";
import SelectSheet from "./SelectSheet";
import AddEditSheet from "./AddEditSheet";
import ReadingDetail from "./ReadingDetail";
import { BM, BMS } from "@/lib/biomarkers";
import { useAppData, type Enriched } from "@/lib/use-app-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Reading } from "@/lib/types";

/* Reference ranges do double duty here: as the picker's subtitles they turn a
   bare list of abbreviations into something that teaches. */
const REF: Record<string, string> = {
  ldl: "Optimal < 100 · High ≥ 160", hdl: "Low < 40 · Protective ≥ 60",
  tc: "Desirable < 200 · High ≥ 240", tg: "Normal < 150 · High ≥ 200",
  apob: "Optimal < 90 · High ≥ 130", tcHdl: "Goal < 3.5 · lower is better",
  tgHdl: "Goal < 2.0 (insulin-sensitivity proxy)",
};

export default function DashboardScreen({ data }: { data: ReturnType<typeof useAppData> }) {
  const {
    readings, profile, saveProfile, saveReading, deleteReading,
    descending, latestFor, trendFor, provenanceFor, rowMetrics,
  } = data;

  const [cardPicker, setCardPicker] = useState<number | null>(null);
  const [editing, setEditing] = useState<Reading | null | undefined>(undefined); // undefined = closed
  const [detail, setDetail] = useState<Enriched | null>(null);

  /* Picking a metric already shown in another slot swaps the two rather than
     duplicating it. */
  const pickCard = (idx: number, key: string) => {
    const next = [...profile.cards];
    const held = next.indexOf(key);
    if (held !== -1 && held !== idx) next[held] = next[idx];
    next[idx] = key;
    void saveProfile({ cards: next });
  };

  return (
    <>
      <main className="mx-auto max-w-[600px] px-4 pb-28">
        <header className="flex items-center justify-between gap-3 py-4">
          <h1 className="text-xl font-extrabold tracking-tight">LipidLog</h1>
          <div className="flex items-center gap-2">
            {!isSupabaseConfigured() && (
              <span className="rounded-full border border-line px-2.5 py-1 text-ink-soft">
                This device only
              </span>
            )}
            <button
              onClick={() => setEditing(null)}
              className="pressable inline-flex items-center gap-1 rounded-full bg-strong px-4 py-2 font-bold text-on-strong"
            >
              <Plus size={16} aria-hidden /> Add
            </button>
          </div>
        </header>

        {readings.length === 0 ? (
          <div className="tile mt-6 px-4 py-12 text-center">
            <h2 className="font-semibold">No readings yet</h2>
            <p className="mt-1.5 text-ink-soft">
              Add your first reading and the trend will start building.
            </p>
            <button
              onClick={() => setEditing(null)}
              className="pressable mt-5 rounded-lg bg-strong px-5 py-3 font-bold text-on-strong"
            >
              Add a reading
            </button>
          </div>
        ) : (
          <>
            {/* The panel readout: ruled columns on the page, not a row of cards. */}
            <div className="mt-5 grid grid-cols-3 gap-2">
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
                    onPress={() => setCardPicker(idx)}
                  />
                );
              })}
            </div>

            <TrendChart enriched={descending} ldlMethod={profile.ldlMethod} />

            <h2 className="mt-8 mb-2.5 px-1 text-[13px] font-semibold tracking-[0.04em] text-ink-faint">
              Recent readings
            </h2>
            <div className="flex flex-col gap-2">
              {descending.slice(0, 5).map((r) => (
                <ReadingRow key={r.id} reading={r} metrics={rowMetrics(r)} onSelect={() => setDetail(r)} />
              ))}
            </div>
          </>
        )}
      </main>

      {cardPicker !== null && (
        <SelectSheet
          title="Show which metric"
          options={BMS.map((b) => ({ value: b.key, label: b.label, sub: REF[b.key] }))}
          current={profile.cards[cardPicker]}
          onSelect={(v) => { pickCard(cardPicker, v); setCardPicker(null); }}
          onClose={() => setCardPicker(null)}
          footer="Picking a metric already shown in another slot swaps the two."
        />
      )}

      {detail && (
        <ReadingDetail
          reading={detail}
          profile={profile}
          onEdit={() => { setEditing(detail); setDetail(null); }}
          onDelete={() => deleteReading(detail.id)}
          onClose={() => setDetail(null)}
        />
      )}

      {editing !== undefined && (
        <AddEditSheet
          reading={editing}
          profile={profile}
          onSave={saveReading}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
