"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  GitCommit,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  User,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { GitHubCommit } from "@/types/github";
import { motion, AnimatePresence } from "framer-motion";

interface GitHubCommitsProps {
  githubUrl: string;
  /** Number of commits to fetch initially */
  initialLimit?: number;
  /** Show compact view */
  compact?: boolean;
}

export function GitHubCommits({ githubUrl, initialLimit = 10, compact = false }: GitHubCommitsProps) {
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

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

  const fetchCommits = useCallback(
    async (pageNum: number, append: boolean = false) => {
      if (!parsed) {
        setError("Invalid GitHub URL");
        setLoading(false);
        return;
      }

      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setIsRefreshing(true);
        }

        const response = await fetch(
          `/api/github/repos/${parsed.owner}/${parsed.repo}/commits?page=${pageNum}&per_page=${initialLimit}`
        );

        if (!response.ok) {
          if (response.status === 503) {
            setError("GitHub integration not configured");
          } else if (response.status === 404) {
            setError("Repository not found or not accessible");
          } else {
            const result = await response.json();
            setError(result.error || "Failed to fetch commits");
          }
          setLoading(false);
          setIsRefreshing(false);
          setLoadingMore(false);
          return;
        }

        const result = await response.json();

        if (append) {
          setCommits((prev) => [...prev, ...result.data]);
        } else {
          setCommits(result.data);
        }

        setHasMore(result.data.length === initialLimit);
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
    [parsed, initialLimit]
  );

  useEffect(() => {
    fetchCommits(1);
  }, [fetchCommits]);

  const loadMore = () => {
    fetchCommits(page + 1, true);
  };

  const copyToClipboard = async (sha: string) => {
    try {
      await navigator.clipboard.writeText(sha);
      setCopiedSha(sha);
      setTimeout(() => setCopiedSha(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!parsed) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitCommit className="h-4 w-4" />
            Recent Commits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitCommit className="h-4 w-4" />
            Recent Commits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-warning" />
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (commits.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitCommit className="h-4 w-4" />
            Recent Commits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No commits found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <GitCommit className="h-4 w-4" />
          Recent Commits
          <Badge variant="outline" className="ml-1 text-xs">
            {commits.length}
            {hasMore ? "+" : ""}
          </Badge>
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchCommits(1)}
          disabled={isRefreshing}
          className="h-7 w-7 p-0"
          title="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="space-y-1">
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
                <div
                  className={`rounded-md border border-border bg-secondary/20 p-3 hover:bg-secondary/40 transition-colors ${
                    compact ? "py-2" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Author Avatar */}
                    {!compact && (
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
                          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Commit Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`font-medium leading-tight ${
                            compact ? "text-sm" : "text-sm"
                          } ${isExpanded ? "" : "line-clamp-1"}`}
                        >
                          {firstLine}
                        </p>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Expand button if message has multiple lines */}
                          {hasMoreLines && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedCommit(isExpanded ? null : commit.sha)}
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}

                          {/* Copy SHA */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(commit.sha)}
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copy commit SHA"
                          >
                            {copiedSha === commit.sha ? (
                              <Check className="h-3.5 w-3.5 text-success" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>

                          {/* Link to GitHub */}
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

                      {/* Expanded message */}
                      <AnimatePresence>
                        {isExpanded && restOfMessage && (
                          <motion.pre
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap font-mono bg-background/50 rounded p-2 border border-border"
                          >
                            {restOfMessage}
                          </motion.pre>
                        )}
                      </AnimatePresence>

                      {/* Meta info */}
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                        <code className="font-mono text-primary/80">{commit.sha.substring(0, 7)}</code>
                        <span>·</span>
                        <span>{commit.commit.author.name}</span>
                        <span>·</span>
                        <span>{formatRelativeTime(commit.commit.author.date)}</span>

                        {commit.commit.verification?.verified && (
                          <>
                            <span>·</span>
                            <Badge variant="success" className="text-xs py-0 px-1">
                              Verified
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Load More */}
        {hasMore && (
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore} className="w-full">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
