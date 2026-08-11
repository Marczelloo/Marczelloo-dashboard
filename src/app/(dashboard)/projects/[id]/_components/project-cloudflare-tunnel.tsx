"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@/components/ui";
import { getProjectTunnelStatusAction, updateProjectTunnelAction } from "@/app/actions/projects";
import { CheckCircle2, Cloud, ExternalLink, Pencil, RefreshCw, Server, TriangleAlert } from "lucide-react";

type TunnelStatus = "active" | "pending" | "not_configured" | "unavailable";

type TunnelData = {
  supportsManagedDeployment: boolean;
  configured: boolean;
  error?: string;
  tunnel: { enabled: boolean; hostname: string; localPort: number } | null;
  actualRoute: { hostname: string; service: string; localPort: number | null } | null;
  status: TunnelStatus;
};

const statusMeta: Record<TunnelStatus, { label: string; variant: "success" | "warning" | "secondary" | "danger" }> = {
  active: { label: "Aktywny", variant: "success" },
  pending: { label: "Wymaga wdrożenia", variant: "warning" },
  not_configured: { label: "Nie skonfigurowano", variant: "secondary" },
  unavailable: { label: "Niedostępny", variant: "danger" },
};

export function ProjectCloudflareTunnel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<TunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [hostname, setHostname] = useState("");
  const [localPort, setLocalPort] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getProjectTunnelStatusAction(projectId);
    if (!result.success || !result.data) {
      toast.error("Nie udało się odczytać Cloudflare Tunnel", { description: result.error });
      setData(null);
    } else {
      setData(result.data);
      const route = result.data.tunnel || result.data.actualRoute;
      setEnabled(Boolean(result.data.tunnel?.enabled));
      setHostname(route?.hostname || "");
      setLocalPort(route?.localPort ? String(route.localPort) : "");
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    const result = await updateProjectTunnelAction(projectId, {
      enabled,
      hostname: hostname.trim(),
      localPort: localPort ? Number(localPort) : undefined,
    });
    setSaving(false);
    if (!result.success) {
      toast.error("Nie zapisano ustawień tunelu", { description: result.error });
      return;
    }
    toast.success(enabled ? "Cloudflare Tunnel zaktualizowany" : "Trasa Cloudflare Tunnel usunięta", {
      description: result.data?.deployQueued
        ? "Nowy port zostanie wystawiony po automatycznym deployu projektu."
        : result.data?.changed
          ? "Ingress przeładowano na Raspberry Pi."
          : "Konfiguracja była już aktualna.",
    });
    setEditing(false);
    await load();
  }

  const status = data ? statusMeta[data.status] : null;
  const activeHostname = data?.tunnel?.hostname || data?.actualRoute?.hostname;

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="h-4 w-4 text-primary" />
            Cloudflare Tunnel
          </CardTitle>
          <CardDescription>Publiczna domena, lokalny port i wpis ingress dla tego projektu.</CardDescription>
        </div>
        {!loading && status && <Badge variant={status.variant}>{status.label}</Badge>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-3" aria-label="Ładowanie konfiguracji tunelu">
            {["domena", "port", "ingress"].map((item) => <div key={item} className="h-16 animate-pulse rounded-md border border-border/50 bg-secondary/30" />)}
          </div>
        ) : !data ? (
          <div className="flex items-center justify-between gap-4 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm">
            <span>Nie można teraz odczytać stanu tunelu.</span>
            <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw /> Spróbuj ponownie</Button>
          </div>
        ) : !data.supportsManagedDeployment ? (
          <div className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p>Najpierw połącz ten projekt z repozytorium GitHub i Docker Compose. Dopiero wtedy Dashboard może bezpiecznie zarządzać jego trasą Tunnel.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatusValue icon={<Cloud />} label="Domena" value={activeHostname || "—"} mono />
              <StatusValue icon={<Server />} label="Port lokalny" value={data.tunnel?.localPort ? `127.0.0.1:${data.tunnel.localPort}` : "—"} mono />
              <StatusValue icon={<CheckCircle2 />} label="Ingress" value={data.actualRoute?.service || "Brak wpisu"} mono />
            </div>

            {data.status === "pending" && (
              <div className="flex gap-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-muted-foreground">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p>Konfiguracja projektu nie odpowiada jeszcze wpisowi ingress. Zapisz ustawienia ponownie albo wykonaj deploy projektu.</p>
              </div>
            )}
            {data.status === "unavailable" && (
              <div className="flex gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-muted-foreground">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p>{data.error || "Nie udało się odczytać systemowego pliku ingress Cloudflare."}</p>
              </div>
            )}

            {!editing ? (
              <div className="flex flex-wrap gap-2 border-t border-border/50 pt-4">
                {activeHostname && data.status === "active" && (
                  <a href={`https://${activeHostname}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm"><ExternalLink /> Otwórz domenę</Button>
                  </a>
                )}
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil /> Edytuj tunel</Button>
                <Button variant="ghost" size="sm" onClick={() => void load()}><RefreshCw /> Odśwież status</Button>
              </div>
            ) : (
              <form className="space-y-4 border-t border-border/50 pt-5" onSubmit={(event) => { event.preventDefault(); void save(); }}>
                <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-secondary/20 p-3">
                  <div>
                    <Label htmlFor="tunnel-enabled">Wystaw przez Cloudflare Tunnel</Label>
                    <p className="mt-1 text-xs text-muted-foreground">Wyłączenie usuwa zarządzany wpis ingress, ale nie zatrzymuje kontenera.</p>
                  </div>
                  <button
                    id="tunnel-enabled"
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => setEnabled((value) => !value)}
                    className={`relative h-8 w-14 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${enabled ? "border-primary bg-primary" : "border-border bg-background"}`}
                  >
                    <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-7" : "translate-x-1"}`} />
                    <span className="sr-only">{enabled ? "Wyłącz Cloudflare Tunnel" : "Włącz Cloudflare Tunnel"}</span>
                  </button>
                </div>
                {enabled && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="tunnel-hostname">Domena</Label>
                      <Input id="tunnel-hostname" value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="app.marczelloo.dev" autoCapitalize="none" autoCorrect="off" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tunnel-port">Port lokalny</Label>
                      <Input id="tunnel-port" inputMode="numeric" value={localPort} onChange={(event) => setLocalPort(event.target.value.replace(/\D/g, ""))} placeholder="3202" />
                      <p className="text-xs text-muted-foreground">Zajęty port zostanie zastąpiony pierwszym wolnym z zakresu 3000–3999.</p>
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => { setEditing(false); void load(); }} disabled={saving}>Anuluj</Button>
                  <Button type="submit" loading={saving} disabled={enabled && (!hostname.trim() || !localPort)}>Zapisz ustawienia</Button>
                </div>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusValue({ icon, label, value, mono = false }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-md border border-border/50 bg-secondary/20 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">{icon}<span>{label}</span></div>
      <p className={`mt-2 truncate text-sm font-medium tabular-nums ${mono ? "font-mono text-xs" : ""}`} title={value}>{value}</p>
    </div>
  );
}
