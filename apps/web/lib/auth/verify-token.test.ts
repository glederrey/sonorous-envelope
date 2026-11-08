import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet, type JWK } from "jose";
import { createVerifier } from "./verify-token";

const ISSUER = "https://example.supabase.co/auth/v1";
const req = new Request("https://app.example/api/mcp");

let privateKey: CryptoKey;
let verify: ReturnType<typeof createVerifier>;

async function token(claims: Record<string, unknown>, opts: { issuer?: string; exp?: string | number } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "ES256", kid: "k1" })
    .setIssuer(opts.issuer ?? ISSUER)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "1h")
    .sign(privateKey);
}

beforeAll(async () => {
  const pair = await generateKeyPair("ES256");
  privateKey = pair.privateKey;
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "ES256", use: "sig" };
  verify = createVerifier(createLocalJWKSet({ keys: [jwk] }), ISSUER);
});

const ok = { sub: "user-1", role: "authenticated", client_id: "claude", scope: "openid email" };

describe("verifyToken", () => {
  it("accepts a valid OAuth token", async () => {
    const info = await verify(req, await token(ok));
    expect(info?.clientId).toBe("claude");
    expect(info?.scopes).toEqual(["openid", "email"]);
    expect(info?.extra).toEqual({ userId: "user-1" });
  });

  it("rejects a missing token", async () => {
    expect(await verify(req, undefined)).toBeUndefined();
  });

  it("rejects an expired token", async () => {
    expect(await verify(req, await token(ok, { exp: Math.floor(Date.now() / 1000) - 60 }))).toBeUndefined();
  });

  it("rejects a token without client_id (a web session token)", async () => {
    const { client_id: _omit, ...web } = ok;
    expect(await verify(req, await token(web))).toBeUndefined();
  });

  it("rejects the wrong issuer", async () => {
    expect(await verify(req, await token(ok, { issuer: "https://evil.example/auth/v1" }))).toBeUndefined();
  });

  it("rejects a role other than authenticated", async () => {
    expect(await verify(req, await token({ ...ok, role: "anon" }))).toBeUndefined();
  });

  it("rejects a token signed by another key", async () => {
    const other = await generateKeyPair("ES256");
    const forged = await new SignJWT(ok)
      .setProtectedHeader({ alg: "ES256", kid: "k1" })
      .setIssuer(ISSUER)
      .setExpirationTime("1h")
      .sign(other.privateKey);
    expect(await verify(req, forged)).toBeUndefined();
  });

  it("rejects garbage", async () => {
    expect(await verify(req, "not-a-jwt")).toBeUndefined();
  });
});
