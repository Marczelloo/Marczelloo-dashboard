"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, RefreshCw, ChevronDown, Copy, Check, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChangelogViewerProps {
  githubUrl: string;
  defaultExpanded?: boolean;
}

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
}

export function ChangelogViewer({ githubUrl, defaultExpanded = false }: ChangelogViewerProps) {
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [selectedFrom, setSelectedFrom] = useState<string>("");
  const [selectedTo, setSelectedTo] = useState<string>("");
  const [changelog, setChangelog] = useState<string>("");
  const [generatingChangelog, setGeneratingChangelog] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const fetchReleases = useCallback(async () => {
    if (!parsed) {
      setError("Invalid GitHub URL");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}/releases?per_page=20`);

      if (!response.ok) {
        throw new Error("Failed to fetch releases");
      }

      const data = await response.json();
      const releaseList = Array.isArray(data.data) ? data.data : [data.data].filter(Boolean);
      setReleases(releaseList);

      // Auto-select latest two releases if available
      if (releaseList.length >= 2 && !selectedFrom && !selectedTo) {
        setSelectedTo(releaseList[0].tag_name);
        setSelectedFrom(releaseList[1].tag_name);
      } else if (releaseList.length === 1 && !selectedTo) {
        setSelectedTo(releaseList[0].tag_name);
      }
    } catch (err) {
      console.error("Failed to fetch releases:", err);
      setError("Failed to load releases");
    } finally {
      setLoading(false);
    }
  }, [parsed, selectedFrom, selectedTo]);

  useEffect(() => {
    if (isExpanded && releases.length === 0 && !error) {
      fetchReleases();
    }
  }, [isExpanded, releases.length, error, fetchReleases]);

  const generateChangelog = async () => {
    if (!parsed || !selectedTo) {
      return;
    }

    setGeneratingChangelog(true);
    setChangelog("");

    try {
      // Use GitHub's release notes generation API
      const response = await fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}/releases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagName: `changelog-preview-${Date.now()}`, // Temporary tag
          autoGenerateNotes: true,
          previousTag: selectedFrom || undefined,
          draft: true, // Don't actually create the release
        }),
      });

      if (!response.ok) {
        // Fall back to comparing release bodies
        let changelogText = `# Changelog: ${selectedFrom || "Beginning"} → ${selectedTo}\n\n`;

        // Get all releases in between
        const toIndex = releases.findIndex((r) => r.tag_name === selectedTo);
        const fromIndex = selectedFrom ? releases.findIndex((r) => r.tag_name === selectedFrom) : releases.length;

        const relevantReleases = releases.slice(toIndex, fromIndex + 1);

        for (const release of relevantReleases.reverse()) {
          if (release.body) {
            changelogText += `## ${release.tag_name}${release.name !== release.tag_name ? ` - ${release.name}` : ""}\n\n`;
            changelogText += release.body + "\n\n";
          }
        }

        setChangelog(changelogText);
      } else {
        // Successfully generated notes
        const data = await response.json();
        if (data.data?.body) {
          setChangelog(`# Changelog: ${selectedFrom || "Beginning"} → ${selectedTo}\n\n${data.data.body}`);
        }
      }
    } catch (err) {
      console.error("Failed to generate changelog:", err);
      // Fall back to combining release notes
      let changelogText = `# Changelog: ${selectedFrom || "Beginning"} → ${selectedTo}\n\n`;

      const toIndex = releases.findIndex((r) => r.tag_name === selectedTo);
      const fromIndex = selectedFrom ? releases.findIndex((r) => r.tag_name === selectedFrom) : releases.length;

      if (toIndex >= 0) {
        const relevantReleases = releases.slice(toIndex, Math.max(fromIndex, toIndex) + 1);

        for (const release of relevantReleases.reverse()) {
          if (release.body) {
            changelogText += `## ${release.tag_name}\n\n`;
            changelogText += release.body + "\n\n";
          }
        }
      }

      setChangelog(changelogText);
    } finally {
      setGeneratingChangelog(false);
    }
  };

  const copyChangelog = async () => {
    try {
      await navigator.clipboard.writeText(changelog);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const downloadChangelog = () => {
    const blob = new Blob([changelog], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CHANGELOG-${selectedFrom || "start"}-${selectedTo}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!parsed) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle
            className="text-base flex items-center gap-2 cursor-pointer select-none"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <ScrollText className="h-4 w-4" />
            Changelog Generator
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </CardTitle>
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
            <CardContent className="pt-0 space-y-4">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : error ? (
                <div className="text-sm text-muted-foreground">
                  {error}
                  <Button variant="ghost" size="sm" className="ml-2" onClick={fetchReleases}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Retry
                  </Button>
                </div>
              ) : releases.length === 0 ? (
                <p className="text-sm text-muted-foreground">No releases found</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">From (older)</label>
                      <Select value={selectedFrom} onValueChange={setSelectedFrom}>
                        <SelectTrigger>
                          <SelectValue placeholder="Beginning" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Beginning</SelectItem>
                          {releases.map((release) => (
                            <SelectItem key={release.id} value={release.tag_name}>
                              {release.tag_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">To (newer)</label>
                      <Select value={selectedTo} onValueChange={setSelectedTo}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select version" />
                        </SelectTrigger>
                        <SelectContent>
                          {releases.map((release) => (
                            <SelectItem key={release.id} value={release.tag_name}>
                              {release.tag_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button onClick={generateChangelog} disabled={!selectedTo || generatingChangelog} className="w-full">
                    {generatingChangelog ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <ScrollText className="h-4 w-4 mr-2" />
                        Generate Changelog
                      </>
                    )}
                  </Button>

                  {changelog && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Generated Changelog</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={copyChangelog}>
                            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={downloadChangelog}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="prose prose-sm prose-invert max-w-none p-4 rounded-md bg-muted/50 max-h-[400px] overflow-y-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{changelog}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
