/**
 * Authentication utilities for Cloudflare Access + PIN
 */

import "server-only";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";

// Cloudflare Access headers
const CF_ACCESS_EMAIL_HEADER = "cf-access-authenticated-user-email";
const CF_ACCESS_COUNTRY_HEADER = "cf-ipcountry";

// Session cookie name
const PIN_SESSION_COOKIE = "Marczelloo Dashboard_pin_session";

interface AuthUser {
  email: string;
  isAuthenticated: boolean;
  isPinVerified: boolean;
  country?: string;
}

/**
 * Get the current user from Cloudflare Access headers
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const headersList = await headers();
  const email = headersList.get(CF_ACCESS_EMAIL_HEADER);

  if (!email) {
    // Allow bypass with DEV_USER_EMAIL for self-hosted setups without Cloudflare Access
    // This works in both development and production (for Docker deployments)
    if (process.env.DEV_USER_EMAIL) {
      return {
        email: process.env.DEV_USER_EMAIL,
        isAuthenticated: true,
        isPinVerified: await isPinSessionValid(),
      };
    }
    return null;
  }

  return {
    email,
    isAuthenticated: true,
    isPinVerified: await isPinSessionValid(),
    country: headersList.get(CF_ACCESS_COUNTRY_HEADER) || undefined,
  };
}

/**
 * Check if the current user's email is in the allowlist
 */
export async function isAllowedUser(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const allowedEmails = (process.env.OWNER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return allowedEmails.includes(user.email.toLowerCase());
}

/**
 * Verify a PIN against the stored hash
 */
export async function verifyPin(pin: string): Promise<boolean> {
  const storedHash = process.env.PIN_HASH;
  if (!storedHash) {
    throw new Error("PIN_HASH environment variable is not set");
  }

  return bcrypt.compare(pin, storedHash);
}

/**
 * Hash a PIN for storage
 */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

/**
 * Create a PIN session after successful verification
 */
export async function createPinSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET environment variable is not set");
  }

  const ttl = parseInt(process.env.PIN_SESSION_TTL || "1800", 10);
  const expiresAt = Date.now() + ttl * 1000;

  // Simple session token: base64(email:expiresAt:hmac)
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("No authenticated user");
  }

  const payload = `${user.email}:${expiresAt}`;
  const hmac = await createHmac(payload, sessionSecret);
  const token = Buffer.from(`${payload}:${hmac}`).toString("base64");

  cookieStore.set(PIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ttl,
  });
}

/**
 * Clear the PIN session
 */
export async function clearPinSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PIN_SESSION_COOKIE);
}

/**
 * Check if current PIN session is valid
 */
export async function isPinSessionValid(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PIN_SESSION_COOKIE)?.value;

  if (!token) return false;

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) return false;

  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return false;

    const [email, expiresAtStr, hmac] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    // Check expiration
    if (Date.now() > expiresAt) {
      await clearPinSession();
      return false;
    }

    // Verify HMAC
    const payload = `${email}:${expiresAt}`;
    const expectedHmac = await createHmac(payload, sessionSecret);
    if (hmac !== expectedHmac) return false;

    // Verify email matches current user
    const user = await getCurrentUser();
    if (!user || user.email.toLowerCase() !== email.toLowerCase()) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Require authentication and PIN verification
 * Throws if not authenticated
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthError("NOT_AUTHENTICATED", "Authentication required");
  }

  const allowed = await isAllowedUser();
  if (!allowed) {
    throw new AuthError("NOT_AUTHORIZED", "User not authorized");
  }

  return user;
}

/**
 * Require PIN verification for sensitive operations
 * Throws if PIN session is not valid
 */
export async function requirePinVerification(): Promise<AuthUser> {
  const user = await requireAuth();

  // Allow bypass with DEV_SKIP_PIN for self-hosted setups
  if (process.env.DEV_SKIP_PIN === "true") {
    return { ...user, isPinVerified: true };
  }

  if (!user.isPinVerified) {
    throw new AuthError("PIN_REQUIRED", "PIN verification required");
  }

  return user;
}

// ========================================
// Helpers
// ========================================

async function createHmac(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));

  return Buffer.from(signature).toString("hex");
}

// ========================================
// Error Class
// ========================================

export class AuthError extends Error {
  constructor(
    public code: "NOT_AUTHENTICATED" | "NOT_AUTHORIZED" | "PIN_REQUIRED" | "INVALID_PIN",
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}
