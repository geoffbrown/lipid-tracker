"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/**
 * Bottom sheet.
 *
 * Animating *out* is the part that makes this feel native, and it is why the
 * component owns its own dismissal: every exit path — backdrop, close button,
 * Escape, swipe — routes through requestClose(), which plays the exit and only
 * then tells the parent to unmount. A parent that unmounts on click would make
 * the sheet vanish, which is what the app did before.
 *
 * Dragging follows the finger 1:1 downward and is rubber-banded upward, because
 * a sheet that can be dragged up past its own top edge feels broken. Release
 * past a third of the height, or with real downward speed, dismisses.
 */
export default function Sheet({
  title, onClose, children, footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  /* The entrance animation fills forwards, and a running animation outranks an
     inline style — so while `sheet-in` is still applied it owns `transform` and
     the drag would not move the panel at all. The class is dropped once the
     entrance finishes, handing transform back to the gesture. */
  const [entered, setEntered] = useState(false);
  const [drag, setDrag] = useState(0);
  const gesture = useRef<{ y: number; t: number; last: number; lastT: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const requestClose = useCallback(() => setClosing(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";   // the sheet is what scrolls
    panel.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [requestClose]);

  const onPointerDown = (e: React.PointerEvent) => {
    // Only from the grab area — dragging from the body would fight scrolling.
    gesture.current = { y: e.clientY, t: performance.now(), last: e.clientY, lastT: performance.now() };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dy = e.clientY - g.y;
    g.last = e.clientY;
    g.lastT = performance.now();
    setDrag(dy > 0 ? dy : dy / 4);   // rubber-band the upward direction
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    setDragging(false);
    if (!g) return;
    const dy = e.clientY - g.y;
    const dt = Math.max(1, performance.now() - g.lastT);
    const velocity = (e.clientY - g.last) / dt;      // px per ms, downward positive
    const height = panel.current?.offsetHeight ?? 1;
    if (dy > height / 3 || velocity > 0.5) requestClose();
    else setDrag(0);
  };

  return (
    <div
      className={`fixed inset-0 z-40 flex items-end justify-center bg-black/50 ${
        closing ? "backdrop-out" : "backdrop-in"
      }`}
      onClick={requestClose}
      onAnimationEnd={(e) => {
        // Only the backdrop's own exit ends the sheet; children bubble too.
        if (closing && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={(e) => { if (e.target === e.currentTarget && !closing) setEntered(true); }}
        className={`flex max-h-[92vh] w-full min-w-0 max-w-[600px] flex-col rounded-t-2xl bg-canvas outline-none ${
          closing ? "sheet-out" : entered ? "" : "sheet-in"
        }`}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          transform: drag ? `translateY(${drag}px)` : undefined,
          transition: dragging ? "none" : "transform var(--dur-fast) var(--ease-standard)",
        }}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="shrink-0 cursor-grab touch-none active:cursor-grabbing"
        >
          {/* Grabber: the affordance that says this can be pulled down. */}
          <div className="mx-auto mt-3 h-1 w-9 rounded-full bg-line-strong" aria-hidden />
          <div className="flex items-center justify-between gap-4 px-4 pb-3 pt-4">
            <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
            <button
              onClick={requestClose}
              aria-label="Close"
              className="pressable grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line"
            >
              <X size={17} aria-hidden />
            </button>
          </div>
        </div>

        {/* Vertical only. `overflow-y: auto` alone computes `overflow-x: auto`,
            so any stray pixel of width makes the whole sheet pannable sideways
            — and iOS rubber-bands well past it, which reads as the sheet coming
            loose. touch-action pins the gesture too, so a diagonal swipe scrolls
            rather than drifting; nothing in a sheet scrolls horizontally.
            pinch-zoom stays listed — dropping it would take magnification away
            from anyone who needs it to read the field labels. */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-6"
          style={{ touchAction: "pan-y pinch-zoom" }}
        >
          {children}
        </div>
        {footer && <div className="shrink-0 border-t border-line px-4 pb-4 pt-4">{footer}</div>}
      </div>
    </div>
  );
}
