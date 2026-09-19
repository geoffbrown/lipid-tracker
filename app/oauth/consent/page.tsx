import type { Route } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * The consent screen for the OAuth 2.1 server built into Supabase Auth.
 *
 * When an MCP client (Claude, say) wants access, Supabase sends the person
 * here with an authorization_id. proxy.ts has already made sure they are
 * signed in. We show who is asking and let them approve or deny; the decision
 * route completes the handshake and sends them back to the client.
 */
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string; error?: string }>;
}) {
  const { authorization_id: authorizationId, error: decisionError } = await searchParams;

  if (!authorizationId) {
    return (
      <Shell>
        <h1 className="text-xl font-bold">Nothing to authorize</h1>
        <p className="mt-2 leading-relaxed text-ink-soft">
          This page is only reached from an app asking to connect to your LipidLog account.
        </p>
      </Shell>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);

  if (error || !data) {
    return (
      <Shell>
        <h1 className="text-xl font-bold">This request has expired</h1>
        <p className="mt-2 leading-relaxed text-ink-soft">
          {error?.message ?? "Invalid authorization request."} Go back to the app and try
          connecting again.
        </p>
      </Shell>
    );
  }

  /* Already approved for this client: Supabase hands back the final redirect. */
  /* An external URL, so typed routes cannot vouch for it; Supabase minted it
     from the client's registered redirect URI. */
  if (!("authorization_id" in data)) redirect(data.redirect_url as Route);

  const client = data.client;
  const clientName = client.name || "An application";
  const host = safeHost(data.redirect_uri);

  return (
    <Shell>
      <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
        Connection request
      </p>
      <h1 className="mt-1 text-xl font-bold">
        Allow {clientName} to use your LipidLog data?
      </h1>

      <dl className="mt-4 divide-y divide-line border-y border-line">
        <Row label="Signed in as" value={data.user.email} />
        <Row label="Application" value={clientName} />
        {host && <Row label="Returns to" value={host} />}
      </dl>

      <p className="mt-4 leading-relaxed text-ink-soft">
        It will be able to read your readings and settings, add and edit readings, and
        delete readings, acting as you. You can revoke this later from your Supabase
        account&rsquo;s authorized apps.
      </p>

      {decisionError && (
        <p role="alert" className="mt-3 text-danger">
          That didn&rsquo;t go through. Please choose again.
        </p>
      )}

      <form action="/api/oauth/decision" method="POST" className="mt-5 grid grid-cols-2 gap-3">
        <input type="hidden" name="authorization_id" value={authorizationId} />
        <button
          type="submit"
          name="decision"
          value="deny"
          className="pressable rounded-lg border border-line py-3 font-bold"
        >
          Deny
        </button>
        <button
          type="submit"
          name="decision"
          value="approve"
          className="pressable rounded-lg bg-strong py-3 font-bold text-on-strong"
        >
          Allow
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-2xl font-extrabold tracking-tight">LipidLog</p>
        </div>
        <div className="card p-5">{children}</div>
        <p className="mt-4 text-center leading-relaxed text-ink-faint">
          For informational purposes only · not a substitute for medical advice
        </p>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="truncate text-right font-semibold">{value}</dd>
    </div>
  );
}

function safeHost(uri: string): string | null {
  try {
    return new URL(uri).host;
  } catch {
    return null;
  }
}
