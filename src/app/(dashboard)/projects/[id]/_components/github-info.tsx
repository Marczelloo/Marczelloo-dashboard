"use client";

import { useEffect, useState, useMemo } from "react";
import { Button, Chip, Panel, PanelHeader, Skeleton } from "@/components/ui";
import {
  Github,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Tag,
  ShieldAlert,
  Users,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { GitHubRepository, GitHubRepoStats } from "@/types/github";

interface GitHubInfoProps {
  githubUrl: string;
}

interface RepoData {
  repo: GitHubRepository;
  stats: GitHubRepoStats;
}

export function GitHubInfo({ githubUrl }: GitHubInfoProps) {
  const [data, setData] = useState<RepoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Parse GitHub URL to get owner/repo
  const parseGitHubUrl = (url: string): { owner: string; repo: string } | null => {
    const patterns = [
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/\?#]+?)(?:\.git)?(?:\/.*)?$/,
      /^git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/,
      /^([^\/]+)\/([^\/]+)$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return { owner: match[1], repo: match[2] };
      }
    }
    return null;
  };

  // Memoize parsed URL to prevent infinite re-renders
  const parsed = useMemo(() => parseGitHubUrl(githubUrl), [githubUrl]);

  const fetchData = async () => {
    if (!parsed) {
      setError("Invalid GitHub URL");
      setLoading(false);
      return;
    }

    try {
      setIsRefreshing(true);
      const response = await fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}?stats=true`);

      if (!response.ok) {
        if (response.status === 503) {
          setError("GitHub integration not configured");
        } else if (response.status === 404) {
          setError("Repository not found or not accessible");
        } else {
          const result = await response.json();
          setError(result.error || "Failed to fetch repository");
        }
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      const result = await response.json();
      setData({ repo: result.data, stats: result.stats });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [githubUrl]);

  if (!parsed) {
    return null;
  }

  const refresh = (
    <Button variant="ghost" size="icon-sm" onClick={fetchData} disabled={isRefreshing} aria-label="Refresh">
      <RefreshCw className={isRefreshing ? "animate-spin" : undefined} strokeWidth={1.75} />
    </Button>
  );

  if (loading) {
    return (
      <Panel>
        <PanelHeader title="Repository" icon={Github} />
        <div className="grid gap-2.5 p-3.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Panel>
    );
  }

  if (error || !data) {
    return (
      <Panel>
        <PanelHeader title="Repository" icon={Github} actions={refresh} />
        <div className="grid gap-2 p-3.5 text-[13px]">
          <p className="flex items-center gap-2 text-fg-2">
            <AlertTriangle className="size-4 text-warn" strokeWidth={1.75} />
            {error ?? "Nothing came back from GitHub"}
          </p>
          <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="flex w-fit items-center gap-1 text-fg-3 hover:text-fg">
            Open on GitHub
            <ExternalLink className="size-3" strokeWidth={1.75} />
          </a>
        </div>
      </Panel>
    );
  }

  const { repo, stats } = data;
  const lastCommit = stats.last_commit;
  const lastRelease = stats.last_release;

  return (
    <Panel>
      <PanelHeader
        title={repo.name}
        icon={Github}
        description={repo.description ?? undefined}
        actions={
          <>
            {refresh}
            <Button variant="ghost" size="icon-sm" asChild>
              <a href={repo.html_url} target="_blank" rel="noopener noreferrer" aria-label="Open on GitHub">
                <ExternalLink strokeWidth={1.75} />
              </a>
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-4 divide-x divide-line-subtle border-b border-line-subtle text-center">
        {[
          { icon: GitBranch, value: stats.branches_count, label: "branches" },
          { icon: GitPullRequest, value: stats.open_prs_count, label: "open PRs" },
          { icon: Tag, value: stats.releases_count, label: "releases" },
          { icon: Users, value: stats.contributors_count, label: "people" },
        ].map(({ icon: Icon, value, label }) => (
          <div key={label} className="px-1 py-2.5">
            <p className="flex items-center justify-center gap-1.5 text-[15px] font-semibold tabular-nums">
              <Icon className="size-3.5 text-fg-4" strokeWidth={1.75} />
              {value}
            </p>
            <p className="text-[11px] text-fg-3">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 p-3.5">
        {stats.security_alerts_count > 0 && (
          <p className="flex items-center gap-2 rounded-md border border-err/25 bg-err/10 px-3 py-2 text-[12.5px] font-medium text-err">
            <ShieldAlert className="size-4" strokeWidth={1.75} />
            {stats.security_alerts_count} open security alert{stats.security_alerts_count > 1 ? "s" : ""}
          </p>
        )}

        {lastCommit && (
          <div className="grid gap-1">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-fg-4">
              <GitCommit className="size-3" strokeWidth={1.75} />
              LATEST COMMIT
            </p>
            <a href={lastCommit.html_url} target="_blank" rel="noopener noreferrer" className="group grid gap-0.5">
              <span className="truncate text-[13px] font-medium group-hover:underline">{lastCommit.commit.message.split("\n")[0]}</span>
              <span className="text-[11.5px] text-fg-3">
                {lastCommit.commit.author.name} · {formatRelativeTime(lastCommit.commit.author.date)} · <code className="text-fg-4">{lastCommit.sha.slice(0, 7)}</code>
              </span>
            </a>
          </div>
        )}

        {lastRelease && (
          <div className="grid gap-1">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-fg-4">
              <Tag className="size-3" strokeWidth={1.75} />
              LATEST RELEASE
            </p>
            <a href={lastRelease.html_url} target="_blank" rel="noopener noreferrer" className="group flex flex-wrap items-center gap-2 text-[13px]">
              <Chip tone={lastRelease.prerelease ? "warn" : "ok"} mono>
                {lastRelease.tag_name}
              </Chip>
              {lastRelease.name && lastRelease.name !== lastRelease.tag_name && <span className="min-w-0 truncate group-hover:underline">{lastRelease.name}</span>}
              <span className="ml-auto text-[11.5px] text-fg-3">{lastRelease.published_at ? formatRelativeTime(lastRelease.published_at) : "draft"}</span>
            </a>
          </div>
        )}

        <dl className="grid border-t border-line-subtle pt-1 text-[12.5px]">
          <div className="flex items-center justify-between py-1.5">
            <dt className="text-fg-3">Default branch</dt>
            <dd>
              <code className="text-[12px] text-fg-2">{repo.default_branch}</code>
            </dd>
          </div>
          {repo.language && (
            <div className="flex items-center justify-between py-1.5">
              <dt className="text-fg-3">Language</dt>
              <dd className="text-fg-2">{repo.language}</dd>
            </div>
          )}
          {repo.pushed_at && (
            <div className="flex items-center justify-between py-1.5">
              <dt className="text-fg-3">Last push</dt>
              <dd className="text-fg-2">{formatRelativeTime(repo.pushed_at)}</dd>
            </div>
          )}
        </dl>
      </div>
    </Panel>
  );
}
