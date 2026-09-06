"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Bottom sheet. Closes on Escape and on backdrop press, traps initial focus,
 *  and locks the page behind it so the sheet is what scrolls. */
export default function Sheet({
  title, onClose, children, footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-[600px] overflow-y-auto rounded-t-2xl bg-canvas outline-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-canvas px-3 pb-2 pt-4">
          <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line"
          >
            <X size={17} aria-hidden />
          </button>
        </div>
        <div className="px-3 pb-4">{children}</div>
        {footer && <div className="sticky bottom-0 bg-canvas px-3 pb-4 pt-2">{footer}</div>}
      </div>
    </div>
  );
}
