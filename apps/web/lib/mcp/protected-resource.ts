import { protectedResourceHandler } from "mcp-handler";
import { authIssuer, mcpResourceUrl } from "../env";

/** RFC 9728 metadata. Built per request so env vars are read lazily. */
export function protectedResource(req: Request) {
  return protectedResourceHandler({
    authServerUrls: [authIssuer()],
    resourceUrl: mcpResourceUrl(),
  })(req);
}
