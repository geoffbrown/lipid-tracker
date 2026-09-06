/**
 * Supabase is the production backend. When these public values are absent the
 * app falls back to a localStorage store and skips the auth gate entirely —
 * which is what lets the whole UI run and be reviewed before any project
 * exists.
 *
 * Only ever put *publishable* values here: the project URL and the anon key,
 * both of which ship in the browser bundle anyway and grant nothing on their
 * own, because every row is guarded by row-level security (see
 * supabase/migrations). The service_role key is a real secret and must never
 * appear in this file or anywhere else in the client.
 *
 * Referenced statically so Next.js can inline them at build time.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}
