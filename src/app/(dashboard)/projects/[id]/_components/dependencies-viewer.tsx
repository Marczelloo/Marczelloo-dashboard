"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Package, ChevronDown, RefreshCw, ExternalLink, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DependenciesViewerProps {
  githubUrl: string;
  defaultExpanded?: boolean;
}

interface DependencyPackage {
  name: string;
  version: string;
  ecosystem: string;
  downloadLocation?: string;
  manifest?: string;
}

const ecosystemColors: Record<string, string> = {
  npm: "text-red-400 bg-red-400/10 border-red-400/30",
  pip: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  cargo: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  go: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
  maven: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  nuget: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  rubygems: "text-red-400 bg-red-400/10 border-red-400/30",
  composer: "text-indigo-400 bg-indigo-400/10 border-indigo-400/30",
  unknown: "text-gray-400 bg-gray-400/10 border-gray-400/30",
};

export function DependenciesViewer({ githubUrl, defaultExpanded = false }: DependenciesViewerProps) {
  const [packages, setPackages] = useState<DependencyPackage[]>([]);
  const [byEcosystem, setByEcosystem] = useState<Record<string, DependencyPackage[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [selectedEcosystem, setSelectedEcosystem] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const parseGitHubUrl = (url: string): { owner: string; repo: string } | null => {
    const pattern = new RegExp("github\\.com[/:]([^/]+)/([^/?#.]+)");
    const match = url.match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2].replace(".git", "") };
    }
    return null;
  };

  // Memoize parsed URL to prevent infinite re-renders
  const parsed = useMemo(() => parseGitHubUrl(githubUrl), [githubUrl]);

  const fetchDependencies = useCallback(async () => {
    if (!parsed) {
      setError("Invalid GitHub URL");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}/dependencies`);

      if (!response.ok) {
        throw new Error("Failed to fetch dependencies");
      }

      const data = await response.json();

      if (data.message) {
        setMessage(data.message);
      }

      if (data.data) {
        setPackages(data.data.packages || []);
        setByEcosystem(data.data.by_ecosystem || {});

        // Auto-select first ecosystem
        const ecosystems = Object.keys(data.data.by_ecosystem || {});
        if (ecosystems.length > 0 && !selectedEcosystem) {
          setSelectedEcosystem(ecosystems[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch dependencies:", err);
      setError("Failed to load dependencies");
    } finally {
      setLoading(false);
    }
  }, [parsed, selectedEcosystem]);

  useEffect(() => {
    if (isExpanded && packages.length === 0 && !error && !message) {
      fetchDependencies();
    }
  }, [isExpanded, packages.length, error, message, fetchDependencies]);

  if (!parsed) return null;

  const ecosystems = Object.keys(byEcosystem);
  const currentPackages = selectedEcosystem ? byEcosystem[selectedEcosystem] || [] : packages;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle
            className="text-base flex items-center gap-2 cursor-pointer select-none"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Package className="h-4 w-4" />
            Dependencies
            {packages.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {packages.length}
              </Badge>
            )}
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </CardTitle>
          {isExpanded && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  fetchDependencies();
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                <a
                  href={`https://github.com/${parsed.owner}/${parsed.repo}/network/dependencies`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
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
                  <div className="flex gap-2">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-8 w-20" />
                    ))}
                  </div>
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : error ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  {error}
                  <Button variant="ghost" size="sm" className="ml-2" onClick={fetchDependencies}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Retry
                  </Button>
                </div>
              ) : message && packages.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-muted-foreground">
                  <Layers className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">{message}</p>
                </div>
              ) : packages.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-muted-foreground">
                  <Package className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No dependencies found</p>
                </div>
              ) : (
                <>
                  {/* Ecosystem tabs */}
                  {ecosystems.length > 1 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {ecosystems.map((eco) => (
                        <button
                          key={eco}
                          onClick={() => setSelectedEcosystem(eco)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            selectedEcosystem === eco
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary hover:bg-secondary/80"
                          }`}
                        >
                          {eco}
                          <span className="ml-1.5 opacity-75">({byEcosystem[eco]?.length || 0})</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Package list */}
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {currentPackages.slice(0, 50).map((pkg, index) => (
                      <div
                        key={`${pkg.name}-${index}`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate">{pkg.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <code className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                            {pkg.version}
                          </code>
                          <Badge
                            variant="outline"
                            className={`text-xs ${ecosystemColors[pkg.ecosystem] || ecosystemColors.unknown}`}
                          >
                            {pkg.ecosystem}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {currentPackages.length > 50 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        And {currentPackages.length - 50} more...
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
