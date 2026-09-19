/**
 * What a reading looks like to an AI client.
 *
 * Every number the app shows is derived at read time by lib/calc.js from the
 * raw inputs, using the account's chosen methods. The MCP server has to say
 * exactly the same things the screens do — the same LDL method, the same ApoB
 * estimate, the same reference bands — or the person hears two versions of
 * their own history. So this module is a thin projection over calc.js and the
 * biomarker table; it invents nothing.
 *
 * Server-safe: no React, no browser globals, and relative imports with explicit
 * extensions so Node can load it straight into the unit test with no bundler.
 */
import { calcDerived, getDispLDL } from "../calc.js";
import { BMS, zoneOf, type Biomarker } from "../biomarkers.ts";
import type { Profile, Reading, Source } from "../types.ts";

export type SourceLabel = "Home" | "Lab";

export const toSourceLabel = (s: Source): SourceLabel => (s === "Lab" ? "Lab" : "Home");
export const fromSourceLabel = (s: SourceLabel): Source => (s === "Lab" ? "Lab" : "POC");

export interface MetricOut {
  key: string;
  label: string;
  value: number;
  unit: string;
  /** Where the number came from: Measured, Martin-Hopkins, INTERHEART, Derived… */
  provenance: string;
  /** Which published band the value sits in, and whether that is the good side. */
  zone: { label: string; status: "good" | "mid" | "bad" };
  /** The cut-points the band comes from, as the app prints them. */
  reference: string;
}

export interface EnrichedOut {
  id: string;
  timestamp: string;
  source: SourceLabel;
  sourceName: string;
  notes: string;
  /** Exactly what was entered, untouched. */
  inputs: {
    tc: number | null; hdl: number | null; ldl: number | null; tg: number | null;
    apobMeasured: number | null;
  };
  metrics: Record<string, MetricOut>;
  /** Present only when the LDL estimate was withheld (TG out of range). */
  ldlNote?: string;
}

const referenceText = (bm: Biomarker): string => {
  const first = bm.marks[0];
  const last = bm.marks[bm.marks.length - 1];
  if (bm.marks.length === 1) return `${bm.zones[0]} < ${first} · lower is better`;
  return `${bm.zones[0]} < ${first} · ${bm.zones[bm.zones.length - 1]} ≥ ${last}`;
};

const metric = (bm: Biomarker, value: number, provenance: string): MetricOut => {
  const z = zoneOf(bm, value);
  return {
    key: bm.key, label: bm.label, value, unit: bm.unit, provenance,
    zone: { label: z.label, status: z.status },
    reference: referenceText(bm),
  };
};

export function enrichReading(r: Reading, profile: Profile): EnrichedOut {
  const d = calcDerived(r, profile.apobMethod);
  const ldl = getDispLDL(r, d, profile.ldlMethod);

  const metrics: Record<string, MetricOut> = {};
  for (const bm of BMS) {
    switch (bm.key) {
      case "ldl":
        if (ldl) metrics.ldl = metric(bm, ldl.value, ldl.label);
        break;
      case "hdl":
        if (r.hdl != null) metrics.hdl = metric(bm, r.hdl, "Measured");
        break;
      case "tc":
        if (r.tc != null) metrics.tc = metric(bm, r.tc, "Measured");
        break;
      case "tg":
        if (r.tg != null) metrics.tg = metric(bm, r.tg, "Measured");
        break;
      case "nonHDL":
        if (d.nonHDL != null) metrics.nonHDL = metric(bm, d.nonHDL, "Derived");
        break;
      case "apob":
        if (d.apob != null) metrics.apob = metric(bm, d.apob, d.apobLabel ?? "Estimated");
        break;
      case "tcHdl":
        if (d.tcHdl != null) metrics.tcHdl = metric(bm, d.tcHdl, "Derived");
        break;
      case "tgHdl":
        if (d.tgHdl != null) metrics.tgHdl = metric(bm, d.tgHdl, "Derived");
        break;
    }
  }

  const out: EnrichedOut = {
    id: r.id,
    timestamp: r.timestamp,
    source: toSourceLabel(r.source),
    sourceName: r.sourceName,
    notes: r.notes,
    inputs: { tc: r.tc, hdl: r.hdl, ldl: r.ldl, tg: r.tg, apobMeasured: r.apobMeasured },
    metrics,
  };
  if (ldl?.blocked && ldl.blockedReason) out.ldlNote = ldl.blockedReason;
  return out;
}

/** Newest first, the order every screen uses. */
export const newestFirst = <T extends { timestamp: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

/**
 * The latest known value of one metric, looking back through history the way
 * the dashboard tiles do: a metric the newest reading omitted still has a
 * last known value.
 */
export function latestMetric(
  enriched: EnrichedOut[], key: string,
): { metric: MetricOut; timestamp: string; source: SourceLabel; previous: { value: number; timestamp: string; source: SourceLabel } | null } | null {
  const rows = newestFirst(enriched);
  let first: EnrichedOut | null = null;
  for (const r of rows) {
    const m = r.metrics[key];
    if (!m) continue;
    if (!first) { first = r; continue; }
    return {
      metric: first.metrics[key], timestamp: first.timestamp, source: first.source,
      previous: { value: m.value, timestamp: r.timestamp, source: r.source },
    };
  }
  return first
    ? { metric: first.metrics[key], timestamp: first.timestamp, source: first.source, previous: null }
    : null;
}
