/**
 * POST /api/settings/portainer-token
 *
 * Authenticate with Portainer and store the JWT token in the database.
 * This allows the token to be refreshed without restarting the container.
 *
 * NOTE: Requires 'settings' table in AtlasHub. If table doesn't exist,
 * the token will still be returned but won't persist across restarts.
 */

import { NextRequest, NextResponse } from "next/server";
import { setPortainerToken } from "@/server/atlashub/settings";
import { setInMemoryToken } from "@/server/portainer/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ success: false, error: "Username and password are required" }, { status: 400 });
    }

    // Get Portainer URL from env
    const portainerUrl = process.env.PORTAINER_URL;
    if (!portainerUrl) {
      return NextResponse.json({ success: false, error: "PORTAINER_URL not configured" }, { status: 500 });
    }

    // Authenticate with Portainer
    const authResponse = await fetch(`${portainerUrl}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!authResponse.ok) {
      const error = await authResponse.json().catch(() => ({ message: "Unknown error" }));
      return NextResponse.json({ success: false, error: error.message || "Authentication failed" }, { status: 401 });
    }

    const authData = await authResponse.json();
    const token = authData.jwt;

    if (!token) {
      return NextResponse.json({ success: false, error: "No token received from Portainer" }, { status: 500 });
    }

    // Decode JWT to get expiry (Portainer tokens typically expire in 8 hours)
    let expiresAt: Date | undefined;
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
      if (payload.exp) {
        expiresAt = new Date(payload.exp * 1000);
      }
    } catch {
      // Failed to decode, set default expiry of 8 hours
      expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    }

    // Try to store token in database
    const saved = await setPortainerToken(token, expiresAt);

    // Always store in memory as fallback (works even without DB table)
    setInMemoryToken(token, expiresAt);

    return NextResponse.json({
      success: true,
      message: saved
        ? "Token refreshed and saved successfully"
        : 'Token refreshed (in-memory only - create "settings" table in AtlasHub to persist across restarts)',
      persisted: saved,
      expiresAt: expiresAt?.toISOString(),
    });
  } catch (error) {
    console.error("[Portainer Token] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/settings/portainer-token
 *
 * Get the current token status (not the token itself for security)
 */
export async function GET() {
  try {
    const { getPortainerToken, getPortainerTokenExpiry } = await import("@/server/atlashub/settings");

    const token = await getPortainerToken();
    const expiry = await getPortainerTokenExpiry();

    const envTokenExists = !!process.env.PORTAINER_TOKEN;

    return NextResponse.json({
      success: true,
      hasToken: !!token || envTokenExists,
      source: token ? "database" : envTokenExists ? "environment" : "none",
      expiresAt: expiry?.toISOString() || null,
      isExpired: expiry ? expiry < new Date() : null,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
