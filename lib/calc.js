/* ════════════════════════════════════════════════════════════════════════════
   BIOMARKER CALCULATIONS

   This module is the single source of truth for every derived lipid value in
   LipidLog. It is deliberately free of React, DOM and storage dependencies so
   that it can be imported directly by tests and carried into the web port
   unchanged.

   The behaviour here is validated against real readings from personal test
   history (see test/fixtures/validated-readings.json). Any change to this file
   must keep test/calc.test.mjs green — those tests exist precisely so that a
   port can prove it preserved the logic rather than assuming it did.
   ════════════════════════════════════════════════════════════════════════════ */

/* ── Martin-Hopkins adjustable divisor ─────────────────────────────────────────
   INCOMPLETE, KNOWINGLY. The published method (Martin SS et al., JAMA 2013)
   selects the divisor from a 180-cell table: 30 triglyceride strata (<50 to
   >=400 mg/dL) x 6 non-HDL-C strata (<100 to >=220 mg/dL). What is implemented
   here is a one-dimensional collapse of that table on triglycerides alone: 18
   strata, no non-HDL axis.

   The gap is measurable rather than theoretical. Cholesterol_PRD_v3_3.md states
   Martin-Hopkins runs 6-7 mg/dL above Friedewald; across 1,792 realistic
   readings this table produces a median of 3.7 and a maximum of 4.7, and
   inverts above TG ~195. It cannot reach the figure the spec describes.

   The values below are NOT invented — they are the prototype's original table,
   preserved exactly and validated against real readings — but they are an
   approximation of the published method, not the method. Replacing them
   requires the source table; reconstructing 180 cells from memory would produce
   something that looks authoritative and is not.

   See PRD-v4-web.md OPEN-2. getMHDiv() already takes nonHDL so that filling in
   the second axis is a data change rather than a signature change, and every
   caller is already passing it. */
export const MH_TABLE_IS_APPROXIMATE = true;

/* Each entry is [upperBound, divisor], applying to TG strictly below that
   bound: TG 99 -> 6.6 while TG 100 -> 6.2. Ordering and strictness are
   load-bearing — shifting a boundary by one unit changes every LDL reported. */
export const MH_TABLE = [
  [40,9.5],[50,8.9],[57,8.5],[65,8.0],[76,7.5],[90,7.0],[100,6.6],
  [114,6.2],[130,5.9],[150,5.6],[172,5.3],[195,5.0],[216,4.9],
  [245,4.8],[274,4.7],[311,4.5],[351,4.4],[401,4.3],
];

/* Above this triglyceride level neither estimate is reportable. Friedewald is
   well established to be invalid at TG >= 400 mg/dL, because the TG/5 term
   stops approximating VLDL-C, and the Martin-Hopkins divisor table is not
   validated beyond it either. The app's differentiator is calculation
   accuracy, so at and above this level both estimates are withheld and the
   device- or lab-reported LDL is shown instead, rather than extrapolating a
   divisor that has no basis in the source table. */
export const TG_CALC_MAX = 400;

/* Returns null when TG is at or beyond the validated range, so callers must
   decide explicitly what to do rather than silently receiving a made-up
   divisor. */
/* nonHDL is accepted and deliberately unused: the published method selects on
   it, this table does not, and taking the argument now means the second axis
   can be added without touching a single call site. */
export const getMHDiv = (tg, nonHDL) => {           // eslint-disable-line no-unused-vars
  if (!(tg < TG_CALC_MAX)) return null;
  for (const [th,d] of MH_TABLE) if (tg < th) return d;
  return null;
};

export function calcDerived(r, apobMethod) {
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
    const div = getMHDiv(TG, d.nonHDL);
    if (div == null) {
      /* Out of validated range: withhold both estimates and say why, so the UI
         can explain the gap instead of falling back to a bare "Device" label
         that looks like a user preference. Non-HDL and ApoB are unaffected —
         neither depends on the TG/VLDL-C approximation. */
      d.ldlFried = null;
      d.ldlMH = null;
      d.ldlDelta = null;
      d.ldlCalcBlocked = true;
      d.ldlCalcBlockedReason =
        `Triglycerides of ${TG} mg/dL are at or above ${TG_CALC_MAX} mg/dL, ` +
        `where neither Friedewald nor Martin-Hopkins is valid. ` +
        `Showing the reported LDL instead.`;
    } else {
      const fr = TC - HDL - TG / 5;
      const mh = TC - HDL - TG / div;
      d.ldlFried = fr > 0 ? +fr.toFixed(1) : null;
      d.ldlMH    = mh > 0 ? +mh.toFixed(1) : null;
      if (d.ldlFried != null && d.ldlMH != null) d.ldlDelta = +(d.ldlMH - d.ldlFried).toFixed(1);
    }
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

export function getDispLDL(reading, d, method) {
  if (method === "martin-hopkins" && d.ldlMH != null) return { value:d.ldlMH, label:"Martin-Hopkins" };
  if (method === "friedewald"     && d.ldlFried != null) return { value:d.ldlFried, label:"Friedewald" };
  if (reading.ldl != null) {
    /* Distinguish "you chose the device value" from "we could not calculate
       one", so a suppressed estimate is never mistaken for a preference. */
    return d.ldlCalcBlocked
      ? { value:reading.ldl, label:"Reported", blocked:true, blockedReason:d.ldlCalcBlockedReason }
      : { value:reading.ldl, label:"Device" };
  }
  return null;
}

export function metricValue(r, key, ldlMethod) {
  switch (key) {
    case "ldl":   return getDispLDL(r, r.d, ldlMethod)?.value ?? null;
    case "hdl":   return r.hdl ?? null;
    case "tc":    return r.tc ?? null;
    case "tg":    return r.tg ?? null;
    case "apob":  return r.d.apob ?? null;
    case "nonHDL":return r.d.nonHDL ?? null;
    case "tcHdl": return r.d.tcHdl ?? null;
    case "tgHdl": return r.d.tgHdl ?? null;
    default:      return null;
  }
}
