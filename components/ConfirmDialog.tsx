"use client";

import { useCallback, useEffect, useState } from "react";

/** Centre dialog. Same ownership of its own exit as Sheet, for the same reason:
 *  a parent that unmounts on click makes it disappear rather than leave. */
export default function ConfirmDialog({
  title, message, confirmLabel = "Confirm", danger, onConfirm, onCancel,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [closing, setClosing] = useState<null | "cancel" | "confirm">(null);
  const close = useCallback((how: "cancel" | "confirm") => setClosing(how), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close("cancel");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center bg-black/60 p-6 ${
        closing ? "backdrop-out" : "backdrop-in"
      }`}
      onClick={() => close("cancel")}
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) (closing === "confirm" ? onConfirm : onCancel)();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`card w-full max-w-sm p-5 ${closing ? "dialog-out" : "dialog-in"}`}
      >
        <h2 className="font-bold">{title}</h2>
        <div className="mt-2 leading-relaxed text-ink-soft">{message}</div>
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => close("cancel")}
            className="pressable flex-1 rounded-lg border border-line py-3 font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={() => close("confirm")}
            className={`pressable flex-1 rounded-lg py-3 font-bold ${
              danger ? "bg-danger text-white" : "bg-strong text-on-strong"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
