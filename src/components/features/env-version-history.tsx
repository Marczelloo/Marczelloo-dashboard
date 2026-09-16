"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, History, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button } from "@/components/ui";
import { PinDialog } from "@/components/pin-dialog";

interface EnvVersion {
  version: number;
  file: string | null;
  keyCount: number;
  note: string | null;
  createdBy: string;
  createdAt: string;
}

const dateFormat = new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short" });

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
        toast.error("Nie przywrócono wersji", { description: data.error });
        return;
      }
      toast.success(`Wersja ${version} w kolejce agenta`, { description: "Po zapisie agent sprawdzi zdrowie usług; przy błędzie wróci do obecnego pliku." });
      await load();
    } finally {
      setRestoring(null);
    }
  }

  if (!agent) return null;

  return (
    <section className="rounded-lg border border-border/70">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-medium"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Historia wersji
          <Badge variant="outline" className="tabular-nums">{versions.length}</Badge>
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border/70">
          {loading && !versions.length ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Wczytywanie…</div>
          ) : !versions.length ? (
            <p className="p-3 text-sm text-muted-foreground">Pierwsza wersja powstanie przy najbliższym zapisie.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {versions.map((item, index) => (
                <li key={item.version} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-medium tabular-nums">v{item.version}</span>
                      {item.file && <code className="text-xs text-muted-foreground">{item.file}</code>}
                      {index === 0 && <Badge variant="secondary">najnowsza</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.note ?? "—"} · {item.keyCount} kluczy · {item.createdBy} · {dateFormat.format(new Date(item.createdAt))}
                    </p>
                  </div>
                  {item.file && index > 0 && (
                    <Button size="sm" variant="outline" onClick={() => void restore(item.version)} disabled={restoring !== null}>
                      {restoring === item.version ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      Przywróć
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
    </section>
  );
}
