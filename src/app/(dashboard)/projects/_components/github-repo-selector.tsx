"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Cloud,
  Code2,
  Container,
  GitBranch,
  Github,
  Globe,
  Loader2,
  Lock,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@/components/ui";
import { preflightDeploymentAction, provisionGitHubProjectAction } from "@/app/actions/projects";
import { slugify } from "@/lib/utils";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  stargazers_count: number;
  language: string | null;
  updated_at: string;
  topics: string[];
  default_branch: string;
  owner: { login: string; avatar_url: string };
}

type Runtime = "web" | "worker" | "bot" | "stack";
type Exposure = "internal" | "cloudflare";
type Preflight = {
  ok: boolean;
  repoState: string;
  composeFile: string | null;
  services: string[];
  profiles: string[];
  messages: Array<{ level: "success" | "warning" | "error"; text: string }>;
};

const PROJECTS_DIR = "/home/Marczelloo_pi/projects";

const languageColors: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  Dockerfile: "#384d54",
};

function technologiesFrom(repo: GitHubRepo) {
  const known: Record<string, string> = {
    nextjs: "Next.js", react: "React", typescript: "TypeScript", javascript: "JavaScript", docker: "Docker",
    python: "Python", nodejs: "Node.js", discord: "Discord", postgres: "PostgreSQL",
  };
  return [...new Set([repo.language, ...repo.topics.map((topic) => known[topic.toLowerCase()])].filter(Boolean) as string[])];
}

