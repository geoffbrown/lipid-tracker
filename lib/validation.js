import { TG_CALC_MAX } from "./calc.js";

/* ════════════════════════════════════════════════════════════════════════════
   READING VALIDATION

   The block-vs-warn distinction is load-bearing and comes straight from
   Cholesterol_PRD_v3_3.md: only four things stop a save. Everything else warns
   and saves after confirmation, because an implausible reading is still real
   data and refusing it would lose it.

   Pure and dependency-free so it can be tested directly — these rules decide
   what lands in someone's health record, which is not a thing to leave to a
   form component.
   ════════════════════════════════════════════════════════════════════════════ */

/** Ranges outside which a value warns but still saves. */
export const WARN_RANGES = {
  tc: [80, 500],
  hdl: [10, 150],
  ldl: [20, 400],
  tg: [20, 1000],
  apobMeasured: [20, 250],
};

const LABELS = { tc: "TC", hdl: "HDL", ldl: "LDL", tg: "TG", apobMeasured: "ApoB" };

/** "" and null are absent, not zero. Anything unparseable is absent too, and
 *  is reported separately as non-numeric. */
export function parseNum(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const looksNumeric = v => v === "" || v == null || Number.isFinite(Number(v));

/**
 * @param form  raw field strings plus `source` and `timestamp`
 * @param now   injectable so the future-date rule is testable
 * @returns {{errors: string[], warnings: string[]}}
 */
export function validateReading(form, now = Date.now()) {
  const errors = [], warnings = [];
  const lipids = ["tc", "hdl", "ldl", "tg"];

  for (const k of [...lipids, "apobMeasured"])
    if (!looksNumeric(form[k])) errors.push(`${LABELS[k]} must be a number.`);

  const v = Object.fromEntries(
    [...lipids, "apobMeasured"].map(k => [k, parseNum(form[k])]));

  if (lipids.every(k => v[k] == null))
    errors.push("Enter at least one lipid value (TC, HDL, LDL, or TG).");

  for (const k of lipids)
    if (v[k] != null && v[k] < 0) errors.push(`${LABELS[k]} cannot be negative.`);
  if (v.apobMeasured != null && v.apobMeasured < 0) errors.push("ApoB cannot be negative.");

  if (v.hdl === 0) errors.push("HDL cannot be 0.");

  // Anything below is a warning: it saves once confirmed.
  const ts = Date.parse(form.timestamp);
  if (Number.isFinite(ts) && ts > now + 60000)
    warnings.push("The date and time are in the future.");

  for (const [k, [lo, hi]] of Object.entries(WARN_RANGES)) {
    // Manual ApoB is only collected for lab sources, so only checked there.
    if (k === "apobMeasured" && form.source !== "Lab") continue;
    if (v[k] != null && (v[k] < lo || v[k] > hi))
      warnings.push(
        `${LABELS[k]} of ${v[k]} is ${v[k] < lo ? "below" : "above"} the typical range (${lo}-${hi} mg/dL).`);
  }

  if (v.tc != null && v.hdl != null && v.hdl >= v.tc)
    warnings.push(
      "HDL is at or above total cholesterol, which isn't physiologically possible. " +
      "Non-HDL cholesterol and estimated ApoB can't be derived from this reading.");

  if (v.tg != null && v.tg >= TG_CALC_MAX)
    warnings.push(
      `Triglycerides of ${v.tg} mg/dL are at or above ${TG_CALC_MAX} mg/dL. Neither Friedewald ` +
      `nor Martin-Hopkins is valid there, so this reading will show the reported LDL instead.`);

  return { errors, warnings };
}
