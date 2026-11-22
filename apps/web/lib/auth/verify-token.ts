import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type CryptoKey, type KeyObject, type JWK } from "jose";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { authIssuer, jwksUrl } from "../env";
import { supabaseForToken } from "../supabase/bearer";

/** Asks whether the token's account (and its sign-in) still exist. */
export type AccountCheck = (token: string, userId: string) => Promise<boolean>;

type KeySource = JWTVerifyGetKey | CryptoKey | KeyObject | JWK | Uint8Array;

/**
 * Builds a verifier for Supabase OAuth access tokens.
 * Plain web-session tokens carry no client_id and are rejected: only OAuth clients may call the MCP endpoint.
 * `aud` is checked against "authenticated", the constant Supabase puts in every user access token (documented). It is a
 * token-type check, not a binding to this resource: Supabase does not issue per-resource audiences unless a custom access
 * token hook sets one. Signature, issuer, role and client_id carry the real guarantees.
 * `accountExists`, when given, is asked after the signature checks: a token signed before the account was deleted is still
 * valid for up to an hour, and without the check every tool failed with a bare server_error. Refused, claude.ai asks to reconnect.
 */
export function createVerifier(getKey: KeySource, issuer: string, accountExists?: AccountCheck) {
  return async function verifyToken(_req: Request, bearer?: string): Promise<AuthInfo | undefined> {
    if (!bearer) return undefined;
    try {
      const { payload } = await jwtVerify(bearer, getKey as JWTVerifyGetKey, { issuer, audience: "authenticated" });
      if (payload.role !== "authenticated" || typeof payload.sub !== "string") return undefined;
      if (typeof payload.client_id !== "string") return undefined;
      if (accountExists && !(await accountExists(bearer, payload.sub))) return undefined;
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

const SEEN_MS = 60_000;
const seen = new Map<string, number>(); // user id -> until when the account is known to exist

/**
 * Every account has a profile row (created by a trigger, removed with the account by cascade), readable only by its owner.
 * Read with the caller's token, as the tools do, so RLS applies: no row means the account is gone. A yes is remembered for
 * a minute per user, so a chain of tool calls costs one lookup. An error (the database unreachable) lets the call through:
 * the signature already holds, and the tools fail on their own.
 */
export const profileExists: AccountCheck = async (token, userId) => {
  const now = Date.now();
  if ((seen.get(userId) ?? 0) > now) return true;
  try {
    const { data, error } = await supabaseForToken(token).from("profiles").select("id").eq("id", userId).maybeSingle();
    if (error) return true;
    if (!data) { seen.delete(userId); return false; }
    if (seen.size > 5000) seen.clear();
    seen.set(userId, now + SEEN_MS);
    return true;
  } catch {
    return true;
  }
};

let cached: ReturnType<typeof createVerifier> | undefined;

/** Default verifier, built on first use so a missing env var cannot break `next build`. */
export const verifyToken: ReturnType<typeof createVerifier> = (req, bearer) => {
  cached ??= createVerifier(createRemoteJWKSet(new URL(jwksUrl())), authIssuer(), profileExists);
  return cached(req, bearer);
};
