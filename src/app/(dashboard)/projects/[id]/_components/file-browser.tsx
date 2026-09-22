"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, ExternalLink, File, FileCode, FileImage, FileJson, FileText, Folder, FolderTree, RefreshCw } from "lucide-react";
import { Button, Skeleton } from "@/components/ui";
import { CodePanel } from "./code-panel";

interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: "file" | "dir" | "symlink" | "submodule";
  html_url: string;
}

const CODE = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "go", "rs", "java", "c", "cpp", "h", "cs", "rb", "php", "sh", "css", "scss", "html", "vue", "svelte", "sql"]);
const DATA = new Set(["json", "yaml", "yml", "toml", "xml", "lock", "env"]);
const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "ico"]);
const TEXT = new Set(["md", "mdx", "txt", "rst"]);

function FileIcon({ name }: { name: string }) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  const Icon = CODE.has(extension) ? FileCode : DATA.has(extension) ? FileJson : IMAGE.has(extension) ? FileImage : TEXT.has(extension) ? FileText : File;
  return <Icon className="size-4 shrink-0 text-fg-4" strokeWidth={1.75} />;
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${parseFloat((bytes / 1024 ** index).toFixed(1))} ${units[index]}`;
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = /github\.com[/:]([^/]+)\/([^/?#]+)/.exec(url);
  return match ? { owner: match[1], repo: match[2].replace(/\.git$/, "") } : null;
}

/** The repository's files, one directory at a time. */
export function FileBrowser({ githubUrl }: { githubUrl: string }) {
  const parsed = useMemo(() => parseGitHubUrl(githubUrl), [githubUrl]);
  const [contents, setContents] = useState<GitHubContent[]>([]);
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(
    async (next: string) => {
      if (!parsed) return;
      setPath(next);
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}/contents?path=${encodeURIComponent(next)}`);
        if (!response.ok) {
          setError(response.status === 404 ? "This directory is not in the repository" : "GitHub did not answer");
          setContents([]);
          return;
        }
        const result = (await response.json()) as { data?: GitHubContent | GitHubContent[] };
        const items = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
        setContents([...items].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1)));
      } catch {
        setError("GitHub did not answer");
      } finally {
        setLoading(false);
      }
    },
    [parsed]
  );

  useEffect(() => {
    void open("");
  }, [open]);

  if (!parsed) return null;

  const parts = path.split("/").filter(Boolean);
  const treeUrl = `https://github.com/${parsed.owner}/${parsed.repo}/tree/HEAD/${path}`;

  return (
    <CodePanel
      title="Files"
      icon={FolderTree}
      actions={
        <>
          <Button variant="ghost" size="icon-sm" onClick={() => void open(path)} disabled={loading} aria-label="Refresh">
            <RefreshCw className={loading ? "animate-spin" : undefined} strokeWidth={1.75} />
          </Button>
          <Button variant="ghost" size="icon-sm" asChild>
            <a href={treeUrl} target="_blank" rel="noopener noreferrer" aria-label="Open on GitHub">
              <ExternalLink strokeWidth={1.75} />
            </a>
          </Button>
        </>
      }
    >
      <nav aria-label="Path" className="flex flex-wrap items-center gap-0.5 border-b border-line-subtle px-3.5 py-2 font-mono text-[12px]">
        <button type="button" onClick={() => void open("")} className="rounded-xs px-1 text-fg-2 hover:bg-white/[.04] hover:text-fg">
          {parsed.repo}
        </button>
        {parts.map((part, index) => (
          <span key={`${part}-${index}`} className="flex items-center gap-0.5">
            <ChevronRight className="size-3 text-fg-4" strokeWidth={1.75} />
            <button
              type="button"
              onClick={() => void open(parts.slice(0, index + 1).join("/"))}
              className={index === parts.length - 1 ? "rounded-xs px-1 text-fg" : "rounded-xs px-1 text-fg-2 hover:bg-white/[.04] hover:text-fg"}
            >
              {part}
            </button>
          </span>
        ))}
      </nav>

      {loading && contents.length === 0 ? (
        <div className="grid gap-2 p-3.5">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-5 w-full" />
          ))}
        </div>
      ) : error ? (
        <p className="p-3.5 text-[13px] text-fg-3">{error}</p>
      ) : contents.length === 0 ? (
        <p className="p-3.5 text-[13px] text-fg-3">Empty directory</p>
      ) : (
        <div className="max-h-[400px] overflow-y-auto py-1">
          {parts.length > 0 && (
            <button type="button" onClick={() => void open(parts.slice(0, -1).join("/"))} className="flex w-full items-center gap-2 px-3.5 py-1.5 text-left font-mono text-[12.5px] text-fg-3 hover:bg-white/[.03]">
              <Folder className="size-4 text-fg-4" strokeWidth={1.75} />
              ..
            </button>
          )}
          {contents.map((item) =>
            item.type === "dir" ? (
              <button key={item.sha} type="button" onClick={() => void open(item.path)} className="flex w-full items-center gap-2 px-3.5 py-1.5 text-left text-[13px] hover:bg-white/[.03]">
                <Folder className="size-4 shrink-0 text-fg-3" strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <ChevronRight className="size-3.5 text-fg-4" strokeWidth={1.75} />
              </button>
            ) : (
              <a key={item.sha} href={item.html_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3.5 py-1.5 text-[13px] text-fg-2 hover:bg-white/[.03] hover:text-fg">
                <FileIcon name={item.name} />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="font-mono text-[11px] tabular-nums text-fg-4">{formatFileSize(item.size)}</span>
              </a>
            )
          )}
        </div>
      )}
    </CodePanel>
  );
}
