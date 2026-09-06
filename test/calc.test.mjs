import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calcDerived, getDispLDL, getMHDiv, MH_TABLE, TG_CALC_MAX,
  MH_TABLE_IS_APPROXIMATE } from "../lib/calc.js";

/* ────────────────────────────────────────────────────────────────────────────
   1. FROZEN BASELINE

   A verbatim copy of the calculator as it stood in the original LipidLog.jsx
   prototype, before the logic was extracted into lib/calc.js. It exists for
   one purpose: to prove that the extraction and the triglyceride ceiling did
   not disturb any value inside the validated range. Do not "fix" it and do
   not import from it — it is a historical record, not live code.
   ──────────────────────────────────────────────────────────────────────────── */
const BASELINE_MH_TABLE = [
  [40,9.5],[50,8.9],[57,8.5],[65,8.0],[76,7.5],[90,7.0],[100,6.6],
  [114,6.2],[130,5.9],[150,5.6],[172,5.3],[195,5.0],[216,4.9],
  [245,4.8],[274,4.7],[311,4.5],[351,4.4],[401,4.3],
];
const baselineMHDiv = tg => { for (const [th,d] of BASELINE_MH_TABLE) if (tg < th) return d; return 4.0; };
function baselineCalcDerived(r, apobMethod) {
  const pn = v => (typeof v === "number" && isFinite(v) && v >= 0) ? v : null;
  const TC = pn(r.tc);
  const hdlRaw = pn(r.hdl);
  const HDL = (hdlRaw != null && hdlRaw > 0) ? hdlRaw : null;
  const TG = pn(r.tg);
  const d = {};
  if (TC != null && HDL != null) {
    const nh = TC - HDL;
    d.nonHDL = nh > 0 ? +nh.toFixed(1) : null;
    d.tcHdl = +(TC / HDL).toFixed(2);
  }
  if (TG != null && HDL != null) d.tgHdl = +(TG / HDL).toFixed(2);
  if (TC != null && HDL != null && TG != null) {
    const fr = TC - HDL - TG / 5;
    const mh = TC - HDL - TG / baselineMHDiv(TG);
    d.ldlFried = fr > 0 ? +fr.toFixed(1) : null;
    d.ldlMH    = mh > 0 ? +mh.toFixed(1) : null;
    if (d.ldlFried != null && d.ldlMH != null) d.ldlDelta = +(d.ldlMH - d.ldlFried).toFixed(1);
  }
  const labApoB = r.source === "Lab" ? pn(r.apobMeasured) : null;
  if (labApoB != null && labApoB > 0) { d.apob = labApoB; d.apobLabel = "Lab Measured"; }
  else if (d.nonHDL != null) {
    const est = apobMethod === "aggressive" ? 0.87 * d.nonHDL + 3 : 0.73 * d.nonHDL + 5;
    d.apob = est > 0 ? Math.round(est) : null;
    d.apobLabel = apobMethod === "aggressive" ? "Aggressive" : "INTERHEART";
  }
  return d;
}

/* ────────────────────────────────────────────────────────────────────────────
   2. EQUIVALENCE INSIDE THE VALIDATED RANGE

   The whole point of the handoff's "preserve that logic exactly" instruction.
   Any port of this calculator should be able to run this same sweep against
   its own implementation and get an identical result.
   ──────────────────────────────────────────────────────────────────────────── */
function* sweep() {
  for (let tc = 100; tc <= 320; tc += 10)
    for (let hdl = 25; hdl <= 90; hdl += 5)
      for (let tg = 20; tg < TG_CALC_MAX; tg += 7)
        for (const apobMethod of ["interheart","aggressive"])
          yield { r:{ tc, hdl, tg }, apobMethod };
}

test("extraction is behaviour-preserving for every TG below the ceiling", () => {
  let n = 0;
  for (const { r, apobMethod } of sweep()) {
    assert.deepEqual(calcDerived(r, apobMethod), baselineCalcDerived(r, apobMethod),
      `diverged at TC=${r.tc} HDL=${r.hdl} TG=${r.tg} (${apobMethod})`);
    n++;
  }
  assert.ok(n > 20000, `sweep too small to be meaningful: ${n} cases`);
});

