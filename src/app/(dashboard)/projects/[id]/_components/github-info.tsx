"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton } from "@/components/ui";
import { Button } from "@/components/ui/button";
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Github className="h-4 w-4" />
            GitHub
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Github className="h-4 w-4" />
            GitHub
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-warning" />
            {error}
          </div>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-primary hover:underline mt-2"
          >
            View on GitHub
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const { repo, stats } = data;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Github className="h-4 w-4" />
          {repo.name}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchData}
            disabled={isRefreshing}
            className="h-7 w-7 p-0"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GitBranch className="h-3.5 w-3.5" />
            <span>{stats.branches_count} branches</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <GitPullRequest className="h-3.5 w-3.5" />
            <span>{stats.open_prs_count} open PRs</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Tag className="h-3.5 w-3.5" />
            <span>{stats.releases_count} releases</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{stats.contributors_count} contributors</span>
          </div>
        </div>

        {/* Security Alerts */}
        {stats.security_alerts_count > 0 && (
          <div className="flex items-center gap-2 rounded-md bg-danger/10 border border-danger/20 px-3 py-2">
            <ShieldAlert className="h-4 w-4 text-danger" />
            <span className="text-sm text-danger font-medium">
              {stats.security_alerts_count} security alert{stats.security_alerts_count > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Latest Commit */}
        {stats.last_commit && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
              <GitCommit className="h-3 w-3" />
              Latest Commit
            </div>
            <div className="rounded-md border border-border bg-secondary/30 p-2">
              <p className="text-sm font-medium truncate">{stats.last_commit.commit.message.split("\n")[0]}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>{stats.last_commit.commit.author.name}</span>
                <span>·</span>
                <span>{formatRelativeTime(stats.last_commit.commit.author.date)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Latest Release */}
        {stats.last_release && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
              <Tag className="h-3 w-3" />
              Latest Release
            </div>
            <a
              href={stats.last_release.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-md border border-border bg-secondary/30 p-2 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Badge variant="success" className="text-xs">
                  {stats.last_release.tag_name}
                </Badge>
                {stats.last_release.prerelease && (
                  <Badge variant="warning" className="text-xs">
                    Pre-release
                  </Badge>
                )}
              </div>
              {stats.last_release.name && stats.last_release.name !== stats.last_release.tag_name && (
                <p className="text-sm mt-1 truncate">{stats.last_release.name}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {stats.last_release.published_at ? formatRelativeTime(stats.last_release.published_at) : "Draft"}
              </p>
            </a>
          </div>
        )}

        {/* Default Branch */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
          <span>Default branch</span>
          <Badge variant="outline" className="text-xs font-mono">
            {repo.default_branch}
          </Badge>
        </div>

        {/* Language */}
        {repo.language && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Primary language</span>
            <span>{repo.language}</span>
          </div>
        )}

        {/* Last pushed */}
        {repo.pushed_at && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Last push</span>
            <span>{formatRelativeTime(repo.pushed_at)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
