"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, ExternalLink, GitMerge, GitPullRequest, Github, MessageSquare, RefreshCw, Tag } from "lucide-react";
import { Button, Chip, Panel, PanelHeader, SegmentedControl, Skeleton } from "@/components/ui";
import { formatRelativeTime } from "@/lib/utils";
import type { GitHubCommit, GitHubPullRequest, GitHubRelease } from "@/types/github";

type TabId = "commits" | "pulls" | "releases";
type PullState = "open" | "closed" | "all";

const TABS: { value: TabId; label: string }[] = [
  { value: "commits", label: "Commits" },
  { value: "pulls", label: "Pull requests" },
  { value: "releases", label: "Releases" },
];

const PAGE = 10;

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = /github\.com[/:]([^/]+)\/([^/?#]+?)(?:\.git)?(?:[/?#].*)?$/.exec(url) ?? /^([^/]+)\/([^/]+)$/.exec(url);
  return match ? { owner: match[1], repo: match[2] } : null;
}

/** Pages of one GitHub list, with a friendly error instead of a status code. */
function useGitHubList<T>(path: string | null) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextPage: number) => {
      if (!path) return;
      setLoading(true);
      try {
        const separator = path.includes("?") ? "&" : "?";
        const response = await fetch(`${path}${separator}page=${nextPage}&per_page=${PAGE}`);
        const result = (await response.json().catch(() => ({}))) as { data?: T[]; error?: string };
        if (!response.ok) {
          setError(response.status === 503 ? "The GitHub App is not configured" : response.status === 404 ? "GitHub cannot see this repository" : (result.error ?? "GitHub did not answer"));
          return;
        }
        const data = Array.isArray(result.data) ? result.data : [];
        setItems((current) => (nextPage === 1 ? data : [...current, ...data]));
        setHasMore(data.length === PAGE);
        setPage(nextPage);
        setError(null);
      } catch {
        setError("GitHub did not answer");
      } finally {
        setLoading(false);
      }
    },
    [path]
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  return { items, loading, error, hasMore, refresh: () => void load(1), more: () => void load(page + 1) };
}

function ListState({ loading, error, empty, emptyText }: { loading: boolean; error: string | null; empty: boolean; emptyText: string }) {
  if (loading && empty) {
    return (
      <div className="grid gap-2.5 p-3.5">
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-9 w-full" />
        ))}
      </div>
    );
  }
  if (error) return <p className="p-3.5 text-[13px] text-fg-3">{error}</p>;
  if (empty) return <p className="p-3.5 text-[13px] text-fg-3">{emptyText}</p>;
  return null;
}

function MoreButton({ visible, loading, onClick }: { visible: boolean; loading: boolean; onClick: () => void }) {
  if (!visible) return null;
  return (
    <div className="border-t border-line-subtle p-2 text-center">
      <Button variant="ghost" size="sm" onClick={onClick} loading={loading}>
        Load more
      </Button>
    </div>
  );
}

function Commits({ base }: { base: string }) {
  const list = useGitHubList<GitHubCommit>(`${base}/commits`);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(sha: string) {
    try {
      await navigator.clipboard.writeText(sha);
      setCopied(sha);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // The sha stays visible to select by hand.
    }
  }

  const state = <ListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyText="No commits yet." />;
  if (list.items.length === 0 || list.error) return state;

  return (
    <>
      {list.items.map((commit) => {
        const [title, ...rest] = commit.commit.message.split("\n");
        const body = rest.join("\n").trim();
        return (
          <div key={commit.sha} className="group flex items-start gap-3 px-3.5 py-2.5 [&+&]:border-t [&+&]:border-line-subtle">
            <div className="min-w-0 flex-1">
              <a href={commit.html_url} target="_blank" rel="noopener noreferrer" className="block truncate text-[13px] font-medium hover:underline" title={body || title}>
                {title}
              </a>
              <p className="mt-0.5 truncate text-[11.5px] text-fg-3">
                {commit.author?.login ?? commit.commit.author.name} · {formatRelativeTime(commit.commit.author.date)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copy(commit.sha)}
              className="flex shrink-0 items-center gap-1 rounded-xs px-1 font-mono text-[11.5px] text-fg-3 hover:bg-white/[.04] hover:text-fg"
              aria-label={`Copy ${commit.sha}`}
            >
              {commit.sha.slice(0, 7)}
              {copied === commit.sha ? <Check className="size-3 text-ok" strokeWidth={2} /> : <Copy className="size-3 opacity-0 group-hover:opacity-100" strokeWidth={1.75} />}
            </button>
          </div>
        );
      })}
      <MoreButton visible={list.hasMore} loading={list.loading} onClick={list.more} />
    </>
  );
}

function pullStatus(pull: GitHubPullRequest): { label: string; tone: "ok" | "live" | "idle" | "neutral"; icon: typeof GitMerge } {
  if (pull.merged_at) return { label: "merged", tone: "ok", icon: GitMerge };
  if (pull.state === "closed") return { label: "closed", tone: "idle", icon: GitPullRequest };
  if (pull.draft) return { label: "draft", tone: "neutral", icon: GitPullRequest };
  return { label: "open", tone: "live", icon: GitPullRequest };
}

