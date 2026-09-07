"use client";

/**
 * The full-page state a screen shows before it has data, or when the load
 * failed. Shared so the three screens cannot drift, and so a failure is never
 * displayed as a spinner that waits forever.
 *
 * `loading` is now rare rather than routine: useAppData seeds from its cache,
 * so only the first load of a document reaches this.
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
      {error ? (
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
      ) : (
        <p className="text-ink-soft">Loading…</p>
      )}
    </main>
  );
}
