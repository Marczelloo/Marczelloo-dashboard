export interface GuardedResult {
  success: boolean;
  error?: string;
  requirePin?: boolean;
}

/** Server actions report a missing PIN either as a flag or as the AuthError message. */
export function needsPin(result: GuardedResult): boolean {
  return result.requirePin === true || result.error === "PIN verification required";
}
