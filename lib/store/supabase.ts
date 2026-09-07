import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Reading, Source } from "../types";
import type { ProfileStore, ReadingStore } from "./store";

/* Column names are snake_case in Postgres and camelCase in the app; the
   mapping lives here so nothing else has to know about either convention. */

interface ReadingRow {
  id: string;
  ts: string;
  source: Source;
  source_name: string;
  tc: number | null;
  hdl: number | null;
  ldl: number | null;
  tg: number | null;
  apob_measured: number | null;
  notes: string | null;
}

const toReading = (r: ReadingRow): Reading => ({
  id: r.id,
  timestamp: r.ts,
  source: r.source,
  sourceName: r.source_name,
  tc: r.tc,
  hdl: r.hdl,
  ldl: r.ldl,
  tg: r.tg,
  apobMeasured: r.apob_measured,
  notes: r.notes ?? "",
});

export class SupabaseReadingStore implements ReadingStore {
  constructor(private supabase: SupabaseClient) {}

  async list(): Promise<Reading[]> {
    const { data, error } = await this.supabase
      .from("readings")
      .select("id, ts, source, source_name, tc, hdl, ldl, tg, apob_measured, notes")
      .order("ts", { ascending: false })
      .order("id", { ascending: false });
    if (error) throw error;
    return (data as ReadingRow[]).map(toReading);
  }

  async save(reading: Omit<Reading, "id"> & { id?: string }): Promise<Reading> {
    // user_id is filled by its column default (auth.uid()), and RLS checks it.
    const row = {
      ...(reading.id ? { id: reading.id } : {}),
      ts: reading.timestamp,
      source: reading.source,
      source_name: reading.sourceName,
      tc: reading.tc,
      hdl: reading.hdl,
      ldl: reading.ldl,
      tg: reading.tg,
      apob_measured: reading.source === "Lab" ? reading.apobMeasured : null,
      notes: reading.notes || null,
    };
    const { data, error } = await this.supabase
      .from("readings")
      .upsert(row)
      .select("id, ts, source, source_name, tc, hdl, ldl, tg, apob_measured, notes")
      .single();
    if (error) throw error;
    return toReading(data as ReadingRow);
  }

  async saveMany(readings: Omit<Reading, "id">[]): Promise<Reading[]> {
    if (readings.length === 0) return [];
    // One insert. user_id comes from its column default and RLS checks it, so
    // a row that is not the caller's cannot be written here either.
    const { data, error } = await this.supabase
      .from("readings")
      .insert(
        readings.map((r) => ({
          ts: r.timestamp,
          source: r.source,
          source_name: r.sourceName,
          tc: r.tc, hdl: r.hdl, ldl: r.ldl, tg: r.tg,
          apob_measured: r.source === "Lab" ? r.apobMeasured : null,
          notes: r.notes || null,
        })),
      )
      .select("id, ts, source, source_name, tc, hdl, ldl, tg, apob_measured, notes");
    if (error) throw error;
    return (data as ReadingRow[]).map(toReading);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from("readings").delete().eq("id", id);
    if (error) throw error;
  }

  async clear(): Promise<void> {
    // RLS scopes this to the caller's own rows; the filter is required by
    // PostgREST, which refuses an unqualified delete.
    const { error } = await this.supabase.from("readings").delete().not("id", "is", null);
    if (error) throw error;
  }
}

interface ProfileRow {
  ldl_method: Profile["ldlMethod"];
  apob_method: Profile["apobMethod"];
  lpa: number | null;
  lpa_unit: Profile["lpaUnit"];
  default_source: Source;
  default_device: string | null;
  default_lab_source: string | null;
  home_devices: string[] | null;
  lab_sources: string[] | null;
  cards: string[] | null;
  onboarded_at: string | null;
}

export class SupabaseProfileStore implements ProfileStore {
  constructor(private supabase: SupabaseClient) {}

  async get(): Promise<Partial<Profile> | null> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select(
        "ldl_method, apob_method, lpa, lpa_unit, default_source, default_device, " +
          "default_lab_source, home_devices, lab_sources, cards, onboarded_at",
      )
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as unknown as ProfileRow;
    return {
      ldlMethod: row.ldl_method,
      apobMethod: row.apob_method,
      lpa: row.lpa,
      lpaUnit: row.lpa_unit,
      defaultSource: row.default_source,
      defaultDevice: row.default_device,
      defaultLabSource: row.default_lab_source,
      homeDevices: row.home_devices ?? [],
      labSources: row.lab_sources ?? [],
      cards: row.cards ?? [],
      onboardedAt: row.onboarded_at,
    };
  }

  async save(patch: Partial<Profile>): Promise<void> {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const map: Record<keyof Profile, string> = {
      ldlMethod: "ldl_method", apobMethod: "apob_method", lpa: "lpa",
      lpaUnit: "lpa_unit", defaultSource: "default_source", defaultDevice: "default_device",
      defaultLabSource: "default_lab_source", homeDevices: "home_devices",
      labSources: "lab_sources", cards: "cards", onboardedAt: "onboarded_at",
    };
    for (const [key, column] of Object.entries(map))
      if (patch[key as keyof Profile] !== undefined) row[column] = patch[key as keyof Profile];
    const { error } = await this.supabase
      .from("profiles")
      .upsert(row, { onConflict: "user_id" });
    if (error) throw error;
  }
}
