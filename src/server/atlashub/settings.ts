/**
 * Settings Module - Key-value store for app configuration
 *
 * Stores dynamic settings that need to persist (e.g., Portainer token)
 * Uses AtlasHub 'settings' table with key-value structure.
 *
 * NOTE: The 'settings' table must be created manually in AtlasHub dashboard:
 *
 * CREATE TABLE settings (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   key VARCHAR(255) UNIQUE NOT NULL,
 *   value TEXT NOT NULL,
 *   encrypted BOOLEAN DEFAULT FALSE,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * If the table doesn't exist, the module will fall back to null values
 * and log a warning. The app will continue working with env variables.
 */

import "server-only";
import * as client from "./client";

// ========================================
// Types
// ========================================

export interface Setting {
  id: string;
  key: string;
  value: string;
  encrypted: boolean;
  created_at: string;
  updated_at: string;
}

// Track if we've already warned about missing table
let tableWarningShown = false;

// ========================================
// CRUD Operations
// ========================================

const TABLE = "settings";

/**
 * Get a setting by key
 */
export async function getSetting(key: string): Promise<string | null> {
  try {
    const response = await client.select<Setting>(TABLE, {
      filters: [{ operator: "eq", column: "key", value: key }],
      limit: 1,
    });
    return response.data[0]?.value || null;
  } catch (error) {
    // Table might not exist - this is expected if not set up
    if (error instanceof client.AtlasHubError && error.statusCode === 404) {
      if (!tableWarningShown) {
        console.warn(
          '[Settings] Table "settings" not found. Token refresh will not persist. See docs to create the table.'
        );
        tableWarningShown = true;
      }
      return null;
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Set a setting (upsert - insert or update)
 */
export async function setSetting(key: string, value: string): Promise<boolean> {
  try {
    // Try to get existing setting
    const existing = await client.select<Setting>(TABLE, {
      filters: [{ operator: "eq", column: "key", value: key }],
      limit: 1,
    });

    if (existing.data.length > 0) {
      // Update existing
      await client.update<Setting>(TABLE, { value, updated_at: new Date().toISOString() }, [
        { operator: "eq", column: "key", value: key },
      ]);
    } else {
      // Insert new
      await client.insert<Setting>(TABLE, {
        key,
        value,
        encrypted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    return true;
  } catch (error) {
    // Table doesn't exist - can't store settings
    if (error instanceof client.AtlasHubError && error.statusCode === 404) {
      console.warn(
        '[Settings] Cannot save setting - table "settings" not found. Create the table in AtlasHub to enable token persistence.'
      );
      return false;
    }
    console.error("[Settings] Failed to set setting:", key, error);
    throw error;
  }
}

/**
 * Delete a setting by key
 */
export async function deleteSetting(key: string): Promise<void> {
  try {
    await client.deleteRows(TABLE, [{ operator: "eq", column: "key", value: key }]);
  } catch {
    // Ignore errors if setting doesn't exist
  }
}

// ========================================
// Specific Settings Helpers
// ========================================

const PORTAINER_TOKEN_KEY = "portainer_token";
const PORTAINER_TOKEN_EXPIRY_KEY = "portainer_token_expiry";

/**
 * Get the stored Portainer token
 */
export async function getPortainerToken(): Promise<string | null> {
  return getSetting(PORTAINER_TOKEN_KEY);
}

/**
 * Store the Portainer token
 * Returns true if saved successfully, false if table doesn't exist
 */
export async function setPortainerToken(token: string, expiresAt?: Date): Promise<boolean> {
  const saved = await setSetting(PORTAINER_TOKEN_KEY, token);
  if (saved && expiresAt) {
    await setSetting(PORTAINER_TOKEN_EXPIRY_KEY, expiresAt.toISOString());
  }
  return saved;
}

/**
 * Get the Portainer token expiry date
 */
export async function getPortainerTokenExpiry(): Promise<Date | null> {
  const expiry = await getSetting(PORTAINER_TOKEN_EXPIRY_KEY);
  return expiry ? new Date(expiry) : null;
}

/**
 * Check if the Portainer token is expired or about to expire (within 1 hour)
 */
export async function isPortainerTokenExpired(): Promise<boolean> {
  const expiry = await getPortainerTokenExpiry();
  if (!expiry) return false; // Unknown expiry, assume valid

  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
  return expiry < oneHourFromNow;
}
