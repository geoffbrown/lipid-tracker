import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCSV, mapHeader, parseValue, normaliseSource,
  detectDateOrder, parseTimestamp, dupKey, importCSV,
} from "../lib/csv-import.js";

/* ── the parser ───────────────────────────────────────────────────────────── */

test("parseCSV keeps commas inside quoted fields", () => {
  const rows = parseCSV('a,b\n"Sep 6, 2026",180');
  assert.deepEqual(rows[1], ["Sep 6, 2026", "180"]);
});

test("parseCSV unescapes doubled quotes", () => {
  assert.deepEqual(parseCSV('note\n"He said ""fasting"""')[1], ['He said "fasting"']);
});

test("parseCSV keeps newlines inside a quoted note", () => {
  const rows = parseCSV('a,notes\r\n1,"line one\nline two"\r\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[1][1], "line one\nline two");
});

test("parseCSV handles CRLF, LF and a trailing newline alike", () => {
  assert.equal(parseCSV("a,b\r\n1,2\r\n").length, 2);
  assert.equal(parseCSV("a,b\n1,2\n").length, 2);
});

test("parseCSV strips a byte-order mark", () => {
  // Excel writes one, and it would otherwise glue itself to the first header.
  assert.equal(parseCSV("﻿Timestamp,TC\n2026-01-01,180")[0][0], "Timestamp");
});

test("parseCSV preserves empty cells rather than collapsing them", () => {
  assert.deepEqual(parseCSV("a,b,c\n1,,3")[1], ["1", "", "3"]);
});

/* ── columns ──────────────────────────────────────────────────────────────── */

test("mapHeader matches aliases regardless of case and punctuation", () => {
  const { map } = mapHeader(["Date", "LDL-C", "HDL (mg/dL)", "Total Cholesterol", "Trigs"]);
  assert.equal(map.timestamp, 0);
  assert.equal(map.ldl, 1);
  assert.equal(map.hdl, 2);
  assert.equal(map.tc, 3);
  assert.equal(map.tg, 4);
});

test("mapHeader reports unrecognised columns instead of dropping them", () => {
  const { unknown } = mapHeader(["Date", "TC", "Fasting?"]);
  assert.deepEqual(unknown, ["Fasting?"]);
});

test("mapHeader treats a bare ApoB as measured in a foreign file", () => {
  const { map } = mapHeader(["Date", "TC", "ApoB"]);
  assert.equal(map.apobMeasured, 2);
});

test("mapHeader treats a bare ApoB as derived in this app's own export", () => {
  // The estimate must never be read back in as a measurement — that would turn
  // a calculation into a lab finding, which is the one thing this app promises
  // it never does.
  const header = ["Timestamp", "TC", "ApoB (Measured)", "ApoB", "ApoB Label"];
  const { map, derived, isOwnExport } = mapHeader(header);
  assert.equal(isOwnExport, true);
  assert.equal(map.apobMeasured, 2);
  assert.ok(derived.includes("ApoB"));
});

/* ── values ───────────────────────────────────────────────────────────────── */

test("parseValue strips units and thousands separators", () => {
  assert.equal(parseValue("180 mg/dL").value, 180);
  assert.equal(parseValue("1,234").value, 1234);
  assert.equal(parseValue(" 99.6 ").value, 99.6);
});

test("parseValue treats blank as absent, not zero", () => {
  assert.equal(parseValue("").value, null);
  assert.equal(parseValue(null).value, null);
});

test("parseValue refuses a censored result rather than storing the bound", () => {
  // "<5" says the true value is below 5, not that it is 5.
  assert.ok(parseValue("<5").error);
  assert.ok(parseValue(">1000").error);
});

test("parseValue refuses text", () => {
  assert.ok(parseValue("pending").error);
});

test("normaliseSource maps the usual spellings both ways", () => {
  assert.equal(normaliseSource("Lab"), "Lab");
  assert.equal(normaliseSource("laboratory"), "Lab");
  assert.equal(normaliseSource("Home"), "POC");
  assert.equal(normaliseSource("point-of-care"), "POC");
  assert.equal(normaliseSource("fingerstick"), "POC");
  assert.equal(normaliseSource("???"), null);
});

/* ── dates ────────────────────────────────────────────────────────────────── */

test("detectDateOrder uses a component above 12 to settle the order", () => {
  assert.equal(detectDateOrder(["03/04/2026", "25/12/2026"]), "dmy");
  assert.equal(detectDateOrder(["03/04/2026", "12/25/2026"]), "mdy");
});

test("detectDateOrder reports ambiguity rather than assuming", () => {
  assert.equal(detectDateOrder(["03/04/2026", "05/06/2026"]), "ambiguous");
});

test("detectDateOrder reports a file that contradicts itself", () => {
  assert.equal(detectDateOrder(["25/12/2026", "12/25/2026"]), "conflict");
});

test("parseTimestamp reads the order it is given", () => {
  assert.equal(parseTimestamp("03/04/2026", "mdy").value.slice(0, 10), "2026-03-04");
  assert.equal(parseTimestamp("03/04/2026", "dmy").value.slice(0, 10), "2026-04-03");
});

test("parseTimestamp accepts ISO and the app's own rendered date", () => {
  assert.equal(parseTimestamp("2026-09-06T21:23:00Z").value.slice(0, 10), "2026-09-06");
  assert.equal(parseTimestamp("Sep 6, 2026").value.slice(0, 10), "2026-09-06");
});

test("parseTimestamp rejects a day that does not exist", () => {
  assert.ok(parseTimestamp("02/31/2026", "mdy").error);
});

/* ── the import ───────────────────────────────────────────────────────────── */

const HEAD = "Date,Source,Device,TC,HDL,LDL,TG,ApoB,Notes";

test("importCSV maps every field, including notes and lab ApoB", () => {
  const csv = `${HEAD}\n2026-08-15T09:00,Lab,LabCorp,184,59,102,118,82,"Fasting, 12h"`;
  const { ready } = importCSV(csv);
  assert.equal(ready.length, 1);
  const r = ready[0].reading;
  assert.equal(r.source, "Lab");
  assert.equal(r.sourceName, "LabCorp");
  assert.deepEqual([r.tc, r.hdl, r.ldl, r.tg], [184, 59, 102, 118]);
  assert.equal(r.apobMeasured, 82);
  assert.equal(r.notes, "Fasting, 12h");
});

test("importCSV drops a measured ApoB on a home reading", () => {
  // A point-of-care device does not measure ApoB, so a value in that column is
  // not one — the same rule the add form enforces.
  const csv = `${HEAD}\n2026-08-15,Home,CURO L7/L5,184,59,102,118,82,`;
  assert.equal(importCSV(csv).ready[0].reading.apobMeasured, null);
});

test("importCSV falls back to the chosen defaults when a row has no source", () => {
  const csv = "Date,TC,HDL\n2026-08-15,184,59";
  const { ready } = importCSV(csv, { defaultSource: "Lab", defaultLabSource: "Quest" });
  assert.equal(ready[0].reading.source, "Lab");
  assert.equal(ready[0].reading.sourceName, "Quest");
});

test("importCSV skips rows the add form would refuse, and says which line", () => {
  const csv = `${HEAD}\n2026-08-15,Lab,LabCorp,,,,,,\n2026-08-16,Lab,LabCorp,184,59,102,118,82,`;
  const { ready, skipped } = importCSV(csv);
  assert.equal(ready.length, 1);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].line, 2);          // 1-based, past the header
  assert.match(skipped[0].reasons.join(" "), /at least one lipid value/);
});

