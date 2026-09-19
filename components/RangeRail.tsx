"use client";

import type { Biomarker } from "@/lib/biomarkers";

/**
 * Where a value sits against its reference thresholds.
 *
 * A hairline rule with the thresholds crossing it and a dot for the value.
 * The thresholds are what make it a scale rather than decoration; without
 * them the dot's position means nothing. The rail stays neutral on purpose:
 * no coloured zones, because the app never classifies a reading as high or
 * low. The reference text beside it says which side is which.
 *
 * `labels` prints the threshold numbers under their marks. The dashboard tiles
 * leave them off (no room, and the position is the point); the reading sheet
 * turns them on so the rail and the reference text agree at a glance.
 */
export default function RangeRail({
  bm, value, labels = false, className = "",
}: {
  bm: Biomarker;
  value: number | null;
  labels?: boolean;
  className?: string;
}) {
  const [lo, hi] = bm.scale;
  const pos = (v: number) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));

  return (
    <span className={`block w-full ${className}`} aria-hidden>
      <span className="relative block h-[9px] w-full">
        <span className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-line-strong" />
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
      {labels && (
        <span className="relative block h-[15px] w-full">
          {bm.marks.map((m) => (
            <span
              key={m}
              className="tabular absolute top-[3px] -translate-x-1/2 text-[11px] leading-none text-ink-faint"
              style={{ left: `${pos(m)}%` }}
            >
              {m}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
