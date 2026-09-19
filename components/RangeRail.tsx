"use client";

import { ZONE_COLOR, zoneOf, type Biomarker } from "@/lib/biomarkers";

/**
 * Where a value sits against its reference thresholds.
 *
 * A hairline rule with the thresholds crossing it and a dot for the value.
 * The thresholds are what make it a scale rather than decoration; without
 * them the dot's position means nothing.
 *
 * The dot is coloured by the band it falls in (success / warn / danger), and
 * that one band is tinted softly underneath it. The other bands stay neutral:
 * painting the whole rail red-amber-green makes every row shout, whereas one
 * tinted segment tells you at a glance where the value landed and nothing
 * else. Biomarker identity is not carried on the dot — the label beside the
 * rail already says which analyte this is, and an LDL dot that is always red
 * reads as "bad" even at a value that is anything but.
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

  const zone = value != null ? zoneOf(bm, value) : null;
  const color = zone ? ZONE_COLOR[zone.status] : undefined;
  /* The band the value is in, as a [start, end] on the rail. */
  const edges = [lo, ...bm.marks, hi];
  const band = zone ? [pos(edges[zone.index]), pos(edges[zone.index + 1])] : null;

  return (
    <span className={`block w-full ${className}`} aria-hidden>
      <span className="relative block h-[9px] w-full">
        <span className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-line-strong" />
        {band && (
          <span
            className="absolute top-1/2 h-[5px] -translate-y-1/2 rounded-full opacity-[0.22]"
            style={{ left: `${band[0]}%`, width: `${band[1] - band[0]}%`, background: color }}
          />
        )}
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
            style={{ left: `${pos(value)}%`, background: color }}
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
