"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Segmented control with a sliding indicator.
 *
 * The selection travels between options rather than blinking from one to the
 * next, which is what makes the control read as one object with a moving
 * marker instead of a row of buttons that change colour. The indicator is
 * measured from the real option elements, so it stays correct at any label
 * width and through a resize.
 */
export default function Segmented<T extends string>({
  options, value, onChange, ariaLabel,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = wrap.current?.querySelector<HTMLElement>(`[data-seg="${value}"]`);
      if (el) setBox({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [value, options]);

  return (
    <div
      ref={wrap}
      role="group"
      aria-label={ariaLabel}
      className="relative inline-flex overflow-hidden rounded-lg border border-line p-0.5"
    >
      {box && (
        <span
          aria-hidden
          className="absolute inset-y-0.5 rounded-[6px] bg-strong"
          style={{
            left: box.left,
            width: box.width,
            transition: "left var(--dur-fast) var(--ease-standard), width var(--dur-fast) var(--ease-standard)",
          }}
        />
      )}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            data-seg={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className={`relative z-10 rounded-[6px] px-3 py-2 text-[15px] transition-colors duration-[var(--dur-fast)] ${
              on ? "font-bold text-on-strong" : "text-ink-soft"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
