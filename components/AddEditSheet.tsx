"use client";

import { useMemo, useState } from "react";
import Sheet from "./Sheet";
import SelectSheet from "./SelectSheet";
import ConfirmDialog from "./ConfirmDialog";
import { calcDerived, getDispLDL } from "@/lib/calc.js";
import { parseNum, validateReading } from "@/lib/validation.js";
import type { Profile, Reading, Source } from "@/lib/types";

/** datetime-local wants `YYYY-MM-DDTHH:mm` in local time, not an ISO instant. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const FIELDS = [
  { key: "tc", label: "Total Cholesterol" },
  { key: "hdl", label: "HDL" },
  { key: "ldl", label: "LDL (as reported)" },
  { key: "tg", label: "Triglycerides" },
] as const;

export default function AddEditSheet({
  reading, profile, onSave, onClose,
}: {
  reading: Reading | null;
  profile: Profile;
  onSave: (r: Omit<Reading, "id"> & { id?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    timestamp: toLocalInput(reading?.timestamp ?? new Date().toISOString()),
    source: (reading?.source ?? profile.defaultSource) as Source,
    sourceName:
      reading?.sourceName ??
      (profile.defaultSource === "Lab" ? profile.defaultLabSource : profile.defaultDevice) ??
      "",
    tc: reading?.tc?.toString() ?? "",
    hdl: reading?.hdl?.toString() ?? "",
    ldl: reading?.ldl?.toString() ?? "",
    tg: reading?.tg?.toString() ?? "",
    apobMeasured: reading?.apobMeasured?.toString() ?? "",
    notes: reading?.notes ?? "",
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<string[] | null>(null);   // warnings awaiting confirmation
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const pool = f.source === "Lab" ? profile.labSources : profile.homeDevices;

  /* Switching source type repoints the name at the matching pool — a device can
     never be recorded as a lab, which is the point of keeping them separate. */
  const setSource = (src: Source) =>
    setF((p) =>
      p.source === src
        ? p
        : {
            ...p,
            source: src,
            sourceName:
              (src === "Lab" ? profile.labSources : profile.homeDevices)[0] ?? "",
            apobMeasured: src === "Lab" ? p.apobMeasured : "",
          });

  /* Live preview of what will be derived, so the effect of an entry is visible
     while typing rather than only after saving. */
  const preview = useMemo(() => {
    const r = {
      tc: parseNum(f.tc), hdl: parseNum(f.hdl), ldl: parseNum(f.ldl), tg: parseNum(f.tg),
      apobMeasured: parseNum(f.apobMeasured), source: f.source,
    };
    const d = calcDerived(r, profile.apobMethod);
    return { d, ldl: getDispLDL(r, d, profile.ldlMethod) };
  }, [f, profile.apobMethod, profile.ldlMethod]);

  const payload = () => ({
    ...(reading?.id ? { id: reading.id } : {}),
    timestamp: new Date(f.timestamp).toISOString(),
    source: f.source,
    sourceName: f.sourceName,
    tc: parseNum(f.tc), hdl: parseNum(f.hdl), ldl: parseNum(f.ldl), tg: parseNum(f.tg),
    apobMeasured: f.source === "Lab" ? parseNum(f.apobMeasured) : null,
    notes: f.notes.trim().slice(0, 300),
  });

  async function commit() {
    setBusy(true);
    await onSave(payload());
    onClose();
  }

  function attemptSave() {
    const { errors: errs, warnings } = validateReading(f);
    setErrors(errs);
    if (errs.length) return;
    // Out-of-range values save, but are confirmed first: a stray digit (1111
    // for 111) is caught before it lands in the record.
    if (warnings.length) return setPending(warnings);
    void commit();
  }

  const input =
    "w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-base outline-none";

  return (
    <>
      <Sheet
        title={reading ? "Edit reading" : "Add reading"}
        onClose={onClose}
        footer={
          <button
            onClick={attemptSave}
            disabled={busy}
            className="pressable w-full rounded-lg bg-strong py-3 font-bold text-on-strong disabled:opacity-50"
          >
            {busy ? "Saving…" : reading ? "Save changes" : "Save reading"}
          </button>
        }
      >
        {errors.length > 0 && (
          <div className="mb-4 rounded-lg border border-danger bg-danger-bg px-3 py-3 text-danger">
            {errors.map((e) => <p key={e}>{e}</p>)}
          </div>
        )}

        <label className="mb-1 block text-ink-soft" htmlFor="ll-when">When</label>
        <input
          id="ll-when" type="datetime-local" className={input}
          value={f.timestamp} onChange={(e) => set("timestamp", e.target.value)}
        />

        <p className="mt-4 mb-1 text-ink-soft">Source</p>
        <div className="flex gap-2">
          {(["POC", "Lab"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              aria-pressed={f.source === s}
              className={`min-w-0 flex-1 rounded-lg border py-2.5 font-semibold ${
                f.source === s ? "border-strong bg-paper-2" : "border-line"
              }`}
            >
              {s === "POC" ? "Home device" : "Lab"}
            </button>
          ))}
        </div>
        <button
          onClick={() => setPicking(true)}
          className="pressable mt-2 flex w-full items-center justify-between rounded-lg border border-line px-3 py-2.5 text-left"
        >
          <span className="truncate">{f.sourceName || "Choose…"}</span>
          <span className="shrink-0 text-ink-soft">Change</span>
        </button>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {FIELDS.map((fl) => (
            <div key={fl.key} className="min-w-0">
              <label className="mb-1 block text-ink-soft" htmlFor={`ll-${fl.key}`}>{fl.label}</label>
              <input
                id={`ll-${fl.key}`} type="number" inputMode="decimal" placeholder="mg/dL"
                className={input} value={f[fl.key]}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => set(fl.key, e.target.value)}
              />
            </div>
          ))}
          {/* Manual ApoB is accepted for lab draws only; a home device does not
              measure it, so offering the field there would invite fiction. */}
          {f.source === "Lab" && (
            <div className="min-w-0">
              <label className="mb-1 block text-ink-soft" htmlFor="ll-apob">ApoB (measured)</label>
              <input
                id="ll-apob" type="number" inputMode="decimal" placeholder="mg/dL"
                className={input} value={f.apobMeasured}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => set("apobMeasured", e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-baseline justify-between">
            <label className="text-ink-soft" htmlFor="ll-notes">Notes</label>
            <span className="text-ink-faint">{f.notes.length}/300</span>
          </div>
          <textarea
            id="ll-notes" rows={3} className={input} value={f.notes}
            placeholder="Optional: medication changes, fasting status, context…"
            onChange={(e) => set("notes", e.target.value.slice(0, 300))}
          />
        </div>

        {(preview.ldl || preview.d.apob != null) && (
          <div className="mt-4 border-y border-line py-3">
            <p className="mb-2 text-[13px] font-semibold tracking-[0.04em] text-ink-faint">
              Will be calculated
            </p>
            <dl className="space-y-1">
              {preview.ldl && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-soft">LDL-C ({preview.ldl.label})</dt>
                  <dd className="tabular font-semibold">{preview.ldl.value} mg/dL</dd>
                </div>
              )}
              {preview.d.nonHDL != null && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-soft">Non-HDL</dt>
                  <dd className="tabular font-semibold">{preview.d.nonHDL} mg/dL</dd>
                </div>
              )}
              {preview.d.apob != null && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-soft">ApoB ({preview.d.apobLabel})</dt>
                  <dd className="tabular font-semibold">{preview.d.apob} mg/dL</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </Sheet>

      {picking && (
        <SelectSheet
          title={f.source === "Lab" ? "Lab source" : "Home device"}
          options={pool.map((p) => ({ value: p, label: p }))}
          current={f.sourceName}
          onSelect={(v) => { set("sourceName", v); setPicking(false); }}
          onClose={() => setPicking(false)}
          footer="Home devices and lab sources are kept as separate lists, so a device can never be recorded as a lab result. Manage them in Settings."
        />
      )}

      {pending && (
        <ConfirmDialog
          title="Double-check this reading"
          message={
            <>
              {pending.map((w) => <p key={w} className="mb-2 last:mb-0">{w}</p>)}
              <p className="mt-2">Save it anyway?</p>
            </>
          }
          confirmLabel="Save anyway"
          onConfirm={() => { setPending(null); void commit(); }}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  );
}
