import type { Profile, Reading } from "../types";
import type { ProfileStore, ReadingStore } from "./store";

/* Demo-mode stores. Used whenever Supabase is not configured, so the app is
   fully usable — and reviewable — before a project exists. Data lives in one
   browser and is not synced; the UI says so. */

const READINGS_KEY = "lipidlog.readings.v1";
const PROFILE_KEY = "lipidlog.profile.v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private mode, or storage full. The in-memory state is still correct for
       this session; losing the mirror is preferable to losing the interaction. */
  }
}

const newId = () =>
  (globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

export class LocalReadingStore implements ReadingStore {
  async list(): Promise<Reading[]> {
    return read<Reading[]>(READINGS_KEY, []).sort(
      (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
    );
  }
  async save(reading: Omit<Reading, "id"> & { id?: string }): Promise<Reading> {
    const rows = read<Reading[]>(READINGS_KEY, []);
    const saved: Reading = { ...reading, id: reading.id ?? newId() };
    const at = rows.findIndex((r) => r.id === saved.id);
    if (at === -1) rows.push(saved);
    else rows[at] = saved;
    write(READINGS_KEY, rows);
    return saved;
  }
  async remove(id: string): Promise<void> {
    write(READINGS_KEY, read<Reading[]>(READINGS_KEY, []).filter((r) => r.id !== id));
  }
  async clear(): Promise<void> {
    write(READINGS_KEY, []);
  }
}

export class LocalProfileStore implements ProfileStore {
  async get(): Promise<Partial<Profile> | null> {
    return read<Partial<Profile> | null>(PROFILE_KEY, null);
  }
  async save(patch: Partial<Profile>): Promise<void> {
    write(PROFILE_KEY, { ...(read<Partial<Profile>>(PROFILE_KEY, {})), ...patch });
  }
}
