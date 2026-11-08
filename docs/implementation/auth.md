# Auth: OAuth 2.1 with Supabase

Two kinds of login use the same Supabase users:
- **Web app login** (player, sessions, settings): normal Supabase Auth with cookies (`@supabase/ssr`).
- **MCP connector** (claude.ai and other MCP clients): OAuth 2.1, with Supabase Auth as the authorization server and our `/api/mcp` as the protected resource.

## Roles in OAuth terms

| Role | Who |
|---|---|
| Authorization server (AS) | Supabase Auth: `https://<project-ref>.supabase.co/auth/v1` |
| Resource server (RS) | Our MCP endpoint: `https://<app>/api/mcp` |
| Client | claude.ai (registers itself dynamically) |
| Authorization UI | Our consent page: `https://<app>/oauth/consent` |

## Supabase setup (dashboard)
1. Authentication → OAuth Server: enable the OAuth 2.1 server.
2. Set the authorization path / URL to our consent page, `https://<app>/oauth/consent`. Supabase sends the user there with an `authorization_id` query parameter.
3. Enable dynamic client registration (claude.ai registers itself).
4. Use asymmetric JWT signing keys (so tokens can be verified with the public JWKS). Check what the project currently uses.
5. Auth providers for the web login: email magic link to start; Google and GitHub optional.
6. URL configuration: site URL = `PUBLIC_BASE_URL`; add `${PUBLIC_BASE_URL}/auth/callback` to redirect URLs.

Discovery check: `https://<project-ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1` must return JSON listing the authorize, token and registration endpoints.

## The full connector flow
1. The user adds `https://<app>/api/mcp` as a custom connector in claude.ai.
2. claude.ai calls `/api/mcp` without a token. We answer `401` with `WWW-Authenticate: Bearer resource_metadata="https://<app>/.well-known/oauth-protected-resource"`. (`withMcpAuth` from `mcp-handler` does this.)
3. claude.ai fetches our protected resource metadata, which lists Supabase as the authorization server.
4. claude.ai fetches Supabase's AS metadata, registers itself (dynamic client registration), and starts the authorization code flow with PKCE.
5. Supabase redirects the user's browser to `https://<app>/oauth/consent?authorization_id=...`.
6. The consent page:
   - If the user isn't logged in, redirect to `/login?next=<current URL>`, then come back.
   - Call `supabase.auth.oauth.getAuthorizationDetails(authorizationId)`.
     - If the result has `authorization_id`: show the consent screen.
     - If it has `redirect_url` (already consented): redirect there.
   - Consent screen shows: client name (and logo if any), the requested scopes, what the app will be able to do ("create sound sessions, update the sound, read your reactions"), and Approve / Deny buttons.
   - Approve → `supabase.auth.oauth.approveAuthorization(authorizationId)`; Deny → `denyAuthorization(...)`. Both redirect the browser back to the client by default.
7. claude.ai exchanges the code for tokens at Supabase's token endpoint and calls `/api/mcp` with `Authorization: Bearer <access token>`.
8. Refresh tokens rotate automatically; claude.ai handles refresh.

Supabase also offers a prebuilt Next.js OAuth consent block in its UI library. It can be used as a starting point, restyled to match the app.

## Protected resource metadata
Serve at both:
- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-protected-resource/api/mcp` (path-suffixed form, RFC 9728; some clients look here)

Use `protectedResourceHandler` from `mcp-handler`:

```ts
// app/.well-known/oauth-protected-resource/route.ts
import { protectedResourceHandler, metadataCorsOptionsRequestHandler } from "mcp-handler";

const handler = protectedResourceHandler({
  authServerUrls: [process.env.SUPABASE_AUTH_ISSUER!], // https://<ref>.supabase.co/auth/v1
});
export { handler as GET, metadataCorsOptionsRequestHandler as OPTIONS };
```

## Token verification on `/api/mcp`

```ts
// lib/auth/verify-token.ts
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AuthInfo } from "<MCP SDK>/server/auth/types"; // path depends on SDK version

const JWKS = createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL!));

export async function verifyToken(_req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  if (!bearer) return undefined;
  try {
    const { payload } = await jwtVerify(bearer, JWKS, { issuer: process.env.SUPABASE_AUTH_ISSUER });
    if (payload.role !== "authenticated" || typeof payload.sub !== "string") return undefined;
    // OAuth tokens carry a client_id claim; plain web-session tokens don't.
    if (typeof payload.client_id !== "string") return undefined;
    return {
      token: bearer,
      clientId: payload.client_id,
      scopes: typeof payload.scope === "string" ? payload.scope.split(" ") : [],
      expiresAt: payload.exp,
      extra: { userId: payload.sub },
    };
  } catch {
    return undefined;
  }
}
```

Wrap the handler:

```ts
// app/api/mcp/route.ts
const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});
export { authHandler as GET, authHandler as POST, authHandler as DELETE };
```

Check `jwtVerify` audience handling against what Supabase puts in `aud` for OAuth tokens, and add an audience check if it is the resource URL.

## Database access with the caller's token
Inside a tool, build a Supabase client that sends the caller's token, so RLS sees `auth.uid()` = the user:

```ts
// lib/supabase/bearer.ts
import { createClient } from "@supabase/supabase-js";
export function supabaseForToken(token: string) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

## claude.ai redirect URI
claude.ai's callback for custom connectors has been `https://claude.ai/api/mcp/auth_callback`. With dynamic registration claude.ai sends it itself, but if registration is restricted, allow it explicitly. Check the current value in Anthropic's connector docs.

## Settings page
- List connected apps with `supabase.auth.oauth.listGrants()`.
- Revoke with `supabase.auth.oauth.revokeGrant({ clientId })`.

## Testing auth
- MCP Inspector (`npx @modelcontextprotocol/inspector`) supports the OAuth flow against a remote server.
- Then add the connector in claude.ai and run `start_session`.
