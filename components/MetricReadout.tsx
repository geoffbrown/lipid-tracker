"use client";

import { ChevronDown } from "lucide-react";
import RangeRail from "./RangeRail";
import type { Biomarker } from "@/lib/biomarkers";

export interface Trend {
  delta: number;
  since: string;
  crossSource: boolean;
  prevSource: string;
}

/**
 * Direction of a change. An inline SVG rather than the ▲/▼ glyphs: those come
 * from whatever symbol font the platform falls back to, and its vertical
 * metrics never quite match Inter's digits, so the arrow floats a pixel or
 * two off the baseline on some machines and not others. Sized in em and
 * placed so its centre sits at the digits' visual centre, this is identical
 * everywhere.
 */
function TrendArrow({ up }: { up: boolean }) {
  return (
    <svg
      viewBox="0 0 10 10"
      className="mr-px inline-block h-[0.55em] w-[0.6em] fill-current align-[0.085em]"
      aria-hidden
    >
      <path d={up ? "M5 1 L10 9 L0 9 Z" : "M5 9 L10 1 L0 1 Z"} />
    </svg>
  );
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

  return (
    <button
      onClick={onPress}
      aria-label={`${bm.label}: choose which metric to show here`}
      className="tile pressable pressable-row min-w-0 px-4 py-4 text-left"
    >
      <span className="flex items-center justify-between gap-1">
        <span className="flex min-w-0 items-center gap-px">
          <span
            className="truncate text-[13px] font-semibold tracking-[0.04em]"
            style={{ color: bm.color }}
          >
            {bm.label}
          </span>
          <ChevronDown size={10} className="shrink-0 text-ink-faint" aria-hidden />
        </span>
        {bm.unit && (
          <span className="shrink-0 text-[12px] text-ink-faint">{bm.unit}</span>
        )}
      </span>

      <span
        className={`tabular mt-1.5 block truncate text-[27px] font-semibold leading-none tracking-[-0.01em] ${
          value == null ? "text-ink-faint" : "text-ink"
        }`}
      >
        {value == null ? "—" : value}
      </span>

      {/* Where this value sits against its reference thresholds. No numbers —
          the position is the point, and a lipid value only means something
          relative to its range. */}
      <RangeRail bm={bm} value={value} className="mt-3.5" />

      <span className="mt-3 block text-[13px] leading-tight text-ink-soft">{provenance}</span>
      {trend && trend.delta !== 0 && (
        <span className="mt-1 block truncate text-[13px] text-ink-soft">
          <span className={`tabular font-semibold ${trendClass}`}>
            <TrendArrow up={up} />
            {Math.abs(trend.delta)}
          </span>{" "}
          {trend.crossSource ? `vs ${trend.prevSource}` : `since ${trend.since}`}
        </span>
      )}
    </button>
  );
}
