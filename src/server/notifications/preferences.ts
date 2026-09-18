import "server-only";

import { DEFAULT_PREFERENCES, NOTIFICATION_EVENTS, type NotificationEvent, type NotificationPreferences } from "@/lib/notifications";
import { settings } from "@/server/data";

const key = (event: NotificationEvent) => `notify.${event}`;

let cache: { at: number; value: NotificationPreferences } | null = null;
const TTL_MS = 30_000;

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const entries = await Promise.all(
    NOTIFICATION_EVENTS.map(async (event) => {
      const stored = await settings.getSetting(key(event)).catch(() => null);
      return [event, stored === null ? DEFAULT_PREFERENCES[event] : stored === "true"] as const;
    })
  );
  const value = Object.fromEntries(entries) as NotificationPreferences;
  cache = { at: Date.now(), value };
  return value;
}

export async function setNotificationPreferences(update: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  for (const [event, enabled] of Object.entries(update)) {
    if (!NOTIFICATION_EVENTS.includes(event as NotificationEvent)) continue;
    await settings.setSetting(key(event as NotificationEvent), enabled ? "true" : "false");
  }
  cache = null;
  return getNotificationPreferences();
}

/** Used by the senders; a failure to read the preferences must not silence an alert. */
export async function notificationEnabled(event: NotificationEvent): Promise<boolean> {
  return getNotificationPreferences()
    .then((preferences) => preferences[event])
    .catch(() => DEFAULT_PREFERENCES[event]);
}
