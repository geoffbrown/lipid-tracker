import test from "node:test";
import assert from "node:assert/strict";
import { enrichReading, latestMetric, newestFirst } from "../lib/mcp/enrich.ts";
import { calcDerived } from "../lib/calc.js";
import { DEFAULT_PROFILE } from "../lib/types.ts";

/* The MCP projection must report exactly what the app computes. These tests
   pin it to calc.js and to the biomarker table rather than to hand-typed
   expectations, so a deliberate change to either flows through, and an
   accidental divergence between the screens and the tools fails here. */

const reading = (over = {}) => ({
  id: "00000000-0000-0000-0000-000000000001",
  timestamp: "2026-09-19T08:41:00.000Z",
  source: "POC",
  sourceName: "CURO L7/L5",
  tc: 125, hdl: 43, ldl: 73, tg: 45, apobMeasured: null, notes: "",
  ...over,
});

test("enrichReading mirrors calc.js under the account's methods", () => {
  const r = reading();
  const e = enrichReading(r, DEFAULT_PROFILE);
  const d = calcDerived(r, DEFAULT_PROFILE.apobMethod);

  assert.equal(e.source, "Home");
  assert.equal(e.metrics.ldl.value, d.ldlMH);
  assert.equal(e.metrics.ldl.provenance, "Martin-Hopkins");
  assert.equal(e.metrics.apob.value, d.apob);
  assert.equal(e.metrics.apob.provenance, "INTERHEART");
  assert.equal(e.metrics.nonHDL.value, d.nonHDL);
  assert.equal(e.metrics.tcHdl.value, d.tcHdl);
  assert.equal(e.metrics.tgHdl.value, d.tgHdl);
  assert.equal(e.metrics.hdl.provenance, "Measured");
  assert.deepEqual(e.inputs, { tc: 125, hdl: 43, ldl: 73, tg: 45, apobMeasured: null });
});

test("zones follow the published cut-points, inverted for HDL", () => {
  const e = enrichReading(reading(), DEFAULT_PROFILE);
  assert.equal(e.metrics.ldl.zone.label, "Optimal");
  assert.equal(e.metrics.ldl.zone.status, "good");
  assert.equal(e.metrics.hdl.zone.label, "Acceptable"); // 43 sits between 40 and 60
  assert.equal(e.metrics.hdl.zone.status, "mid");
  assert.equal(e.metrics.tgHdl.zone.label, "At goal");

  const high = enrichReading(reading({ tc: 260, hdl: 35, tg: 180 }), DEFAULT_PROFILE);
  assert.equal(high.metrics.hdl.zone.label, "Low");
  assert.equal(high.metrics.hdl.zone.status, "bad");
  assert.equal(high.metrics.tc.zone.label, "High");
  assert.equal(high.metrics.tc.zone.status, "bad");
});

test("a lab reading with measured ApoB reports it as measured", () => {
  const e = enrichReading(
    reading({ source: "Lab", sourceName: "LabCorp", apobMeasured: 71 }),
    DEFAULT_PROFILE,
  );
  assert.equal(e.source, "Lab");
  assert.equal(e.metrics.apob.value, 71);
  assert.equal(e.metrics.apob.provenance, "Lab Measured");
});

test("an out-of-range TG withholds the estimate and explains why", () => {
  const e = enrichReading(reading({ tg: 450 }), DEFAULT_PROFILE);
  assert.equal(e.metrics.ldl.value, 73);
  assert.equal(e.metrics.ldl.provenance, "Reported");
  assert.match(e.ldlNote, /400 mg\/dL/);
});

test("the friedewald method changes the reported LDL and its provenance", () => {
  const r = reading();
  const e = enrichReading(r, { ...DEFAULT_PROFILE, ldlMethod: "friedewald" });
  assert.equal(e.metrics.ldl.value, calcDerived(r, "interheart").ldlFried);
  assert.equal(e.metrics.ldl.provenance, "Friedewald");
});

test("latestMetric looks back for a metric the newest reading omitted", () => {
  const rows = newestFirst([
    reading({ id: "a", timestamp: "2026-09-01T08:00:00Z", tc: 180, hdl: 50, tg: 90 }),
    reading({ id: "b", timestamp: "2026-09-10T08:00:00Z", tc: null, hdl: 48, tg: null, ldl: 95 }),
    reading({ id: "c", timestamp: "2026-09-19T08:00:00Z", tc: null, hdl: 46, tg: null, ldl: 90 }),
  ]).map((r) => enrichReading(r, DEFAULT_PROFILE));

  const hdl = latestMetric(rows, "hdl");
  assert.equal(hdl.metric.value, 46);
  assert.equal(hdl.previous.value, 48);

  // Only the oldest reading carries TC, so that is the latest known value.
  const tc = latestMetric(rows, "tc");
  assert.equal(tc.metric.value, 180);
  assert.equal(tc.previous, null);

  // ApoB needs TC and HDL, so it too comes from the oldest reading.
  const oldest = reading({ tc: 180, hdl: 50, tg: 90 });
  assert.equal(latestMetric(rows, "apob").metric.value, calcDerived(oldest, "interheart").apob);
});