test("importCSV flags out-of-range values as warnings but still imports them", () => {
  // An implausible reading is still real data; refusing it would lose it.
  const csv = `${HEAD}\n2026-08-15,Lab,LabCorp,700,59,102,118,,`;
  const { ready } = importCSV(csv);
  assert.equal(ready.length, 1);
  assert.match(ready[0].warnings.join(" "), /above the typical range/);
});

test("importCSV skips rows already in the record", () => {
  const csv = `${HEAD}\n2026-08-15T09:00,Lab,LabCorp,184,59,102,118,82,`;
  const existing = importCSV(csv).ready.map((r) => r.reading);
  const again = importCSV(csv, { existing });
  assert.equal(again.ready.length, 0);
  assert.equal(again.duplicates.length, 1);
});

test("importCSV skips a row duplicated inside one file", () => {
  const row = "2026-08-15T09:00,Lab,LabCorp,184,59,102,118,82,";
  const { ready, duplicates } = importCSV(`${HEAD}\n${row}\n${row}`);
  assert.equal(ready.length, 1);
  assert.equal(duplicates.length, 1);
});

test("importCSV refuses a file with no date column", () => {
  assert.match(importCSV("TC,HDL\n180,60").fatal, /date column/i);
});

test("importCSV refuses a file with no lipid columns", () => {
  assert.match(importCSV("Date,Notes\n2026-08-15,hi").fatal, /lipid columns/i);
});

