/** Visual status used across the UI. `live` means an operation is running right now. */
export type Tone = "ok" | "live" | "warn" | "err" | "idle";
export type LegacyStatus = "online" | "warning" | "offline" | "unknown";

const LEGACY: Record<LegacyStatus, Tone> = { online: "ok", warning: "warn", offline: "err", unknown: "idle" };

export function toTone(status: Tone | LegacyStatus): Tone {
  return status in LEGACY ? LEGACY[status as LegacyStatus] : (status as Tone);
}
