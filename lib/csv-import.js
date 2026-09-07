/* ════════════════════════════════════════════════════════════════════════════
   CSV IMPORT

   Parsing someone's lipid history is a data-integrity job, not a convenience
   feature, so this module is pure and dependency-free and carries its own
   tests. Three rules shape it:

   1. Validation is not duplicated. Rows go through the same validateReading()
      the add form uses, so a file cannot put a reading into the record that
      the form would have refused.
   2. Nothing is guessed silently. Where a file is ambiguous — the date order,
      an unrecognised column, a censored "<5" value — the ambiguity is reported
      rather than resolved by assumption.
   3. Derived values are never imported. LDL (MH), non-HDL, the ratios and the
      estimated ApoB are recomputed from the raw inputs at read time; reading
      them back in would freeze an estimate as though it were measured.
   ════════════════════════════════════════════════════════════════════════════ */

import { parseNum, validateReading } from "./validation.js";

/* ── RFC 4180 ─────────────────────────────────────────────────────────────── */

/**
 * Split CSV text into rows of raw string cells.
 *
 * Hand-written rather than split(",") because every field this app exports can
 * legitimately contain a comma — device names, notes, and the dates other
 * tools emit ("Sep 6, 2026"). A quoted newline inside a note is also normal,
 * so rows cannot be found by splitting on \n first.
 */
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  // A byte-order mark survives Excel's "Save as CSV" and would otherwise end
  // up glued to the first header name, breaking the column match.
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  const endField = () => { row.push(field); field = ""; };
  const endRow = () => { endField(); rows.push(row); row = []; };

  for (; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }   // escaped quote
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === "") { quoted = true; continue; }
    if (c === ",") { endField(); continue; }
    if (c === "\r") { if (text[i + 1] === "\n") i++; endRow(); continue; }
    if (c === "\n") { endRow(); continue; }
    field += c;
  }
  if (field !== "" || row.length) endRow();

  // Trailing blank lines are an artefact of the file ending in a newline.
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/* ── Columns ──────────────────────────────────────────────────────────────── */

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/* Header names carry units — "HDL (mg/dL)", "TG mg/dL" — which would otherwise
   normalise into the name and miss every alias. Only unit parentheticals are
   stripped, never all of them: "ApoB (Measured)" and "LDL (Device)" say which
   ApoB and which LDL, and collapsing those would lose the distinction this
   module exists to protect. */
const normHeader = (s) =>
  norm(
    String(s)
      .replace(/\(\s*(?:mg|mmol|nmol|ng|g)\s*\/\s*(?:dl|l|ml)\s*\)/gi, " ")
      .replace(/\b(?:mg|mmol|nmol|ng|g)\s*\/\s*(?:dl|l|ml)\b/gi, " "),
  );

/* Aliases cover this app's own export plus what labs and other trackers call
   the same columns. Matching is on letters and digits only, so "LDL-C",
   "ldl c" and "LDL (mg/dL)" all land together. */
export const FIELD_ALIASES = {
  timestamp: ["timestamp", "date", "datetime", "datetaken", "testdate", "collected", "collectiondate", "time"],
  source: ["source", "type", "sourcetype", "testtype"],
  sourceName: ["device", "sourcename", "devicename", "lab", "labname", "provider", "instrument"],
  tc: ["tc", "totalcholesterol", "cholesteroltotal", "cholesterol", "totchol", "tchol"],
  hdl: ["hdl", "hdlc", "hdlcholesterol", "cholesterolhdl"],
  ldl: ["ldldevice", "ldl", "ldlc", "ldlcholesterol", "ldlreported", "ldlasreported"],
  tg: ["tg", "triglycerides", "trig", "trigs", "triglyceride"],
  apobMeasured: ["apobmeasured", "measuredapob", "apolipoproteinb", "apolipoproteinb100", "apob"],
  notes: ["notes", "note", "comment", "comments", "remarks"],
};

/* Columns this app exports that are computed from the ones above. Recognised
   so they can be ignored deliberately rather than fought over by the alias
   table — "ApoB" in our own export is an estimate, not a measurement. */
const DERIVED = ["ldlmh", "ldlfried", "nonhdl", "apoblabel", "tchdl", "tghdl"];

/**
 * Match a header row to fields.
 *
 * Returns which column feeds which field, the derived columns being skipped,
 * and anything unrecognised — reported to the reader rather than dropped, so
 * an unimported column is a visible decision.
 */