test("importCSV reports the date order it settled on", () => {
  assert.equal(importCSV(`${HEAD}\n25/12/2026,Lab,LabCorp,184,59,102,118,,`).dateOrder, "dmy");
  assert.equal(importCSV(`${HEAD}\n03/04/2026,Lab,LabCorp,184,59,102,118,,`).dateOrder, "ambiguous");
});

/* ── round trip ───────────────────────────────────────────────────────────── */

test("a LipidLog export imports back as the same readings", async () => {
  // The strongest guarantee this feature can offer: export, re-import, and the
  // raw record is unchanged — including which ApoB was measured and which was
  // calculated.
  const { toCSV } = await import("../lib/csv.ts");
  const originals = [
    { id: "1", timestamp: "2026-08-29T10:00:00.000Z", source: "POC", sourceName: "CURO L7/L5",
      tc: 180, hdl: 60, ldl: 99, tg: 110, apobMeasured: null, notes: "Morning, fasted" },
    { id: "2", timestamp: "2026-08-15T09:00:00.000Z", source: "Lab", sourceName: "LabCorp, Inc",
      tc: 184, hdl: 59, ldl: 102, tg: 118, apobMeasured: 82, notes: 'Said "fasting"' },
  ];

  const { ready, skipped, isOwnExport } = importCSV(toCSV(originals, "interheart"));
  assert.equal(skipped.length, 0);
  assert.equal(isOwnExport, true);
  assert.equal(ready.length, 2);

  for (const original of originals) {
    const found = ready.find((r) => Date.parse(r.reading.timestamp) === Date.parse(original.timestamp));
    assert.ok(found, `${original.timestamp} survived the round trip`);
    const { id, timestamp, ...rest } = original;
    const { timestamp: _t, ...got } = found.reading;
    assert.deepEqual(got, rest);
  }
});

test("the derived ApoB in an export is never imported as measured", () => {
  // A home reading has no measured ApoB but does get an estimate, and the
  // export writes both columns. Only the empty one may come back.
  const csv =
    "Timestamp,Source,Device,TC,HDL,LDL (Device),LDL (MH),TG,Non-HDL,ApoB (Measured),ApoB,ApoB Label,Notes\r\n" +
    "2026-08-29T10:00:00.000Z,Home,CURO L7/L5,180,60,99,99.6,110,120,,88,INTERHEART,";
  assert.equal(importCSV(csv).ready[0].reading.apobMeasured, null);
});

test("detectDateOrder finds nothing ambiguous in dates that name their month", () => {
  // ISO and "Sep 6, 2026" are unambiguous; warning about them would train the
  // reader to ignore the warning that matters.
  assert.equal(detectDateOrder(["2026-01-12", "2026-02-20"]), "unambiguous");
  assert.equal(detectDateOrder(["Sep 6, 2026"]), "unambiguous");
});
