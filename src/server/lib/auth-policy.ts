type Env = Record<string, string | undefined>;

export function parseOwnerEmails(env: Env = process.env): string[] {
  return (env.OWNER_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwnerEmail(email: string, env: Env = process.env): boolean {
  return parseOwnerEmails(env).includes(email.trim().toLowerCase());
}

export function isPinBypassAllowed(env: Env = process.env): boolean {
  return env.NODE_ENV !== "production" && env.DEV_SKIP_PIN === "true";
}
