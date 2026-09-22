"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button, Chip, SegmentedControl, Skeleton } from "@/components/ui";
import { ExternalLink, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";
import { CodePanel } from "./code-panel";

interface SecurityDashboardProps {
  githubUrl: string;
}

interface DependabotAlert {
  number: number;
  state: string;
  security_advisory: {
    ghsa_id: string;
    summary: string;
    severity: string;
  };
  security_vulnerability: {
    severity: string;
    package: {
      name: string;
      ecosystem: string;
    };
  };
  html_url: string;
  created_at: string;
}

interface CodeScanningAlert {
  number: number;
  state: string;
  rule: {
    id: string;
    severity: string;
    security_severity_level: string | null;
    description: string;
    name: string;
  };
  tool: {
    name: string;
  };
  most_recent_instance: {
    location: {
      path: string;
      start_line: number;
    };
    message: {
      text: string;
    };
  };
  html_url: string;
  created_at: string;
}

type Source = "dependabot" | "codeql";

const SEVERITY_TONE: Record<string, "err" | "warn" | "neutral"> = { critical: "err", high: "err", medium: "warn", moderate: "warn", low: "neutral" };

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = /github\.com[/:]([^/]+)\/([^/?#]+)/.exec(url);
  return match ? { owner: match[1], repo: match[2].replace(/\.git$/, "") } : null;
}

function AlertRow({ href, title, detail, severity }: { href: string; title: string; detail: React.ReactNode; severity: string | null | undefined }) {
  const level = (severity ?? "").toLowerCase();
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 px-3.5 py-2.5 hover:bg-white/[.02] [&+&]:border-t [&+&]:border-line-subtle">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{title}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-fg-3">{detail}</p>
      </div>
      {level && <Chip tone={SEVERITY_TONE[level] ?? "neutral"}>{level}</Chip>}
      <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-fg-4" strokeWidth={1.75} />
    </a>
  );
}

/** Open Dependabot and code scanning alerts for the repository. */
export function SecurityDashboard({ githubUrl }: SecurityDashboardProps) {
  const parsed = useMemo(() => parseGitHubUrl(githubUrl), [githubUrl]);
  const [dependabot, setDependabot] = useState<DependabotAlert[]>([]);
  const [codeql, setCodeql] = useState<CodeScanningAlert[]>([]);
  const [source, setSource] = useState<Source>("dependabot");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!parsed) return;
    setLoading(true);
    setError(null);
    try {
      const base = `/api/github/repos/${parsed.owner}/${parsed.repo}`;
      const [dependabotRes, codeqlRes] = await Promise.all([fetch(`${base}/security?state=open&per_page=10`), fetch(`${base}/code-scanning?state=open&per_page=10`)]);
      const nextDependabot = dependabotRes.ok ? (((await dependabotRes.json()) as { data?: DependabotAlert[] }).data ?? []) : [];
      const nextCodeql = codeqlRes.ok ? (((await codeqlRes.json()) as { data?: CodeScanningAlert[] }).data ?? []) : [];
      setDependabot(nextDependabot);
      setCodeql(nextCodeql);
      if (!nextDependabot.length && nextCodeql.length) setSource("codeql");
    } catch {
      setError("GitHub did not answer");
    } finally {
      setLoading(false);
    }
  }, [parsed]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!parsed) return null;

  const total = dependabot.length + codeql.length;

  return (
    <CodePanel
      title="Security"
      icon={total ? ShieldAlert : ShieldCheck}
      description={loading ? undefined : total ? `${total} open alert${total === 1 ? "" : "s"}` : "No open alerts"}
      actions={
        <Button variant="ghost" size="icon-sm" onClick={() => void load()} disabled={loading} aria-label="Refresh">
          <RefreshCw className={loading ? "animate-spin" : undefined} strokeWidth={1.75} />
        </Button>
      }
    >
      {loading && total === 0 ? (
        <div className="grid gap-2 p-3.5">
          {[0, 1].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      ) : error ? (
        <p className="p-3.5 text-[13px] text-fg-3">{error}</p>
      ) : total === 0 ? (
        <p className="flex items-center gap-2 p-3.5 text-[13px] text-fg-3">
          <ShieldCheck className="size-4 text-ok" strokeWidth={1.75} />
          Dependabot and code scanning have nothing open.
        </p>
      ) : (
        <>
          <div className="border-b border-line-subtle px-3.5 py-2.5">
            <SegmentedControl<Source>
              aria-label="Alert source"
              value={source}
              onChange={setSource}
              options={[
                { value: "dependabot", label: "Dependencies", count: dependabot.length },
                { value: "codeql", label: "Code scanning", count: codeql.length },
              ]}
            />
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {source === "dependabot" ? (
              dependabot.length === 0 ? (
                <p className="p-3.5 text-[13px] text-fg-3">No vulnerable dependencies.</p>
              ) : (
                dependabot.map((alert) => (
                  <AlertRow
                    key={alert.number}
                    href={alert.html_url}
                    title={alert.security_advisory?.summary || `Alert #${alert.number}`}
                    detail={<code className="text-fg-3">{alert.security_vulnerability?.package?.name}</code>}
                    severity={alert.security_vulnerability?.severity}
                  />
                ))
              )
            ) : codeql.length === 0 ? (
              <p className="p-3.5 text-[13px] text-fg-3">Code scanning found nothing.</p>
            ) : (
              codeql.map((alert) => (
                <AlertRow
                  key={alert.number}
                  href={alert.html_url}
                  title={alert.rule?.description || alert.rule?.name}
                  detail={
                    <>
                      <code className="text-fg-3">
                        {alert.most_recent_instance?.location?.path}:{alert.most_recent_instance?.location?.start_line}
                      </code>
                      {alert.tool?.name ? ` · ${alert.tool.name}` : ""}
                    </>
                  }
                  severity={alert.rule?.security_severity_level || alert.rule?.severity}
                />
              ))
            )}
          </div>
        </>
      )}
    </CodePanel>
  );
}
