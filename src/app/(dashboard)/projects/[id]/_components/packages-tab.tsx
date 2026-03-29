"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  RefreshCw,
  Check,
  X,
  AlertTriangle,
  Clock,
  History,
} from "lucide-react";
import { motion } from "framer-motion";
import type { Project } from "@/types";

interface PackagesTabProps {
  project: Project;
}

interface PackageCheckResult {
  ecosystem: string;
  outdated: Array<{
    name: string;
    current: string;
    wanted: string;
    latest: string;
    service_name?: string;
  }>;
  outdated_count: number;
  checked_at: string;
}

interface PackageUpdateRecord {
  id: string;
  ecosystem: string;
  packages_updated: string[];
  old_versions: Record<string, string>;
  new_versions: Record<string, string>;
  status: "pending" | "success" | "failed" | "rolled_back";
  test_output: string | null;
  error_message: string | null;
  branch_name: string | null;
  pr_url: string | null;
  created_at: string;
  completed_at: string | null;
}

interface RepoPathOption {
  service_id: string;
  service_name: string;
  repo_path: string;
}

export function PackagesTab({ project }: PackagesTabProps) {
  const [checkResult, setCheckResult] = useState<PackageCheckResult | null>(null);
  const [history, setHistory] = useState<PackageUpdateRecord[]>([]);
  const [availableRepoPaths, setAvailableRepoPaths] = useState<RepoPathOption[]>([]);
  const [selectedRepoPath, setSelectedRepoPath] = useState<string>("");
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());

  // Fetch functions (must be declared before useEffect that uses them)
  const fetchRepoPaths = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}/packages`);
      if (response.ok) {
        const data = await response.json();
        const allPaths = data.available_repo_paths || [];

        // Filter out services that are known to not have packages
        // This is a simple heuristic - services like 'runner' don't have npm packages
        const pathsWithPackages = allPaths.filter((service: RepoPathOption) => {
          const serviceName = service.service_name.toLowerCase();
          // Skip services that are known to not have packages
          const skipList = ['runner', 'portainer', 'database', 'cache', 'redis', 'proxy'];
          return !skipList.some(name => serviceName.includes(name));
        });

        setAvailableRepoPaths(pathsWithPackages);

        if (pathsWithPackages.length > 0) {
          setSelectedRepoPath(pathsWithPackages[0].repo_path);
        }
      }
    } catch (err) {
      console.error("Failed to fetch repo paths:", err);
    }
  }, [project.id]);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}/packages/history`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  }, [project.id]);

  const handleCheck = useCallback(async () => {
    if (!selectedRepoPath) {
      setError("No repository path available. Please configure a service with repo_path.");
      return;
    }

    setChecking(true);
    setError(null);

    try {
      // Find service name for this repo_path
      const serviceInfo = availableRepoPaths.find(s => s.repo_path === selectedRepoPath);

      console.log("Checking packages for:", { repoPath: selectedRepoPath, serviceName: serviceInfo?.service_name });

      const response = await fetch(`/api/projects/${project.id}/packages/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_path: selectedRepoPath,
          service_name: serviceInfo?.service_name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to check packages");
      }

      const data = await response.json();
      setCheckResult(data);
    } catch (err) {
      console.error("Package check error:", err);
      setError(err instanceof Error ? err.message : "Failed to check packages");
    } finally {
      setChecking(false);
    }
  }, [selectedRepoPath, project.id, availableRepoPaths]);

  const handleUpdate = useCallback(async () => {
    if (!selectedRepoPath) {
      setError("No repository path available. Please configure a service with repo_path.");
      return;
    }

    // If no packages are selected, select all outdated packages
    const packagesToUpdate = selectedPackages.size > 0
      ? Array.from(selectedPackages)
      : checkResult?.outdated.map(pkg => pkg.name) || [];

    if (packagesToUpdate.length === 0) {
      setError("No packages to update");
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${project.id}/packages/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_path: selectedRepoPath,
          packages: packagesToUpdate,
          run_tests: true,
          run_build: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update packages");
      }

      const data = await response.json();
      // Refresh history and check result
      await fetchHistory();
      await handleCheck();
      setSelectedPackages(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update packages");
    } finally {
      setUpdating(false);
    }
  }, [selectedRepoPath, selectedPackages, project.id, fetchHistory, handleCheck, checkResult]);

  const togglePackage = useCallback((packageName: string) => {
    const newSelected = new Set(selectedPackages);
    if (newSelected.has(packageName)) {
      newSelected.delete(packageName);
    } else {
      newSelected.add(packageName);
    }
    setSelectedPackages(newSelected);
  }, [selectedPackages]);

  // Fetch available repo paths and history on mount
  useEffect(() => {
    fetchRepoPaths();
    fetchHistory();
  }, [project.id, fetchRepoPaths, fetchHistory]);

  // Auto-check packages when repo path is available
  useEffect(() => {
    if (selectedRepoPath && !checkResult) {
      handleCheck();
    }
  }, [selectedRepoPath, checkResult, handleCheck]);

  const getStatusIcon = (status: PackageUpdateRecord["status"]) => {
    switch (status) {
      case "success":
        return <Check className="h-4 w-4 text-success" />;
      case "failed":
        return <X className="h-4 w-4 text-destructive" />;
      case "rolled_back":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getVersionColor = (current: string, latest: string) => {
    // Handle undefined/null values
    if (!current || !latest) return "secondary";

    const currentParts = current.split(".").map(Number);
    const latestParts = latest.split(".").map(Number);

    if (currentParts[0] !== latestParts[0]) return "destructive"; // Major
    if (currentParts[1] !== latestParts[1]) return "warning"; // Minor
    return "secondary"; // Patch
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Service Selection (if multiple available) */}
        {availableRepoPaths.length > 1 && (
          <Card>
            <CardContent className="pt-4">
              <label htmlFor="service-select" className="text-sm font-medium mb-2 block">Select Service:</label>
              <select
                id="service-select"
                value={selectedRepoPath}
                onChange={(e) => setSelectedRepoPath(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background"
              >
                {availableRepoPaths.map((option) => (
                  <option key={option.service_id} value={option.repo_path}>
                    {option.service_name}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>
        )}

        {/* No Repo Path Warning */}
        {availableRepoPaths.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No repository path configured.</p>
              <p className="text-sm mt-1">Add a service with a repo_path to enable package management.</p>
            </CardContent>
          </Card>
        )}

        {/* Package Status Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Package Status
              {availableRepoPaths.length === 1 && (
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  ({availableRepoPaths[0].service_name})
                </span>
              )}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheck}
              disabled={checking || !selectedRepoPath}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
              Check for Updates
            </Button>
          </CardHeader>
          <CardContent>
            {checking ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : checkResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <span>Ecosystem:</span>
                  <Badge variant="secondary">{checkResult.ecosystem}</Badge>
                  <span>Outdated:</span>
                  <Badge
                    variant={checkResult.outdated_count > 0 ? "warning" : "success"}
                  >
                    {checkResult.outdated_count}
                  </Badge>
                </div>

                {checkResult.outdated_count > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {checkResult.outdated_count} package(s) can be updated
                      </p>
                      <Button
                        size="sm"
                        disabled={updating}
                        onClick={handleUpdate}
                      >
                        {updating ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Package className="h-4 w-4 mr-2" />
                            Update {selectedPackages.size > 0 ? `${selectedPackages.size}` : "All"}
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {checkResult.outdated.map((pkg) => {
                        // Defensive: skip packages with missing data
                        if (!pkg.current || !pkg.latest) {
                          console.log("Skipping package with missing data:", pkg);
                          return null;
                        }

                        return (
                          <div
                            key={pkg.name}
                            className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                            onClick={() => togglePackage(pkg.name)}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selectedPackages.has(pkg.name)}
                                onChange={() => togglePackage(pkg.name)}
                                className="h-4 w-4"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">{pkg.name}</span>
                                {pkg.service_name && (
                                  <span className="text-xs text-muted-foreground">{pkg.service_name}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                                {pkg.current}
                              </code>
                              <span className="text-muted-foreground">→</span>
                              <Badge
                                variant={getVersionColor(pkg.current, pkg.latest)}
                                className="text-xs"
                              >
                                {pkg.latest}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {checkResult.outdated_count === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Check className="h-12 w-12 mx-auto mb-2 text-success" />
                    <p>All packages are up to date!</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Click "Check for Updates" to see outdated packages</p>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar - History */}
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Update History
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchHistory}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No updates yet
              </p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {history.map((update) => (
                  <div
                    key={update.id}
                    className="p-3 rounded-lg border border-border/50 hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(update.status)}
                        <span className="text-xs font-medium">
                          {update.packages_updated.length} package(s)
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(update.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                      {update.packages_updated.slice(0, 3).map((pkg) => (
                        <Badge key={pkg} variant="outline" className="text-xs">
                          {pkg}
                        </Badge>
                      ))}
                      {update.packages_updated.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{update.packages_updated.length - 3}
                        </Badge>
                      )}
                    </div>

                    {update.status === "failed" && update.error_message && (
                      <p className="text-xs text-destructive truncate">
                        {update.error_message}
                      </p>
                    )}

                    {update.pr_url && (
                      <a
                        href={update.pr_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        View PR →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
