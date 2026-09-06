"use client";

import { ChevronDown } from "lucide-react";

export interface Trend {
  delta: number;
  since: string;
  crossSource: boolean;
  prevSource: string;
}

export interface Biomarker {
  key: string;
  label: string;
  unit: string;
  color: string;
  lowerBetter: boolean;
  /** Domain for the range rail, and the reference thresholds marked on it. */
  scale: [number, number];
  marks: number[];
}

/**
 * One analyte in the panel readout.
 *
 * Deliberately not a card. A lipid panel is a ruled document, not a dashboard —
 * values sit in columns separated by hairlines, the analyte name is set small
 * above its figure, and the figure carries its unit. Boxing each value in a
 * rounded card with a coloured bar across the top is the shape every generated
 * dashboard takes, and it says nothing about what this screen is.
 *
 * Colour still encodes biomarker identity, but it lives on the name — the same
 * place the chart header uses it — rather than on a decorative rail.
 */
export default function MetricReadout({
  bm, value, provenance, trend, onPress,
}: {
  bm: Biomarker;
  value: number | null;
  provenance: string;
  trend: Trend | null;
  onPress: () => void;
}) {
  const up = trend ? trend.delta > 0 : false;
  const favorable = up !== bm.lowerBetter;
  const trendClass = !trend
    ? ""
    : trend.crossSource ? "text-ink-soft" : favorable ? "text-success" : "text-ink-soft";

  const pos = (v: number) => {
    const [lo, hi] = bm.scale;
    return Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
  };

  return (
    <button
      onClick={onPress}
      aria-label={`${bm.label}: choose which metric to show here`}
      className="min-w-0 px-3 py-3.5 text-left"
    >
      <span className="flex min-w-0 items-center gap-px">
        <span
          className="truncate text-[13px] font-semibold tracking-[0.04em]"
          style={{ color: bm.color }}
        >
          {bm.label}
        </span>
        <ChevronDown size={10} className="shrink-0 text-ink-faint" aria-hidden />
      </span>

      <span className="mt-1 flex items-baseline gap-1">
        <span
          className={`tabular text-[26px] font-semibold leading-none tracking-[-0.01em] ${
            value == null ? "text-ink-faint" : "text-ink"
          }`}
        >
          {value == null ? "—" : value}
        </span>
        {value != null && bm.unit && (
          <span className="truncate text-[12px] text-ink-faint">{bm.unit}</span>
        )}
      </span>

      {/* Where this value sits against its reference thresholds. No numbers —
          the position is the point, and a lipid value only means something
          relative to its range. */}
      <span className="relative mt-3 block h-[9px] w-full" aria-hidden>
        <span className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-line-strong" />
        {/* Thresholds cross the rule, so they read as a scale rather than as
            decoration. Without them the marker's position means nothing. */}
        {bm.marks.map((m) => (
          <span
            key={m}
            className="absolute top-0 h-full w-px bg-line-strong"
            style={{ left: `${pos(m)}%` }}
          />
        ))}
        {value != null && (
          <span
            className="absolute top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${pos(value)}%`, background: bm.color }}
          />
        )}
      </span>

      <span className="mt-2.5 block text-[13px] leading-tight text-ink-soft">{provenance}</span>
      {trend && trend.delta !== 0 && (
        <span className="mt-1 block truncate text-[13px] text-ink-soft">
          <span className={`tabular font-semibold ${trendClass}`}>
            {up ? "▲" : "▼"}
            {Math.abs(trend.delta)}
          </span>{" "}
          {trend.crossSource ? `vs ${trend.prevSource}` : `since ${trend.since}`}
        </span>
      )}
    </button>
  );
}
