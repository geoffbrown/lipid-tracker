import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Completes the consent step. Supabase records the decision against the
 * signed-in user and returns the URL that carries the authorization code (or
 * the denial) back to the client; we just follow it.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const decision = form.get("decision");
  const authorizationId = form.get("authorization_id");
  const origin = new URL(request.url).origin;

  if (typeof authorizationId !== "string" || !authorizationId) {
    return NextResponse.redirect(`${origin}/oauth/consent`, 303);
  }

  const supabase = await createClient();
  const back = `${origin}/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}&error=1`;

  if (decision === "approve") {
    const { data, error } = await supabase.auth.oauth.approveAuthorization(authorizationId, {
      skipBrowserRedirect: true,
    });
    if (error || !data) return NextResponse.redirect(back, 303);
    return NextResponse.redirect(data.redirect_url, 303);
  }

  const { data, error } = await supabase.auth.oauth.denyAuthorization(authorizationId, {
    skipBrowserRedirect: true,
  });
  if (error || !data) return NextResponse.redirect(back, 303);
  return NextResponse.redirect(data.redirect_url, 303);
}
