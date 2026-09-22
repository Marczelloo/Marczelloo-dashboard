"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Package, RefreshCw } from "lucide-react";
import { Button, Input, SegmentedControl, Skeleton } from "@/components/ui";
import { CodePanel } from "./code-panel";

interface DependencyPackage {
  name: string;
  version: string;
  ecosystem: string;
  downloadLocation?: string;
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = /github\.com[/:]([^/]+)\/([^/?#]+)/.exec(url);
  return match ? { owner: match[1], repo: match[2].replace(/\.git$/, "") } : null;
}

/** What the repository depends on, from GitHub's dependency graph. */
export function DependenciesViewer({ githubUrl }: { githubUrl: string }) {
  const parsed = useMemo(() => parseGitHubUrl(githubUrl), [githubUrl]);
  const [byEcosystem, setByEcosystem] = useState<Record<string, DependencyPackage[]>>({});
  const [ecosystem, setEcosystem] = useState<string>("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!parsed) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}/dependencies`);
      const result = (await response.json().catch(() => ({}))) as { data?: { by_ecosystem?: Record<string, DependencyPackage[]> }; message?: string; error?: string };
      if (!response.ok) {
        setNotice(result.error ?? "GitHub did not answer");
        return;
      }
      const groups = result.data?.by_ecosystem ?? {};
      setByEcosystem(groups);
      setEcosystem((current) => (current && groups[current] ? current : (Object.keys(groups)[0] ?? "")));
      if (result.message) setNotice(result.message);
    } catch {
      setNotice("GitHub did not answer");
    } finally {
      setLoading(false);
    }
  }, [parsed]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!parsed) return null;

  const ecosystems = Object.keys(byEcosystem);
  const total = ecosystems.reduce((sum, key) => sum + byEcosystem[key].length, 0);
  const needle = query.trim().toLowerCase();
  const packages = (byEcosystem[ecosystem] ?? []).filter((item) => !needle || item.name.toLowerCase().includes(needle));

  return (
    <CodePanel
      title="Dependencies"
      icon={Package}
      description={total ? `${total} packages` : undefined}
      actions={
        <Button variant="ghost" size="icon-sm" onClick={() => void load()} disabled={loading} aria-label="Refresh">
          <RefreshCw className={loading ? "animate-spin" : undefined} strokeWidth={1.75} />
        </Button>
      }
    >
      {loading && total === 0 ? (
        <div className="grid gap-2 p-3.5">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-5 w-full" />
          ))}
        </div>
      ) : total === 0 ? (
        <p className="p-3.5 text-[13px] text-fg-3">{notice ?? "No dependency graph for this repository."}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle px-3.5 py-2.5">
            {ecosystems.length > 1 && (
              <SegmentedControl<string>
                aria-label="Ecosystem"
                value={ecosystem}
                onChange={setEcosystem}
                options={ecosystems.map((key) => ({ value: key, label: key, count: byEcosystem[key].length }))}
              />
            )}
            {total > 12 && <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter packages" aria-label="Filter packages" className="h-8 min-w-0 flex-1" />}
          </div>
          <div className="max-h-[360px] overflow-y-auto py-1">
            {packages.length === 0 ? (
              <p className="px-3.5 py-2 text-[13px] text-fg-3">Nothing matches “{query}”.</p>
            ) : (
              packages.map((item) => (
                <div key={`${item.ecosystem}:${item.name}`} className="flex items-center gap-2 px-3.5 py-1.5 text-[13px]">
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <code className="shrink-0 text-[11.5px] text-fg-3">{item.version}</code>
                  {item.downloadLocation && item.downloadLocation.startsWith("http") ? (
                    <a href={item.downloadLocation} target="_blank" rel="noopener noreferrer" className="text-fg-4 hover:text-fg" aria-label={`Open ${item.name}`}>
                      <ExternalLink className="size-3.5" strokeWidth={1.75} />
                    </a>
                  ) : (
                    <span className="size-3.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </CodePanel>
  );
}
