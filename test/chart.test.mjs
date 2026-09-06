import test from "node:test";
import assert from "node:assert/strict";
import { downsample, fitTrend, fmtSpan, MAX_CHART_POINTS } from "../src/chart.js";

const DAY = 86400000;
const T0 = Date.UTC(2026, 0, 5);
const rows = (n, source, from = T0, step = DAY) =>
  Array.from({ length: n }, (_, i) => ({ t: from + i * step, source, ldl: 100 + i }));

/* ────────────────────────────────────────────────────────────────────────────
   THE FITTED TREND LINE

   The chart's x-axis is a real time scale, so the fit has to weight readings by
   when they happened. Weighting by position instead — the old category-axis
   behaviour — is exactly the bug this replaced.
   ──────────────────────────────────────────────────────────────────────────── */
test("recovers an exact slope", () => {
  const f = fitTrend([{ x: T0, y: 100 }, { x: T0 + DAY, y: 90 }, { x: T0 + 2 * DAY, y: 80 }]);
  assert.equal(f.change, -20);
  assert.equal(f.days, 2);
  assert.ok(Math.abs(f.y1 - 100) < 1e-9);
  assert.ok(Math.abs(f.y2 - 80) < 1e-9);
});

test("weights by elapsed time, not by reading count", () => {
  /* Three clustered readings then a long gap. Fitting on position would let the
     cluster dominate; fitting on time must follow the real decline. */
  const f = fitTrend([
    { x: T0, y: 120 }, { x: T0 + 7 * DAY, y: 118 }, { x: T0 + 14 * DAY, y: 119 },
    { x: T0 + 200 * DAY, y: 95 },
  ]);
  assert.equal(f.days, 200);
  assert.ok(f.change < 0, `expected a downward trend, got ${f.change}`);
});

test("declines to fit what it cannot", () => {
  assert.equal(fitTrend([]), null);
  assert.equal(fitTrend([{ x: T0, y: 1 }]), null);
  // Two points are already joined by the series line; a "fit" would just retrace it.
  assert.equal(fitTrend([{ x: T0, y: 1 }, { x: T0 + DAY, y: 2 }]), null);
  // Same instant for every reading — no divide by zero, no vertical line.
  assert.equal(fitTrend([{ x: T0, y: 1 }, { x: T0, y: 2 }, { x: T0, y: 3 }]), null);
});

test("a flat history trends flat", () => {
  const f = fitTrend([0, 1, 2, 3].map(i => ({ x: T0 + i * DAY, y: 100 })));
  assert.equal(f.change, 0);
});

/* ────────────────────────────────────────────────────────────────────────────
   SPAN WORDING
   ──────────────────────────────────────────────────────────────────────────── */
test("spans read as a person would say them", () => {
  assert.equal(fmtSpan(1), "1 day");
  assert.equal(fmtSpan(9), "9 days");
  assert.equal(fmtSpan(21), "3 weeks");
  assert.equal(fmtSpan(200), "7 months");
  assert.equal(fmtSpan(900), "2.5 years");
});

/* ────────────────────────────────────────────────────────────────────────────
   DOWNSAMPLING

   Buckets must keep a usable timestamp and must not claim a source they do not
   have — the source mark is what tells a reader whether a step in the line is
   biology or a change of measurement method.
   ──────────────────────────────────────────────────────────────────────────── */
test("passes small sets through untouched", () => {
  const r = rows(10, "POC");
  const out = downsample(r);
  assert.equal(out.bucketed, false);
  assert.deepEqual(out.data, r);
});

test("buckets only above the cap", () => {
  assert.equal(downsample(rows(MAX_CHART_POINTS, "POC")).bucketed, false);
  const over = downsample(rows(MAX_CHART_POINTS + 1, "POC"));
  assert.equal(over.bucketed, true);
  assert.equal(over.original, MAX_CHART_POINTS + 1);
  assert.ok(over.data.length <= MAX_CHART_POINTS);
});

test("every bucket carries a real timestamp", () => {
  for (const b of downsample(rows(400, "POC")).data)
    assert.equal(typeof b.t, "number", "a bucket without a timestamp cannot be placed on a time axis");
});

test("a uniform bucket keeps its source", () => {
  assert.ok(downsample(rows(400, "POC")).data.every(b => b.source === "POC"));
  assert.ok(downsample(rows(400, "Lab")).data.every(b => b.source === "Lab"));
});

test("a bucket spanning both sources claims neither", () => {
  const mixed = [...rows(200, "POC"), ...rows(200, "Lab", T0 + 200 * DAY)];
  const out = downsample(mixed);
  assert.ok(out.data.some(b => b.source === "mixed"),
    "a bucket averaging home and lab readings must not be drawn as either");
  assert.ok(out.data.every(b => ["POC", "Lab", "mixed"].includes(b.source)));
});

test("averages ignore gaps rather than treating them as zero", () => {
  const r = [
    { t: T0,           source: "POC", ldl: 100 },
    { t: T0 + DAY,     source: "POC", ldl: null },
    { t: T0 + 2 * DAY, source: "POC", ldl: 140 },
  ];
  assert.equal(downsample(r, 1).data[0].ldl, 120);
});

test("a bucket with no values for a metric reports null, not zero", () => {
  const r = [
    { t: T0,       source: "POC", ldl: null },
    { t: T0 + DAY, source: "POC", ldl: null },
  ];
  assert.equal(downsample(r, 1).data[0].ldl, null);
});
