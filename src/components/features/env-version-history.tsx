"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, History, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, Panel } from "@/components/ui";
import { PinDialog } from "@/components/pin-dialog";

interface EnvVersion {
  version: number;
  file: string | null;
  keyCount: number;
  note: string | null;
  createdBy: string;
  createdAt: string;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

/** Env file versions of an agent-deployed project; restoring goes through the agent's health gate. */
export function EnvVersionHistory({ serviceId, refreshKey }: { serviceId: string; refreshKey: number }) {
  const [open, setOpen] = useState(false);
  const [agent, setAgent] = useState(false);
  const [versions, setVersions] = useState<EnvVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [pinFor, setPinFor] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/services/${serviceId}/env-versions`, { cache: "no-store" });
      const data = (await response.json()) as { success: boolean; agent?: boolean; versions?: EnvVersion[] };
      if (data.success) {
        setAgent(Boolean(data.agent));
        setVersions(data.versions ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function restore(version: number) {
    setRestoring(version);
    try {
      const response = await fetch(`/api/services/${serviceId}/env-versions/${version}/restore`, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { success?: boolean; requirePin?: boolean; error?: string };
      if (data.requirePin) {
        setPinFor(version);
        return;
      }
      if (!response.ok || !data.success) {
        toast.error("Version not restored", { description: data.error });
        return;
      }
      toast.success(`Version ${version} queued`, { description: "The agent health-checks the services after writing and rolls back to the current file if they fail." });
      await load();
    } finally {
      setRestoring(null);
    }
  }

  if (!agent) return null;

  return (
    <Panel>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-[13.5px] font-semibold">
          <History className="size-4 text-fg-3" strokeWidth={1.75} />
          Version history
          <Chip mono>{versions.length}</Chip>
        </span>
        <ChevronDown className={`size-4 text-fg-3 transition-transform duration-base ease-out ${open ? "rotate-180" : ""}`} strokeWidth={1.75} />
      </button>
      {open && (
        <div className="border-t border-line-subtle">
          {loading && !versions.length ? (
            <p className="flex items-center gap-2 p-3.5 text-[13px] text-fg-3">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </p>
          ) : !versions.length ? (
            <p className="p-3.5 text-[13px] text-fg-3">The first version is written on the next save.</p>
          ) : (
            <ul>
              {versions.map((item, index) => (
                <li key={item.version} className="flex items-center justify-between gap-3 px-3.5 py-2.5 [&+&]:border-t [&+&]:border-line-subtle">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[13px]">
                      <span className="font-medium tabular-nums">v{item.version}</span>
                      {item.file && <code className="text-[11.5px] text-fg-3">{item.file}</code>}
                      {index === 0 && <Chip tone="ok">current</Chip>}
                    </p>
                    <p className="truncate text-[11.5px] text-fg-3">
                      {item.note ?? "no note"} · {item.keyCount} keys · {item.createdBy} · {dateFormat.format(new Date(item.createdAt))}
                    </p>
                  </div>
                  {item.file && index > 0 && (
                    <Button size="sm" variant="secondary" onClick={() => void restore(item.version)} disabled={restoring !== null}>
                      {restoring === item.version ? <Loader2 className="animate-spin" /> : <RotateCcw strokeWidth={1.75} />}
                      Restore
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <PinDialog
        open={pinFor !== null}
        onSuccess={() => {
          const version = pinFor;
          setPinFor(null);
          if (version !== null) void restore(version);
        }}
        onCancel={() => setPinFor(null)}
      />
    </Panel>
  );
}
