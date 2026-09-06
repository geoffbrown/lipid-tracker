import test from "node:test";
import assert from "node:assert/strict";
import { validateReading, parseNum, WARN_RANGES } from "../lib/validation.js";

const NOW = Date.UTC(2026, 8, 6);
const form = (over = {}) => ({
  tc: "", hdl: "", ldl: "", tg: "", apobMeasured: "",
  source: "POC", timestamp: "2026-09-01T08:00", ...over,
});
const check = (over) => validateReading(form(over), NOW);

/* ────────────────────────────────────────────────────────────────────────────
   WHAT BLOCKS A SAVE

   Exactly four things, per the PRD. Anything that blocks more than this loses
   data the user actually has.
   ──────────────────────────────────────────────────────────────────────────── */
test("an empty reading is refused", () => {
  assert.match(check({}).errors.join(" "), /at least one lipid value/);
});

test("one lipid value is enough", () => {
  for (const k of ["tc", "hdl", "ldl", "tg"])
    assert.deepEqual(check({ [k]: "100" }).errors, [], `${k} alone should be savable`);
});

test("negative values are refused", () => {
  assert.match(check({ tc: "-1" }).errors.join(" "), /TC cannot be negative/);
});

test("HDL of zero is refused, because everything divides by it", () => {
  assert.match(check({ hdl: "0" }).errors.join(" "), /HDL cannot be 0/);
});

test("non-numeric input is refused rather than silently dropped", () => {
  assert.match(check({ tc: "one twenty" }).errors.join(" "), /TC must be a number/);
});

/* ────────────────────────────────────────────────────────────────────────────
   WHAT ONLY WARNS

   An implausible reading is still real data. Refusing it would lose it, so
   these save once confirmed.
   ──────────────────────────────────────────────────────────────────────────── */
test("out-of-range values warn but never block", () => {
  for (const [k, [lo, hi]] of Object.entries(WARN_RANGES)) {
    // ApoB is not itself a lipid value, so it needs one alongside it to be a
    // savable reading at all — that rule is exercised separately above.
    const base = k === "apobMeasured" ? { tc: "180" } : {};
    const over = check({ ...base, [k]: String(hi + 1), source: "Lab" });
    assert.deepEqual(over.errors, [], `${k} above range must not block`);
    assert.ok(over.warnings.length, `${k} above range should warn`);
    const under = check({ ...base, [k]: String(lo - 1), source: "Lab" });
    assert.deepEqual(under.errors, [], `${k} below range must not block`);
    assert.ok(under.warnings.length, `${k} below range should warn`);
  }
});

test("a physiologically impossible HDL warns and explains the consequence", () => {
  const r = check({ tc: "50", hdl: "60" });
  assert.deepEqual(r.errors, []);
  assert.match(r.warnings.join(" "), /isn't physiologically possible/);
});

test("triglycerides at the ceiling warn that the estimates are withheld", () => {
  const r = check({ tc: "300", hdl: "40", tg: "400" });
  assert.deepEqual(r.errors, []);
  assert.match(r.warnings.join(" "), /400 mg\/dL/);
  assert.deepEqual(check({ tc: "300", hdl: "40", tg: "399" }).warnings
    .filter(w => /Neither Friedewald/.test(w)), []);
});

test("a future timestamp warns, with a minute of tolerance for clock skew", () => {
  assert.ok(check({ tc: "180", timestamp: new Date(NOW + 3600e3).toISOString() }).warnings.length);
  assert.deepEqual(check({ tc: "180", timestamp: new Date(NOW - 1000).toISOString() }).warnings, []);
});

test("manual ApoB is only range-checked where it is collected", () => {
  assert.ok(check({ tc: "180", apobMeasured: "900", source: "Lab" }).warnings.length);
  assert.deepEqual(check({ tc: "180", apobMeasured: "900", source: "POC" }).warnings, [],
    "home readings do not collect a manual ApoB, so there is nothing to check");
});

test("parseNum treats blank as absent, not as zero", () => {
  assert.equal(parseNum(""), null);
  assert.equal(parseNum(null), null);
  assert.equal(parseNum("0"), 0);
  assert.equal(parseNum("abc"), null);
});
