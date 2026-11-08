import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { verifyToken } from "../../../lib/auth/verify-token";

export const maxDuration = 30;

// TEMPORARY: one tool so the connector can be added and tested end to end.
// Replaced by start_session / set_sound in the next group of work.
const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "ping",
      {
        title: "Ping",
        description: "Connectivity check. Returns ok. Temporary.",
        inputSchema: z.object({}),
      },
      async () => ({ content: [{ type: "text", text: JSON.stringify({ ok: true }) }] }),
    );
  },
  { serverInfo: { name: "sonorous-envelope", version: "0.1.0" } },
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
