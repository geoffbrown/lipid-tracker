"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const IOS_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const DRAG_THRESHOLD = 6;

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Sheet duration scales (sub-linearly) with height so tall and short sheets feel
// like they travel at the same speed — anchored to ~480ms for a ~360px sheet.
function presentDuration(h: number) {
  return Math.round(Math.min(680, Math.max(440, 480 * Math.sqrt(h / 360))));
}

// ─── Shared calendar + time panel (used by desktop dropdown and mobile sheet) ──

function CalendarPanel({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const [view, setView] = useState(
    () => new Date(value.getFullYear(), value.getMonth(), 1),
  );
  const today = new Date();
  const month = view.getMonth();
  const gridStart = new Date(view);
  gridStart.setDate(1 - view.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  function pickDay(d: Date) {
    onChange(
      new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        value.getHours(),
        value.getMinutes(),
      ),
    );
  }

  const hour12 = value.getHours() % 12 || 12;
  const isPM = value.getHours() >= 12;
  function setTime(h12: number, min: number, pm: boolean) {
    const h24 = (h12 % 12) + (pm ? 12 : 0);
    onChange(
      new Date(value.getFullYear(), value.getMonth(), value.getDate(), h24, min),
    );
  }

  // Native <select> → an iOS wheel on phones (mobile-friendly), a dropdown on desktop.
  const selectCls =
    "appearance-none rounded-lg border border-line bg-paper py-2.5 pl-3 pr-7 text-base outline-none transition-colors focus:border-ink tabular bg-[length:14px] bg-[right_0.5rem_center] bg-no-repeat sm:py-1.5 sm:pl-2.5 sm:pr-6 sm:text-sm";
  const caret =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%237c7c84' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

  return (
    <div>
      {/* Month nav */}
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-base font-semibold sm:text-sm">
          {view.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setView(new Date(view.getFullYear(), month - 1, 1))}
            className="grid h-11 w-11 place-items-center rounded-full text-ink-soft transition-colors hover:bg-ink/[0.06] hover:text-ink active:bg-ink/[0.1] sm:h-7 sm:w-7"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setView(new Date(view.getFullYear(), month + 1, 1))}
            className="grid h-11 w-11 place-items-center rounded-full text-ink-soft transition-colors hover:bg-ink/[0.06] hover:text-ink active:bg-ink/[0.1] sm:h-7 sm:w-7"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 text-center text-xs font-medium text-ink-faint sm:text-xs">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const selected = sameDay(d, value);
          const isToday = sameDay(d, today);
          return (
            <button
              key={i}
              type="button"
              onClick={() => pickDay(d)}
              className={`mx-auto my-0.5 grid h-10 w-10 place-items-center rounded-full text-base tabular transition-colors sm:h-8 sm:w-8 sm:text-sm ${
                selected
                  ? "bg-strong font-semibold text-on-strong"
                  : inMonth
                    ? "text-ink hover:bg-ink/[0.06] active:bg-ink/[0.1]"
                    : "text-ink-faint hover:bg-ink/[0.04]"
              } ${isToday && !selected ? "font-semibold ring-1 ring-line-strong" : ""}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      {/* Time row */}
      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        <select
          aria-label="Hour"
          value={hour12}
          onChange={(e) => setTime(Number(e.target.value), value.getMinutes(), isPM)}
          className={selectCls}
          style={{ backgroundImage: caret }}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="text-ink-soft">:</span>
        <select
          aria-label="Minute"
          value={value.getMinutes()}
          onChange={(e) => setTime(hour12, Number(e.target.value), isPM)}
          className={selectCls}
          style={{ backgroundImage: caret }}
        >
          {Array.from({ length: 60 }, (_, i) => i).map((m) => (
            <option key={m} value={m}>
              {String(m).padStart(2, "0")}
            </option>
          ))}
        </select>
        <div className="ml-auto inline-flex gap-0.5 rounded-lg bg-ink/[0.06] p-1">
          {(["AM", "PM"] as const).map((p) => {
            const active = (p === "PM") === isPM;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setTime(hour12, value.getMinutes(), p === "PM")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:px-2.5 sm:py-1 sm:text-xs ${
                  active ? "bg-paper text-ink shadow-card" : "text-ink-soft"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Desktop dropdown ─────────────────────────────────────────────────────────

function DesktopCalendar({
  value,
  onChange,
  onClose,
}: {
  value: Date;
  onChange: (d: Date) => void;
  onClose: () => void;
}) {
  return (
    <div className="w-[300px] rounded-2xl border border-line bg-paper p-3 shadow-pop">
      <CalendarPanel value={value} onChange={onChange} />
      <button
        type="button"
        onClick={onClose}
        className="mt-3 w-full rounded-full bg-strong py-2 text-sm font-medium text-on-strong transition-opacity hover:opacity-90 active:opacity-80"
      >
        Done
      </button>
    </div>
  );
}

// ─── Mobile bottom sheet ──────────────────────────────────────────────────────

function MobileSheet({
  value,
  onChange,
  onClose,
}: {
  value: Date;
  onChange: (d: Date) => void;
  onClose: () => void;
}) {
  const [entered, setEntered] = useState(false);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const down = useRef(false);
  const active = useRef(false);
  const startY = useRef(0);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const velocity = useRef(0);
  const lastDrag = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocus.current = document.activeElement as HTMLElement | null;
    const id = requestAnimationFrame(() => {
      setEntered(true);
      sheetRef.current?.focus();
    });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Capture + stopPropagation: Escape dismisses only this sheet, not the
    // reading form underneath it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey, true);
      restoreFocus.current?.focus?.();
    };
    // handleClose is a stable function declaration; this runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    setEntered(false);
    window.setTimeout(onClose, 720);
  }

  function onPointerDown(e: React.PointerEvent) {
    down.current = true;
    active.current = false;
    startY.current = e.clientY;
    lastY.current = e.clientY;
    lastT.current = performance.now();
    velocity.current = 0;
    lastDrag.current = 0;
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!down.current) return;
    const dy = e.clientY - startY.current;
    if (!active.current) {
      if (dy <= DRAG_THRESHOLD) return;
      active.current = true;
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    }
    const now = performance.now();
    const dt = now - lastT.current;
    if (dt > 0) velocity.current = (e.clientY - lastY.current) / dt;
    lastY.current = e.clientY;
    lastT.current = now;
    const d = Math.max(0, dy);
    lastDrag.current = d;
    setDrag(d);
  }
  function endDrag() {
    if (!down.current) return;
    down.current = false;
    if (!active.current) return;
    active.current = false;
    setDragging(false);
    const h = sheetRef.current?.offsetHeight ?? 360;
    if (lastDrag.current > h * 0.3 || velocity.current > 0.6) handleClose();
    else setDrag(0);
  }

  const transform = dragging
    ? `translateY(${drag}px)`
    : entered
      ? "translateY(0)"
      : "translateY(100%)";
  const sheetH = sheetRef.current?.offsetHeight ?? 460;
  const dragProgress = dragging ? Math.min(1, drag / sheetH) : 0;

  return (
    /* z-[60] to sit above the edit-reading modal (z-50) */
    <div className="fixed inset-0 z-[60] flex items-end">
      <div
        className="absolute inset-0 bg-black/50"
        style={{
          opacity: entered ? 1 - dragProgress * 0.6 : 0,
          transition: dragging ? "none" : "opacity 320ms ease",
        }}
        onClick={handleClose}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Date & time"
        tabIndex={-1}
        className="relative w-full rounded-t-2xl bg-paper shadow-pop outline-none will-change-transform"
        style={{
          transform,
          transition: dragging
            ? "none"
            : `transform ${presentDuration(sheetH)}ms ${IOS_EASE}`,
        }}
      >
        {/* Draggable grabber + header */}
        <div
          className="touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="flex cursor-grab justify-center pb-1 pt-3 active:cursor-grabbing">
            <div className="h-[5px] w-10 rounded-full bg-ink/[0.14]" />
          </div>
          <div className="flex items-center justify-between px-6 pb-3 pt-2">
            <h2 className="text-lg font-semibold tracking-tightish">Date &amp; time</h2>
          </div>
        </div>

        <div className="max-h-[78dvh] overflow-y-auto px-5 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1rem))]">
          <CalendarPanel value={value} onChange={onChange} />
          <button
            type="button"
            onClick={handleClose}
            className="mt-4 w-full rounded-full bg-strong py-3 text-sm font-medium text-on-strong transition-[opacity,transform] hover:opacity-90 active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DateTimePicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close desktop dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    // Escape closes just the picker — capture phase so the surrounding
    // modal's own Escape handler doesn't also fire and close the form.
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const display = value.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl border border-line bg-paper px-3 py-2.5 text-left text-base outline-none transition-colors hover:border-ink-soft focus:border-ink active:bg-ink/[0.02]"
      >
        <span className="tabular">{display}</span>
        <CalendarDays size={17} className="shrink-0 text-ink-soft" />
      </button>

      {/* Desktop dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 hidden sm:block">
          <DesktopCalendar
            value={value}
            onChange={onChange}
            onClose={() => setOpen(false)}
          />
        </div>
      )}

      {/* Mobile bottom sheet */}
      {open && (
        <div className="sm:hidden">
          <MobileSheet
            value={value}
            onChange={onChange}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
