"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getProfileStore, getReadingStore } from "./store";
import { DEFAULT_PROFILE, type Profile, type Reading } from "./types";
import { BM } from "./biomarkers";
import { calcDerived, getDispLDL, metricValue } from "./calc.js";

export type Derived = ReturnType<typeof calcDerived>;
export type Enriched = Reading & { d: Derived };

export interface Trend {
  delta: number;
  since: string;
  crossSource: boolean;
  prevSource: string;
}

const fmtShort = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Everything the screens need from the store, in one place, so the dashboard
 *  and the history view cannot disagree about how a value is derived. */
export function useAppData() {
  const [readings, setReadings] = useState<Reading[] | null>(null);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    (async () => {
      const [rows, saved] = await Promise.all([
        getReadingStore().list(),
        getProfileStore().get(),
      ]);
      const merged = { ...DEFAULT_PROFILE, ...(saved ?? {}) };
      setNeedsOnboarding(!merged.onboardedAt && rows.length === 0);
      setProfile(merged);
      setReadings(rows);
    })();
  }, []);

  /* Mutations live beside the reads so every screen sees the same state without
     a refetch, and so nothing has to remember to re-sort. */
  const saveReading = useCallback(
    async (data: Omit<Reading, "id"> & { id?: string }) => {
      const saved = await getReadingStore().save(data);
      setReadings((rows) => {
        const next = (rows ?? []).filter((r) => r.id !== saved.id).concat(saved);
        return next.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
      });
    },
    [],
  );

  const deleteReading = useCallback(async (id: string) => {
    await getReadingStore().remove(id);
    setReadings((rows) => (rows ?? []).filter((r) => r.id !== id));
  }, []);

  const saveProfile = useCallback(
    async (patch: Partial<Profile>) => {
      setProfile((p) => ({ ...p, ...patch }));
      await getProfileStore().save(patch);
    },
    [],
  );

  const enriched: Enriched[] = useMemo(
    () => (readings ?? []).map((r) => ({ ...r, d: calcDerived(r, profile.apobMethod) })),
    [readings, profile.apobMethod],
  );
  const descending = useMemo(
    () => [...enriched].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
    [enriched],
  );

  /* Reads the whole history, not just the newest reading: a pinned metric
     should still show its last known value when the latest reading omitted it. */
  const latestFor = useCallback(
    (key: string) => {
      for (const r of descending) {
        const v = metricValue(r, key, profile.ldlMethod);
        if (v != null) return { value: v as number, reading: r };
      }
      return null;
    },
    [descending, profile.ldlMethod],
  );

  const trendFor = useCallback(
    (key: string): Trend | null => {
      const found: Enriched[] = [];
      for (const r of descending) {
        if (metricValue(r, key, profile.ldlMethod) != null) {
          found.push(r);
          if (found.length === 2) break;
        }
      }
      if (found.length !== 2) return null;
      const [now, prev] = found;
      const delta =
        (metricValue(now, key, profile.ldlMethod) as number) -
        (metricValue(prev, key, profile.ldlMethod) as number);
      return {
        delta: +delta.toFixed(1),
        since: fmtShort(prev.timestamp),
        crossSource: (now.source === "Lab") !== (prev.source === "Lab"),
        prevSource: prev.source === "Lab" ? "Lab" : "Home",
      };
    },
    [descending, profile.ldlMethod],
  );

  /* Where a number came from is the point of this app, so everything says it. */
  const provenanceFor = useCallback(
    (key: string, r: Enriched) => {
      if (key === "ldl") return getDispLDL(r, r.d, profile.ldlMethod)?.label ?? "Reported";
      if (key === "apob") return r.d.apobLabel ?? "Estimated";
      if (key === "tcHdl" || key === "tgHdl") return "Derived";
      return "Measured";
    },
    [profile.ldlMethod],
  );

  const rowMetrics = useCallback(
    (r: Enriched) =>
      profile.cards
        .map((k) => {
          const v = metricValue(r, k, profile.ldlMethod);
          return v == null ? null : { key: k, label: BM(k)?.label ?? k, value: v as number };
        })
        .filter((m): m is { key: string; label: string; value: number } => m !== null),
    [profile.cards, profile.ldlMethod],
  );

  return {
    loading: readings === null,
    needsOnboarding,
    readings: readings ?? [],
    profile, saveProfile, saveReading, deleteReading,
    enriched, descending,
    latestFor, trendFor, provenanceFor, rowMetrics,
  };
}
