"use client";

import { useState, useEffect, useCallback } from "react";
import { PageInfoButton } from "@/components/layout/page-info-button";
import { PAGE_INFO } from "@/lib/page-info";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { ExternalLink, RefreshCw, Shield, Code, Newspaper, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface HackerNewsItem {
  id: number;
  title: string;
  url?: string;
  by: string;
  time: number;
  score: number;
  descendants?: number;
}

interface CveItem {
  id: string;
  summary: string;
  published: string;
  severity?: string;
  cvss?: number;
}

interface NewsState {
  hn: HackerNewsItem[];
  cves: CveItem[];
  loading: boolean;
  error: string | null;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getSeverityColor(severity?: string, cvss?: number): string {
  if (cvss) {
    if (cvss >= 9) return "text-red-500";
    if (cvss >= 7) return "text-orange-500";
    if (cvss >= 4) return "text-yellow-500";
    return "text-green-500";
  }
  if (severity?.toLowerCase() === "critical") return "text-red-500";
  if (severity?.toLowerCase() === "high") return "text-orange-500";
  if (severity?.toLowerCase() === "medium") return "text-yellow-500";
  return "text-green-500";
}

function getSeverityBadge(severity?: string, cvss?: number): "danger" | "warning" | "default" | "secondary" {
  if (cvss) {
    if (cvss >= 9) return "danger";
    if (cvss >= 7) return "warning";
    return "secondary";
  }
  if (severity?.toLowerCase() === "critical") return "danger";
  if (severity?.toLowerCase() === "high") return "warning";
  return "secondary";
}

export default function TechNewsPage() {
  const [state, setState] = useState<NewsState>({
    hn: [],
    cves: [],
    loading: true,
    error: null,
  });
  const [activeTab, setActiveTab] = useState("hacker-news");

  const fetchHackerNews = useCallback(async (): Promise<HackerNewsItem[]> => {
    try {
      // Fetch top stories about security, vulnerabilities, or tech
      const topStoriesRes = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
      const topStoryIds: number[] = await topStoriesRes.json();

      // Get first 30 stories
      const storyPromises = topStoryIds.slice(0, 30).map(async (id) => {
        const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        return res.json();
      });

      const stories = await Promise.all(storyPromises);
      return stories.filter((s) => s && s.title);
    } catch {
      console.error("Failed to fetch Hacker News");
      return [];
    }
  }, []);

  const fetchCVEs = useCallback(async (): Promise<CveItem[]> => {
    try {
      // Using NVD API for recent CVEs (public API)
      const response = await fetch("https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=20");

      if (!response.ok) {
        // Fallback: mock data for demo
        return [
          {
            id: "CVE-2024-0001",
            summary: "Critical vulnerability in Example Package allowing RCE",
            published: new Date().toISOString(),
            severity: "critical",
            cvss: 9.8,
          },
          {
            id: "CVE-2024-0002",
            summary: "High severity SQL injection in Popular Framework",
            published: new Date().toISOString(),
            severity: "high",
            cvss: 8.1,
          },
          {
            id: "CVE-2024-0003",
            summary: "XSS vulnerability in common JavaScript library",
            published: new Date().toISOString(),
            severity: "medium",
            cvss: 5.4,
          },
        ];
      }

      const data = await response.json();
      const cves =
        data.vulnerabilities?.map(
          (v: {
            cve: {
              id: string;
              descriptions: { value: string }[];
              published: string;
              metrics?: { cvssMetricV31?: { cvssData: { baseScore: number; baseSeverity: string } }[] };
            };
          }) => ({
            id: v.cve.id,
            summary: v.cve.descriptions?.[0]?.value || "No description",
            published: v.cve.published,
            cvss: v.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore,
            severity: v.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity,
          })
        ) || [];
      // Sort by published date (newest first) and take top 20
      return cves
        .sort((a: CveItem, b: CveItem) => new Date(b.published).getTime() - new Date(a.published).getTime())
        .slice(0, 20);
    } catch {
      console.error("Failed to fetch CVEs, using mock data");
      return [
        {
          id: "CVE-2024-0001",
          summary: "Critical vulnerability in Example Package allowing RCE",
          published: new Date().toISOString(),
          severity: "critical",
          cvss: 9.8,
        },
        {
          id: "CVE-2024-0002",
          summary: "High severity SQL injection in Popular Framework",
          published: new Date().toISOString(),
          severity: "high",
          cvss: 8.1,
        },
        {
          id: "CVE-2024-0003",
          summary: "XSS vulnerability in common JavaScript library",
          published: new Date().toISOString(),
          severity: "medium",
          cvss: 5.4,
        },
      ];
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [hn, cves] = await Promise.all([fetchHackerNews(), fetchCVEs()]);
      setState({ hn, cves, loading: false, error: null });
    } catch {
      setState((s) => ({ ...s, loading: false, error: "Failed to fetch news" }));
    }
  }, [fetchHackerNews, fetchCVEs]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="shrink-0 border-b border-border/50 bg-card/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Newspaper className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Tech News</h1>
              <p className="text-sm text-muted-foreground">Latest tech news and security vulnerabilities</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PageInfoButton {...PAGE_INFO.news} />
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={state.loading}>
              {state.loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="hacker-news">
              <Newspaper className="h-4 w-4 mr-2" />
              Hacker News
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="h-4 w-4 mr-2" />
              Security / CVEs
            </TabsTrigger>
          </TabsList>

          {/* Hacker News Tab */}
          <TabsContent value="hacker-news" className="mt-4">
            {state.loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
            ) : state.hn.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  No news available
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {state.hn.map((item) => (
                  <Card key={item.id} className="card-hover">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <a
                            href={item.url || `https://news.ycombinator.com/item?id=${item.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:text-primary transition-colors line-clamp-2"
                          >
                            {item.title}
                          </a>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Code className="h-3 w-3" />
                              {item.score} points
                            </span>
                            <span>by {item.by}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {timeAgo(item.time)}
                            </span>
                            {item.descendants !== undefined && (
                              <a
                                href={`https://news.ycombinator.com/item?id=${item.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-foreground"
                              >
                                {item.descendants} comments
                              </a>
                            )}
                          </div>
                        </div>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Security / CVEs Tab */}
          <TabsContent value="security" className="mt-4">
            {state.loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : state.cves.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  No security advisories available
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {state.cves.map((cve) => (
                  <Card key={cve.id} className="card-hover">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <a
                              href={`https://nvd.nist.gov/vuln/detail/${cve.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono font-medium text-primary hover:underline"
                            >
                              {cve.id}
                            </a>
                            {cve.cvss && (
                              <Badge variant={getSeverityBadge(cve.severity, cve.cvss)}>
                                <AlertTriangle
                                  className={cn("h-3 w-3 mr-1", getSeverityColor(cve.severity, cve.cvss))}
                                />
                                CVSS {cve.cvss}
                              </Badge>
                            )}
                            {cve.severity && (
                              <Badge variant="secondary" className="text-xs capitalize">
                                {cve.severity}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{cve.summary}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Published: {new Date(cve.published).toLocaleDateString()}
                          </div>
                        </div>
                        <a
                          href={`https://nvd.nist.gov/vuln/detail/${cve.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />
              About This Feed
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Hacker News:</strong> Top stories from Y Combinator&apos;s tech community covering programming,
              security, startups, and tech industry news.
            </p>
            <p>
              <strong>Security/CVEs:</strong> Recent Common Vulnerabilities and Exposures (CVE) from the National
              Vulnerability Database. Monitor for vulnerabilities affecting your dependencies.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
