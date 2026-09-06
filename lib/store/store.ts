import type { Profile, Reading } from "../types";

/** The rest of the app depends only on these two interfaces, never on Supabase
 *  or on localStorage directly. That is what lets the app run identically with
 *  and without a configured backend. */
export interface ReadingStore {
  list(): Promise<Reading[]>;
  save(reading: Omit<Reading, "id"> & { id?: string }): Promise<Reading>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export interface ProfileStore {
  get(): Promise<Partial<Profile> | null>;
  save(patch: Partial<Profile>): Promise<void>;
}
