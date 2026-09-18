"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { usePinGuard } from "@/components/features/use-pin-guard";
import { FormField, FormSection } from "@/components/layout/form-layout";
import { Button, Input } from "@/components/ui";

/** The one knob the monitoring loop takes; everything else about it is derived. */
export function MonitoringSection() {
  const { run, dialog } = usePinGuard();
  const [minutes, setMinutes] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/settings/monitoring-interval", { cache: "no-store" });
    const result = (await response.json().catch(() => null)) as { success?: boolean; interval_minutes?: number } | null;
    if (result?.success && result.interval_minutes) {
      setMinutes(String(result.interval_minutes));
      setSaved(String(result.interval_minutes));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    const value = Number(minutes);
    if (!Number.isFinite(value) || value < 1 || value > 60) {
      toast.error("Pick between 1 and 60 minutes");
      return;
    }
    setSaving(true);
    try {
      const result = await run(async () => {
        const response = await fetch("/api/settings/monitoring-interval", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interval_ms: value * 60_000 }),
        });
        return (await response.json().catch(() => ({ success: false }))) as { success: boolean; error?: string; requirePin?: boolean };
      });
      if (!result) return;
      if (!result.success) {
        toast.error(result.error ?? "Could not save the interval");
        return;
      }
      setSaved(String(value));
      toast.success(`Checks every ${value} min`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSection id="monitoring" title="Monitoring" description="How often domains, containers and certificates are checked.">
      <FormField label="Interval" htmlFor="interval" hint="Between 1 and 60 minutes. Each sweep is one round against every target.">
        <div className="flex items-center gap-2">
          <Input id="interval" type="number" min={1} max={60} value={minutes} onChange={(event) => setMinutes(event.target.value)} className="w-[110px]" />
          <span className="text-[13px] text-fg-3">minutes</span>
          <Button size="sm" onClick={() => void save()} loading={saving} disabled={minutes === saved || !minutes} className="ml-auto">
            <Save strokeWidth={1.75} />
            Save
          </Button>
        </div>
      </FormField>
      <p className="text-[11.5px] text-fg-3">
        Results, incidents and certificate days live on the{" "}
        <Link href="/monitoring" className="text-fg-2 hover:text-fg">
          Monitoring
        </Link>{" "}
        page.
      </p>
      {dialog}
    </FormSection>
  );
}
