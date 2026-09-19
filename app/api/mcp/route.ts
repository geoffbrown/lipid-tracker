import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerLipidTools } from "@/lib/mcp/tools";
import { verifySupabaseToken } from "@/lib/mcp/auth";

/**
 * The MCP endpoint: https://<host>/api/mcp
 *
 * Streamable HTTP, one stateless request per call, which is what a serverless
 * function can serve. Authentication is OAuth 2.1 with Supabase Auth as the
 * authorization server: the client discovers it through the protected-resource
 * metadata served next to this route, the person signs in and approves on
 * /oauth/consent, and every call after that carries a Supabase access token.
 * The tools run as that user under row-level security; the server holds no
 * privileged key.
 */
const handler = createMcpHandler(
  (server) => registerLipidTools(server),
  {
    serverInfo: { name: "lipidlog", version: "1.0.0" },
    instructions:
      "LipidLog holds one person's cholesterol history: readings from home point-of-care " +
      "devices and labs, with LDL (Martin-Hopkins or Friedewald), ApoB estimates, non-HDL and " +
      "ratios derived by the app. Values are mg/dL. Reference bands are general guidance, not " +
      "a diagnosis; say so when it matters. Use get_latest_panel first for a summary.",
  },
);

const authed = withMcpAuth(handler, verifySupabaseToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authed as GET, authed as POST, authed as DELETE };

export const maxDuration = 60;
