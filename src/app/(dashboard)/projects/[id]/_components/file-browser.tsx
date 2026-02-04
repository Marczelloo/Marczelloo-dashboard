"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Folder,
  File,
  FileText,
  FileCode,
  FileImage,
  FileJson,
  ChevronRight,
  ChevronDown,
  Home,
  RefreshCw,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FileBrowserProps {
  githubUrl: string;
  defaultExpanded?: boolean;
}

interface GitHubContent {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number;
  sha: string;
  url: string;
  html_url: string;
  download_url: string | null;
  content?: string;
  encoding?: string;
}

// File type icons
const getFileIcon = (filename: string) => {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  const iconMap: Record<string, React.ReactNode> = {
    // Code files
    ts: <FileCode className="h-4 w-4 text-blue-400" />,
    tsx: <FileCode className="h-4 w-4 text-blue-400" />,
    js: <FileCode className="h-4 w-4 text-yellow-400" />,
    jsx: <FileCode className="h-4 w-4 text-yellow-400" />,
    py: <FileCode className="h-4 w-4 text-green-400" />,
    go: <FileCode className="h-4 w-4 text-cyan-400" />,
    rs: <FileCode className="h-4 w-4 text-orange-400" />,
    java: <FileCode className="h-4 w-4 text-red-400" />,
    c: <FileCode className="h-4 w-4 text-gray-400" />,
    cpp: <FileCode className="h-4 w-4 text-gray-400" />,
    h: <FileCode className="h-4 w-4 text-gray-400" />,
    css: <FileCode className="h-4 w-4 text-purple-400" />,
    scss: <FileCode className="h-4 w-4 text-pink-400" />,
    html: <FileCode className="h-4 w-4 text-orange-400" />,
    vue: <FileCode className="h-4 w-4 text-green-400" />,
    svelte: <FileCode className="h-4 w-4 text-orange-400" />,

    // Config files
    json: <FileJson className="h-4 w-4 text-yellow-400" />,
    yaml: <FileText className="h-4 w-4 text-red-400" />,
    yml: <FileText className="h-4 w-4 text-red-400" />,
    toml: <FileText className="h-4 w-4 text-gray-400" />,

    // Images
    png: <FileImage className="h-4 w-4 text-purple-400" />,
    jpg: <FileImage className="h-4 w-4 text-purple-400" />,
    jpeg: <FileImage className="h-4 w-4 text-purple-400" />,
    gif: <FileImage className="h-4 w-4 text-purple-400" />,
    svg: <FileImage className="h-4 w-4 text-orange-400" />,
    webp: <FileImage className="h-4 w-4 text-purple-400" />,
    ico: <FileImage className="h-4 w-4 text-purple-400" />,

    // Documents
    md: <FileText className="h-4 w-4 text-gray-300" />,
    txt: <FileText className="h-4 w-4 text-gray-400" />,
    pdf: <FileText className="h-4 w-4 text-red-400" />,
  };

  // Special files
  const specialFiles: Record<string, React.ReactNode> = {
    "package.json": <FileJson className="h-4 w-4 text-green-400" />,
    "tsconfig.json": <FileJson className="h-4 w-4 text-blue-400" />,
    "next.config.js": <FileCode className="h-4 w-4 text-white" />,
    "next.config.ts": <FileCode className="h-4 w-4 text-white" />,
    dockerfile: <FileText className="h-4 w-4 text-blue-400" />,
    "docker-compose.yml": <FileText className="h-4 w-4 text-blue-400" />,
    ".gitignore": <FileText className="h-4 w-4 text-gray-500" />,
    ".env": <FileText className="h-4 w-4 text-yellow-400" />,
    ".env.local": <FileText className="h-4 w-4 text-yellow-400" />,
    "readme.md": <FileText className="h-4 w-4 text-blue-300" />,
  };

  return specialFiles[filename.toLowerCase()] || iconMap[ext] || <File className="h-4 w-4 text-gray-400" />;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export function FileBrowser({ githubUrl, defaultExpanded = false }: FileBrowserProps) {
  const [contents, setContents] = useState<GitHubContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [currentPath, setCurrentPath] = useState("");
  const [pathHistory, setPathHistory] = useState<string[]>([]);

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

  const fetchContents = useCallback(
    async (path: string = "") => {
      if (!parsed) {
        setError("Invalid GitHub URL");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/github/repos/${parsed.owner}/${parsed.repo}/contents?path=${encodeURIComponent(path)}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            setError("Directory not found");
          } else {
            throw new Error("Failed to fetch contents");
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        if (data.data) {
          // Sort: directories first, then files alphabetically
          const sorted = Array.isArray(data.data)
            ? data.data.sort((a: GitHubContent, b: GitHubContent) => {
                if (a.type !== b.type) {
                  return a.type === "dir" ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
              })
            : [data.data];
          setContents(sorted);
        }
      } catch (err) {
        console.error("Failed to fetch contents:", err);
        setError("Failed to load files");
      } finally {
        setLoading(false);
      }
    },
    [parsed]
  );

  useEffect(() => {
    if (isExpanded && contents.length === 0 && !error) {
      fetchContents(currentPath);
    }
  }, [isExpanded, contents.length, error, fetchContents, currentPath]);

  const navigateTo = (path: string) => {
    setPathHistory([...pathHistory, currentPath]);
    setCurrentPath(path);
    setContents([]);
    fetchContents(path);
  };

  const navigateBack = () => {
    const previousPath = pathHistory[pathHistory.length - 1] || "";
    setPathHistory(pathHistory.slice(0, -1));
    setCurrentPath(previousPath);
    setContents([]);
    fetchContents(previousPath);
  };

  const navigateHome = () => {
    setPathHistory([]);
    setCurrentPath("");
    setContents([]);
    fetchContents("");
  };

  if (!parsed) {
    return null;
  }

  const pathParts = currentPath.split("/").filter(Boolean);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle
            className="text-base flex items-center gap-2 cursor-pointer select-none"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Folder className="h-4 w-4" />
            Files
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
                  fetchContents(currentPath);
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                <a
                  href={`https://github.com/${parsed.owner}/${parsed.repo}/tree/main/${currentPath}`}
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
              {/* Breadcrumb */}
              {currentPath && (
                <div className="flex items-center gap-1 text-sm mb-3 pb-3 border-b border-border overflow-x-auto">
                  <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={navigateHome}>
                    <Home className="h-3.5 w-3.5" />
                  </Button>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  {pathParts.map((part, index) => (
                    <div key={index} className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-xs"
                        onClick={() => {
                          const newPath = pathParts.slice(0, index + 1).join("/");
                          navigateTo(newPath);
                        }}
                      >
                        {part}
                      </Button>
                      {index < pathParts.length - 1 && (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Back button */}
              {currentPath && (
                <button
                  className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm rounded hover:bg-secondary/50 transition-colors mb-1"
                  onClick={navigateBack}
                >
                  <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">..</span>
                </button>
              )}

              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <Folder className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">{error}</p>
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => fetchContents(currentPath)}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Retry
                  </Button>
                </div>
              ) : contents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Empty directory</p>
              ) : (
                <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
                  {contents.map((item) => (
                    <div key={item.sha}>
                      {item.type === "dir" ? (
                        <button
                          className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm rounded hover:bg-secondary/50 transition-colors"
                          onClick={() => navigateTo(item.path)}
                        >
                          <Folder className="h-4 w-4 text-blue-400" />
                          <span className="truncate flex-1">{item.name}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      ) : (
                        <a
                          href={item.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm rounded hover:bg-secondary/50 transition-colors"
                        >
                          {getFileIcon(item.name)}
                          <span className="truncate flex-1">{item.name}</span>
                          <span className="text-xs text-muted-foreground">{formatFileSize(item.size)}</span>
                        </a>
                      )}
                    </div>
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