export function GitHubRepoSelector() {
  const router = useRouter();
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GitHubRepo | null>(null);
  const [branch, setBranch] = useState("main");
  const [repoPath, setRepoPath] = useState("");
  const [composeFile, setComposeFile] = useState("");
  const [composeProject, setComposeProject] = useState("");
  const [profiles, setProfiles] = useState("");
  const [runtime, setRuntime] = useState<Runtime>("web");
  const [exposure, setExposure] = useState<Exposure>("internal");
  const [hostname, setHostname] = useState("");
  const [localPort, setLocalPort] = useState("");
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [checking, setChecking] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  const fetchRepos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/github/repos?page=1&per_page=100");
      if (!response.ok) throw new Error(response.status === 503 ? "GitHub App is not configured" : "Failed to load repositories");
      const data = await response.json();
      setRepos(data.data || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load repositories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRepos(); }, [fetchRepos]);

  const filteredRepos = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return repos;
    return repos.filter((repo) => [repo.name, repo.full_name, repo.description || "", repo.language || "", ...repo.topics].some((value) => value.toLowerCase().includes(normalized)));
  }, [query, repos]);

  function chooseRepo(repo: GitHubRepo) {
    if (selected?.id === repo.id) {
      setSelected(null);
      setPreflight(null);
      return;
    }
    const slug = slugify(repo.name);
    setSelected(repo);
    setBranch(repo.default_branch || "main");
    setRepoPath(`${PROJECTS_DIR}/${slug}`);
    setComposeProject(slug);
    setComposeFile("");
    setProfiles("");
    setRuntime(repo.topics.some((topic) => /discord|bot/i.test(topic)) ? "bot" : "web");
    setExposure("internal");
    setHostname("");
    setLocalPort("");
    setPreflight(null);
  }

  function configInput() {
    if (!selected) return null;
    return {
      githubUrl: selected.html_url,
      branch,
      repoPath,
      composeFile: composeFile.trim() || null,
      composeProject,
      profiles: profiles.split(",").map((profile) => profile.trim()).filter(Boolean),
      runtime,
      exposure,
      hostname: hostname.trim() || undefined,
      localPort: localPort ? Number(localPort) : undefined,
    };
  }

  async function runPreflight() {
    const input = configInput();
    if (!input) return;
    setChecking(true);
    setPreflight(null);
    try {
      const result = await preflightDeploymentAction(input);
      if (!result.success || !result.data) {
        toast.error("Preflight nie przeszedł", { description: result.error });
        return;
      }
      setPreflight(result.data);
      if (result.data.composeFile && !composeFile) setComposeFile(result.data.composeFile);
      if (result.data.profiles.length && !profiles) setProfiles(result.data.profiles.join(", "));
      if (result.data.ok) toast.success("Preflight zakończony poprawnie");
      else toast.error("Preflight wykrył problem wymagający poprawy");
    } catch (reason) {
      toast.error("Nie udało się wykonać preflight", { description: reason instanceof Error ? reason.message : undefined });
    } finally {
      setChecking(false);
    }
  }

  async function provision() {
    const config = configInput();
    if (!selected || !config) return;
    setProvisioning(true);
    try {
      const result = await provisionGitHubProjectAction({
        name: selected.name,
        slug: slugify(selected.name),
        description: selected.description || undefined,
        tags: selected.topics.slice(0, 12),
        technologies: technologiesFrom(selected),
        ...config,
        deployNow: true,
      });
      if (!result.success || !result.data) {
        toast.error("Nie udało się przygotować projektu", { description: result.error });
        return;
      }
      toast.success(result.data.deployId ? "Projekt został utworzony, a deploy wystartował" : "Projekt został zapisany — popraw wskazane elementy preflight");
      router.push(`/projects/${result.data.projectId}`);
      router.refresh();
    } catch (reason) {
      toast.error("Nie udało się przygotować projektu", { description: reason instanceof Error ? reason.message : undefined });
    } finally {
      setProvisioning(false);
    }
  }

  if (error) {
    return <Card className="border-dashed"><CardContent className="flex flex-col items-center gap-4 py-12"><AlertTriangle className="h-10 w-10 text-warning" /><p className="text-sm text-muted-foreground">{error}</p><Button variant="outline" onClick={fetchRepos}><RefreshCw className="h-4 w-4" />Try again</Button></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Github className="h-5 w-5" /></div>
            <div><CardTitle>Deploy from GitHub</CardTitle><CardDescription>Jedna konfiguracja dla repozytorium, Docker Compose i publicznego adresu.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search repositories…" value={query} onChange={(event) => setQuery(event.target.value)} /></div></CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3"><CardTitle className="text-base">Repository</CardTitle><Button variant="ghost" size="sm" onClick={fetchRepos} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="space-y-0">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="flex gap-3 border-t p-4"><Skeleton className="h-9 w-9 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-2/3" /></div></div>)}</div> :
            filteredRepos.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground"><Code2 className="mx-auto mb-3 h-8 w-8 opacity-50" />No matching repositories</div> :
              <div className="max-h-[28rem] divide-y divide-border overflow-y-auto">{filteredRepos.map((repo) => <button key={repo.id} type="button" onClick={() => chooseRepo(repo)} className={`flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-secondary/50 ${selected?.id === repo.id ? "bg-primary/10" : ""}`}>
                <Image src={repo.owner.avatar_url} alt="" width={36} height={36} className="rounded-full" unoptimized />
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{repo.name}</span>{repo.private ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <Globe className="h-3.5 w-3.5 text-muted-foreground" />}</div>{repo.description && <p className="mt-1 truncate text-sm text-muted-foreground">{repo.description}</p>}<div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">{repo.language && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: languageColors[repo.language] || "#858585" }} />{repo.language}</span>}<span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" />{repo.stargazers_count}</span><span className="font-mono">{repo.default_branch}</span></div></div>
                <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected?.id === repo.id ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"}`}>{selected?.id === repo.id && <Check className="h-3 w-3" />}</span>
              </button>)}</div>}
        </CardContent>
      </Card>

      {selected && <Card className="border-primary/30">
        <CardHeader><CardTitle className="flex items-center gap-2"><Container className="h-4 w-4 text-primary" />Deployment plan</CardTitle><CardDescription>{selected.full_name} zostanie utrzymany jako repo Git i stack Docker Compose na Raspberry Pi.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Branch" icon={<GitBranch className="h-4 w-4" />}><Input value={branch} onChange={(event) => setBranch(event.target.value)} /></Field>
            <Field label="Compose project"><Input value={composeProject} onChange={(event) => setComposeProject(event.target.value)} /></Field>
            <Field label="Repository path" className="md:col-span-2"><Input className="font-mono text-xs" value={repoPath} onChange={(event) => setRepoPath(event.target.value)} /><p className="text-xs text-muted-foreground">Nowe repo zostanie sklonowane tutaj. Istniejący katalog musi być poprawnym repozytorium Git.</p></Field>
            <Field label="Compose file (optional)"><Input placeholder="Auto-detect: compose.yml" value={composeFile} onChange={(event) => setComposeFile(event.target.value)} /></Field>
            <Field label="Production profiles (optional)"><Input placeholder="api, production" value={profiles} onChange={(event) => setProfiles(event.target.value)} /><p className="text-xs text-muted-foreground">Tylko wybrane profile; `dev` nie jest uruchamiany automatycznie.</p></Field>
            <Field label="Runtime"><Select value={runtime} onValueChange={(value) => setRuntime(value as Runtime)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="web">Web application</SelectItem><SelectItem value="bot">Bot</SelectItem><SelectItem value="worker">Worker / background job</SelectItem><SelectItem value="stack">Multi-service stack</SelectItem></SelectContent></Select></Field>
            <Field label="Exposure"><Select value={exposure} onValueChange={(value) => setExposure(value as Exposure)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="internal">Internal only</SelectItem><SelectItem value="cloudflare">Cloudflare Tunnel</SelectItem></SelectContent></Select></Field>
          </div>

          {exposure === "cloudflare" && <div className="grid gap-4 rounded-lg border border-border/70 bg-secondary/20 p-4 md:grid-cols-2"><div className="md:col-span-2 flex items-start gap-3"><Cloud className="mt-0.5 h-4 w-4 text-primary" /><div><p className="text-sm font-medium">Cloudflare Tunnel route</p><p className="text-xs text-muted-foreground">Po udanym deployu dashboard doda ingress route i przeładuje cloudflared. Wymaga konfiguracji operatora na Pi.</p></div></div><Field label="Hostname"><Input placeholder="app.marczelloo.dev" value={hostname} onChange={(event) => setHostname(event.target.value)} /></Field><Field label="Local HTTP port"><Input inputMode="numeric" placeholder="3000" value={localPort} onChange={(event) => setLocalPort(event.target.value.replace(/\D/g, ""))} /></Field></div>}

          {preflight && <div className="rounded-lg border border-border/70 bg-background/50 p-4"><div className="mb-3 flex flex-wrap items-center gap-2"><ShieldCheck className={`h-4 w-4 ${preflight.ok ? "text-success" : "text-destructive"}`} /><p className="text-sm font-medium">Preflight {preflight.ok ? "passed" : "needs attention"}</p>{preflight.composeFile && <Badge variant="secondary" className="font-mono">{preflight.composeFile}</Badge>}{preflight.services.map((service) => <Badge key={service} variant="outline" className="font-mono">{service}</Badge>)}</div><div className="space-y-2">{preflight.messages.map((message, index) => <div key={`${message.text}-${index}`} className="flex gap-2 text-sm"><span className={message.level === "success" ? "text-success" : message.level === "warning" ? "text-warning" : "text-destructive"}>{message.level === "success" ? "✓" : message.level === "warning" ? "!" : "×"}</span><span className="text-muted-foreground">{message.text}</span></div>)}</div></div>}

          <div className="flex flex-wrap justify-end gap-3 border-t border-border/60 pt-5"><Button variant="outline" onClick={runPreflight} disabled={checking || provisioning}>{checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Run preflight</Button><Button onClick={provision} disabled={provisioning || checking}>{provisioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}Provision & deploy<ArrowRight className="h-4 w-4" /></Button></div>
        </CardContent>
      </Card>}
    </div>
  );
}

function Field({ label, icon, className, children }: { label: string; icon?: ReactNode; className?: string; children: ReactNode }) {
  return <div className={`space-y-2 ${className || ""}`}><Label className="flex items-center gap-2">{icon}{label}</Label>{children}</div>;
}
