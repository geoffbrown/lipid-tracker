"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReadingRow from "@/components/ReadingRow";
import BottomNav from "@/components/BottomNav";
import Segmented from "@/components/Segmented";
import ReadingDetail from "@/components/ReadingDetail";
import AddEditSheet from "@/components/AddEditSheet";
import { useAppData, type Enriched } from "@/lib/use-app-data";
import type { Reading } from "@/lib/types";

type SrcMode = "all" | "home" | "lab";

const fmtMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });

export default function HistoryPage() {
  const router = useRouter();
  const { loading, needsOnboarding, descending, rowMetrics, profile, saveReading, deleteReading } =
    useAppData();
  const [srcMode, setSrcMode] = useState<SrcMode>("all");
  const [detail, setDetail] = useState<Enriched | null>(null);
  const [editing, setEditing] = useState<Reading | null | undefined>(undefined);

  useEffect(() => {
    if (needsOnboarding) router.replace("/onboarding");
  }, [needsOnboarding, router]);

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
      <main className="mx-auto max-w-[600px] px-4 pb-28">
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
              <h2 className="mt-8 mb-2.5 flex items-baseline justify-between px-1 text-[13px] font-semibold tracking-[0.04em] text-ink-faint">
                {month}
                <span>{rows.length}</span>
              </h2>
              <div className="flex flex-col gap-2">
                {rows.map((r) => (
                  <ReadingRow key={r.id} reading={r} metrics={rowMetrics(r)} onSelect={() => setDetail(r)} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {detail && (
        <ReadingDetail
          reading={detail}
          profile={profile}
          onEdit={() => { setEditing(detail); setDetail(null); }}
          onDelete={() => deleteReading(detail.id)}
          onClose={() => setDetail(null)}
        />
      )}
      {editing !== undefined && (
        <AddEditSheet
          reading={editing}
          profile={profile}
          onSave={saveReading}
          onClose={() => setEditing(undefined)}
        />
      )}
      <BottomNav />
    </>
  );
}
