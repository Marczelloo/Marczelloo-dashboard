"use client";

import { useEffect, useState } from "react";
import { listCloudflareZonesAction } from "@/app/actions/cloudflare";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";

function split(hostname: string, zones: string[]): { label: string; zone: string } | null {
  const host = hostname.trim().toLowerCase();
  const zone = [...zones].sort((a, b) => b.length - a.length).find((candidate) => host === candidate || host.endsWith(`.${candidate}`));
  if (!zone) return null;
  return { label: host === zone ? "" : host.slice(0, -(zone.length + 1)), zone };
}

/**
 * Subdomain + zone picker when the tunnel is managed through the Cloudflare
 * API; a plain hostname input otherwise.
 */
export function CloudflareHostnameField({ id, value, onChange, placeholder = "app.marczelloo.dev" }: { id: string; value: string; onChange: (hostname: string) => void; placeholder?: string }) {
  const [zones, setZones] = useState<string[] | null>(null);
  const [pickedZone, setPickedZone] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listCloudflareZonesAction().then((result) => {
      if (active) setZones(result.zones);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!zones?.length) {
    return <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoCapitalize="none" autoCorrect="off" />;
  }

  const parsed = split(value, zones);
  const parts = parsed ?? { label: value.includes(".") ? "" : value, zone: pickedZone ?? zones[0] };
  // An emptied label clears the hostname instead of silently selecting the zone apex, which usually belongs to another site.
  const compose = (label: string, zone: string) => onChange(label.trim() ? `${label.trim().toLowerCase()}.${zone}` : "");

  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        className="min-w-0 flex-1 font-mono text-xs"
        value={parts.label}
        onChange={(event) => compose(event.target.value.replace(/[^a-z0-9.-]/gi, ""), parts.zone)}
        placeholder="subdomena"
        autoCapitalize="none"
        autoCorrect="off"
        aria-label="Subdomena"
      />
      <span className="text-fg-3">.</span>
      <Select value={parts.zone} onValueChange={(zone) => {
        setPickedZone(zone);
        if (parts.label) compose(parts.label, zone);
        else if (parsed) onChange(zone);
      }}>
        <SelectTrigger className="w-44" aria-label="Domena Cloudflare">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {zones.map((zone) => (
            <SelectItem key={zone} value={zone}>{zone}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
