"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ChevronDown } from "lucide-react";
import Segmented from "./Segmented";
import { BM, BMS, RANGES, type Range } from "@/lib/biomarkers";
import { downsample, fitTrend, fmtSpan } from "@/lib/chart.js";
import { metricValue } from "@/lib/calc.js";
import type { Enriched } from "@/lib/use-app-data";
import type { LdlMethod } from "@/lib/types";

type SrcMode = "all" | "home" | "lab";

/** One plotted point: a real time value, the source that produced it, and a
 *  column per biomarker. downsample() is plain JS, so the shape is named here. */
type Row = { t: number; source: string } & Record<string, number | null>;

const fmtShort = (t: number) =>
  new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/* Home and Lab carry the same marks the chart draws, so this control doubles as
   the legend for them — it teaches the encoding and filters by it in one place,
   instead of a legend above the chart and a filter below it. */
const SRC_OPTIONS = [
  { value: "all" as const, label: "All" },
  { value: "home" as const, label: (
    <span className="inline-flex items-center gap-1.5">
      <svg width="8" height="8" aria-hidden><circle cx="4" cy="4" r="3.4" fill="currentColor" /></svg>
      Home
    </span>
  ) },
  { value: "lab" as const, label: (
    <span className="inline-flex items-center gap-1.5">
      <svg width="8" height="8" aria-hidden>
        <circle cx="4" cy="4" r="2.9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      Lab
    </span>
  ) },
];

export default function TrendChart({
  enriched, ldlMethod, onPickMetric,
}: {
  enriched: Enriched[];
  ldlMethod: LdlMethod;
  onPickMetric: (slot: "primary" | "compare") => void;
}) {
  const [bmA, setBmA] = useState("ldl");
  const [bmB] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("All");
  const [srcMode, setSrcMode] = useState<SrcMode>("all");
  const a = BM(bmA), b = bmB ? BM(bmB) : undefined;

  const { data: chartData, bucketed, original } = useMemo(() => {
    const cut =
      range === "All" ? 0 : Date.now() - { "30d": 30, "90d": 90, "1y": 365 }[range] * 86400000;
    const rows = [...enriched]
      .sort((x, y) => Date.parse(x.timestamp) - Date.parse(y.timestamp))
      .filter((r) => Date.parse(r.timestamp) >= cut)
      .filter((r) =>
        srcMode === "all" ? true : srcMode === "lab" ? r.source === "Lab" : r.source !== "Lab")
      .map((r) => ({
        /* A real timestamp, not a formatted label. As a category axis every gap
           rendered the same width, so slope carried no meaning. */
        t: Date.parse(r.timestamp),
        source: r.source === "Lab" ? "Lab" : "POC",
        ...Object.fromEntries(BMS.map((m) => [m.key, metricValue(r, m.key, ldlMethod)])),
      }));
    return downsample(rows) as { data: Row[]; bucketed: boolean; original?: number };
  }, [enriched, range, srcMode, ldlMethod]);

  const fit = useMemo(
    () =>
      fitTrend(
        chartData
          .filter((r: Row) => r[bmA] != null)
          .map((r: Row) => ({ x: r.t, y: r[bmA] as number })),
      ) as { x1: number; y1: number; x2: number; y2: number; change: number; days: number } | null,
    [chartData, bmA],
  );

  /* Source lives in the mark itself: filled for a home device, a ring for a lab
     draw. The two disagree systematically, so a step in the line that coincides
     with a change of mark is method rather than biology. */
  const seriesDot = (color: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ cx, cy, payload }: any) => {
      if (cx == null || cy == null) return <g />;
      if (payload?.source === "Lab")
        return <circle cx={cx} cy={cy} r={3.6} fill="var(--color-paper)" stroke={color} strokeWidth={1.8} />;
      if (payload?.source === "POC") return <circle cx={cx} cy={cy} r={3.5} fill={color} />;
      return <circle cx={cx} cy={cy} r={3.2} fill={color} fillOpacity={0.45} />;
    };

  const enough = chartData.filter((r: Row) => r[bmA] != null).length >= 2;

  return (
    <section className="card mt-3.5 px-4 py-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <button
          onClick={() => { setBmA(bmA); onPickMetric("primary"); }}
          className="inline-flex items-center gap-1"
        >
          <span className="text-[20px] font-bold" style={{ color: a?.color }}>{a?.label}</span>
          <ChevronDown size={16} className="text-ink-soft" aria-hidden />
        </button>
        <button onClick={() => onPickMetric("compare")} className="text-[15px] text-ink-soft">
          + Compare
        </button>
      </div>

      {/* The chart's conclusion, stated beside its subject rather than floating
          under the plot. */}
      <p className="mt-0.5 mb-4 text-[15px] leading-snug text-ink-soft">
        {fit
          ? `${fit.change >= 0 ? "Up" : "Down"} ${Math.abs(fit.change)}${a?.unit ? ` ${a.unit}` : ""} over ${fmtSpan(fit.days)}`
          : "Not enough readings yet to show a trend"}
        {bucketed && ` · ${original} readings averaged`}
      </p>

      <div className="mb-4">
        <Segmented options={SRC_OPTIONS} value={srcMode} onChange={setSrcMode} ariaLabel="Source" />
      </div>

      {!enough ? (
        <div className="grid h-[216px] place-items-center px-6 text-center text-ink-soft">
          Not enough {a?.label} data for this range and filter
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={216}>
          <LineChart data={chartData} margin={{ top: 14, right: 24, bottom: 6, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" vertical={false} />
            <XAxis
              dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]}
              tickFormatter={fmtShort} tickLine={false} axisLine={false}
              interval="preserveStartEnd" minTickGap={34} tickMargin={10}
              tick={{ fontSize: 15, fill: "var(--color-ink-soft)" }}
            />
            <YAxis
              yAxisId="left" domain={["auto", "auto"]} width={40} tickLine={false} axisLine={false}
              tickMargin={6} padding={{ top: 6, bottom: 6 }}
              tick={{ fontSize: 15, fill: "var(--color-ink-soft)" }}
            />
            <Tooltip
              allowEscapeViewBox={{ x: false, y: false }}
              wrapperStyle={{ zIndex: 5 }}
              contentStyle={{
                background: "var(--color-paper)", border: "1px solid var(--color-line-strong)",
                borderRadius: 10, fontSize: 15,
              }}
              labelFormatter={(t) => fmtDate(t as number)}
              formatter={(v) => [v as number, a?.label ?? ""]}
            />
            {/* Drawn before the series so the data sits on top of its own fit. */}
            {fit && (
              <ReferenceLine
                yAxisId="left" ifOverflow="extendDomain"
                segment={[{ x: fit.x1, y: fit.y1 }, { x: fit.x2, y: fit.y2 }]}
                stroke={a?.color} strokeOpacity={0.4} strokeWidth={1.5} strokeDasharray="5 4"
              />
            )}
            {/* Straight segments: a spline draws curvature through values that
                were never measured. */}
            <Line
              yAxisId="left" type="linear" dataKey={bmA} stroke={a?.color} strokeWidth={2.4}
              dot={seriesDot(a?.color ?? "")} activeDot={{ r: 6 }}
              connectNulls={false} isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className="mt-4 flex justify-center">
        <Segmented
          options={RANGES.map((r) => ({ value: r, label: r }))}
          value={range} onChange={setRange} ariaLabel="Time range"
        />
      </div>
    </section>
  );
}
