"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getProfileStore, getReadingStore } from "./store";
import { DEFAULT_PROFILE, type Profile, type Reading } from "./types";
import { BM } from "./biomarkers";
import { getTheme, setTheme } from "./theme";
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

interface Snapshot {
  readings: Reading[];
  profile: Profile;
  needsOnboarding: boolean;
}

/**
 * What the last successful load returned, kept for the life of the document.
 *
 * Every screen mounts its own copy of this hook, so without a cache each
 * navigation started from `readings === null` and every screen showed its
 * full-page loading state before rendering anything — a flash on every tab
 * change, for data the app already had. Seeding from here makes a second visit
 * render immediately; the fetch below still runs and reconciles.
 *
 * It is per-document and per-account: sign-out clears it, and both sign-in and
 * sign-out navigate hard, which tears down the module anyway. One account's
 * readings must never be seeded into another's screen.
 */
let cache: Snapshot | null = null;

export function clearAppCache() {
  cache = null;
}

/** Everything the screens need from the store, in one place, so the dashboard
 *  and the history view cannot disagree about how a value is derived. */
export function useAppData() {
  const [readings, setReadings] = useState<Reading[] | null>(cache?.readings ?? null);
  const [profile, setProfile] = useState<Profile>(cache?.profile ?? DEFAULT_PROFILE);
  const [needsOnboarding, setNeedsOnboarding] = useState(cache?.needsOnboarding ?? false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [rows, saved] = await Promise.all([
          getReadingStore().list(),
          getProfileStore().get(),
        ]);
        const merged = { ...DEFAULT_PROFILE, ...(saved ?? {}) };
        /* The account's theme wins over whatever this browser last had. The
           pre-paint script has already painted from the local mirror, so this
           only does work when the two disagree — i.e. the choice was made on
           another device. Writing it back keeps the mirror right for the next
           first paint here. */
        if (merged.theme !== getTheme()) setTheme(merged.theme);
        cache = {
          readings: rows,
          profile: merged,
          needsOnboarding: !merged.onboardedAt && rows.length === 0,
        };
        if (!alive) return;
        setNeedsOnboarding(cache.needsOnboarding);
        setProfile(merged);
        setReadings(rows);
        setError(null);
      } catch (err) {
        /* Without this the rejection was silent and `readings` stayed null, so
           a failed load rendered "Loading…" forever with nothing to act on.
           A stuck spinner is the worst way to report an error. */
        if (!alive) return;
        setError(
          err instanceof Error ? err.message : "Couldn't load your readings.",
        );
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* Mutations live beside the reads so every screen sees the same state without
     a refetch, and so nothing has to remember to re-sort. */
  const saveReading = useCallback(
    async (data: Omit<Reading, "id"> & { id?: string }) => {
      const saved = await getReadingStore().save(data);
      setReadings((rows) => {
        const next = (rows ?? [])
          .filter((r) => r.id !== saved.id)
          .concat(saved)
          .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
        if (cache) cache = { ...cache, readings: next };
        return next;
      });
    },
    [],
  );

  /* Import lands as one write and one state update: a hundred rows arriving
     one at a time would re-render and re-sort the whole list a hundred times. */
  const importReadings = useCallback(
    async (incoming: Omit<Reading, "id">[]) => {
      const saved = await getReadingStore().saveMany(incoming);
      setReadings((rows) => {
        const next = (rows ?? [])
          .concat(saved)
          .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
        if (cache) cache = { ...cache, readings: next };
        return next;
      });
      return saved.length;
    },
    [],
  );

  const deleteReading = useCallback(async (id: string) => {
    await getReadingStore().remove(id);
    setReadings((rows) => {
      const next = (rows ?? []).filter((r) => r.id !== id);
      if (cache) cache = { ...cache, readings: next };
      return next;
    });
  }, []);

  const saveProfile = useCallback(
    async (patch: Partial<Profile>) => {
      setProfile((p) => {
        const next = { ...p, ...patch };
        if (cache) cache = { ...cache, profile: next };
        return next;
      });
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
      if (key === "nonHDL" || key === "tcHdl" || key === "tgHdl") return "Derived";
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
    loading: readings === null && error === null,
    error,
    needsOnboarding,
    readings: readings ?? [],
    profile, saveProfile, saveReading, deleteReading, importReadings,
    enriched, descending,
    latestFor, trendFor, provenanceFor, rowMetrics,
  };
}
