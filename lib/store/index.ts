import { createClient } from "../supabase/client";
import { isSupabaseConfigured } from "../supabase/config";
import { LocalProfileStore, LocalReadingStore } from "./local";
import { SupabaseProfileStore, SupabaseReadingStore } from "./supabase";
import type { ProfileStore, ReadingStore } from "./store";

/** Supabase when configured, the local store otherwise. Every caller depends
 *  on the interface, so nothing else in the app changes when keys arrive. */
export function getReadingStore(): ReadingStore {
  return isSupabaseConfigured() ? new SupabaseReadingStore(createClient()) : new LocalReadingStore();
}

export function getProfileStore(): ProfileStore {
  return isSupabaseConfigured() ? new SupabaseProfileStore(createClient()) : new LocalProfileStore();
}

export type { ProfileStore, ReadingStore } from "./store";
