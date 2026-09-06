"use client";

import { Check } from "lucide-react";
import Sheet from "./Sheet";

export interface Option<T extends string> {
  value: T;
  label: string;
  sub?: string;
}

export default function SelectSheet<T extends string>({
  title, options, current, onSelect, onClose, footer,
}: {
  title: string;
  options: Option<T>[];
  current: T;
  onSelect: (v: T) => void;
  onClose: () => void;
  footer?: string;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="divide-y divide-line border-y border-line">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onSelect(o.value)}
            className="flex w-full items-center justify-between gap-4 px-3 py-4 text-left"
          >
            <span className="min-w-0">
              <span className={`block ${o.value === current ? "font-bold" : ""}`}>{o.label}</span>
              {o.sub && <span className="mt-0.5 block text-ink-soft">{o.sub}</span>}
            </span>
            {o.value === current && <Check size={18} className="shrink-0" aria-label="Selected" />}
          </button>
        ))}
      </div>
      {footer && (
        <p className="mt-4 whitespace-pre-line leading-relaxed text-ink-soft">{footer}</p>
      )}
    </Sheet>
  );
}
