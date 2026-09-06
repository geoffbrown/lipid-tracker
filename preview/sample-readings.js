/* SAMPLE DATA — for the preview build only.
 *
 * These readings are invented. They exist so the dashboard has something to
 * draw when the app is opened cold, and they are shaped to exercise the things
 * that are hard to judge on an empty chart:
 *
 *   - irregular intervals, including a three-month gap, so the time axis has
 *     something to be right about
 *   - a mix of home-device and lab readings, so the source marks appear
 *   - a genuine downward trend, so the fitted line has something to fit
 *   - a lab draw as the second-most-recent reading, so the stat cards show a
 *     cross-source delta rather than a like-for-like one
 *
 * Nothing here is real, and none of it ships in the app. Clearing all data in
 * Settings removes it.
 */
export const SAMPLE_READINGS = [
  { ts:"2025-11-08T08:12", src:"POC", name:"CURO L7/L5", tc:232, hdl:48, ldl:152, tg:160, note:"Baseline before any changes." },
  { ts:"2025-11-22T07:58", src:"POC", name:"CURO L7/L5", tc:228, hdl:49, ldl:148, tg:152 },
  { ts:"2025-12-06T08:05", src:"POC", name:"CURO L7/L5", tc:221, hdl:51, ldl:141, tg:145 },
  { ts:"2026-01-14T09:30", src:"Lab", name:"LabCorp",    tc:214, hdl:53, ldl:136, tg:138, apob:108, note:"Fasting 14h. Full panel with ApoB." },
  { ts:"2026-02-21T08:20", src:"POC", name:"CURO L7/L5", tc:205, hdl:54, ldl:128, tg:130 },
  { ts:"2026-03-07T08:02", src:"POC", name:"CURO L7/L5", tc:199, hdl:55, ldl:122, tg:124 },
  { ts:"2026-06-20T08:41", src:"POC", name:"CURO L7/L5", tc:186, hdl:57, ldl:110, tg:112, note:"First test back after a long gap." },
  { ts:"2026-07-04T07:49", src:"POC", name:"CURO L7/L5", tc:182, hdl:58, ldl:106, tg:105 },
  { ts:"2026-08-15T09:15", src:"Lab", name:"LabCorp",    tc:176, hdl:59, ldl:99,  tg:98,  apob:82, note:"Fasting 13h." },
  { ts:"2026-08-29T08:07", src:"POC", name:"CURO L7/L5", tc:174, hdl:60, ldl:96,  tg:95, note:"Sample data for this preview \u2014 remove it with Clear All Data in Settings." },
];

export function seedIfEmpty() {
  if (localStorage.getItem("lipidlog_readings")) return;
  const rows = SAMPLE_READINGS.map((r, i) => ({
    id: `sample-${i}`,
    timestamp: new Date(r.ts).toISOString(),
    source: r.src,
    sourceName: r.name,
    tc: r.tc, hdl: r.hdl, ldl: r.ldl, tg: r.tg,
    apobMeasured: r.apob ?? null,
    notes: r.note ?? "",
  }));
  localStorage.setItem("lipidlog_readings", JSON.stringify(rows));
}
