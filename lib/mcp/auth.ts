import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../supabase/config";

/**
 * A Supabase client that acts as whoever holds `token`.
 *
 * The token is an access token Supabase Auth issued to the MCP client through
 * the OAuth 2.1 flow. Sending it as the bearer means every query runs under
 * that user's row-level security, exactly as the browser's does: the server
 * never needs, and never holds, a key that could see anyone else's rows.
 */
export function clientForToken(token: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** The parts of the JWT payload this server cares about. Read, not trusted:
 *  the token has already been verified by Supabase before these are used. */
function readClaims(token: string): { client_id?: string; exp?: number } {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

/**
 * Verifies a bearer token by asking Supabase Auth who it belongs to. That is a
 * network round trip per request, but it is correct for every signing
 * algorithm the project might use, and it honours revocation. Returns nothing
 * for a missing or bad token, which mcp-handler turns into a 401 that points
 * the client at the protected-resource metadata.
 */
export async function verifySupabaseToken(
  _req: Request, token?: string,
): Promise<AuthInfo | undefined> {
  if (!token) return undefined;
  const { data, error } = await clientForToken(token).auth.getUser(token);
  if (error || !data.user) return undefined;
  const claims = readClaims(token);
  return {
    token,
    clientId: claims.client_id ?? "supabase-session",
    scopes: [],
    expiresAt: claims.exp,
    extra: { userId: data.user.id, email: data.user.email ?? null },
  };
}