export function mapHeader(header) {
  const cells = header.map(normHeader);
  const map = {};
  const derived = [];
  const unknown = [];

  /* Our own export carries computed columns. Their presence is what says a
     bare "ApoB" here is the estimate, so it must not be read as measured. */
  const isOwnExport = cells.includes("apoblabel") || cells.includes("ldlmh");

  cells.forEach((cell, idx) => {
    if (cell === "") return;
    if (DERIVED.includes(cell)) { derived.push(header[idx]); return; }
    if (isOwnExport && cell === "apob") { derived.push(header[idx]); return; }

    for (const [field, names] of Object.entries(FIELD_ALIASES)) {
      if (!names.includes(cell)) continue;
      if (map[field] === undefined) map[field] = idx;   // first wins
      return;
    }
    unknown.push(header[idx]);
  });

  return { map, derived, unknown, isOwnExport };
}

/* ── Values ───────────────────────────────────────────────────────────────── */

/**
 * A measurement, or a reason it is not one.
 *
 * Censored results ("<5", ">1000") are real findings but they are bounds, not
 * values; storing the bound as though it were measured would overstate what
 * the lab said. They are refused with an explanation instead.
 */
export function parseValue(raw) {
  const s = String(raw ?? "").trim();
  if (s === "") return { value: null };
  if (/^[<>≤≥]/.test(s))
    return { error: `"${s}" is a limit, not a measurement — enter the reading by hand if you know it` };
  // Strip a trailing unit and thousands separators: "1,234 mg/dL" -> 1234.
  const cleaned = s.replace(/,(?=\d{3}\b)/g, "").replace(/\s*(mg\/dl|mmol\/l|mg|nmol\/l)\s*$/i, "").trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return { error: `"${s}" is not a number` };
  return { value: n };
}

/** POC covers anything self-administered; Lab covers a drawn panel. */
export function normaliseSource(raw) {
  const s = norm(String(raw ?? ""));
  if (s === "") return null;
  if (["lab", "laboratory", "labdraw", "blooddraw", "venous", "serum", "labcorp", "quest"].includes(s)) return "Lab";
  if (["home", "poc", "pointofcare", "device", "homedevice", "fingerstick", "capillary", "self"].includes(s)) return "POC";
  return null;
}

/* ── Dates ────────────────────────────────────────────────────────────────── */

const SLASHED = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[ T]+(\d{1,2}):(\d{2}))?/;

/**
 * Decide whether slashed dates in this file are month-first or day-first.
 *
 * 03/04/2026 is two different days depending on where the file came from, and
 * guessing wrong moves a reading by up to eleven months. The file usually
 * settles it: any component above 12 can only be a day. Only when nothing in
 * the file exceeds 12 is it genuinely ambiguous, and then the caller is told
 * rather than the question being answered quietly.
 */
export function detectDateOrder(values) {
  let mdy = false;
  let dmy = false;
  let slashed = false;
  for (const v of values) {
    const m = SLASHED.exec(String(v ?? "").trim());
    if (!m) continue;
    slashed = true;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12) dmy = true;
    if (b > 12) mdy = true;
  }
  /* No slashed dates means nothing to be ambiguous about — ISO and "Sep 6,
     2026" both name their month. Saying "check the dates" over a file of ISO
     timestamps trains the reader to ignore the warning that matters. */
  if (!slashed) return "unambiguous";
  if (mdy && dmy) return "conflict";
  if (dmy) return "dmy";
  if (mdy) return "mdy";
  return "ambiguous";
}

const pad = (n) => String(n).padStart(2, "0");

