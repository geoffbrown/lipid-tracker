"use client";

import { ChevronDown } from "lucide-react";

export interface Trend {
  delta: number;
  since: string;        // "Aug 15"
  crossSource: boolean;
  prevSource: string;   // "Lab"
}

export default function StatCard({
  label, value, provenance, color, trend, lowerBetter, onPress,
}: {
  label: string;
  value: number | null;
  provenance: string;
  color: string;
  trend: Trend | null;
  lowerBetter: boolean;
  onPress: () => void;
}) {
  const up = trend ? trend.delta > 0 : false;
  const favorable = up !== lowerBetter;

  /* A delta spanning two source types is mostly method bias, not movement, so
     it is never coloured as improvement — the caption names the other source,
     which is what actually explains the number. */
  const trendClass = !trend
    ? ""
    : trend.crossSource ? "text-ink-soft" : favorable ? "text-success" : "text-ink-soft";

  return (
    <button
      onClick={onPress}
      aria-label={`${label}: choose which metric to show here`}
      className="card h-full w-full min-w-0 px-2.5 py-4 text-left"
      style={{ borderTop: `2px solid ${color}` }}
    >
      <span className="mb-2 flex items-center justify-between gap-1">
        <span className="flex min-w-0 items-center gap-px">
          <span className="truncate font-bold text-ink-soft">{label}</span>
          <ChevronDown size={10} className="shrink-0 text-ink-faint" aria-hidden />
        </span>
        {trend && trend.delta !== 0 && (
          <span className={`tabular shrink-0 whitespace-nowrap font-semibold ${trendClass}`}>
            {up ? "▲" : "▼"}
            {Math.abs(trend.delta)}
          </span>
        )}
      </span>

      <span
        className={`tabular block truncate text-[27px] font-extrabold leading-none ${
          value == null ? "text-ink-faint" : "text-ink"
        }`}
      >
        {value == null ? "—" : value}
      </span>

      {/* Wrapped, not clipped: "Martin-Hopkins" is the one provenance label too
          long for a third of a phone, and it breaks at its own hyphen. */}
      <span className="mt-1.5 block text-[13.5px] leading-tight text-ink-soft">{provenance}</span>
      {trend && (
        <span className="mt-0.5 block truncate text-[13.5px] text-ink-soft">
          {trend.crossSource ? `vs ${trend.prevSource} ${trend.since}` : `since ${trend.since}`}
        </span>
      )}
    </button>
  );
}
