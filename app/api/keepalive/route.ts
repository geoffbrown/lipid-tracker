import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

/**
 * Free-tier Supabase projects are paused after about a week without traffic.
 * A daily Vercel cron (vercel.json) hits this route, which sends one tiny
 * query through the REST API so the project always shows recent activity.
 *
 * It runs as anon, so row-level security returns no rows — the request still
 * reaches Postgres, which is all that counts.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  /* Vercel sends `Bearer $CRON_SECRET` when that env var is set. Without it
     the route stays open, which is harmless: it reads nothing and returns
     nothing but a status. */
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "supabase not configured" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await supabase
    .from("profiles")
    .select("user_id", { head: true, count: "exact" });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
