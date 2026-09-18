"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FormSection } from "@/components/layout/form-layout";
import { Skeleton, Switch } from "@/components/ui";
import { DEFAULT_PREFERENCES, LABELS, NOTIFICATION_EVENTS, type NotificationEvent, type NotificationPreferences } from "@/lib/notifications";

/** Which alerts reach Discord. Each switch saves on its own; there is nothing to submit. */
export function NotificationsSection({ configured }: { configured: boolean }) {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState<NotificationEvent | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/settings/notifications", { cache: "no-store" });
    const result = (await response.json().catch(() => null)) as { success?: boolean; data?: NotificationPreferences } | null;
    setPreferences(result?.success && result.data ? result.data : DEFAULT_PREFERENCES);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(event: NotificationEvent, next: boolean) {
    const previous = preferences;
    setPreferences((current) => (current ? { ...current, [event]: next } : current));
    setSaving(event);
    try {
      const response = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [event]: next }),
      });
      const result = (await response.json().catch(() => ({}))) as { success?: boolean; data?: NotificationPreferences; error?: string };
      if (!result.success) {
        setPreferences(previous);
        toast.error(result.error ?? "Could not save that");
        return;
      }
      if (result.data) setPreferences(result.data);
    } catch {
      setPreferences(previous);
      toast.error("Could not save that");
    } finally {
      setSaving(null);
    }
  }

  return (
    <FormSection
      id="notifications"
      title="Alerts"
      description={configured ? "Which events are posted to Discord." : "Set DISCORD_WEBHOOK_URL to turn these into messages; the switches are kept either way."}
    >
      <div className="-my-1">
        {!preferences
          ? NOTIFICATION_EVENTS.map((event) => <Skeleton key={event} className="my-2.5 h-9 rounded-md" />)
          : NOTIFICATION_EVENTS.map((event) => (
              <div key={event} className="flex items-center gap-3 py-2.5 [&+&]:border-t [&+&]:border-line-subtle">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{LABELS[event].title}</p>
                  <p className="truncate text-[11.5px] text-fg-3">{LABELS[event].description}</p>
                </div>
                <Switch
                  checked={preferences[event]}
                  onChange={(next) => void toggle(event, next)}
                  disabled={saving !== null}
                  aria-label={`${LABELS[event].title} alerts`}
                />
              </div>
            ))}
      </div>
    </FormSection>
  );
}
