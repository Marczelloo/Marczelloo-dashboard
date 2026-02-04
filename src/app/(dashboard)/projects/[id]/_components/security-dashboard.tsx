"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Shield, ChevronDown, RefreshCw, AlertTriangle, ExternalLink, Bug, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SecurityDashboardProps {
  githubUrl: string;
  defaultExpanded?: boolean;
}

interface DependabotAlert {
  number: number;
  state: string;
  security_advisory: {
    ghsa_id: string;
    summary: string;
    severity: string;
  };
  security_vulnerability: {
    severity: string;
    package: {
      name: string;
      ecosystem: string;
    };
  };
  html_url: string;
  created_at: string;
}

interface CodeScanningAlert {
  number: number;
  state: string;
  rule: {
    id: string;
    severity: string;
    security_severity_level: string | null;
    description: string;
    name: string;
  };
  tool: {
    name: string;
  };
  most_recent_instance: {
    location: {
      path: string;
      start_line: number;
    };
    message: {
      text: string;
    };
  };
  html_url: string;
  created_at: string;
}

export function SecurityDashboard({ githubUrl, defaultExpanded = false }: SecurityDashboardProps) {
  const [dependabotAlerts, setDependabotAlerts] = useState<DependabotAlert[]>([]);
  const [codeScanningAlerts, setCodeScanningAlerts] = useState<CodeScanningAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState<"dependabot" | "codeql">("dependabot");

  const parseGitHubUrl = (url: string): { owner: string; repo: string } | null => {
    const patterns = [/github\.com\/([^\/]+)\/([^\/\?#]+)/, /github\.com:([^\/]+)\/([^\/\?#\.]+)/];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
      }
    }
    return null;
  };

  // Memoize parsed URL to prevent infinite re-renders
  const parsed = useMemo(() => parseGitHubUrl(githubUrl), [githubUrl]);

  const fetchAlerts = useCallback(async () => {
    if (!parsed) {
      setError("Invalid GitHub URL");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [dependabotRes, codeScanningRes] = await Promise.all([
        fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}/security?state=open&per_page=10`),
        fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}/code-scanning?state=open&per_page=10`),
      ]);

      if (dependabotRes.ok) {
        const data = await dependabotRes.json();
        setDependabotAlerts(data.data || []);
      }

      if (codeScanningRes.ok) {
        const data = await codeScanningRes.json();
        setCodeScanningAlerts(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch security alerts:", err);
      setError("Failed to load security alerts");
    } finally {
      setLoading(false);
    }
  }, [parsed]);

  useEffect(() => {
    if (isExpanded && dependabotAlerts.length === 0 && codeScanningAlerts.length === 0 && !error) {
      fetchAlerts();
    }
  }, [isExpanded, dependabotAlerts.length, codeScanningAlerts.length, error, fetchAlerts]);

  if (!parsed) return null;

  const totalAlerts = dependabotAlerts.length + codeScanningAlerts.length;

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case "critical":
        return "text-red-500 bg-red-500/10 border-red-500/30";
      case "high":
        return "text-orange-500 bg-orange-500/10 border-orange-500/30";
      case "medium":
        return "text-yellow-500 bg-yellow-500/10 border-yellow-500/30";
      case "low":
        return "text-blue-500 bg-blue-500/10 border-blue-500/30";
      default:
        return "text-gray-500 bg-gray-500/10 border-gray-500/30";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle
            className="text-base flex items-center gap-2 cursor-pointer select-none"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Shield className="h-4 w-4" />
            Security
            {totalAlerts > 0 && (
              <Badge variant="destructive" className="ml-2">
                {totalAlerts}
              </Badge>
            )}
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
                fetchAlerts();
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
              {/* Tabs */}
              <div className="flex gap-2 mb-4 border-b border-border">
                <button
                  className={`flex items-center gap-2 pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "dependabot"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActiveTab("dependabot")}
                >
                  <Lock className="h-4 w-4" />
                  Dependabot
                  {dependabotAlerts.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {dependabotAlerts.length}
                    </Badge>
                  )}
                </button>
                <button
                  className={`flex items-center gap-2 pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "codeql"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActiveTab("codeql")}
                >
                  <Bug className="h-4 w-4" />
                  CodeQL
                  {codeScanningAlerts.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {codeScanningAlerts.length}
                    </Badge>
                  )}
                </button>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : error ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  {error}
                  <Button variant="ghost" size="sm" className="ml-2" onClick={fetchAlerts}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Retry
                  </Button>
                </div>
              ) : activeTab === "dependabot" ? (
                dependabotAlerts.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-muted-foreground">
                    <Lock className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No Dependabot alerts</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {dependabotAlerts.map((alert) => (
                      <a
                        key={alert.number}
                        href={alert.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                              <span className="text-sm font-medium truncate">
                                {alert.security_advisory?.summary || `Alert #${alert.number}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{alert.security_vulnerability?.package?.name}</span>
                              <Badge
                                variant="outline"
                                className={getSeverityColor(alert.security_vulnerability?.severity)}
                              >
                                {alert.security_vulnerability?.severity}
                              </Badge>
                            </div>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      </a>
                    ))}
                  </div>
                )
              ) : codeScanningAlerts.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-muted-foreground">
                  <Bug className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No CodeQL alerts</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {codeScanningAlerts.map((alert) => (
                    <a
                      key={alert.number}
                      href={alert.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Bug className="h-4 w-4 text-warning shrink-0" />
                            <span className="text-sm font-medium truncate">
                              {alert.rule?.description || alert.rule?.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              {alert.most_recent_instance?.location?.path}:
                              {alert.most_recent_instance?.location?.start_line}
                            </span>
                            <Badge
                              variant="outline"
                              className={getSeverityColor(alert.rule?.security_severity_level || alert.rule?.severity)}
                            >
                              {alert.rule?.security_severity_level || alert.rule?.severity}
                            </Badge>
                            <span className="text-muted-foreground">{alert.tool?.name}</span>
                          </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </a>
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
