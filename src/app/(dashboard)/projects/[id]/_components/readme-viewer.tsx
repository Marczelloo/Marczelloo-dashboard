"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ExternalLink, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ReadmeViewerProps {
  githubUrl: string;
  defaultExpanded?: boolean;
  maxHeight?: number;
}

interface ReadmeData {
  content: string;
  path: string;
  html_url: string;
}

export function ReadmeViewer({ githubUrl, defaultExpanded = false, maxHeight = 400 }: ReadmeViewerProps) {
  const [readme, setReadme] = useState<ReadmeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
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
    if (isExpanded && !readme && !error) {
      fetchReadme();
    }
  }, [isExpanded, readme, error, fetchReadme]);

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
            <FileText className="h-4 w-4" />
            README
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </CardTitle>
          {readme && (
            <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
              <a href={readme.html_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
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
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">{error}</p>
                  <Button variant="ghost" size="sm" className="mt-2" onClick={fetchReadme}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Retry
                  </Button>
                </div>
              ) : readme ? (
                <div className="relative">
                  <div
                    className={`prose prose-sm prose-invert max-w-none overflow-hidden transition-all duration-300 ${
                      isFullExpanded ? "" : ""
                    }`}
                    style={{
                      maxHeight: isFullExpanded ? "none" : `${maxHeight}px`,
                      maskImage:
                        !isFullExpanded && readme.content.length > 500
                          ? "linear-gradient(to bottom, black 80%, transparent 100%)"
                          : undefined,
                      WebkitMaskImage:
                        !isFullExpanded && readme.content.length > 500
                          ? "linear-gradient(to bottom, black 80%, transparent 100%)"
                          : undefined,
                    }}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Style links
                        a: ({ children, href }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-red-400 hover:text-red-300 underline"
                          >
                            {children}
                          </a>
                        ),
                        // Style code blocks
                        code: ({ className, children, ...props }) => {
                          const isInline = !className;
                          if (isInline) {
                            return (
                              <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                                {children}
                              </code>
                            );
                          }
                          return (
                            <code
                              className={`${className} block bg-muted p-3 rounded-md text-sm font-mono overflow-x-auto`}
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                        // Style pre blocks
                        pre: ({ children }) => (
                          <pre className="bg-muted rounded-md overflow-x-auto my-3">{children}</pre>
                        ),
                        // Style headings
                        h1: ({ children }) => (
                          <h1 className="text-xl font-bold text-foreground mb-3 mt-4 first:mt-0">{children}</h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-lg font-semibold text-foreground mb-2 mt-4">{children}</h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-base font-semibold text-foreground mb-2 mt-3">{children}</h3>
                        ),
                        // Style lists
                        ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                        // Style paragraphs
                        p: ({ children }) => <p className="text-muted-foreground leading-relaxed my-2">{children}</p>,
                        // Style blockquotes
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-2 border-red-500/50 pl-4 my-3 italic text-muted-foreground">
                            {children}
                          </blockquote>
                        ),
                        // Style images - using img for external GitHub images
                        img: ({ src, alt }) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt={alt || ""} className="max-w-full h-auto rounded-md my-3" />
                        ),
                        // Style tables
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-3">
                            <table className="min-w-full divide-y divide-border">{children}</table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="px-3 py-2 text-sm text-foreground border-b border-border">{children}</td>
                        ),
                        // Style horizontal rules
                        hr: () => <hr className="border-border my-4" />,
                      }}
                    >
                      {readme.content}
                    </ReactMarkdown>
                  </div>

                  {readme.content.length > 500 && (
                    <div className="flex justify-center pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsFullExpanded(!isFullExpanded)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {isFullExpanded ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-1" />
                            Show Less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-1" />
                            Show More
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
