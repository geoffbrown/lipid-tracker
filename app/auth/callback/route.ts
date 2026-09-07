import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Completes any emailed-link sign-in. Normal sign-in is email + password and
 * never comes through here — this route exists for the links Supabase can still
 * send (a dashboard-issued invite, or a password reset if one is ever added).
 *
 * Supabase hands back one of two shapes depending on the project's email
 * template:
 *   PKCE      -> ?code=...              (exchangeCodeForSession)
 *   Email OTP -> ?token_hash=...&type=  (verifyOtp)
 * Both are handled so the link works whichever template is configured.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
