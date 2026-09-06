"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReadingRow from "@/components/ReadingRow";
import BottomNav from "@/components/BottomNav";
import Segmented from "@/components/Segmented";
import { useAppData } from "@/lib/use-app-data";

type SrcMode = "all" | "home" | "lab";

const fmtMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });

export default function HistoryPage() {
  const router = useRouter();
  const { loading, needsOnboarding, descending, rowMetrics } = useAppData();
  const [srcMode, setSrcMode] = useState<SrcMode>("all");

  if (needsOnboarding) router.replace("/onboarding");

  const scoped = useMemo(
    () =>
      descending.filter((r) =>
        srcMode === "all" ? true : srcMode === "lab" ? r.source === "Lab" : r.source !== "Lab"),
    [descending, srcMode],
  );

  /* Grouped by month, which is also why these rows can drop the year that the
     dashboard's ungrouped list has to carry. */
  const groups = useMemo(() => {
    const map = new Map<string, typeof scoped>();
    for (const r of scoped) {
      const k = fmtMonth(r.timestamp);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return [...map.entries()];
  }, [scoped]);

  if (loading) return <main className="grid min-h-screen place-items-center text-ink-soft">Loading…</main>;

  return (
    <>
      <main className="mx-auto max-w-[600px] px-3 pb-24">
        <header className="flex items-baseline justify-between py-4">
          <h1 className="text-xl font-extrabold tracking-tight">History</h1>
          <span className="text-ink-soft">{scoped.length} readings</span>
        </header>

        <Segmented
          options={[
            { value: "all" as const, label: "All" },
            { value: "home" as const, label: "Home" },
            { value: "lab" as const, label: "Lab" },
          ]}
          value={srcMode} onChange={setSrcMode} ariaLabel="Source"
        />

        {groups.length === 0 ? (
          <p className="mt-8 text-center text-ink-soft">No readings recorded yet.</p>
        ) : (
          groups.map(([month, rows]) => (
            <section key={month}>
              <h2 className="mt-7 mb-1 flex items-baseline justify-between px-3 text-[13px] font-semibold tracking-[0.04em] text-ink-faint">
                {month}
                <span>{rows.length}</span>
              </h2>
              <div className="divide-y divide-line border-y border-line">
                {rows.map((r) => (
                  <ReadingRow key={r.id} reading={r} metrics={rowMetrics(r)} onSelect={() => {}} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>
      <BottomNav />
    </>
  );
}
