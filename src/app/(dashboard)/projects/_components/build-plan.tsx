"use client";

import { useCallback, useEffect, useState } from "react";
import { Hammer, Loader2, RefreshCw } from "lucide-react";
import { detectRepositoryBuildAction } from "@/app/actions/build-detect";
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Chip } from "@/components/ui";
import type { BuildKind, BuildSpec } from "@/server/deployments/detect";

const KIND_LABEL: Record<BuildKind, string> = {
  compose: "Own Compose file",
  dockerfile: "Own Dockerfile",
  node: "Node.js app (template)",
  static: "Static site (nginx)",
  python: "Python app (template)",
};

const EMPTY: Omit<BuildSpec, "kind"> = {
  framework: null,
  packageManager: null,
  port: null,
  installCommand: null,
  buildCommand: null,
  startCommand: null,
  outputDir: null,
  dockerfile: null,
  composeFile: null,
};

/**
 * Shows how the repository will be built. Repositories with their own compose
 * file keep the existing flow; the others get a compose file rendered by the
 * dashboard, so the fields here are the whole build definition.
 */
export function BuildPlan({ githubUrl, branch, runtime, value, onChange }: { githubUrl: string; branch: string; runtime: "web" | "worker" | "bot" | "stack"; value: BuildSpec | null; onChange: (spec: BuildSpec | null) => void }) {
  const [reasons, setReasons] = useState<string[]>([]);
  const [detecting, setDetecting] = useState(false);

  const detect = useCallback(async () => {
    setDetecting(true);
    try {
      const result = await detectRepositoryBuildAction({ githubUrl, branch, runtime });
      setReasons(result.success ? result.reasons : [result.error ?? "Could not read the repository."]);
      if (result.success) onChange(result.spec);
    } finally {
      setDetecting(false);
    }
  }, [githubUrl, branch, runtime, onChange]);

  useEffect(() => {
    void detect();
    // Detect again only when the repository, branch or runtime changes, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [githubUrl, branch, runtime]);

  const set = (patch: Partial<BuildSpec>) => value && onChange({ ...value, ...patch });
  const text = (field: keyof BuildSpec) => (typeof value?.[field] === "string" ? (value[field] as string) : "");
  const nullable = (input: string) => (input.trim() ? input : null);
  const templated = value && value.kind !== "compose";

  return (
    <div className="space-y-4 rounded-lg border border-line bg-surface-raised/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Hammer className="mt-0.5 h-4 w-4 text-fg-3" />
          <div>
            <p className="text-sm font-medium">How it builds</p>
            <p className="text-xs text-fg-3">Detected from the repository's files; correct it before deploying if needed.</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => void detect()} disabled={detecting}>
          {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Detect again
        </Button>
      </div>

      {reasons.length > 0 && (
        <ul className="space-y-1 text-xs text-fg-3">
          {reasons.map((reason) => <li key={reason}>• {reason}</li>)}
        </ul>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Kind</Label>
          <Select value={value?.kind ?? ""} onValueChange={(kind) => onChange({ ...EMPTY, ...(value ?? {}), kind: kind as BuildKind })}>
            <SelectTrigger><SelectValue placeholder="Not recognised; choose one" /></SelectTrigger>
            <SelectContent>
              {(Object.keys(KIND_LABEL) as BuildKind[]).map((kind) => <SelectItem key={kind} value={kind}>{KIND_LABEL[kind]}</SelectItem>)}
            </SelectContent>
          </Select>
          {value?.framework && <Chip tone="neutral">{value.framework}{value.packageManager ? ` · ${value.packageManager}` : ""}</Chip>}
        </div>

        {templated && (
          <div className="space-y-2">
            <Label htmlFor="build-port">App port inside the container</Label>
            <Input id="build-port" inputMode="numeric" placeholder="brak (bot/worker)" value={value.port ?? ""} onChange={(event) => set({ port: event.target.value ? Number(event.target.value.replace(/\D/g, "")) || null : null })} />
          </div>
        )}

        {value?.kind === "dockerfile" && (
          <div className="space-y-2">
            <Label htmlFor="build-dockerfile">Dockerfile</Label>
            <Input id="build-dockerfile" className="font-mono text-xs" value={text("dockerfile")} onChange={(event) => set({ dockerfile: nullable(event.target.value) })} />
          </div>
        )}

        {(value?.kind === "node" || value?.kind === "python" || value?.kind === "static") && (
          <>
            <div className="space-y-2">
              <Label htmlFor="build-install">Install command</Label>
              <Input id="build-install" className="font-mono text-xs" value={text("installCommand")} onChange={(event) => set({ installCommand: nullable(event.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="build-build">Build command (optional)</Label>
              <Input id="build-build" className="font-mono text-xs" value={text("buildCommand")} onChange={(event) => set({ buildCommand: nullable(event.target.value) })} />
            </div>
          </>
        )}

        {(value?.kind === "node" || value?.kind === "python") && (
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="build-start">Start command</Label>
            <Input id="build-start" className="font-mono text-xs" value={text("startCommand")} onChange={(event) => set({ startCommand: nullable(event.target.value) })} />
          </div>
        )}

        {value?.kind === "static" && (
          <div className="space-y-2">
            <Label htmlFor="build-output">Built site directory</Label>
            <Input id="build-output" className="font-mono text-xs" value={text("outputDir")} onChange={(event) => set({ outputDir: nullable(event.target.value) })} />
          </div>
        )}
      </div>

      {templated && (
        <p className="text-xs text-fg-3">
          Dashboard wygeneruje Dockerfile i compose poza repozytorium. Plik <code>.env</code> trafia do kontenera jako zmienne, nigdy do obrazu.
        </p>
      )}
    </div>
  );
}
