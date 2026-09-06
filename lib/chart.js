/* ════════════════════════════════════════════════════════════════════════════
   CHART AGGREGATION

   Pure helpers behind the trend chart, kept free of React and recharts so they
   can be tested directly and carried into the web port unchanged. Covered by
   test/chart.test.mjs.
   ════════════════════════════════════════════════════════════════════════════ */

/* Above this many points the chart buckets rather than drawing every reading. */
export const MAX_CHART_POINTS = 150;

export function downsample(rows, max = MAX_CHART_POINTS) {
  if (rows.length <= max) return { data:rows, bucketed:false };
  const size = Math.ceil(rows.length / max);
  const out = [];
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const avg = key => {
      const v = chunk.map(c => c[key]).filter(x => x != null);
      return v.length ? +(v.reduce((a,b)=>a+b,0) / v.length).toFixed(1) : null;
    };
    /* A bucket spanning both a home device and a lab draw has no single
       source, and saying otherwise would be a claim the average cannot make. */
    const sources = new Set(chunk.map(c => c.source));
    out.push({ t:chunk[Math.floor(chunk.length/2)].t,
      source: sources.size === 1 ? [...sources][0] : "mixed",
      ldl:avg("ldl"), hdl:avg("hdl"), tc:avg("tc"), tg:avg("tg"),
      apob:avg("apob"), tcHdl:avg("tcHdl"), tgHdl:avg("tgHdl") });
  }
  return { data:out, bucketed:true, original:rows.length };
}

/* Human wording for an elapsed span. "over 6 months" reads; "over 187 days"
   makes the reader do arithmetic. */
export function fmtSpan(days) {
  if (days < 14)  return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 60)  return `${Math.round(days / 7)} weeks`;
  if (days < 730) return `${Math.round(days / 30.44)} months`;
  return `${(days / 365.25).toFixed(1)} years`;
}

/* Least-squares fit over (time, value) pairs — the linear trend line the PRD
   asks for. Home readings scatter enough that the slope is the only thing that
   reads through the noise. Three points minimum: with two, the "fit" is just
   the segment already drawn. */
export function fitTrend(points) {
  const n = points.length;
  if (n < 3) return null;
  const mx = points.reduce((a,p)=>a+p.x,0) / n;
  const my = points.reduce((a,p)=>a+p.y,0) / n;
  let num = 0, den = 0;
  for (const p of points) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  if (den === 0) return null;                       // all readings on one day
  const slope = num / den, intercept = my - slope * mx;
  const x1 = points[0].x, x2 = points[n-1].x;
  return { x1, y1: slope*x1 + intercept, x2, y2: slope*x2 + intercept,
    change: +(slope * (x2 - x1)).toFixed(1),
    days: Math.round((x2 - x1) / 86400000) };
}
