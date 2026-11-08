import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyToken } from "../../../lib/auth/verify-token";
import { SERVER_INSTRUCTIONS } from "../../../lib/mcp/instructions";
import { registerTools } from "../../../lib/mcp/tools";

export const maxDuration = 30;

const handler = createMcpHandler(
  (server) => registerTools(server),
  { serverInfo: { name: "sonorous-envelope", version: "0.2.0" }, instructions: SERVER_INSTRUCTIONS },
);

// Wrapped per request so env vars are read lazily and `next build` needs none.
async function authed(req: Request) {
  const { mcpResourceUrl } = await import("../../../lib/env");
  const origin = new URL(mcpResourceUrl()).origin;
  return withMcpAuth(handler, verifyToken, {
    required: true,
    resourceMetadataPath: "/.well-known/oauth-protected-resource",
    resourceUrl: origin,
  })(req);
}

export { authed as GET, authed as POST, authed as DELETE };
