import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { createAccessVerifier, normalizeTeamDomain, resolveIdentity, type AccessVerify } from "./cloudflare-access";

const TEAM = "https://marczelloo.cloudflareaccess.com";
const AUD = "aud-tag-123";
let privateKey: CryptoKey;
let verify: AccessVerify;

async function token(claims: Record<string, unknown>, options: { issuer?: string; audience?: string; expires?: string } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(options.issuer ?? TEAM)
    .setAudience(options.audience ?? AUD)
    .setIssuedAt()
    .setExpirationTime(options.expires ?? "5m")
    .sign(privateKey);
}

function headers(values: Record<string, string>) {
  return { get: (name: string) => values[name.toLowerCase()] ?? null };
}

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  verify = createAccessVerifier({ teamDomain: TEAM, audience: AUD, keySet: createLocalJWKSet({ keys: [jwk] }) });
});

describe("normalizeTeamDomain", () => {
  it("accepts bare and https team domains", () => {
    expect(normalizeTeamDomain("marczelloo.cloudflareaccess.com")).toBe(TEAM);
    expect(normalizeTeamDomain(`${TEAM}/`)).toBe(TEAM);
  });

  it("rejects foreign hosts", () => {
    expect(() => normalizeTeamDomain("https://evil.example.com")).toThrow();
  });
});

describe("createAccessVerifier", () => {
  it("returns the lower-cased email for a valid token", async () => {
    await expect(verify(await token({ email: "Owner@Example.com", sub: "u1" }))).resolves.toEqual({ email: "owner@example.com", subject: "u1" });
  });

  it("rejects a wrong audience, issuer or an expired token", async () => {
    await expect(verify(await token({ email: "a@b.c" }, { audience: "other" }))).resolves.toBeNull();
    await expect(verify(await token({ email: "a@b.c" }, { issuer: "https://other.cloudflareaccess.com" }))).resolves.toBeNull();
    await expect(verify(await token({ email: "a@b.c" }, { expires: "-1m" }))).resolves.toBeNull();
  });

  it("rejects tokens without email and missing tokens", async () => {
    await expect(verify(await token({ sub: "service" }))).resolves.toBeNull();
    await expect(verify(null)).resolves.toBeNull();
  });
});

describe("resolveIdentity", () => {
  it("ignores the unsigned email header", async () => {
    const result = await resolveIdentity(headers({ "cf-access-authenticated-user-email": "owner@example.com" }), { NODE_ENV: "production" }, verify);
    expect(result).toBeNull();
  });

  it("uses the verified JWT", async () => {
    const jwt = await token({ email: "owner@example.com" });
    await expect(resolveIdentity(headers({ "cf-access-jwt-assertion": jwt }), { NODE_ENV: "production" }, verify)).resolves.toMatchObject({ email: "owner@example.com" });
  });

  it("allows DEV_USER_EMAIL only outside production", async () => {
    await expect(resolveIdentity(headers({}), { NODE_ENV: "production", DEV_USER_EMAIL: "dev@x.y" }, null)).resolves.toBeNull();
    await expect(resolveIdentity(headers({}), { NODE_ENV: "development", DEV_USER_EMAIL: "Dev@x.y" }, null)).resolves.toEqual({ email: "dev@x.y", subject: "dev" });
  });
});
