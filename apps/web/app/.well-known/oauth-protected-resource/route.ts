import { metadataCorsOptionsRequestHandler } from "mcp-handler";
import { protectedResource } from "../../../lib/mcp/protected-resource";

export function GET(req: Request) {
  return protectedResource(req);
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
