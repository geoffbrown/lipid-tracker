"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Check, FileUp } from "lucide-react";
import Sheet from "./Sheet";
import { importCSV } from "@/lib/csv-import.js";
import type { Profile, Reading } from "@/lib/types";

type Parsed = ReturnType<typeof importCSV>;
type Incoming = Omit<Reading, "id">;

/**
 * CSV import.
 *
 * Deliberately two steps. Reading a file is cheap to undo before it is saved
 * and tedious afterwards — a hundred rows landing in someone's health record
 * is not something to do on a single tap — so the file is parsed, everything
 * that will happen is shown, and only then is anything written.
 *
 * What the preview has to answer, in this order: how many readings, how are
 * they split between home and lab, what is being skipped and why, and what did
 * the file leave ambiguous.
 */
export default function ImportSheet({
  profile, existing, onImport, onClose,
}: {
  profile: Profile;
  /** The current history, so a row already recorded is recognised as one. */
  existing: Reading[];
  onImport: (rows: Incoming[]) => Promise<number>;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [failed, setFailed] = useState("");

  async function pick(file: File) {
    setFailed("");
    setDone(null);
    setName(file.name);
    try {
      const text = await file.text();
      setParsed(
        importCSV(text, {
          existing,
          defaultSource: profile.defaultSource,
          defaultDevice: profile.defaultDevice ?? "",
          defaultLabSource: profile.defaultLabSource ?? "",
        }),
      );
    } catch {
      setFailed("That file could not be read.");
    }
  }

  async function commit() {
    if (!parsed?.ready?.length) return;
    setBusy(true);
    try {
      const n = await onImport(parsed.ready.map((r) => r.reading as Incoming));
      setDone(n);
      setParsed(null);
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "The import could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  /* importCSV returns either a refusal or a result; reading the fields through
     one set of defaults keeps every use below from restating that. */
  const ready = parsed?.ready ?? [];
  const skipped = parsed?.skipped ?? [];
  const duplicates = parsed?.duplicates ?? [];
  const unknown = parsed?.unknown ?? [];
  const lab = ready.filter((r) => r.reading.source === "Lab").length;
  const withNotes = ready.filter((r) => r.reading.notes).length;
  const withApoB = ready.filter((r) => r.reading.apobMeasured != null).length;
  const warned = ready.filter((r) => r.warnings.length);

  const Stat = ({ k, v }: { k: string; v: string | number }) => (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-ink-soft">{k}</dt>
      <dd className="tabular font-semibold">{v}</dd>
    </div>
  );

  return (
    <Sheet
      title="Import CSV"
      onClose={onClose}
      footer={
        done !== null ? (
          <button onClick={onClose} className="pressable w-full rounded-lg bg-strong py-3 font-bold text-on-strong">
            Done
          </button>
        ) : (
          <button
            onClick={commit}
            disabled={busy || ready.length === 0}
            className="pressable w-full rounded-lg bg-strong py-3 font-bold text-on-strong disabled:opacity-50"
          >
            {busy
              ? "Importing…"
              : ready.length
                ? `Import ${ready.length} reading${ready.length === 1 ? "" : "s"}`
                : "Import"}
          </button>
        )
      }
    >
      {done !== null ? (
        <div className="py-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-paper-2">
            <Check size={22} aria-hidden />
          </span>
          <p className="mt-4 font-semibold">
            Imported {done} reading{done === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-ink-soft">They are in your history now.</p>
        </div>
      ) : (
        <>
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); }}
          />
          <button
            onClick={() => input.current?.click()}
            className="pressable flex w-full items-center gap-3 rounded-lg border border-dashed border-line-strong px-4 py-5 text-left"
          >
            <FileUp size={20} className="shrink-0 text-ink-soft" aria-hidden />
            <span className="min-w-0">
              <span className="block font-semibold">{name || "Choose a CSV file"}</span>
              <span className="mt-0.5 block text-[13px] text-ink-soft">
                {name ? "Choose a different file" : "A LipidLog export, or any file with a date and lipid columns"}
              </span>
            </span>
          </button>

          {failed && <p role="alert" className="mt-4 text-danger">{failed}</p>}

          {parsed?.fatal && (
            <p role="alert" className="mt-4 rounded-lg border border-danger bg-danger-bg px-3 py-3 text-danger">
              {parsed.fatal}
            </p>
          )}

          {parsed && !parsed.fatal && (
            <>
              <dl className="tile mt-4 divide-y divide-line px-4 py-2">
                <Stat k="Readings to import" v={ready.length} />
                <Stat k="Home / Lab" v={`${ready.length - lab} / ${lab}`} />
                {withApoB > 0 && <Stat k="With measured ApoB" v={withApoB} />}
                {withNotes > 0 && <Stat k="With notes" v={withNotes} />}
                {duplicates.length > 0 && (
                  <Stat k="Already in your history" v={duplicates.length} />
                )}
                {skipped.length > 0 && <Stat k="Skipped" v={skipped.length} />}
              </dl>

              {/* Ambiguity is surfaced, not resolved quietly: 03/04 is two
                  different days and only the reader knows which. */}
              {parsed.dateOrder === "ambiguous" && (
                <Note>
                  Every date in this file could be read either way round, so they were read
                  as month/day. Check the dates after importing.
                </Note>
              )}
              {parsed.dateOrder === "conflict" && (
                <Note danger>
                  This file mixes month/day and day/month dates. Some readings will land on
                  the wrong day — fix the file before importing.
                </Note>
              )}
              {unknown.length > 0 && (
                <Note>
                  Not imported: {unknown.join(", ")}. LipidLog stores the panel it can
                  calculate from.
                </Note>
              )}
              {parsed.isOwnExport && (
                <Note>
                  This is a LipidLog export. The calculated columns are recomputed from your
                  readings rather than imported.
                </Note>
              )}

              {warned.length > 0 && (
                <Detail summary={`${warned.length} to double-check`}>
                  {warned.slice(0, 20).map((r) => (
                    <li key={r.line} className="py-1.5">
                      <span className="text-ink-soft">Line {r.line}:</span> {r.warnings.join(" ")}
                    </li>
                  ))}
                </Detail>
              )}

              {skipped.length > 0 && (
                <Detail summary={`${skipped.length} skipped`} danger>
                  {skipped.slice(0, 20).map((r) => (
                    <li key={r.line} className="py-1.5">
                      <span className="text-ink-soft">Line {r.line}:</span> {r.reasons.join(" ")}
                    </li>
                  ))}
                </Detail>
              )}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

function Note({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <p className={`mt-3 flex gap-2 text-[13px] leading-relaxed ${danger ? "text-danger" : "text-ink-soft"}`}>
      <AlertTriangle size={15} className="mt-px shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function Detail({
  summary, children, danger,
}: { summary: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <details className="tile mt-3 px-4 py-3">
      <summary className={`cursor-pointer font-semibold ${danger ? "text-danger" : ""}`}>
        {summary}
      </summary>
      <ul className="mt-2 divide-y divide-line text-[13px] leading-snug">{children}</ul>
    </details>
  );
}
