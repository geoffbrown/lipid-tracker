import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { SupabaseProfileStore, SupabaseReadingStore } from "../store/supabase";
import { DEFAULT_PROFILE, type Profile, type Reading } from "../types";
import { BMS } from "../biomarkers";
import { validateReading } from "../validation.js";
import { clientForToken } from "./auth";
import {
  enrichReading, fromSourceLabel, latestMetric, newestFirst, toSourceLabel,
  type EnrichedOut,
} from "./enrich";

/* ── Plumbing ──────────────────────────────────────────────────────────────── */

const METRIC_KEYS = BMS.map((b) => b.key) as [string, ...string[]];
const METRIC_HELP = BMS.map((b) => `${b.key} (${b.label})`).join(", ");

const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  structuredContent: data as Record<string, unknown>,
});
const fail = (message: string) => ({
  content: [{ type: "text" as const, text: message }],
  isError: true,
});

/** Supabase raises plain objects as often as Error instances; either way the
 *  caller should read a sentence, not "[object Object]". */
const describe = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e && typeof e.message === "string") return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
};

/** Every tool body runs through this so a thrown error becomes a readable
 *  tool error rather than a protocol-level failure. */
type ToolBody<A> = (args: A, ctx: ServerContext) => Promise<ReturnType<typeof ok> | ReturnType<typeof fail> | { content: { type: "text"; text: string }[]; structuredContent?: Record<string, unknown> }>;
const guarded = <A,>(body: ToolBody<A>) => async (args: A, ctx: ServerContext) => {
  try {
    return await body(args, ctx);
  } catch (e) {
    return fail(`LipidLog error: ${describe(e)}`);
  }
};

/** Stores and profile for the caller. Every tool goes through here so none of
 *  them can forget to scope to the token. */
async function session(ctx: ServerContext) {
  const token = ctx.http?.authInfo?.token;
  if (!token) throw new Error("Not authenticated.");
  const supabase = clientForToken(token);
  const readings = new SupabaseReadingStore(supabase);
  const profiles = new SupabaseProfileStore(supabase);
  const saved = await profiles.get();
  const profile: Profile = { ...DEFAULT_PROFILE, ...(saved ?? {}) };
  return { readings, profiles, profile };
}

const rangeStart = (range: "30d" | "90d" | "1y" | "all"): number => {
  const day = 86_400_000;
  const now = Date.now();
  return range === "30d" ? now - 30 * day
    : range === "90d" ? now - 90 * day
    : range === "1y" ? now - 365 * day
    : 0;
};

/* ── Shared input shapes ───────────────────────────────────────────────────── */

const sourceLabel = z.enum(["Home", "Lab"]);

const lipidFields = {
  tc: z.number().nullable().optional().describe("Total cholesterol, mg/dL"),
  hdl: z.number().nullable().optional().describe("HDL cholesterol, mg/dL"),
  ldl: z.number().nullable().optional().describe("LDL as reported by the device or lab, mg/dL. Stored as-is; the app also computes its own estimate."),
  tg: z.number().nullable().optional().describe("Triglycerides, mg/dL"),
  apobMeasured: z.number().nullable().optional().describe("Lab-measured ApoB, mg/dL. Lab readings only; ignored for Home."),
  notes: z.string().max(300).optional().describe("Free-text note, up to 300 characters"),
};

/** Run the app's own validation and decide whether to save. Warnings hold the
 *  save until the caller confirms, mirroring the confirmation step in the UI. */
function gate(candidate: Omit<Reading, "id">, confirmWarnings: boolean | undefined) {
  const { errors, warnings } = validateReading(
    {
      tc: candidate.tc, hdl: candidate.hdl, ldl: candidate.ldl, tg: candidate.tg,
      apobMeasured: candidate.apobMeasured, source: candidate.source,
      timestamp: candidate.timestamp,
    },
  ) as { errors: string[]; warnings: string[] };
  if (errors.length) return fail(`Not saved:\n- ${errors.join("\n- ")}`);
  if (warnings.length && !confirmWarnings) {
    return {
      content: [{
        type: "text" as const,
        text:
          "Not saved yet. These values are unusual:\n- " + warnings.join("\n- ") +
          "\n\nIf they are correct, call the tool again with confirmWarnings: true.",
      }],
      structuredContent: { saved: false, warnings },
    };
  }
  return null;
}

/* ── Tools ─────────────────────────────────────────────────────────────────── */

