"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button, Skeleton } from "@/components/ui";
import { FileText, ExternalLink, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodePanel } from "./code-panel";

interface ReadmeViewerProps {
  githubUrl: string;
  maxHeight?: number;
}

interface ReadmeData {
  content: string;
  path: string;
  html_url: string;
}

export function ReadmeViewer({ githubUrl, maxHeight = 520 }: ReadmeViewerProps) {
  const [readme, setReadme] = useState<ReadmeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullExpanded, setIsFullExpanded] = useState(false);

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

  const fetchReadme = useCallback(async () => {
    if (!parsed) {
      setError("Invalid GitHub URL");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}/contents?path=README.md`);

      if (!response.ok) {
        // Try lowercase readme.md
        const response2 = await fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}/contents?path=readme.md`);

        if (!response2.ok) {
          if (response2.status === 404) {
            setError("No README found");
          } else {
            throw new Error("Failed to fetch README");
          }
          setLoading(false);
          return;
        }

        const data2 = await response2.json();
        if (data2.data?.content) {
          // Decode base64 content
          const content = atob(data2.data.content.replace(/\n/g, ""));
          setReadme({
            content,
            path: data2.data.path,
            html_url: data2.data.html_url,
          });
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (data.data?.content) {
        // Decode base64 content
        const content = atob(data.data.content.replace(/\n/g, ""));
        setReadme({
          content,
          path: data.data.path,
          html_url: data.data.html_url,
        });
      }
    } catch (err) {
      console.error("Failed to fetch README:", err);
      setError("Failed to load README");
    } finally {
      setLoading(false);
    }
  }, [parsed]);

  useEffect(() => {
    void fetchReadme();
  }, [fetchReadme]);

  if (!parsed) {
    return null;
  }

  const long = (readme?.content.length ?? 0) > 1200;

  return (
    <CodePanel
      title="README"
      icon={FileText}
      description={readme?.path}
      actions={
        readme && (
          <Button variant="ghost" size="icon-sm" asChild>
            <a href={readme.html_url} target="_blank" rel="noopener noreferrer" aria-label="Open on GitHub">
              <ExternalLink strokeWidth={1.75} />
            </a>
          </Button>
        )
      }
    >
      <div className="p-3.5 md:px-5">
        {loading ? (
          <div className="grid gap-2.5">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 text-[13px] text-fg-3">
            {error}
            <Button variant="ghost" size="sm" onClick={() => void fetchReadme()}>
              <RefreshCw strokeWidth={1.75} />
              Retry
            </Button>
          </div>
        ) : readme ? (
          <>
            <div
              className="overflow-hidden"
              style={{
                maxHeight: long && !isFullExpanded ? `${maxHeight}px` : "none",
                maskImage: long && !isFullExpanded ? "linear-gradient(to bottom, black 75%, transparent)" : undefined,
                WebkitMaskImage: long && !isFullExpanded ? "linear-gradient(to bottom, black 75%, transparent)" : undefined,
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN}>
                {readme.content}
              </ReactMarkdown>
            </div>
            {long && (
              <div className="flex justify-center pt-2">
                <Button variant="ghost" size="sm" onClick={() => setIsFullExpanded((value) => !value)}>
                  {isFullExpanded ? <ChevronUp strokeWidth={1.75} /> : <ChevronDown strokeWidth={1.75} />}
                  {isFullExpanded ? "Show less" : "Show all"}
                </Button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </CodePanel>
  );
}

/** Markdown rendered in the app's own type and colours. */
const MARKDOWN: Components = {
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-fg underline decoration-line-strong underline-offset-[3px] hover:decoration-fg-3">
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) =>
    className ? (
      <code className={`${className} block overflow-x-auto p-3 font-mono text-[12px] leading-relaxed text-fg-2`} {...props}>
        {children}
      </code>
    ) : (
      <code className="rounded-xs bg-white/[.05] px-1 py-px font-mono text-[12px] text-fg" {...props}>
        {children}
      </code>
    ),
  pre: ({ children }) => <pre className="my-3 overflow-x-auto rounded-md border border-line bg-canvas">{children}</pre>,
  h1: ({ children }) => <h1 className="mb-2 mt-5 text-[18px] font-semibold tracking-[-0.01em] text-fg first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-5 border-b border-line-subtle pb-1.5 text-[15px] font-semibold text-fg first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-4 text-[13.5px] font-semibold text-fg">{children}</h3>,
  ul: ({ children }) => <ul className="my-2 grid gap-1 pl-5 text-[13px] text-fg-2 [&>li]:list-disc [&>li]:marker:text-fg-4">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 grid gap-1 pl-5 text-[13px] text-fg-2 [&>li]:list-decimal [&>li]:marker:text-fg-4">{children}</ol>,
  p: ({ children }) => <p className="my-2 text-[13px] leading-relaxed text-fg-2">{children}</p>,
  blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-line-strong pl-3 text-fg-3">{children}</blockquote>,
  // eslint-disable-next-line @next/next/no-img-element
  img: ({ src, alt }) => <img src={typeof src === "string" ? src : undefined} alt={alt || ""} className="my-3 h-auto max-w-full rounded-md" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-md border border-line">
      <table className="min-w-full text-[12.5px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-line bg-white/[.02] px-3 py-2 text-left font-medium text-fg-2">{children}</th>,
  td: ({ children }) => <td className="border-b border-line-subtle px-3 py-2 text-fg-2">{children}</td>,
  hr: () => <hr className="my-4 border-line" />,
};
