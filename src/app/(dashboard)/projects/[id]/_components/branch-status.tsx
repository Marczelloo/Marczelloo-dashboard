"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { GitBranch, ChevronDown, RefreshCw, ArrowUp, ArrowDown, Check, Shield, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BranchStatusProps {
  githubUrl: string;
  defaultExpanded?: boolean;
}

interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

interface BranchComparison {
  status: string;
  ahead_by: number;
  behind_by: number;
  total_commits: number;
}

export function BranchStatus({ githubUrl, defaultExpanded = false }: BranchStatusProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [comparisons, setComparisons] = useState<Record<string, BranchComparison>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [defaultBranch, setDefaultBranch] = useState<string>("main");

  // Parse owner and repo from GitHub URL
  const parseGitHubUrl = (url: string): { owner: string; repo: string } | null => {
    const patterns = [/github\.com\/([^\/]+)\/([^\/\?#]+)/, /github\.com:([^\/]+)\/([^\/\?#\.]+)/];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(/\.git$/, ""),
        };
      }
    }
    return null;
  };

  // Memoize parsed URL to prevent infinite re-renders
  const parsed = useMemo(() => parseGitHubUrl(githubUrl), [githubUrl]);

  const fetchBranches = useCallback(async () => {
    if (!parsed) {
      setError("Invalid GitHub URL");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First fetch repo info to get default branch
      const repoResponse = await fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}`);

      if (repoResponse.ok) {
        const repoData = await repoResponse.json();
        if (repoData.data?.default_branch) {
          setDefaultBranch(repoData.data.default_branch);
        }
      }

      // Fetch branches
      const response = await fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}/branches?per_page=20`);

      if (!response.ok) {
        throw new Error("Failed to fetch branches");
      }

      const data = await response.json();
      const branchList = Array.isArray(data.data) ? data.data : [];
      setBranches(branchList);

      // Fetch comparisons for non-default branches
      const currentDefault = defaultBranch;
      const comparisonPromises = branchList
        .filter((b: Branch) => b.name !== currentDefault)
        .slice(0, 10) // Limit to first 10 non-default branches
        .map(async (branch: Branch) => {
          try {
            const compareResponse = await fetch(
              `/api/github/repos/${parsed.owner}/${parsed.repo}/compare?base=${currentDefault}&head=${branch.name}`
            );
            if (compareResponse.ok) {
              const compareData = await compareResponse.json();
              return { name: branch.name, comparison: compareData.data };
            }
          } catch {
            // Ignore comparison errors
          }
          return null;
        });

      const results = await Promise.all(comparisonPromises);
      const newComparisons: Record<string, BranchComparison> = {};
      results.forEach((result) => {
        if (result) {
          newComparisons[result.name] = result.comparison;
        }
      });
      setComparisons(newComparisons);
    } catch (err) {
      console.error("Failed to fetch branches:", err);
      setError("Failed to load branches");
    } finally {
      setLoading(false);
    }
  }, [parsed, defaultBranch]);

  useEffect(() => {
    if (isExpanded && branches.length === 0 && !error) {
      fetchBranches();
    }
  }, [isExpanded, branches.length, error, fetchBranches]);

  if (!parsed) {
    return null;
  }

  const getStatusBadge = (comparison: BranchComparison) => {
    if (comparison.ahead_by === 0 && comparison.behind_by === 0) {
      return (
        <Badge variant="outline" className="text-success border-success/30 bg-success/10">
          <Check className="h-3 w-3 mr-1" />
          Up to date
        </Badge>
      );
    }

    return (
      <div className="flex items-center gap-2">
        {comparison.ahead_by > 0 && (
          <Badge variant="outline" className="text-blue-400 border-blue-400/30 bg-blue-400/10">
            <ArrowUp className="h-3 w-3 mr-1" />
            {comparison.ahead_by} ahead
          </Badge>
        )}
        {comparison.behind_by > 0 && (
          <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10">
            <ArrowDown className="h-3 w-3 mr-1" />
            {comparison.behind_by} behind
          </Badge>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle
            className="text-base flex items-center gap-2 cursor-pointer select-none"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <GitBranch className="h-4 w-4" />
            Branch Status
            <Badge variant="secondary" className="ml-2 text-xs">
              {branches.length || "..."}
            </Badge>
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </CardTitle>
          {isExpanded && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={(e) => {
                e.stopPropagation();
                fetchBranches();
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-0">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  {error}
                  <Button variant="ghost" size="sm" className="ml-2" onClick={fetchBranches}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Retry
                  </Button>
                </div>
              ) : branches.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No branches found</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {/* Default branch first */}
                  {branches
                    .filter((b) => b.name === defaultBranch)
                    .map((branch) => (
                      <div
                        key={branch.name}
                        className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/20"
                      >
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4 text-primary" />
                          <span className="font-medium">{branch.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            default
                          </Badge>
                          {branch.protected && <Shield className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                        <a
                          href={`https://github.com/${parsed.owner}/${parsed.repo}/tree/${branch.name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    ))}

                  {/* Other branches */}
                  {branches
                    .filter((b) => b.name !== defaultBranch)
                    .map((branch) => (
                      <div
                        key={branch.name}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{branch.name}</span>
                          {branch.protected && <Shield className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                        <div className="flex items-center gap-2">
                          {comparisons[branch.name] && getStatusBadge(comparisons[branch.name])}
                          <a
                            href={`https://github.com/${parsed.owner}/${parsed.repo}/tree/${branch.name}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
