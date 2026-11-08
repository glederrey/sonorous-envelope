import { describe, expect, it, beforeAll } from "vitest";

beforeAll(() => {
  process.env.SUPABASE_AUTH_ISSUER = "https://example.supabase.co/auth/v1";
  process.env.SUPABASE_JWKS_URL = "https://example.supabase.co/auth/v1/.well-known/jwks.json";
  process.env.PUBLIC_BASE_URL = "https://app.example";
  process.env.MCP_RESOURCE_URL = "https://app.example/api/mcp";
});

describe("protected resource metadata", () => {
  it("names the MCP resource and the Supabase authorization server", async () => {
    const { GET } = await import("../../app/.well-known/oauth-protected-resource/route");
    const res = GET(new Request("https://app.example/.well-known/oauth-protected-resource"));
    const body = await (await res).json();
    expect(body.resource).toBe("https://app.example/api/mcp");
    expect(body.authorization_servers).toEqual(["https://example.supabase.co/auth/v1"]);
  });

  it("serves the same document at the path-suffixed URL", async () => {
    const { GET } = await import("../../app/.well-known/oauth-protected-resource/api/mcp/route");
    const body = await (await GET(new Request("https://app.example/.well-known/oauth-protected-resource/api/mcp"))).json();
    expect(body.resource).toBe("https://app.example/api/mcp");
  });
});

describe("/api/mcp without a token", () => {
  it("answers 401 with a WWW-Authenticate header pointing at the metadata", async () => {
    const { POST } = await import("../../app/api/mcp/route");
    const res = await POST(
      new Request("https://app.example/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    );
    expect(res.status).toBe(401);
    const header = res.headers.get("www-authenticate") ?? "";
    expect(header).toContain("Bearer");
    expect(header).toContain("https://app.example/.well-known/oauth-protected-resource");
  });
});
