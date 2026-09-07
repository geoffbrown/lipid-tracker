"use client";

/**
 * The full-page state when a load failed.
 *
 * Loading is a skeleton now (components/Skeleton.tsx); this is only ever
 * reached on a real failure. It exists so a failure is never displayed as a
 * placeholder that waits for ever — which is what a store error used to do.
 */
export default function ScreenState({
  error,
  onRetry,
}: {
  error?: string | null;
  onRetry?: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-sm text-center">
        <h1 className="font-bold">Couldn&rsquo;t load your readings</h1>
        <p className="mt-2 leading-relaxed text-ink-soft">{error}</p>
        <button
          onClick={onRetry ?? (() => window.location.reload())}
          className="pressable mt-5 rounded-lg bg-strong px-5 py-3 font-bold text-on-strong"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
