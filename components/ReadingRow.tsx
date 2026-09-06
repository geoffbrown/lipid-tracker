"use client";

import { ChevronRight, StickyNote } from "lucide-react";
import SourceBadge from "./SourceBadge";
import type { Reading } from "@/lib/types";

export interface RowMetric {
  key: string;
  label: string;
  value: number;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function ReadingRow({
  reading, metrics, onSelect,
}: {
  reading: Reading;
  metrics: RowMetric[];
  onSelect: (r: Reading) => void;
}) {
  return (
    <button
      onClick={() => onSelect(reading)}
      className="flex w-full items-center justify-between gap-3 px-3 py-4 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="mb-1.5 flex min-w-0 items-center gap-1.5">
          <SourceBadge source={reading.source} />
          <span className="whitespace-nowrap text-ink-soft">{fmtDate(reading.timestamp)}</span>
          {reading.sourceName && (
            <span className="min-w-0 truncate text-ink-soft">· {reading.sourceName}</span>
          )}
          {/* A note is announced, not previewed — a sentence cut off mid-word
              cost a whole line and could not be read anyway. */}
          {reading.notes && (
            <StickyNote size={14} className="shrink-0 text-ink-soft" aria-label="Has a note" />
          )}
        </span>
        <span className="flex items-baseline gap-[18px] overflow-hidden">
          {metrics.map((m) => (
            <span key={m.key} className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-ink-soft">{m.label}</span>
              <span className="tabular text-[19px] font-semibold">{m.value}</span>
            </span>
          ))}
        </span>
      </span>
      <ChevronRight size={17} className="shrink-0 text-ink-soft" aria-hidden />
    </button>
  );
}
