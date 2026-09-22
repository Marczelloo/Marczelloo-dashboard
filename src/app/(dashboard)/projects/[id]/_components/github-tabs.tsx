"use client";

import { useState } from "react";
import { Button, Chip, Panel, PanelHeader, SegmentedControl } from "@/components/ui";
import { Github, ExternalLink, GitPullRequest } from "lucide-react";
import { motion } from "framer-motion";

interface GitHubTabsProps {
  githubUrl: string;
}

type TabId = "commits" | "pulls" | "releases";

const TABS: { value: TabId; label: string }[] = [
  { value: "commits", label: "Commits" },
  { value: "pulls", label: "Pull requests" },
  { value: "releases", label: "Releases" },
];

/** The repository's activity: commits, pull requests and releases, one at a time. */
export function GitHubTabs({ githubUrl }: GitHubTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("commits");
  const repoUrl = /^(https?:\/\/github\.com\/[^/]+\/[^/?#]+)/.exec(githubUrl)?.[1] ?? githubUrl;

  return (
    <Panel className="self-start">
      <PanelHeader
        title="Activity"
        icon={Github}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <a href={repoUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink strokeWidth={1.75} />
              GitHub
            </a>
          </Button>
        }
      />
      <div className="border-b border-line-subtle px-3.5 py-2.5">
        <SegmentedControl<TabId> aria-label="Repository activity" value={activeTab} onChange={setActiveTab} options={TABS} />
      </div>
      <div className="p-3.5">
        {activeTab === "commits" && <InnerCommits githubUrl={githubUrl} />}
        {activeTab === "pulls" && <InnerPulls githubUrl={githubUrl} />}
        {activeTab === "releases" && <InnerReleases githubUrl={githubUrl} />}
      </div>
    </Panel>
  );
}

// Inner components that render the actual content
import { useEffect, useState as useStateHook, useCallback, useMemo } from "react";
import Image from "next/image";
import { Skeleton } from "@/components/ui";
import {
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  User,
  GitMerge,
  XCircle,
  MessageSquare,
  Clock,
  Eye,
  Download,
  FileArchive,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { GitHubCommit, GitHubPullRequest, GitHubRelease } from "@/types/github";
import { AnimatePresence } from "framer-motion";

function InnerCommits({ githubUrl }: { githubUrl: string }) {
  const [commits, setCommits] = useStateHook<GitHubCommit[]>([]);
  const [loading, setLoading] = useStateHook(true);
  const [error, setError] = useStateHook<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useStateHook(false);
  const [page, setPage] = useStateHook(1);
  const [hasMore, setHasMore] = useStateHook(false);
  const [loadingMore, setLoadingMore] = useStateHook(false);
  const [expandedCommit, setExpandedCommit] = useStateHook<string | null>(null);
  const [copiedSha, setCopiedSha] = useStateHook<string | null>(null);

  const parseGitHubUrl = (url: string): { owner: string; repo: string } | null => {
    const patterns = [
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/\?#]+?)(?:\.git)?(?:\/.*)?$/,
      /^git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/,
      /^([^\/]+)\/([^\/]+)$/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return { owner: match[1], repo: match[2] };
    }
    return null;
  };

  // Memoize parsed URL to prevent infinite re-renders
  const parsed = useMemo(() => parseGitHubUrl(githubUrl), [githubUrl]);
  const limit = 10;

  const fetchCommits = useCallback(
    async (pageNum: number, append: boolean = false) => {
      if (!parsed) {
        setError("Invalid GitHub URL");
        setLoading(false);
        return;
      }

      try {
        if (append) setLoadingMore(true);
        else setIsRefreshing(true);

        const response = await fetch(
          `/api/github/repos/${parsed.owner}/${parsed.repo}/commits?page=${pageNum}&per_page=${limit}`
        );

        if (!response.ok) {
          if (response.status === 503) setError("GitHub integration not configured");
          else if (response.status === 404) setError("Repository not found");
          else {
            const result = await response.json();
            setError(result.error || "Failed to fetch commits");
          }
          setLoading(false);
          setIsRefreshing(false);
          setLoadingMore(false);
          return;
        }

        const result = await response.json();
        if (append) setCommits((prev) => [...prev, ...result.data]);
        else setCommits(result.data);

        setHasMore(result.data.length === limit);
        setPage(pageNum);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
        setLoadingMore(false);
      }
    },
    [parsed, limit]
  );

  useEffect(() => {
    fetchCommits(1);
  }, [fetchCommits]);

  const copyToClipboard = async (sha: string) => {
    await navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  if (!parsed) return null;

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-fg-3 py-4">
        <AlertTriangle className="h-4 w-4 text-warn" />
        {error}
      </div>
    );
  }

  if (commits.length === 0) {
    return <p className="text-sm text-fg-3 text-center py-4">No commits found</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end mb-2">
        <Button variant="ghost" size="sm" onClick={() => fetchCommits(1)} disabled={isRefreshing} className="h-7">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {commits.map((commit, index) => {
        const isExpanded = expandedCommit === commit.sha;
        const messageLines = commit.commit.message.split("\n");
        const firstLine = messageLines[0];
        const hasMoreLines = messageLines.length > 1;
        const restOfMessage = messageLines.slice(1).join("\n").trim();

        return (
          <motion.div
            key={commit.sha}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
            className="group"
          >
            <div className="rounded-md border border-line bg-surface-raised/20 p-3 hover:bg-surface-raised/40 transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  {commit.author?.avatar_url ? (
                    <Image
                      src={commit.author.avatar_url}
                      alt={commit.author.login || commit.commit.author.name}
                      width={32}
                      height={32}
                      className="rounded-full"
                      unoptimized
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-surface-raised flex items-center justify-center">
                      <User className="h-4 w-4 text-fg-3" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium leading-tight ${isExpanded ? "" : "line-clamp-1"}`}>
                      {firstLine}
                    </p>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {hasMoreLines && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedCommit(isExpanded ? null : commit.sha)}
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(commit.sha)}
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {copiedSha === commit.sha ? (
                          <Check className="h-3.5 w-3.5 text-ok" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>

                      <a
                        href={commit.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && restOfMessage && (
                      <motion.pre
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-xs text-fg-3 mt-2 whitespace-pre-wrap font-mono bg-canvas/50 rounded p-2 border border-line"
                      >
                        {restOfMessage}
                      </motion.pre>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center gap-2 mt-1.5 text-xs text-fg-3">
                    <code className="font-mono text-accent-text/80">{commit.sha.substring(0, 7)}</code>
                    <span>·</span>
                    <span>{commit.commit.author.name}</span>
                    <span>·</span>
                    <span>{formatRelativeTime(commit.commit.author.date)}</span>
                    {commit.commit.verification?.verified && (
                      <>
                        <span>·</span>
                        <Chip tone="ok" className="text-xs py-0 px-1">
                          Verified
                        </Chip>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}

      {hasMore && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchCommits(page + 1, true)}
          disabled={loadingMore}
          className="w-full mt-2"
        >
          {loadingMore ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5 mr-2" />
              Load More Commits
            </>
          )}
        </Button>
      )}
    </div>
  );
}

function InnerPulls({ githubUrl }: { githubUrl: string }) {
  const [pulls, setPulls] = useStateHook<GitHubPullRequest[]>([]);
  const [loading, setLoading] = useStateHook(true);
  const [error, setError] = useStateHook<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useStateHook(false);
  const [activeState, setActiveState] = useStateHook<"open" | "closed" | "all">("open");

  const parseGitHubUrl = (url: string): { owner: string; repo: string } | null => {
    const patterns = [
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/\?#]+?)(?:\.git)?(?:\/.*)?$/,
      /^git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/,
      /^([^\/]+)\/([^\/]+)$/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return { owner: match[1], repo: match[2] };
    }
    return null;
  };

  // Memoize parsed URL to prevent infinite re-renders
  const parsed = useMemo(() => parseGitHubUrl(githubUrl), [githubUrl]);

  const fetchPulls = useCallback(
    async (pullState: string) => {
      if (!parsed) {
        setError("Invalid GitHub URL");
        setLoading(false);
        return;
      }

      try {
        setIsRefreshing(true);
        const response = await fetch(
          `/api/github/repos/${parsed.owner}/${parsed.repo}/pulls?state=${pullState}&per_page=10`
        );

        if (!response.ok) {
          if (response.status === 503) setError("GitHub integration not configured");
          else if (response.status === 404) setError("Repository not found");
          else {
            const result = await response.json();
            setError(result.error || "Failed to fetch pull requests");
          }
          setLoading(false);
          setIsRefreshing(false);
          return;
        }

        const result = await response.json();
        setPulls(result.data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [parsed]
  );

  useEffect(() => {
    fetchPulls(activeState);
  }, [fetchPulls, activeState]);

  const getPRStatusBadge = (pr: GitHubPullRequest) => {
    if (pr.merged_at) {
      return (
        <Chip tone="neutral" className="bg-purple-600 hover:bg-purple-700">
          <GitMerge className="h-3 w-3 mr-1" />
          Merged
        </Chip>
      );
    }
    if (pr.state === "closed") {
      return (
        <Chip tone="err">
          <XCircle className="h-3 w-3 mr-1" />
          Closed
        </Chip>
      );
    }
    if (pr.draft) {
      return <Chip tone="neutral">Draft</Chip>;
    }
    return (
      <Chip tone="ok">
        <GitPullRequest className="h-3 w-3 mr-1" />
        Open
      </Chip>
    );
  };

  if (!parsed) return null;

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-fg-3 py-4">
        <AlertTriangle className="h-4 w-4 text-warn" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex rounded-md border border-line overflow-hidden">
          {(["open", "closed", "all"] as const).map((s) => (
            <Button
              key={s}
              variant={activeState === s ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveState(s)}
              className={`h-7 px-2 text-xs rounded-none capitalize ${activeState === s ? "" : "hover:bg-surface-raised/50"}`}
            >
              {s}
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchPulls(activeState)}
          disabled={isRefreshing}
          className="h-7"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {pulls.length === 0 ? (
        <p className="text-sm text-fg-3 text-center py-4">
          No {activeState === "all" ? "" : activeState} pull requests
        </p>
      ) : (
        pulls.map((pr, index) => (
          <motion.a
            key={pr.id}
            href={pr.html_url}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="block group"
          >
            <div className="rounded-md border border-line bg-surface-raised/20 p-3 hover:bg-surface-raised/40 transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  {pr.user?.avatar_url ? (
                    <Image
                      src={pr.user.avatar_url}
                      alt={pr.user.login}
                      width={24}
                      height={24}
                      className="rounded-full"
                      unoptimized
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-surface-raised flex items-center justify-center">
                      <User className="h-3 w-3 text-fg-3" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1 group-hover:text-accent-text transition-colors">
                        {pr.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-fg-3">
                        <span className="font-mono text-accent-text/70">#{pr.number}</span>
                        <span>·</span>
                        <span>{pr.user?.login || "Unknown"}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(pr.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">{getPRStatusBadge(pr)}</div>
                  </div>

                  {pr.labels && pr.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {pr.labels.slice(0, 5).map((label) => (
                        <Chip
                          key={label.id}
                          tone="neutral"
                          className="text-xs py-0 px-1.5"
                          style={{ borderColor: `#${label.color}`, color: `#${label.color}` }}
                        >
                          {label.name}
                        </Chip>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-xs text-fg-3">
                    {pr.comments > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {pr.comments}
                      </span>
                    )}
                    {pr.review_comments > 0 && (
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {pr.review_comments}
                      </span>
                    )}
                    <span className="font-mono text-xs">
                      {pr.head.ref} → {pr.base.ref}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.a>
        ))
      )}
    </div>
  );
}

function InnerReleases({ githubUrl }: { githubUrl: string }) {
  const [releases, setReleases] = useStateHook<GitHubRelease[]>([]);
  const [loading, setLoading] = useStateHook(true);
  const [error, setError] = useStateHook<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useStateHook(false);
  const [expandedRelease, setExpandedRelease] = useStateHook<number | null>(null);

  const parseGitHubUrl = (url: string): { owner: string; repo: string } | null => {
    const patterns = [
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/\?#]+?)(?:\.git)?(?:\/.*)?$/,
      /^git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/,
      /^([^\/]+)\/([^\/]+)$/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return { owner: match[1], repo: match[2] };
    }
    return null;
  };

  // Memoize parsed URL to prevent infinite re-renders
  const parsed = useMemo(() => parseGitHubUrl(githubUrl), [githubUrl]);

  const fetchReleases = useCallback(async () => {
    if (!parsed) {
      setError("Invalid GitHub URL");
      setLoading(false);
      return;
    }

    try {
      setIsRefreshing(true);
      const response = await fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}/releases?per_page=10`);

      if (!response.ok) {
        if (response.status === 503) setError("GitHub integration not configured");
        else if (response.status === 404) setError("Repository not found");
        else {
          const result = await response.json();
          setError(result.error || "Failed to fetch releases");
        }
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      const result = await response.json();
      setReleases(Array.isArray(result.data) ? result.data : [result.data].filter(Boolean));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [parsed]);

  useEffect(() => {
    fetchReleases();
  }, [fetchReleases]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!parsed) return null;

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-fg-3 py-4">
        <AlertTriangle className="h-4 w-4 text-warn" />
        {error}
      </div>
    );
  }

  if (releases.length === 0) {
    return <p className="text-sm text-fg-3 text-center py-4">No releases yet</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end mb-2">
        <Button variant="ghost" size="sm" onClick={fetchReleases} disabled={isRefreshing} className="h-7">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {releases.map((release, index) => {
        const isExpanded = expandedRelease === release.id;
        const isLatest = index === 0 && !release.prerelease;

        return (
          <motion.div
            key={release.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="group"
          >
            <div className="rounded-md border border-line bg-surface-raised/20 p-3 hover:bg-surface-raised/40 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Chip tone={release.prerelease ? "warn" : "ok"} className="text-xs">
                    {release.tag_name}
                  </Chip>
                  {isLatest && (
                    <Chip tone="neutral" className="text-xs bg-accent">
                      Latest
                    </Chip>
                  )}
                  {release.prerelease && (
                    <Chip tone="neutral" className="text-xs">
                      Pre-release
                    </Chip>
                  )}
                  {release.draft && (
                    <Chip tone="neutral" className="text-xs">
                      Draft
                    </Chip>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {release.assets && release.assets.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedRelease(isExpanded ? null : release.id)}
                      className="h-6 w-6 p-0"
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                  <a
                    href={release.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
              </div>

              {release.name && release.name !== release.tag_name && (
                <p className="text-sm font-medium mt-2">{release.name}</p>
              )}

              {release.body && (
                <p className="text-xs text-fg-3 mt-1 line-clamp-2">
                  {release.body.replace(/[#*`]/g, "").substring(0, 200)}
                  {release.body.length > 200 ? "..." : ""}
                </p>
              )}

              <div className="flex items-center gap-3 mt-2 text-xs text-fg-3">
                {release.author && (
                  <span className="flex items-center gap-1">
                    {release.author.avatar_url ? (
                      <Image
                        src={release.author.avatar_url}
                        alt={release.author.login}
                        width={14}
                        height={14}
                        className="rounded-full"
                        unoptimized
                      />
                    ) : (
                      <User className="h-3 w-3" />
                    )}
                    {release.author.login}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {release.published_at ? formatRelativeTime(release.published_at) : "Draft"}
                </span>
                {release.assets && release.assets.length > 0 && (
                  <>
                    <span className="flex items-center gap-1">
                      <FileArchive className="h-3 w-3" />
                      {release.assets.length} asset{release.assets.length > 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {release.assets.reduce((acc, a) => acc + a.download_count, 0)} downloads
                    </span>
                  </>
                )}
              </div>

              <AnimatePresence>
                {isExpanded && release.assets && release.assets.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 pt-3 border-t border-line"
                  >
                    <p className="text-xs font-medium text-fg-3 mb-2">Assets</p>
                    <div className="space-y-1.5">
                      {release.assets.map((asset) => (
                        <a
                          key={asset.id}
                          href={asset.browser_download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2 rounded-md border border-line bg-canvas/50 px-2 py-1.5 hover:bg-surface-raised/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileArchive className="h-3.5 w-3.5 text-fg-3 flex-shrink-0" />
                            <span className="text-xs font-mono truncate">{asset.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-fg-3 flex-shrink-0">
                            <span>{formatFileSize(asset.size)}</span>
                            <span className="flex items-center gap-0.5">
                              <Download className="h-3 w-3" />
                              {asset.download_count}
                            </span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
