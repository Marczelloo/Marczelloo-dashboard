"use client";

import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tag, RefreshCw, Sparkles, ChevronDown, AlertCircle, Rocket } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface ReleaseCreatorProps {
  githubUrl: string;
  defaultExpanded?: boolean;
  onReleaseCreated?: (release: { tag_name: string; html_url: string }) => void;
}

export function ReleaseCreator({ githubUrl, defaultExpanded = false, onReleaseCreated }: ReleaseCreatorProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [loading, setLoading] = useState(false);
  const [tagName, setTagName] = useState("");
  const [releaseName, setReleaseName] = useState("");
  const [description, setDescription] = useState("");
  const [prerelease, setPrerelease] = useState(false);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [latestTag, setLatestTag] = useState<string | null>(null);
  const [fetchingLatest, setFetchingLatest] = useState(false);

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

  const parsed = useMemo(() => parseGitHubUrl(githubUrl), [githubUrl]);

  const fetchLatestRelease = useCallback(async () => {
    if (!parsed) return;

    setFetchingLatest(true);
    try {
      const response = await fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}/releases?latest=true`);

      if (response.ok) {
        const data = await response.json();
        if (data.data?.tag_name) {
          setLatestTag(data.data.tag_name);
          // Suggest next version
          const versionMatch = data.data.tag_name.match(/v?(\d+)\.(\d+)\.(\d+)/);
          if (versionMatch) {
            const [, major, minor, patch] = versionMatch;
            const nextVersion = `v${major}.${minor}.${parseInt(patch) + 1}`;
            if (!tagName) {
              setTagName(nextVersion);
              setReleaseName(nextVersion);
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch latest release:", err);
    } finally {
      setFetchingLatest(false);
    }
  }, [parsed, tagName]);

  const handleCreateRelease = async () => {
    if (!parsed || !tagName) {
      toast.error("Tag name is required");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}/releases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagName,
          name: releaseName || tagName,
          description: !autoGenerate ? description : undefined,
          prerelease,
          autoGenerateNotes: autoGenerate,
          previousTag: latestTag || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create release");
      }

      const data = await response.json();
      toast.success(`Release ${tagName} created successfully!`);

      // Reset form
      setTagName("");
      setReleaseName("");
      setDescription("");
      setLatestTag(tagName);

      if (onReleaseCreated && data.data) {
        onReleaseCreated({
          tag_name: data.data.tag_name,
          html_url: data.data.html_url,
        });
      }
    } catch (err) {
      console.error("Failed to create release:", err);
      toast.error(err instanceof Error ? err.message : "Failed to create release");
    } finally {
      setLoading(false);
    }
  };

  const suggestBumpVersion = (type: "patch" | "minor" | "major") => {
    const currentTag = latestTag || tagName || "v0.0.0";
    const versionMatch = currentTag.match(/v?(\d+)\.(\d+)\.(\d+)/);

    if (versionMatch) {
      let [, major, minor, patch] = versionMatch.map(Number);

      switch (type) {
        case "patch":
          patch++;
          break;
        case "minor":
          minor++;
          patch = 0;
          break;
        case "major":
          major++;
          minor = 0;
          patch = 0;
          break;
      }

      const newVersion = `v${major}.${minor}.${patch}`;
      setTagName(newVersion);
      setReleaseName(newVersion);
    }
  };

  if (!parsed) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle
            className="text-base flex items-center gap-2 cursor-pointer select-none"
            onClick={() => {
              setIsExpanded(!isExpanded);
              if (!isExpanded && !latestTag) {
                fetchLatestRelease();
              }
            }}
          >
            <Rocket className="h-4 w-4 text-primary" />
            Create Release
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </CardTitle>
          {latestTag && (
            <Badge variant="outline" className="text-xs">
              Latest: {latestTag}
            </Badge>
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
            <CardContent className="space-y-4 pt-0">
              {/* Version Bump Suggestions */}
              {latestTag && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Quick bump:</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => suggestBumpVersion("patch")}
                  >
                    Patch
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => suggestBumpVersion("minor")}
                  >
                    Minor
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => suggestBumpVersion("major")}
                  >
                    Major
                  </Button>
                </div>
              )}

              {/* Tag Name */}
              <div className="space-y-2">
                <Label htmlFor="tagName">Tag Name *</Label>
                <div className="flex gap-2">
                  <Input
                    id="tagName"
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    placeholder="v1.0.0"
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon" onClick={fetchLatestRelease} disabled={fetchingLatest}>
                    <RefreshCw className={`h-4 w-4 ${fetchingLatest ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>

              {/* Release Name */}
              <div className="space-y-2">
                <Label htmlFor="releaseName">Release Name</Label>
                <Input
                  id="releaseName"
                  value={releaseName}
                  onChange={(e) => setReleaseName(e.target.value)}
                  placeholder={tagName || "Release title"}
                />
              </div>

              {/* Auto Generate Toggle */}
              <button
                type="button"
                onClick={() => setAutoGenerate(!autoGenerate)}
                className={`flex items-center justify-between w-full rounded-lg border p-3 transition-colors ${autoGenerate ? "border-primary/50 bg-primary/10" : "border-border bg-secondary/20"}`}
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Auto-generate release notes</p>
                    <p className="text-xs text-muted-foreground">Create notes from commits since last release</p>
                  </div>
                </div>
                <div
                  className={`h-5 w-9 rounded-full transition-colors ${autoGenerate ? "bg-primary" : "bg-muted"} relative`}
                >
                  <div
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${autoGenerate ? "translate-x-4" : "translate-x-0.5"}`}
                  />
                </div>
              </button>

              {/* Manual Description */}
              {!autoGenerate && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <Label htmlFor="description">Release Notes</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What's new in this release..."
                    rows={4}
                    className="font-mono text-sm"
                  />
                </motion.div>
              )}

              {/* Pre-release Toggle */}
              <button
                type="button"
                onClick={() => setPrerelease(!prerelease)}
                className={`flex items-center justify-between w-full rounded-lg border p-3 transition-colors ${prerelease ? "border-warning/50 bg-warning/10" : "border-border"}`}
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Mark as pre-release</p>
                    <p className="text-xs text-muted-foreground">This is not production-ready</p>
                  </div>
                </div>
                <div
                  className={`h-5 w-9 rounded-full transition-colors ${prerelease ? "bg-warning" : "bg-muted"} relative`}
                >
                  <div
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${prerelease ? "translate-x-4" : "translate-x-0.5"}`}
                  />
                </div>
              </button>

              {/* Create Button */}
              <Button onClick={handleCreateRelease} disabled={!tagName || loading} className="w-full">
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Creating Release...
                  </>
                ) : (
                  <>
                    <Tag className="h-4 w-4 mr-2" />
                    Create Release {tagName && <span className="ml-1 font-mono">{tagName}</span>}
                  </>
                )}
              </Button>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