function Pulls({ base }: { base: string }) {
  const [state, setState] = useState<PullState>("open");
  const list = useGitHubList<GitHubPullRequest>(`${base}/pulls?state=${state}`);

  return (
    <>
      <div className="border-b border-line-subtle px-3.5 py-2">
        <SegmentedControl<PullState>
          aria-label="Pull request state"
          value={state}
          onChange={setState}
          options={[
            { value: "open", label: "Open" },
            { value: "closed", label: "Closed" },
            { value: "all", label: "All" },
          ]}
        />
      </div>
      {list.items.length === 0 || list.error ? (
        <ListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyText={state === "open" ? "Nothing open." : "No pull requests."} />
      ) : (
        <>
          {list.items.map((pull) => {
            const status = pullStatus(pull);
            const Icon = status.icon;
            return (
              <a
                key={pull.id}
                href={pull.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 px-3.5 py-2.5 hover:bg-white/[.02] [&+&]:border-t [&+&]:border-line-subtle"
              >
                <Icon className={status.tone === "ok" ? "mt-0.5 size-4 shrink-0 text-ok" : status.tone === "live" ? "mt-0.5 size-4 shrink-0 text-accent-text" : "mt-0.5 size-4 shrink-0 text-fg-4"} strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{pull.title}</p>
                  <p className="mt-0.5 truncate text-[11.5px] text-fg-3">
                    #{pull.number} · {pull.user?.login} · <code className="text-fg-4">{pull.head.ref}</code> · {formatRelativeTime(pull.updated_at)}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-2 text-[11.5px] text-fg-3">
                  {pull.comments + pull.review_comments > 0 && (
                    <span className="flex items-center gap-1">
                      <MessageSquare className="size-3" strokeWidth={1.75} />
                      {pull.comments + pull.review_comments}
                    </span>
                  )}
                  <Chip tone={status.tone}>{status.label}</Chip>
                </span>
              </a>
            );
          })}
          <MoreButton visible={list.hasMore} loading={list.loading} onClick={list.more} />
        </>
      )}
    </>
  );
}

function Releases({ base }: { base: string }) {
  const list = useGitHubList<GitHubRelease>(`${base}/releases`);
  const state = <ListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyText="No releases yet. Tag one from the Deployments tab." />;
  if (list.items.length === 0 || list.error) return state;

  return (
    <>
      {list.items.map((release) => {
        const downloads = release.assets?.reduce((sum, asset) => sum + asset.download_count, 0) ?? 0;
        const summary = release.body?.replace(/[#*`>_-]/g, "").replace(/\s+/g, " ").trim();
        return (
          <a
            key={release.id}
            href={release.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 px-3.5 py-2.5 hover:bg-white/[.02] [&+&]:border-t [&+&]:border-line-subtle"
          >
            <Tag className="mt-0.5 size-4 shrink-0 text-fg-4" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[13px]">
                <code className="font-medium text-fg">{release.tag_name}</code>
                {release.name && release.name !== release.tag_name && <span className="min-w-0 truncate text-fg-2">{release.name}</span>}
                {release.prerelease && <Chip tone="warn">pre-release</Chip>}
                {release.draft && <Chip>draft</Chip>}
              </p>
              {summary && <p className="mt-0.5 line-clamp-1 text-[11.5px] text-fg-3">{summary}</p>}
            </div>
            <span className="flex shrink-0 flex-col items-end gap-0.5 text-[11.5px] text-fg-3">
              {release.published_at ? formatRelativeTime(release.published_at) : "unpublished"}
              {downloads > 0 && (
                <span className="flex items-center gap-1 text-fg-4">
                  <Download className="size-3" strokeWidth={1.75} />
                  {downloads}
                </span>
              )}
            </span>
          </a>
        );
      })}
      <MoreButton visible={list.hasMore} loading={list.loading} onClick={list.more} />
    </>
  );
}

/** The repository's activity: commits, pull requests and releases, one at a time. */
export function GitHubTabs({ githubUrl }: { githubUrl: string }) {
  const [tab, setTab] = useState<TabId>("commits");
  const [generation, setGeneration] = useState(0);
  const parsed = useMemo(() => parseGitHubUrl(githubUrl), [githubUrl]);
  if (!parsed) return null;

  const base = `/api/github/repos/${parsed.owner}/${parsed.repo}`;
  const repoUrl = `https://github.com/${parsed.owner}/${parsed.repo}`;

  return (
    <Panel className="self-start">
      <PanelHeader
        title="Activity"
        icon={Github}
        actions={
          <>
            <Button variant="ghost" size="icon-sm" onClick={() => setGeneration((value) => value + 1)} aria-label="Refresh">
              <RefreshCw strokeWidth={1.75} />
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href={repoUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink strokeWidth={1.75} />
                GitHub
              </a>
            </Button>
          </>
        }
      />
      <div className="border-b border-line-subtle px-3.5 py-2.5">
        <SegmentedControl<TabId> aria-label="Repository activity" value={tab} onChange={setTab} options={TABS} />
      </div>
      <div key={`${tab}-${generation}`}>
        {tab === "commits" && <Commits base={base} />}
        {tab === "pulls" && <Pulls base={base} />}
        {tab === "releases" && <Releases base={base} />}
      </div>
    </Panel>
  );
}
