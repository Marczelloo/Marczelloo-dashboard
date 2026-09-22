"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Copy, Download, ScrollText, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from "@/components/ui";
import { CodePanel } from "./code-panel";

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
}

const START = "__start__";

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = /github\.com[/:]([^/]+)\/([^/?#]+)/.exec(url);
  return match ? { owner: match[1], repo: match[2].replace(/\.git$/, "") } : null;
}

/** Release notes between two releases joined into one file, newest last. */
function fromReleaseBodies(releases: GitHubRelease[], from: string, to: string): string {
  const toIndex = releases.findIndex((release) => release.tag_name === to);
  const fromIndex = from === START ? releases.length : releases.findIndex((release) => release.tag_name === from);
  if (toIndex < 0) return "";
  return releases
    .slice(toIndex, Math.max(fromIndex, toIndex + 1))
    .reverse()
    .filter((release) => release.body)
    .map((release) => `## ${release.tag_name}\n\n${release.body.trim()}`)
    .join("\n\n");
}

/** What changed between two releases, ready to paste or save as CHANGELOG.md. */
export function ChangelogViewer({ githubUrl }: { githubUrl: string }) {
  const parsed = useMemo(() => parseGitHubUrl(githubUrl), [githubUrl]);
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(START);
  const [to, setTo] = useState("");
  const [changelog, setChangelog] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!parsed) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}/releases?per_page=20`);
      const result = (await response.json().catch(() => ({}))) as { data?: GitHubRelease[] };
      const list = response.ok && Array.isArray(result.data) ? result.data : [];
      setReleases(list);
      if (list[0]) setTo(list[0].tag_name);
      if (list[1]) setFrom(list[1].tag_name);
    } finally {
      setLoading(false);
    }
  }, [parsed]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    if (!parsed || !to) return;
    setGenerating(true);
    const title = `# ${from === START ? "Start" : from} → ${to}\n\n`;
    try {
      // GitHub writes the notes from merged pull requests; nothing is created by asking.
      const response = await fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}/releases/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagName: to, previousTag: from === START ? undefined : from }),
      });
      const result = (await response.json().catch(() => ({}))) as { data?: { body?: string } };
      setChangelog(title + (response.ok && result.data?.body ? result.data.body : fromReleaseBodies(releases, from, to)));
    } catch {
      setChangelog(title + fromReleaseBodies(releases, from, to));
    } finally {
      setGenerating(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(changelog);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // The text stays on screen to select by hand.
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([changelog], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `CHANGELOG-${from === START ? "start" : from}-${to}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!parsed) return null;

  return (
    <CodePanel title="Changelog" icon={ScrollText} description={releases.length ? `${releases.length} releases` : undefined}>
      {loading ? (
        <div className="p-3.5">
          <Skeleton className="h-8 w-full" />
        </div>
      ) : releases.length === 0 ? (
        <p className="p-3.5 text-[13px] text-fg-3">No releases yet. Tag one from the Deployments tab.</p>
      ) : (
        <div className="grid gap-3 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger className="h-8 w-[130px]" aria-label="From release">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={START}>Start</SelectItem>
                {releases.map((release) => (
                  <SelectItem key={release.id} value={release.tag_name}>
                    {release.tag_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ArrowRight className="size-3.5 text-fg-4" strokeWidth={1.75} />
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger className="h-8 w-[130px]" aria-label="To release">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {releases.map((release) => (
                  <SelectItem key={release.id} value={release.tag_name}>
                    {release.tag_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="secondary" size="sm" onClick={() => void generate()} loading={generating} disabled={!to} className="ml-auto">
              {!generating && <Sparkles strokeWidth={1.75} />}
              Generate
            </Button>
          </div>

          {changelog && (
            <div className="overflow-hidden rounded-md border border-line bg-canvas">
              <div className="flex items-center justify-end gap-1 border-b border-line-subtle px-1.5 py-1">
                <Button variant="ghost" size="sm" onClick={() => void copy()}>
                  {copied ? <Check strokeWidth={1.75} /> : <Copy strokeWidth={1.75} />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button variant="ghost" size="sm" onClick={download}>
                  <Download strokeWidth={1.75} />
                  .md
                </Button>
              </div>
              <div className="max-h-[360px] overflow-y-auto px-3.5 py-2 text-[13px] leading-relaxed text-fg-2 [&_h1]:mb-2 [&_h1]:text-[14px] [&_h1]:font-semibold [&_h1]:text-fg [&_h2]:mb-1 [&_h2]:mt-3 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:text-fg [&_li]:ml-4 [&_li]:list-disc [&_p]:my-1.5 [&_a]:underline [&_a]:decoration-line-strong">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{changelog}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </CodePanel>
  );
}