test("divisor lookup matches the baseline across the whole validated range", () => {
  for (let tg = 0; tg < TG_CALC_MAX; tg++)
    assert.equal(getMHDiv(tg), baselineMHDiv(tg), `divisor diverged at TG=${tg}`);
});

test("the divisor table is flagged as an approximation of the published method", () => {
  /* The published Martin-Hopkins table selects on triglycerides AND non-HDL-C.
     This one does not. The flag exists so the gap cannot be forgotten, and this
     test fails the moment someone clears it without adding the second axis —
     at which point getMHDiv must actually vary with its nonHDL argument. */
  assert.equal(MH_TABLE_IS_APPROXIMATE, true,
    "if the real 180-cell table has landed, this test should be replaced by one that " +
    "asserts getMHDiv varies with non-HDL");
  const atLowNonHDL  = getMHDiv(150, 80);
  const atHighNonHDL = getMHDiv(150, 240);
  assert.equal(atLowNonHDL, atHighNonHDL,
    "the current table is one-dimensional, so non-HDL must not change the divisor");
});

/* ────────────────────────────────────────────────────────────────────────────
   3. DIVISOR TABLE BOUNDARIES

   Each entry applies to TG strictly below its bound. These are the exact
   points a reimplementation is most likely to get wrong by one unit.
   ──────────────────────────────────────────────────────────────────────────── */
test("each divisor boundary is strict, not inclusive", () => {
  for (const [bound, divisor] of MH_TABLE) {
    if (bound >= TG_CALC_MAX) continue;
    assert.equal(getMHDiv(bound - 1), divisor, `TG ${bound - 1} should still use ${divisor}`);
    assert.notEqual(getMHDiv(bound), divisor, `TG ${bound} should have moved past ${divisor}`);
  }
});

test("divisors decrease monotonically as triglycerides rise", () => {
  let prev = Infinity;
  for (let tg = 0; tg < TG_CALC_MAX; tg++) {
    const d = getMHDiv(tg);
    assert.ok(d <= prev, `divisor rose at TG=${tg}: ${prev} -> ${d}`);
    prev = d;
  }
});

/* ────────────────────────────────────────────────────────────────────────────
   4. THE TRIGLYCERIDE CEILING
   ──────────────────────────────────────────────────────────────────────────── */
test("no divisor is invented at or above the ceiling", () => {
  for (const tg of [TG_CALC_MAX, 401, 500, 1000, 5000])
    assert.equal(getMHDiv(tg), null, `TG=${tg} should have no divisor`);
});

test("both LDL estimates are withheld at or above the ceiling", () => {
  const d = calcDerived({ tc:300, hdl:40, tg:450 }, "interheart");
  assert.equal(d.ldlFried, null);
  assert.equal(d.ldlMH, null);
  assert.equal(d.ldlDelta, null);
  assert.equal(d.ldlCalcBlocked, true);
  assert.match(d.ldlCalcBlockedReason, /400 mg\/dL/);
});

test("the last reading below the ceiling still calculates", () => {
  const d = calcDerived({ tc:300, hdl:40, tg:TG_CALC_MAX - 1 }, "interheart");
  assert.ok(d.ldlMH != null && d.ldlFried != null);
  assert.ok(!d.ldlCalcBlocked);
});

test("non-HDL and ApoB survive above the ceiling — neither depends on the TG term", () => {
  const d = calcDerived({ tc:300, hdl:40, tg:450 }, "interheart");
  assert.equal(d.nonHDL, 260);
  assert.equal(d.apob, Math.round(0.73 * 260 + 5));
});

test("a blocked estimate falls back to the reported LDL and explains itself", () => {
  const r = { tc:300, hdl:40, tg:450, ldl:150 };
  const d = calcDerived(r, "interheart");
  const disp = getDispLDL(r, d, "martin-hopkins");
  assert.equal(disp.value, 150);
  assert.equal(disp.label, "Reported");
  assert.equal(disp.blocked, true);
  assert.ok(disp.blockedReason);
});

