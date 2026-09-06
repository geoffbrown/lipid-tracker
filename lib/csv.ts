import type { Reading } from "./types";
import { calcDerived } from "./calc.js";
import type { ApobMethod } from "./types";

/* Every field goes through this. Device names, notes and dates all contain
   commas in normal use, and an unquoted one silently shifts every later column
   — the file still opens, the numbers are just wrong. RFC 4180: quote when the
   value contains a comma, quote, CR or LF, and double any embedded quote. */
function cell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADER = [
  "Timestamp", "Source", "Device", "TC", "HDL", "LDL (Device)", "LDL (MH)", "LDL (Fried)",
  "TG", "Non-HDL", "ApoB", "ApoB Label", "TC/HDL", "TG/HDL", "Notes",
];

export function toCSV(readings: Reading[], apobMethod: ApobMethod): string {
  const rows = [...readings]
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .map((r) => {
      const d = calcDerived(r, apobMethod);
      /* ISO 8601 rather than a display date: readings are stored to minute
         precision, and a rendered date discards the time of day. */
      return [
        r.timestamp, r.source === "Lab" ? "Lab" : "Home", r.sourceName,
        r.tc, r.hdl, r.ldl, d.ldlMH, d.ldlFried, r.tg, d.nonHDL, d.apob, d.apobLabel,
        d.tcHdl, d.tgHdl, r.notes,
      ].map(cell).join(",");
    });
  return [HEADER.join(","), ...rows].join("\r\n");
}

export function downloadCSV(readings: Reading[], apobMethod: ApobMethod): void {
  const blob = new Blob([toCSV(readings, apobMethod)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: "lipidlog_export.csv" });
  a.click();
  URL.revokeObjectURL(url);
}
