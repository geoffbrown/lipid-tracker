"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import Sheet from "./Sheet";
import ConfirmDialog from "./ConfirmDialog";
import SourceBadge from "./SourceBadge";
import { getDispLDL } from "@/lib/calc.js";
import type { Enriched } from "@/lib/use-app-data";
import type { Profile } from "@/lib/types";

/* General, non-diagnostic reference ranges (ATP III-style). Informational
   only — the app never classifies a reading as high or low. */
const REF: Record<string, string> = {
  ldl: "Optimal < 100 · High ≥ 160",
  hdl: "Low < 40 · Protective ≥ 60",
  tc: "Desirable < 200 · High ≥ 240",
  tg: "Normal < 150 · High ≥ 200",
  nonHDL: "Optimal < 130 · High ≥ 190",
  apob: "Optimal < 90 · High ≥ 130",
  tcHdl: "Goal < 3.5 · lower is better",
  tgHdl: "Goal < 2.0 (insulin-sensitivity proxy)",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default function ReadingDetail({
  reading, profile, onEdit, onDelete, onClose,
}: {
  reading: Enriched;
  profile: Profile;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const d = reading.d;
  const ldl = getDispLDL(reading, d, profile.ldlMethod);

  const rows: { key?: string; label: string; value: number | string; unit?: string; sub?: boolean }[] = [
    ...(ldl ? [{ key: "ldl", label: `LDL-C (${ldl.label})`, value: ldl.value, unit: "mg/dL" }] : []),
    ...(reading.ldl != null && profile.ldlMethod !== "none" && !ldl?.blocked
      ? [{ label: "LDL-C (as reported)", value: reading.ldl, unit: "mg/dL", sub: true }] : []),
    ...(d.ldlDelta != null && profile.ldlMethod === "martin-hopkins"
      ? [{ label: "Martin-Hopkins − Friedewald",
           value: `${d.ldlDelta >= 0 ? "+" : ""}${d.ldlDelta}`, unit: "mg/dL", sub: true }] : []),
    ...(reading.hdl != null ? [{ key: "hdl", label: "HDL-C", value: reading.hdl, unit: "mg/dL" }] : []),
    ...(reading.tc != null ? [{ key: "tc", label: "Total Cholesterol", value: reading.tc, unit: "mg/dL" }] : []),
    ...(reading.tg != null ? [{ key: "tg", label: "Triglycerides", value: reading.tg, unit: "mg/dL" }] : []),
    ...(d.nonHDL != null ? [{ key: "nonHDL", label: "Non-HDL Cholesterol", value: d.nonHDL, unit: "mg/dL" }] : []),
    ...(d.apob != null ? [{ key: "apob", label: `ApoB (${d.apobLabel})`, value: d.apob, unit: "mg/dL" }] : []),
    ...(d.tcHdl != null ? [{ key: "tcHdl", label: "TC/HDL Ratio", value: d.tcHdl }] : []),
    ...(d.tgHdl != null ? [{ key: "tgHdl", label: "TG/HDL Ratio", value: d.tgHdl }] : []),
  ];

  return (
    <>
      <Sheet title={fmtDate(reading.timestamp)} onClose={onClose}>
        <p className="mb-4 flex items-center gap-2 text-ink-soft">
          <SourceBadge source={reading.source} />
          {reading.sourceName} · {fmtTime(reading.timestamp)}
        </p>

        <div className="divide-y divide-line border-y border-line">
          {rows.map((r, i) => (
            <div key={i} className="flex items-start justify-between gap-4 px-1 py-3">
              <span className={r.sub ? "text-ink-soft" : ""}>{r.label}</span>
              <span className="shrink-0 text-right">
                <span className={`tabular font-semibold ${r.sub ? "text-ink-soft" : ""}`}>
                  {r.value}{r.unit ? ` ${r.unit}` : ""}
                </span>
                {!r.sub && r.key && REF[r.key] && (
                  <span className="mt-0.5 block text-[13px] text-ink-faint">{REF[r.key]}</span>
                )}
              </span>
            </div>
          ))}
        </div>

        {ldl?.blocked && (
          <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-3 leading-relaxed text-ink-soft">
            {ldl.blockedReason}
          </p>
        )}

        <p className="mt-3 text-[13px] text-ink-faint">
          Reference values are general guidance, not a diagnosis.
        </p>

        {profile.lpa != null && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-dashed border-line px-3 py-3">
            <span className="text-ink-soft">
              Lp(a) <span className="text-ink-faint">· stored once, not per reading</span>
            </span>
            <span className="tabular font-semibold">{profile.lpa} {profile.lpaUnit}</span>
          </div>
        )}

        {reading.notes && (
          <div className="mt-4">
            <p className="mb-1 text-[13px] font-semibold tracking-[0.04em] text-ink-faint">Notes</p>
            <p className="leading-relaxed">{reading.notes}</p>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onEdit}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-line py-3 font-semibold"
          >
            <Pencil size={16} aria-hidden /> Edit
          </button>
          <button
            onClick={() => setConfirming(true)}
            className="flex items-center justify-center gap-2 rounded-lg border border-line px-4 py-3 font-semibold text-danger"
          >
            <Trash2 size={16} aria-hidden /> Delete
          </button>
        </div>
      </Sheet>

      {confirming && (
        <ConfirmDialog
          title="Delete this reading?"
          message="This permanently removes the reading. It cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={async () => { await onDelete(); onClose(); }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