test("a blocked estimate with no reported LDL yields nothing rather than a guess", () => {
  const r = { tc:300, hdl:40, tg:450 };
  assert.equal(getDispLDL(r, calcDerived(r, "interheart"), "martin-hopkins"), null);
});

test("choosing the device value is still distinguishable from a blocked estimate", () => {
  const r = { tc:180, hdl:55, tg:100, ldl:105 };
  const disp = getDispLDL(r, calcDerived(r, "interheart"), "none");
  assert.equal(disp.label, "Device");
  assert.ok(!disp.blocked);
});

/* ────────────────────────────────────────────────────────────────────────────
   5. PARTIAL AND DEGENERATE READINGS
   ──────────────────────────────────────────────────────────────────────────── */
test("a reading without TG yields ratios but no LDL estimate", () => {
  const d = calcDerived({ tc:180, hdl:55 }, "interheart");
  assert.equal(d.nonHDL, 125);
  assert.equal(d.tcHdl, 3.27);
  assert.equal(d.ldlMH, undefined);
  assert.ok(!d.ldlCalcBlocked);
});

test("HDL of zero is rejected rather than dividing by it", () => {
  const d = calcDerived({ tc:180, hdl:0, tg:100 }, "interheart");
  assert.equal(d.tcHdl, undefined);
  assert.equal(d.nonHDL, undefined);
});

test("HDL at or above TC produces no non-HDL and therefore no estimated ApoB", () => {
  const d = calcDerived({ tc:50, hdl:60, tg:100 }, "interheart");
  assert.equal(d.nonHDL, null);
  assert.equal(d.apob, undefined);
});

test("a lab-measured ApoB wins over the estimate, but only for lab sources", () => {
  const lab  = calcDerived({ tc:180, hdl:55, tg:100, source:"Lab", apobMeasured:88 }, "interheart");
  assert.equal(lab.apob, 88);
  assert.equal(lab.apobLabel, "Lab Measured");
  const home = calcDerived({ tc:180, hdl:55, tg:100, source:"POC", apobMeasured:88 }, "interheart");
  assert.equal(home.apobLabel, "INTERHEART");
});

/* ────────────────────────────────────────────────────────────────────────────
   6. FIXTURE-DRIVEN CASES

   Two sets, and the difference between them matters.

   synthetic-readings.json is invented data. It catches drift — change any
   derived value and one of these fails — but it cannot establish that the
   calculator is clinically correct, because its expectations were written by
   us. They were at least derived independently of lib/calc.js (see the 'work'
   field on each case), so agreement is a cross-check rather than a tautology.

   validated-readings.json is the real thing: the six readings from personal
   test history named in LipidLog-CC-handoff.md. Until it is filled, nothing
   in this suite proves correctness against ground truth, so it reports as
   skipped rather than passing quietly.
   ──────────────────────────────────────────────────────────────────────────── */
const load = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

function checkAll(fixtures) {
  for (const { note, input, apobMethod = "interheart", expect } of fixtures.readings) {
    const d = calcDerived(input, apobMethod);
    for (const [key, want] of Object.entries(expect))
      assert.equal(d[key], want, `${note}: expected ${key}=${want}, got ${d[key]}`);
  }
}

const synthetic = load("synthetic-readings.json");

test("synthetic fixtures match independently derived expectations", () => {
  assert.ok(synthetic.readings.length >= 9, "synthetic set should cover the full range of behaviour");
  checkAll(synthetic);
});

test("synthetic fixtures span both sides of the ceiling", () => {
  const blocked = synthetic.readings.filter(r => r.expect.ldlCalcBlocked === true);
  const calculated = synthetic.readings.filter(r => r.expect.ldlMH != null);
  assert.ok(blocked.length >= 2, "need cases at and above the ceiling");
  assert.ok(calculated.length >= 4, "need cases that still calculate");
});

const validated = load("validated-readings.json");

test("validated readings reproduce their recorded expectations", { skip: validated.readings.length === 0
    ? "No real validated readings recorded yet — synthetic fixtures prove consistency, not correctness"
    : false }, () => {
  checkAll(validated);
});
