import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";

export interface AccessIdentity {
  email: string;
  subject: string;
}

export type AccessVerify = (token: string | null | undefined) => Promise<AccessIdentity | null>;

export function normalizeTeamDomain(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".cloudflareaccess.com")) {
    throw new Error("CF_ACCESS_TEAM_DOMAIN must look like https://<team>.cloudflareaccess.com");
  }
  return `https://${url.hostname}`;
}

export function createAccessVerifier(options: { teamDomain: string; audience: string; keySet?: JWTVerifyGetKey }): AccessVerify {
  const issuer = normalizeTeamDomain(options.teamDomain);
  const keySet = options.keySet ?? createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));

  return async (token) => {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, keySet, {
        issuer,
        audience: options.audience,
        algorithms: ["RS256"],
      });
      const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
      return email ? { email, subject: String(payload.sub ?? "") } : null;
    } catch {
      return null;
    }
  };
}

let cachedVerifier: { key: string; verify: AccessVerify } | null = null;

export function getAccessVerifierFromEnv(env: NodeJS.ProcessEnv = process.env): AccessVerify | null {
  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN?.trim();
  const audience = env.CF_ACCESS_AUD?.trim();
  if (!teamDomain || !audience) return null;

  const key = `${teamDomain}|${audience}`;
  if (!cachedVerifier || cachedVerifier.key !== key) {
    cachedVerifier = { key, verify: createAccessVerifier({ teamDomain, audience }) };
  }
  return cachedVerifier.verify;
}

export async function resolveIdentity(
  headers: { get(name: string): string | null },
  env: NodeJS.ProcessEnv = process.env,
  verify: AccessVerify | null = getAccessVerifierFromEnv(env)
): Promise<AccessIdentity | null> {
  if (verify) {
    const identity = await verify(headers.get(ACCESS_JWT_HEADER));
    if (identity) return identity;
  }

  // Local development only. Production never trusts a configured identity.
  if (env.NODE_ENV !== "production" && env.DEV_USER_EMAIL) {
    return { email: env.DEV_USER_EMAIL.trim().toLowerCase(), subject: "dev" };
  }

  return null;
}
