"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  Tag,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Download,
  FileArchive,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { GitHubRelease } from "@/types/github";
import { motion, AnimatePresence } from "framer-motion";

interface GitHubReleasesProps {
  githubUrl: string;
  /** Number of releases to fetch */
  limit?: number;
  /** Show only latest release */
  latestOnly?: boolean;
}

export function GitHubReleases({ githubUrl, limit = 10, latestOnly = false }: GitHubReleasesProps) {
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedRelease, setExpandedRelease] = useState<number | null>(null);

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

  const fetchReleases = useCallback(async () => {
    if (!parsed) {
      setError("Invalid GitHub URL");
      setLoading(false);
      return;
    }

    try {
      setIsRefreshing(true);

      const url = latestOnly
        ? `/api/github/repos/${parsed.owner}/${parsed.repo}/releases?latest=true`
        : `/api/github/repos/${parsed.owner}/${parsed.repo}/releases?per_page=${limit}`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 503) {
          setError("GitHub integration not configured");
        } else if (response.status === 404) {
          setError("Repository not found or not accessible");
        } else {
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
  }, [parsed, limit, latestOnly]);

  useEffect(() => {
    fetchReleases();
  }, [fetchReleases]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!parsed) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Releases
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: latestOnly ? 1 : 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-1/3" />
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
            <Tag className="h-4 w-4" />
            Releases
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

  if (releases.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Releases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No releases yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Releases
          <Badge variant="outline" className="ml-1 text-xs">
            {releases.length}
          </Badge>
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchReleases}
          disabled={isRefreshing}
          className="h-7 w-7 p-0"
          title="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
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
                <div className="rounded-md border border-border bg-secondary/20 p-3 hover:bg-secondary/40 transition-colors">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={release.prerelease ? "warning" : "success"} className="text-xs">
                        {release.tag_name}
                      </Badge>
                      {isLatest && (
                        <Badge variant="default" className="text-xs bg-primary">
                          Latest
                        </Badge>
                      )}
                      {release.prerelease && (
                        <Badge variant="outline" className="text-xs">
                          Pre-release
                        </Badge>
                      )}
                      {release.draft && (
                        <Badge variant="secondary" className="text-xs">
                          Draft
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {release.assets && release.assets.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedRelease(isExpanded ? null : release.id)}
                          className="h-6 w-6 p-0"
                          title="Show assets"
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

                  {/* Title & Description */}
                  {release.name && release.name !== release.tag_name && (
                    <p className="text-sm font-medium mt-2">{release.name}</p>
                  )}

                  {release.body && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {release.body.replace(/[#*`]/g, "").substring(0, 200)}
                      {release.body.length > 200 ? "..." : ""}
                    </p>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
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
                      <span className="flex items-center gap-1">
                        <FileArchive className="h-3 w-3" />
                        {release.assets.length} asset{release.assets.length > 1 ? "s" : ""}
                      </span>
                    )}

                    {/* Total downloads */}
                    {release.assets && release.assets.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        {release.assets.reduce((acc, a) => acc + a.download_count, 0)} downloads
                      </span>
                    )}
                  </div>

                  {/* Assets (expanded) */}
                  <AnimatePresence>
                    {isExpanded && release.assets && release.assets.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 pt-3 border-t border-border"
                      >
                        <p className="text-xs font-medium text-muted-foreground mb-2">Assets</p>
                        <div className="space-y-1.5">
                          {release.assets.map((asset) => (
                            <a
                              key={asset.id}
                              href={asset.browser_download_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/50 px-2 py-1.5 hover:bg-secondary/50 transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileArchive className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs font-mono truncate">{asset.name}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
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
      </CardContent>
    </Card>
  );
}
