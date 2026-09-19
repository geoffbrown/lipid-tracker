import {
  generateProtectedResourceMetadata, getPublicOrigin, metadataCorsOptionsRequestHandler,
} from "mcp-handler";
import { SUPABASE_URL } from "../supabase/config";

/**
 * RFC 9728 protected-resource metadata: tells an MCP client which
 * authorization server guards /api/mcp. Supabase publishes its own RFC 8414
 * document under the issuer below, so from here the client can find the
 * authorize, token and registration endpoints on its own.
 *
 * Served at both the root well-known path and the path-suffixed one, because
 * clients differ on which they try first.
 */
export function protectedResourceMetadata(req: Request): Response {
  const body = generateProtectedResourceMetadata({
    authServerUrls: [`${SUPABASE_URL}/auth/v1`],
    resourceUrl: `${getPublicOrigin(req)}/api/mcp`,
    additionalMetadata: {
      resource_name: "LipidLog",
      bearer_methods_supported: ["header"],
    },
  });
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export const metadataOptions = metadataCorsOptionsRequestHandler();
