"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  GitPullRequest,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  GitMerge,
  XCircle,
  MessageSquare,
  Clock,
  User,
  Check,
  Eye,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { GitHubPullRequest } from "@/types/github";
import { motion } from "framer-motion";

interface GitHubPullsProps {
  githubUrl: string;
  /** Filter by state: open, closed, all */
  state?: "open" | "closed" | "all";
  /** Number of PRs to fetch */
  limit?: number;
}

export function GitHubPulls({ githubUrl, state = "open", limit = 10 }: GitHubPullsProps) {
  const [pulls, setPulls] = useState<GitHubPullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeState, setActiveState] = useState(state);

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
          `/api/github/repos/${parsed.owner}/${parsed.repo}/pulls?state=${pullState}&per_page=${limit}`
        );

        if (!response.ok) {
          if (response.status === 503) {
            setError("GitHub integration not configured");
          } else if (response.status === 404) {
            setError("Repository not found or not accessible");
          } else {
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
    [parsed, limit]
  );

  useEffect(() => {
    fetchPulls(activeState);
  }, [fetchPulls, activeState]);

  const handleStateChange = (newState: "open" | "closed" | "all") => {
    setActiveState(newState);
  };

  const getPRStatusBadge = (pr: GitHubPullRequest) => {
    if (pr.merged_at) {
      return (
        <Badge variant="default" className="bg-purple-600 hover:bg-purple-700">
          <GitMerge className="h-3 w-3 mr-1" />
          Merged
        </Badge>
      );
    }
    if (pr.state === "closed") {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Closed
        </Badge>
      );
    }
    if (pr.draft) {
      return <Badge variant="secondary">Draft</Badge>;
    }
    return (
      <Badge variant="success">
        <GitPullRequest className="h-3 w-3 mr-1" />
        Open
      </Badge>
    );
  };

  if (!parsed) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitPullRequest className="h-4 w-4" />
            Pull Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/2" />
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
            <GitPullRequest className="h-4 w-4" />
            Pull Requests
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <GitPullRequest className="h-4 w-4" />
          Pull Requests
          <Badge variant="outline" className="ml-1 text-xs">
            {pulls.length}
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-2">
          {/* State Filter */}
          <div className="flex rounded-md border border-border overflow-hidden">
            {(["open", "closed", "all"] as const).map((s) => (
              <Button
                key={s}
                variant={activeState === s ? "default" : "ghost"}
                size="sm"
                onClick={() => handleStateChange(s)}
                className={`h-7 px-2 text-xs rounded-none capitalize ${
                  activeState === s ? "" : "hover:bg-secondary/50"
                }`}
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
            className="h-7 w-7 p-0"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {pulls.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No {activeState === "all" ? "" : activeState} pull requests
          </p>
        ) : (
          <div className="space-y-2">
            {pulls.map((pr, index) => (
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
                <div className="rounded-md border border-border bg-secondary/20 p-3 hover:bg-secondary/40 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Author Avatar */}
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
                        <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center">
                          <User className="h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* PR Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
                            {pr.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className="font-mono text-primary/70">#{pr.number}</span>
                            <span>·</span>
                            <span>{pr.user?.login || "Unknown"}</span>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(pr.created_at)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getPRStatusBadge(pr)}
                          <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                        </div>
                      </div>

                      {/* Labels */}
                      {pr.labels && pr.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {pr.labels.slice(0, 5).map((label) => (
                            <Badge
                              key={label.id}
                              variant="outline"
                              className="text-xs py-0 px-1.5"
                              style={{
                                borderColor: `#${label.color}`,
                                color: `#${label.color}`,
                              }}
                            >
                              {label.name}
                            </Badge>
                          ))}
                          {pr.labels.length > 5 && (
                            <Badge variant="outline" className="text-xs py-0 px-1.5">
                              +{pr.labels.length - 5}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {/* Comments */}
                        {pr.comments > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {pr.comments}
                          </span>
                        )}

                        {/* Review comments */}
                        {pr.review_comments > 0 && (
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {pr.review_comments}
                          </span>
                        )}

                        {/* Branches */}
                        <span className="font-mono text-xs">
                          {pr.head.ref} → {pr.base.ref}
                        </span>

                        {/* Checks */}
                        {pr.mergeable_state && pr.mergeable_state !== "unknown" && (
                          <span
                            className={`flex items-center gap-1 ${
                              pr.mergeable_state === "clean"
                                ? "text-success"
                                : pr.mergeable_state === "blocked"
                                  ? "text-warning"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {pr.mergeable_state === "clean" && <Check className="h-3 w-3" />}
                            {pr.mergeable_state}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
