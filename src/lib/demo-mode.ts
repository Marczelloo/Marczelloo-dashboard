/**
 * Demo Mode Utilities
 *
 * When DEMO_MODE=true, the app serves mock data and disables destructive actions.
 * This is useful for portfolio demos where you want to show the UI without
 * exposing real data or allowing modifications.
 */

/**
 * Check if the application is running in demo mode
 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/**
 * Demo user identity used when demo mode is active
 */
export const DEMO_USER = {
  email: "demo@marczelloo.dev",
  name: "Demo User",
} as const;

/**
 * Error message returned when an action is blocked in demo mode
 */
export const DEMO_MODE_ERROR = "This action is disabled in demo mode";

/**
 * Error code for demo mode blocked actions
 */
export const DEMO_MODE_ERROR_CODE = "DEMO_MODE";

/**
 * Check if demo mode is active and return early result for server actions
 */
export function checkDemoModeBlocked():
  | { blocked: true; result: { success: false; error: string; code: string } }
  | { blocked: false } {
  if (isDemoMode()) {
    return {
      blocked: true,
      result: {
        success: false as const,
        error: DEMO_MODE_ERROR,
        code: DEMO_MODE_ERROR_CODE,
      },
    };
  }
  return { blocked: false };
}
