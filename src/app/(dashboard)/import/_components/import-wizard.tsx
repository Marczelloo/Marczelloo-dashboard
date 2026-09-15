"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, ScanSearch, Save } from "lucide-react";
import { toast } from "sonner";
import { saveImportAction, scanInventoryAction } from "@/app/actions/app-import";
import { PinDialog } from "@/components/pin-dialog";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import type { ImportProposalView } from "@/server/apps/import/proposal";
import type { SaveImportResult } from "@/server/apps/import/save-import";

const ORIGIN_LABEL = { file: "plik", compose: "compose", container: "kontener", "legacy-db": "stara baza" } as const;
const CONFLICT_LABEL = {
  "file-differs": "plik ≠ kontener",
  "services-differ": "różne w usługach",
  "legacy-differs": "stara baza ≠ kontener",
  "not-in-container": "nieużywana w kontenerach",
} as const;
const SKIP = "__skip__";

interface Decision {
  projectId: string | null;
  includeKeys: Set<string>;
}

export function ImportWizard({ imported }: { imported: Array<{ composeProject: string; projectName: string; updatedAt: string }> }) {
  const [proposal, setProposal] = useState<ImportProposalView | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [busy, setBusy] = useState<"scan" | "save" | null>(null);
  const [pinFor, setPinFor] = useState<"scan" | "save" | null>(null);
  const [saved, setSaved] = useState<SaveImportResult | null>(null);

  const projectNames = useMemo(() => new Map((proposal?.projects ?? []).map((project) => [project.id, project.name])), [proposal]);

  async function scan() {
    setBusy("scan");
    setSaved(null);
    const result = await scanInventoryAction();
    setBusy(null);
    if (result.code === "PIN_REQUIRED") return setPinFor("scan");
    if (!result.success || !result.data) return toast.error("Skan nie powiódł się", { description: result.error });

    setProposal(result.data);
    setDecisions(
      Object.fromEntries(
        result.data.stacks.map((stack) => [
          stack.composeProject,
          { projectId: stack.match.confidence === "high" ? stack.match.projectId : null, includeKeys: new Set(stack.env.filter((entry) => entry.include).map((entry) => entry.key)) },
        ])
      )
    );
    toast.success(`Zeskanowano ${result.data.stacks.length} stacków i ${result.data.routes.length} reguł tunelu`);
  }

  async function save() {
    if (!proposal) return;
    setBusy("save");
    const result = await saveImportAction({
      proposalId: proposal.id,
      decisions: proposal.stacks.map((stack) => ({ composeProject: stack.composeProject, projectId: decisions[stack.composeProject]?.projectId ?? null, includeKeys: [...(decisions[stack.composeProject]?.includeKeys ?? [])] })),
    });
    setBusy(null);
    if (result.code === "PIN_REQUIRED") return setPinFor("save");
    if (!result.success || !result.data) return toast.error("Nie zapisano importu", { description: result.error });
    setSaved(result.data);
    toast.success("Import zapisany. Kontenery nie zostały zmienione.");
  }

  function update(composeProject: string, change: (decision: Decision) => Decision) {
    setDecisions((current) => ({ ...current, [composeProject]: change(current[composeProject]) }));
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Skan serwera</CardTitle>
            <CardDescription>Odczytuje kontenery, pliki Compose i env oraz konfigurację tunelu. Wymaga PIN.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={scan} disabled={busy !== null}>
              {busy === "scan" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
              {proposal ? "Skanuj ponownie" : "Skanuj serwer"}
            </Button>
            {proposal && (
              <Button onClick={save} disabled={busy !== null}>
                {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Zapisz import
              </Button>
            )}
          </div>
        </CardHeader>
        {imported.length > 0 && (
          <CardContent className="text-sm text-muted-foreground">
            Zaimportowane wcześniej: {imported.map((item) => `${item.composeProject} → ${item.projectName}`).join(", ")}
          </CardContent>
        )}
      </Card>

      {saved && (
        <Card className="border-success/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Check className="h-4 w-4 text-success" />
              Zapisano import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {saved.stacks.map((stack) => (
              <p key={stack.composeProject}>
                <span className="font-mono">{stack.composeProject}</span>:{" "}
                {stack.projectId ? `env w wersji ${stack.envVersion} (${stack.envKeys} kluczy${stack.envUnchanged ? ", bez zmian" : ""})` : "pominięty"}
              </p>
            ))}
            <p>Trasy tunelu: {saved.routes}</p>
          </CardContent>
        </Card>
      )}

      {proposal?.stacks.map((stack) => {
        const decision = decisions[stack.composeProject];
        return (
          <Card key={stack.composeProject}>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-mono text-base">{stack.composeProject}</CardTitle>
                  <CardDescription className="font-mono text-xs">{stack.workingDir ?? "brak katalogu"}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={stack.match.confidence === "high" ? "success" : stack.match.confidence === "medium" ? "warning" : "secondary"}>
                    {stack.match.confidence === "high" ? "pewne dopasowanie" : stack.match.confidence === "medium" ? "do potwierdzenia" : "brak dopasowania"}
                  </Badge>
                  <Select value={decision?.projectId ?? SKIP} onValueChange={(value) => update(stack.composeProject, (current) => ({ ...current, projectId: value === SKIP ? null : value }))}>
                    <SelectTrigger className="w-64" aria-label={`Projekt dla ${stack.composeProject}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SKIP}>Pomiń ten stack</SelectItem>
                      {proposal.projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{stack.match.reasons.join(" ")}</p>
              {stack.warnings.length > 0 && (
                <ul className="space-y-1 text-sm text-warning">
                  {stack.warnings.map((warning) => (
                    <li key={warning} className="flex gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      {warning}
                    </li>
                  ))}
                </ul>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <section>
                <h3 className="mb-2 text-sm font-medium">Kontenery</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr><th className="py-1 pr-4">Kontener</th><th className="pr-4">Usługa</th><th className="pr-4">Stan</th><th className="pr-4">Porty</th><th>Wolumeny</th></tr>
                    </thead>
                    <tbody>
                      {stack.containers.map((container) => (
                        <tr key={container.name} className="border-t border-border/50 align-top">
                          <td className="py-1.5 pr-4 font-mono">{container.name}</td>
                          <td className="pr-4">{container.service ?? "—"}</td>
                          <td className="pr-4">{container.status}</td>
                          <td className="pr-4 font-mono text-xs">{container.ports.filter((port) => port.hostIp !== "::").map((port) => `${port.hostIp}:${port.hostPort}→${port.containerPort}`).join(", ") || "—"}</td>
                          <td className="font-mono text-xs">{container.mounts.map((mount) => mount.name ?? mount.source).join(", ") || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-medium">Zmienne ({decision?.includeKeys.size ?? 0} z {stack.env.length} do importu)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr><th className="py-1 pr-2">Import</th><th className="pr-4">Klucz</th><th className="pr-4">Źródło</th><th className="pr-4">Usługi</th><th>Uwagi</th></tr>
                    </thead>
                    <tbody>
                      {stack.env.map((entry) => {
                        const id = `env-${stack.composeProject}-${entry.key}`;
                        return (
                          <tr key={entry.key} className="border-t border-border/50">
                            <td className="py-1.5 pr-2">
                              <input
                                id={id}
                                type="checkbox"
                                checked={decision?.includeKeys.has(entry.key) ?? false}
                                onChange={(event) =>
                                  update(stack.composeProject, (current) => {
                                    const includeKeys = new Set(current.includeKeys);
                                    if (event.target.checked) includeKeys.add(entry.key);
                                    else includeKeys.delete(entry.key);
                                    return { ...current, includeKeys };
                                  })
                                }
                              />
                            </td>
                            <td className="pr-4 font-mono"><label htmlFor={id}>{entry.key}</label>{entry.secret && <Badge variant="outline" className="ml-2">sekret</Badge>}</td>
                            <td className="pr-4"><Badge variant="secondary">{ORIGIN_LABEL[entry.origin]}</Badge></td>
                            <td className="pr-4 text-xs text-muted-foreground">{entry.services.join(", ") || "—"}</td>
                            <td className="space-x-1">{entry.conflicts.map((conflict) => <Badge key={conflict} variant="warning">{CONFLICT_LABEL[conflict]}</Badge>)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {stack.dryRun && (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                    Test na sucho
                    <Badge variant={stack.dryRun.ok ? "success" : "danger"}>{stack.dryRun.ok ? "zgodny" : "różnice"}</Badge>
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {stack.dryRun.checks.filter((check) => !check.ok).map((check) => (
                      <li key={`${check.service}-${check.check}`} className="text-danger">
                        <span className="font-mono">{check.service}</span> · {check.check}: {check.detail}
                      </li>
                    ))}
                    {stack.dryRun.ok && <li className="text-muted-foreground">{stack.dryRun.checks.length} sprawdzeń zgodnych.</li>}
                  </ul>
                </section>
              )}
            </CardContent>
          </Card>
        );
      })}

      {proposal && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trasy tunelu ({proposal.routes.length} reguł, {proposal.hostnameCount} domen)</CardTitle>
            {proposal.ingressError && <CardDescription className="text-danger">{proposal.ingressError}</CardDescription>}
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="py-1 pr-4">#</th><th className="pr-4">Domena</th><th className="pr-4">Ścieżka</th><th className="pr-4">Cel</th><th>Projekt</th></tr>
              </thead>
              <tbody>
                {proposal.routes.map((route) => {
                  const composeProject = route.target.kind === "container" ? route.target.composeProject : null;
                  const projectId = composeProject ? decisions[composeProject]?.projectId ?? null : null;
                  return (
                    <tr key={route.rule.position} className="border-t border-border/50">
                      <td className="py-1.5 pr-4 tabular-nums">{route.rule.position + 1}</td>
                      <td className="pr-4 font-mono">{route.rule.hostname ?? "(pozostałe)"}</td>
                      <td className="pr-4 font-mono text-xs">{route.rule.path ?? "—"}</td>
                      <td className="pr-4 text-xs">
                        {route.target.kind === "container" && <span className="font-mono">{route.target.containerName}:{route.target.containerPort}</span>}
                        {route.target.kind === "host" && <span>usługa hosta :{route.target.port}</span>}
                        {route.target.kind === "status" && <span>odpowiedź {route.target.status}</span>}
                        {route.target.kind === "other" && <span className="font-mono">{route.target.url}</span>}
                        {route.rule.originRequest && <Badge variant="outline" className="ml-2">originRequest</Badge>}
                      </td>
                      <td className="text-xs">{projectId ? projectNames.get(projectId) : route.target.kind === "container" ? "—" : "zewnętrzna"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {proposal.projectsWithoutStack.length > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">Projekty bez stacka na serwerze: {proposal.projectsWithoutStack.map((project) => project.name).join(", ")}.</p>
            )}
          </CardContent>
        </Card>
      )}

      <PinDialog
        open={pinFor !== null}
        onCancel={() => setPinFor(null)}
        onSuccess={() => {
          const retry = pinFor;
          setPinFor(null);
          if (retry === "scan") void scan();
          if (retry === "save") void save();
        }}
      />
    </>
  );
}