export function registerLipidTools(server: McpServer) {
  server.registerTool(
    "get_latest_panel",
    {
      title: "Latest lipid panel",
      description:
        "The most recent reading in full, plus the latest known value of every metric " +
        "(looking back through history for any the newest reading omitted) with the " +
        "change since the previous value. Start here for 'how am I doing'.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    guarded(async (_args, ctx) => {
      const { readings, profile } = await session(ctx);
      const rows = newestFirst(await readings.list());
      if (rows.length === 0) return ok({ latestReading: null, metrics: {}, message: "No readings yet." });
      const enriched = rows.map((r) => enrichReading(r, profile));
      const metrics: Record<string, unknown> = {};
      for (const bm of BMS) {
        const l = latestMetric(enriched, bm.key);
        if (!l) continue;
        metrics[bm.key] = {
          ...l.metric,
          asOf: l.timestamp,
          source: l.source,
          change: l.previous
            ? {
                delta: +(l.metric.value - l.previous.value).toFixed(1),
                since: l.previous.timestamp,
                crossSource: l.previous.source !== l.source,
                betterDirection: bm.lowerBetter ? "lower" : "higher",
              }
            : null,
        };
      }
      return ok({
        latestReading: enriched[0],
        metrics,
        methods: { ldl: profile.ldlMethod, apob: profile.apobMethod },
        lpa: profile.lpa != null ? { value: profile.lpa, unit: profile.lpaUnit } : null,
        readingCount: rows.length,
      });
    }),
  );

  server.registerTool(
    "list_readings",
    {
      title: "List readings",
      description:
        "Readings newest first, each with raw inputs and every derived metric. " +
        "Filter by date range or source. Use get_trend for one metric over time.",
      inputSchema: z.object({
        since: z.string().optional().describe("ISO date; only readings on or after this"),
        until: z.string().optional().describe("ISO date; only readings on or before this"),
        source: sourceLabel.optional().describe("Home (point-of-care device) or Lab"),
        limit: z.number().int().min(1).max(200).default(20),
      }),
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ since, until, source, limit }, ctx) => {
      const { readings, profile } = await session(ctx);
      const sinceT = since ? Date.parse(since) : -Infinity;
      const untilT = until ? Date.parse(until) : Infinity;
      if (Number.isNaN(sinceT) || Number.isNaN(untilT)) return fail("since/until must be ISO dates.");
      const rows = newestFirst(await readings.list()).filter((r) => {
        const t = Date.parse(r.timestamp);
        return t >= sinceT && t <= untilT && (!source || toSourceLabel(r.source) === source);
      });
      return ok({
        total: rows.length,
        returned: Math.min(rows.length, limit),
        readings: rows.slice(0, limit).map((r) => enrichReading(r, profile)),
      });
    }),
  );

  server.registerTool(
    "get_trend",
    {
      title: "Metric trend",
      description:
        `One metric over time, oldest first, with first/last/change and min/max. Metrics: ${METRIC_HELP}. ` +
        "LDL uses the account's chosen method (Martin-Hopkins by default).",
      inputSchema: z.object({
        metric: z.enum(METRIC_KEYS),
        range: z.enum(["30d", "90d", "1y", "all"]).default("all"),
        source: sourceLabel.optional().describe("Restrict to Home or Lab readings"),
      }),
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ metric, range, source }, ctx) => {
      const { readings, profile } = await session(ctx);
      const start = rangeStart(range);
      const bm = BMS.find((b) => b.key === metric)!;
      const carrying = newestFirst(await readings.list())
        .filter((r) => Date.parse(r.timestamp) >= start && (!source || toSourceLabel(r.source) === source))
        .map((r) => enrichReading(r, profile))
        .filter((e) => e.metrics[metric]);
      const points = carrying
        .map((e) => ({
          timestamp: e.timestamp, value: e.metrics[metric].value, source: e.source,
          sourceName: e.sourceName, zone: e.metrics[metric].zone.label,
        }))
        .reverse();
      if (points.length === 0) return ok({ metric, label: bm.label, unit: bm.unit, range, points: [] });
      const values = points.map((p) => p.value);
      const first = points[0], last = points[points.length - 1];
      return ok({
        metric, label: bm.label, unit: bm.unit, range,
        betterDirection: bm.lowerBetter ? "lower" : "higher",
        reference: carrying[0].metrics[metric].reference,
        first, last,
        change: +(last.value - first.value).toFixed(1),
        min: Math.min(...values), max: Math.max(...values),
        count: points.length,
        points,
      });
    }),
  );

  server.registerTool(
    "add_reading",
    {
      title: "Add reading",
      description:
        "Record a new reading. Give at least one of tc, hdl, ldl, tg. Source defaults to the " +
        "account's default; timestamp defaults to now. Unusual values are held back with " +
        "warnings until confirmWarnings is true, exactly like the app's confirmation step.",
      inputSchema: z.object({
        timestamp: z.string().optional().describe("ISO 8601 date-time. Defaults to now."),
        source: sourceLabel.optional(),
        sourceName: z.string().optional().describe("Device or lab name, e.g. 'CURO L7/L5' or 'LabCorp'. Defaults to the account's default for the source."),
        ...lipidFields,
        confirmWarnings: z.boolean().optional(),
      }),
    },
    guarded(async (a, ctx) => {
      const { readings, profile } = await session(ctx);
      const source = fromSourceLabel(a.source ?? toSourceLabel(profile.defaultSource));
      const sourceName =
        a.sourceName ??
        (source === "Lab" ? profile.defaultLabSource : profile.defaultDevice) ??
        (source === "Lab" ? "Lab" : "Home device");
      const ts = a.timestamp ? new Date(a.timestamp) : new Date();
      if (Number.isNaN(ts.getTime())) return fail("timestamp must be an ISO 8601 date-time.");
      const candidate: Omit<Reading, "id"> = {
        timestamp: ts.toISOString(), source, sourceName,
        tc: a.tc ?? null, hdl: a.hdl ?? null, ldl: a.ldl ?? null, tg: a.tg ?? null,
        apobMeasured: source === "Lab" ? a.apobMeasured ?? null : null,
        notes: a.notes ?? "",
      };
      const held = gate(candidate, a.confirmWarnings);
      if (held) return held;
      const saved = await readings.save(candidate);
      return ok({ saved: true, reading: enrichReading(saved, profile) });
    }),
  );

  server.registerTool(
    "update_reading",
    {
      title: "Update reading",
      description:
        "Change fields on an existing reading by id. Only the fields given change; pass null " +
        "to clear a value. Same validation and warning confirmation as add_reading.",
      inputSchema: z.object({
        id: z.string().uuid(),
        timestamp: z.string().optional(),
        source: sourceLabel.optional(),
        sourceName: z.string().optional(),
        ...lipidFields,
        confirmWarnings: z.boolean().optional(),
      }),
    },
    guarded(async (a, ctx) => {
      const { readings, profile } = await session(ctx);
      const existing = (await readings.list()).find((r) => r.id === a.id);
      if (!existing) return fail(`No reading with id ${a.id}.`);
      const source = a.source ? fromSourceLabel(a.source) : existing.source;
      const ts = a.timestamp ? new Date(a.timestamp) : new Date(existing.timestamp);
      if (Number.isNaN(ts.getTime())) return fail("timestamp must be an ISO 8601 date-time.");
      const pick = <K extends keyof Reading>(k: K, v: Reading[K] | undefined): Reading[K] =>
        v === undefined ? existing[k] : v;
      const candidate: Omit<Reading, "id"> & { id: string } = {
        id: existing.id,
        timestamp: ts.toISOString(), source,
        sourceName: a.sourceName ?? existing.sourceName,
        tc: pick("tc", a.tc), hdl: pick("hdl", a.hdl), ldl: pick("ldl", a.ldl), tg: pick("tg", a.tg),
        apobMeasured: source === "Lab" ? pick("apobMeasured", a.apobMeasured) : null,
        notes: a.notes ?? existing.notes,
      };
      const held = gate(candidate, a.confirmWarnings);
      if (held) return held;
      const saved = await readings.save(candidate);
      return ok({ saved: true, reading: enrichReading(saved, profile) });
    }),
  );

  server.registerTool(
    "delete_reading",
    {
      title: "Delete reading",
      description: "Permanently delete one reading by id. Confirm with the person first.",
      inputSchema: z.object({ id: z.string().uuid() }),
      annotations: { destructiveHint: true },
    },
    guarded(async ({ id }, ctx) => {
      const { readings } = await session(ctx);
      const existing = (await readings.list()).find((r) => r.id === id);
      if (!existing) return fail(`No reading with id ${id}.`);
      await readings.remove(id);
      return ok({ deleted: true, id, timestamp: existing.timestamp });
    }),
  );

  server.registerTool(
    "get_profile",
    {
      title: "Account settings",
      description:
        "The calculation methods and defaults the account uses: LDL method, ApoB estimate, " +
        "Lp(a), default source and device, and the known devices and labs.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    guarded(async (_a, ctx) => {
      const { profile } = await session(ctx);
      return ok({
        ldlMethod: profile.ldlMethod,
        apobMethod: profile.apobMethod,
        lpa: profile.lpa, lpaUnit: profile.lpaUnit,
        defaultSource: toSourceLabel(profile.defaultSource),
        defaultDevice: profile.defaultDevice,
        defaultLabSource: profile.defaultLabSource,
        homeDevices: profile.homeDevices,
        labSources: profile.labSources,
      });
    }),
  );

  server.registerTool(
    "update_profile",
    {
      title: "Update account settings",
      description:
        "Change the LDL or ApoB method, or the stored Lp(a). Changing a method reprices " +
        "every reading, since derived values are computed at read time.",
      inputSchema: z.object({
        ldlMethod: z.enum(["none", "friedewald", "martin-hopkins"]).optional(),
        apobMethod: z.enum(["interheart", "aggressive"]).optional(),
        lpa: z.number().min(0).nullable().optional(),
        lpaUnit: z.enum(["mg/dL", "nmol/L"]).optional(),
      }),
    },
    guarded(async (patch, ctx) => {
      const { profiles } = await session(ctx);
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      if (Object.keys(clean).length === 0) return fail("Nothing to change.");
      await profiles.save(clean as Partial<Profile>);
      return ok({ saved: true, changed: clean });
    }),
  );
}

export type { EnrichedOut };
