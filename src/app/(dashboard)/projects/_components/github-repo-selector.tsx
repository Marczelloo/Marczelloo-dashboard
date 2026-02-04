"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Skeleton,
  Badge,
} from "@/components/ui";
import { createProjectAction } from "@/app/actions/projects";
import { slugify } from "@/lib/utils";
import {
  Github,
  Star,
  GitFork,
  Lock,
  Globe,
  Search,
  RefreshCw,
  Check,
  ArrowRight,
  Sparkles,
  Code2,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  fork: boolean;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  updated_at: string;
  topics: string[];
  default_branch: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

const languageColors: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  Java: "#b07219",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  Vue: "#41b883",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Shell: "#89e051",
  Dockerfile: "#384d54",
};

export function GitHubRepoSelector() {
  const router = useRouter();
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchRepos = useCallback(async (pageNum: number, append = false) => {
    try {
      if (!append) setLoading(true);
      setError(null);

      const response = await fetch(`/api/github/repos?page=${pageNum}&per_page=30`);

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error("GitHub App not configured");
        }
        throw new Error("Failed to fetch repositories");
      }

      const data = await response.json();
      const repoList = data.data || [];

      if (append) {
        setRepos((prev) => [...prev, ...repoList]);
      } else {
        setRepos(repoList);
      }

      setHasMore(repoList.length === 30);
      setPage(pageNum);
    } catch (err) {
      console.error("Failed to fetch repos:", err);
      setError(err instanceof Error ? err.message : "Failed to load repositories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRepos(1);
  }, [fetchRepos]);

  const filteredRepos = repos.filter((repo) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      repo.name.toLowerCase().includes(query) ||
      repo.full_name.toLowerCase().includes(query) ||
      repo.description?.toLowerCase().includes(query) ||
      repo.topics.some((t) => t.toLowerCase().includes(query)) ||
      repo.language?.toLowerCase().includes(query)
    );
  });

  const handleCreateProject = async () => {
    if (!selectedRepo) return;

    setCreating(true);
    try {
      // Detect technologies from language and topics
      const technologies: string[] = [];
      if (selectedRepo.language) {
        technologies.push(selectedRepo.language.toLowerCase());
      }

      // Add common mappings from topics
      const topicToTech: Record<string, string> = {
        nextjs: "Next.js",
        "next-js": "Next.js",
        react: "React",
        typescript: "TypeScript",
        javascript: "JavaScript",
        tailwindcss: "Tailwind CSS",
        tailwind: "Tailwind CSS",
        docker: "Docker",
        nodejs: "Node.js",
        python: "Python",
        rust: "Rust",
        golang: "Go",
        vue: "Vue.js",
        angular: "Angular",
        svelte: "Svelte",
        prisma: "Prisma",
        drizzle: "Drizzle",
        postgresql: "PostgreSQL",
        mongodb: "MongoDB",
        redis: "Redis",
      };

      selectedRepo.topics.forEach((topic) => {
        const tech = topicToTech[topic.toLowerCase()];
        if (tech && !technologies.includes(tech.toLowerCase())) {
          technologies.push(tech);
        }
      });

      const projectData = {
        name: selectedRepo.name,
        slug: slugify(selectedRepo.name),
        description: selectedRepo.description || undefined,
        status: "active" as const,
        tags: selectedRepo.topics.slice(0, 5),
        technologies: technologies.slice(0, 10),
        github_url: selectedRepo.html_url,
      };

      const result = await createProjectAction(projectData);

      if (!result.success) {
        toast.error(result.error || "Failed to create project");
        return;
      }

      toast.success(`Project "${selectedRepo.name}" created successfully!`);
      router.push(`/projects/${result.data?.id}`);
      router.refresh();
    } catch (err) {
      console.error("Failed to create project:", err);
      toast.error("Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  if (error) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-warning mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => fetchRepos(1)} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Github className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Import from GitHub
                <Sparkles className="h-4 w-4 text-primary" />
              </CardTitle>
              <CardDescription>Select a repository to create a project with auto-detected settings</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/50"
            />
          </div>
        </CardContent>
      </Card>

      {/* Selected Repo Preview */}
      <AnimatePresence>
        {selectedRepo && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Card className="border-primary bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Check className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{selectedRepo.name}</p>
                      <p className="text-sm text-muted-foreground">Ready to import as project</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => setSelectedRepo(null)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateProject} disabled={creating}>
                      {creating ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          Create Project
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Repository List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base">
            Your Repositories
            {!loading && <span className="ml-2 text-muted-foreground font-normal">({filteredRepos.length})</span>}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => fetchRepos(1)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading && repos.length === 0 ? (
            <div className="space-y-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border-b border-border last:border-b-0">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Code2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? "No repositories match your search" : "No repositories found"}
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {filteredRepos.map((repo, index) => (
                  <motion.div
                    key={repo.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(index * 0.02, 0.3) }}
                  >
                    <button
                      onClick={() => setSelectedRepo(selectedRepo?.id === repo.id ? null : repo)}
                      className={`w-full text-left p-4 transition-colors hover:bg-secondary/50 ${
                        selectedRepo?.id === repo.id ? "bg-primary/10" : ""
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <Image
                          src={repo.owner.avatar_url}
                          alt={repo.owner.login}
                          width={40}
                          height={40}
                          className="rounded-full"
                          unoptimized
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{repo.name}</span>
                            {repo.private ? (
                              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            {repo.fork && (
                              <Badge variant="outline" className="text-xs">
                                Fork
                              </Badge>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{repo.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {repo.language && (
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{
                                    backgroundColor: languageColors[repo.language] || "#858585",
                                  }}
                                />
                                {repo.language}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Star className="h-3.5 w-3.5" />
                              {repo.stargazers_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <GitFork className="h-3.5 w-3.5" />
                              {repo.forks_count}
                            </span>
                            <span>Updated {formatDate(repo.updated_at)}</span>
                          </div>
                          {repo.topics.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {repo.topics.slice(0, 4).map((topic) => (
                                <Badge key={topic} variant="secondary" className="text-xs px-1.5 py-0 font-normal">
                                  {topic}
                                </Badge>
                              ))}
                              {repo.topics.length > 4 && (
                                <Badge variant="secondary" className="text-xs px-1.5 py-0 font-normal">
                                  +{repo.topics.length - 4}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <div
                          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            selectedRepo?.id === repo.id ? "border-primary bg-primary" : "border-muted-foreground/30"
                          }`}
                        >
                          {selectedRepo?.id === repo.id && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      </div>
                    </button>
                  </motion.div>
                ))}
              </div>

              {hasMore && (
                <div className="p-4 border-t border-border">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => fetchRepos(page + 1, true)}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load More Repositories"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
