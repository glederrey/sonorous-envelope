import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type CryptoKey, type KeyObject, type JWK } from "jose";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { authIssuer, jwksUrl } from "../env";

type KeySource = JWTVerifyGetKey | CryptoKey | KeyObject | JWK | Uint8Array;

/**
 * Builds a verifier for Supabase OAuth access tokens.
 * Plain web-session tokens carry no client_id and are rejected: only OAuth clients may call the MCP endpoint.
 * `aud` is checked against "authenticated", the constant Supabase puts in every user access token (documented). It is a
 * token-type check, not a binding to this resource: Supabase does not issue per-resource audiences unless a custom access
 * token hook sets one. Signature, issuer, role and client_id carry the real guarantees.
 */
export function createVerifier(getKey: KeySource, issuer: string) {
  return async function verifyToken(_req: Request, bearer?: string): Promise<AuthInfo | undefined> {
    if (!bearer) return undefined;
    try {
      const { payload } = await jwtVerify(bearer, getKey as JWTVerifyGetKey, { issuer, audience: "authenticated" });
      if (payload.role !== "authenticated" || typeof payload.sub !== "string") return undefined;
      if (typeof payload.client_id !== "string") return undefined;
      return {
        token: bearer,
        clientId: payload.client_id,
        scopes: typeof payload.scope === "string" ? payload.scope.split(" ").filter(Boolean) : [],
        expiresAt: payload.exp,
        extra: { userId: payload.sub },
      };
    } catch {
      return undefined;
    }
  };
}

let cached: ReturnType<typeof createVerifier> | undefined;

/** Default verifier, built on first use so a missing env var cannot break `next build`. */
export const verifyToken: ReturnType<typeof createVerifier> = (req, bearer) => {
  cached ??= createVerifier(createRemoteJWKSet(new URL(jwksUrl())), authIssuer());
  return cached(req, bearer);
};
