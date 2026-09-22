"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button, Chip, Panel, PanelHeader, Skeleton } from "@/components/ui";
import { GitBranch, RefreshCw, ArrowUp, ArrowDown, Shield, ExternalLink } from "lucide-react";

interface BranchStatusProps {
  githubUrl: string;
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

export function BranchStatus({ githubUrl }: BranchStatusProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [comparisons, setComparisons] = useState<Record<string, BranchComparison>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      let currentDefault = "main";

      if (repoResponse.ok) {
        const repoData = await repoResponse.json();
        if (repoData.data?.default_branch) currentDefault = repoData.data.default_branch;
      }
      setDefaultBranch(currentDefault);

      // Fetch branches
      const response = await fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}/branches?per_page=20`);

      if (!response.ok) {
        throw new Error("Failed to fetch branches");
      }

      const data = await response.json();
      const branchList = Array.isArray(data.data) ? data.data : [];
      setBranches(branchList);

      // Fetch comparisons for non-default branches
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
  }, [parsed]);

  useEffect(() => {
    void fetchBranches();
  }, [fetchBranches]);

  if (!parsed) {
    return null;
  }

  const treeUrl = (name: string) => `https://github.com/${parsed.owner}/${parsed.repo}/tree/${name}`;
  const ordered = [...branches.filter((branch) => branch.name === defaultBranch), ...branches.filter((branch) => branch.name !== defaultBranch)];

  return (
    <Panel>
      <PanelHeader
        title="Branches"
        icon={GitBranch}
        description={loading ? undefined : `${branches.length} against ${defaultBranch}`}
        actions={
          <Button variant="ghost" size="icon-sm" onClick={() => void fetchBranches()} disabled={loading} aria-label="Refresh">
            <RefreshCw className={loading ? "animate-spin" : undefined} strokeWidth={1.75} />
          </Button>
        }
      />
      {loading && branches.length === 0 ? (
        <div className="grid gap-2.5 p-3.5">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-5 w-full" />
          ))}
        </div>
      ) : error ? (
        <p className="p-3.5 text-[13px] text-fg-3">{error}</p>
      ) : branches.length === 0 ? (
        <p className="p-3.5 text-[13px] text-fg-3">No branches</p>
      ) : (
        <div className="max-h-[320px] overflow-y-auto">
          {ordered.map((branch) => {
            const comparison = comparisons[branch.name];
            const isDefault = branch.name === defaultBranch;
            return (
              <div key={branch.name} className="flex items-center gap-2 px-3.5 py-2 text-[13px] [&+&]:border-t [&+&]:border-line-subtle">
                <code className={isDefault ? "min-w-0 truncate text-[12.5px] font-medium text-fg" : "min-w-0 truncate text-[12.5px] text-fg-2"}>{branch.name}</code>
                {isDefault && <Chip>default</Chip>}
                {branch.protected && <Shield className="size-3.5 shrink-0 text-fg-4" strokeWidth={1.75} aria-label="Protected" />}
                <span className="ml-auto flex shrink-0 items-center gap-2 font-mono text-[11.5px]">
                  {comparison && comparison.ahead_by === 0 && comparison.behind_by === 0 && <span className="text-fg-4">even</span>}
                  {comparison && comparison.ahead_by > 0 && (
                    <span className="flex items-center gap-0.5 text-ok">
                      <ArrowUp className="size-3" strokeWidth={2} />
                      {comparison.ahead_by}
                    </span>
                  )}
                  {comparison && comparison.behind_by > 0 && (
                    <span className="flex items-center gap-0.5 text-warn">
                      <ArrowDown className="size-3" strokeWidth={2} />
                      {comparison.behind_by}
                    </span>
                  )}
                  <a href={treeUrl(branch.name)} target="_blank" rel="noopener noreferrer" className="text-fg-4 hover:text-fg" aria-label={`Open ${branch.name} on GitHub`}>
                    <ExternalLink className="size-3.5" strokeWidth={1.75} />
                  </a>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