/** Local wall-clock ISO, matching how the app stores a reading entered by hand. */
const iso = (y, mo, d, h = 0, mi = 0) => {
  const dt = new Date(y, mo - 1, d, h, mi);
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;   // 31 Feb
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00.000${
    (() => { const o = -dt.getTimezoneOffset(); const s = o < 0 ? "-" : "+";
             return `${s}${pad(Math.floor(Math.abs(o) / 60))}:${pad(Math.abs(o) % 60)}`; })()
  }`;
};

export function parseTimestamp(raw, order = "mdy") {
  const s = String(raw ?? "").trim();
  if (s === "") return { error: "no date" };

  // ISO first: this app's own export, and anything machine-generated.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.includes("T") || s.includes(" ") ? s.replace(" ", "T") : `${s}T00:00`);
    return Number.isNaN(d.getTime()) ? { error: `"${s}" is not a date` } : { value: d.toISOString() };
  }

  const m = SLASHED.exec(s);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += y < 70 ? 2000 : 1900;
    const dayFirst = order === "dmy" || (order !== "mdy" && a > 12);
    const value = iso(y, dayFirst ? b : a, dayFirst ? a : b, Number(m[4] ?? 0), Number(m[5] ?? 0));
    return value ? { value } : { error: `"${s}" is not a real date` };
  }

  // "Sep 6, 2026" — what this app renders, so what a copy-paste produces.
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? { error: `"${s}" is not a date` } : { value: d.toISOString() };
}

/* ── Duplicates ───────────────────────────────────────────────────────────── */

/**
 * Identity for de-duplication: when it was taken, from what, and what it said.
 *
 * Values are part of the key on purpose. Re-importing a corrected file adds a
 * row rather than overwriting one — a reading in a health record is never
 * silently replaced, and two rows the reader can see and delete beats one
 * they cannot.
 */
export function dupKey(r) {
  return [
    String(r.timestamp).slice(0, 16),
    r.source,
    String(r.sourceName ?? "").trim().toLowerCase(),
    r.tc, r.hdl, r.ldl, r.tg, r.apobMeasured,
  ].join("|");
}

/* ── The import ───────────────────────────────────────────────────────────── */

/**
 * Turn CSV text into readings ready to save, plus everything the reader needs
 * in order to decide whether to save them.
 *
 * Nothing is written here. The caller shows the result, and only a confirmed
 * import reaches the store.
 */
export function importCSV(text, opts = {}) {
  const {
    existing = [],
    defaultSource = "POC",
    defaultDevice = "",
    defaultLabSource = "",
    now = Date.now(),
  } = opts;

  const rows = parseCSV(text);
  if (rows.length === 0) return { fatal: "That file is empty." };

  const { map, derived, unknown, isOwnExport } = mapHeader(rows[0]);
  if (map.timestamp === undefined)
    return {
      fatal: "No date column found. The file needs a column named Date or Timestamp.",
      unknown,
    };
  if (["tc", "hdl", "ldl", "tg"].every((k) => map[k] === undefined))
    return {
      fatal: "No lipid columns found. The file needs at least one of TC, HDL, LDL or TG.",
      unknown,
    };

  const body = rows.slice(1);
  const at = (row, field) => (map[field] === undefined ? "" : row[map[field]] ?? "");
  const dateOrder = detectDateOrder(body.map((r) => at(r, "timestamp")));

  const ready = [];
  const skipped = [];
  const duplicates = [];
  const seen = new Set(existing.map(dupKey));

  body.forEach((row, i) => {
    const line = i + 2;                       // 1-based, and past the header
    const reasons = [];

    const ts = parseTimestamp(at(row, "timestamp"), dateOrder === "dmy" ? "dmy" : "mdy");
    if (ts.error) reasons.push(`Date: ${ts.error}`);

    const nums = {};
    for (const k of ["tc", "hdl", "ldl", "tg", "apobMeasured"]) {
      const parsed = parseValue(at(row, k));
      if (parsed.error) reasons.push(`${k.toUpperCase().replace("MEASURED", "")}: ${parsed.error}`);
      else nums[k] = parsed.value;
    }

    const source = normaliseSource(at(row, "source")) ?? defaultSource;
    const named = String(at(row, "sourceName") ?? "").trim();
    const sourceName = named || (source === "Lab" ? defaultLabSource : defaultDevice);

    if (reasons.length) { skipped.push({ line, reasons }); return; }

    /* The same rules the add form applies. An import must not be a way to put
       something into the record that typing it in would have refused. */
    const { errors, warnings } = validateReading(
      { ...nums, source, timestamp: ts.value }, now,
    );
    if (errors.length) { skipped.push({ line, reasons: errors }); return; }

    const reading = {
      timestamp: ts.value,
      source,
      sourceName,
      tc: nums.tc ?? null,
      hdl: nums.hdl ?? null,
      ldl: nums.ldl ?? null,
      tg: nums.tg ?? null,
      // Measured ApoB is a lab finding; a home device does not produce one.
      apobMeasured: source === "Lab" ? nums.apobMeasured ?? null : null,
      notes: String(at(row, "notes") ?? "").trim().slice(0, 300),
    };

    const key = dupKey(reading);
    if (seen.has(key)) { duplicates.push({ line, reading }); return; }
    seen.add(key);
    ready.push({ line, reading, warnings });
  });

  return {
    ready, skipped, duplicates,
    dateOrder, derived, unknown, isOwnExport,
    total: body.length,
  };
}

/** Only ever null for a home reading — kept as a named export for the tests. */
export const IMPORT_FIELDS = Object.keys(FIELD_ALIASES);
