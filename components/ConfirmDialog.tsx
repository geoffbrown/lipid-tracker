"use client";

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
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-sm p-5"
      >
        <h2 className="font-bold">{title}</h2>
        <div className="mt-2 leading-relaxed text-ink-soft">{message}</div>
        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-line py-2.5 font-semibold">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-lg py-2.5 font-bold ${
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
