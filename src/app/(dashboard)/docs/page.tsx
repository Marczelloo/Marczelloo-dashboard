"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { PageInfoButton } from "@/components/layout/page-info-button";
import { PAGE_INFO } from "@/lib/page-info";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from "@/components/ui";
import {
  Database,
  Container,
  Play,
  Shield,
  Globe,
  Key,
  Terminal,
  Server,
  Webhook,
  CheckCircle,
  AlertTriangle,
  FolderPlus,
  Layers,
  ClipboardList,
  Package,
  Settings,
  Clock,
  Network,
  List,
  Github,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  BookOpen,
  Rocket,
  FileText,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface DocSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface DocCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  sections: DocSection[];
}

// ============================================================================
// Documentation Structure
// ============================================================================

const DOC_CATEGORIES: DocCategory[] = [
  {
    id: "getting-started",
    label: "Getting Started",
    icon: Rocket,
    sections: [
      { id: "overview", title: "Overview", icon: Globe },
      { id: "quick-start", title: "Quick Start", icon: CheckCircle },
      { id: "docker-deployment", title: "Docker Deployment", icon: Package },
    ],
  },
  {
    id: "setup",
    label: "Setup & Configuration",
    icon: Settings,
    sections: [
      { id: "atlashub", title: "AtlasHub (Database)", icon: Database },
      { id: "portainer", title: "Portainer (Docker)", icon: Container },
      { id: "runner", title: "Runner (Deployments)", icon: Play },
      { id: "auth", title: "Authentication", icon: Shield },
    ],
  },
  {
    id: "features",
    label: "Features",
    icon: Layers,
    sections: [
      { id: "projects", title: "Projects", icon: FolderPlus },
      { id: "services", title: "Services", icon: Layers },
      { id: "work-items", title: "Work Items", icon: ClipboardList },
      { id: "github", title: "GitHub Integration", icon: Github },
      { id: "monitoring", title: "Monitoring", icon: Server },
      { id: "notifications", title: "Notifications", icon: Webhook },
    ],
  },
  {
    id: "reference",
    label: "Reference",
    icon: FileText,
    sections: [
      { id: "env-vars", title: "Environment Variables", icon: Key },
      { id: "settings-page", title: "Settings Dashboard", icon: Settings },
      { id: "troubleshooting", title: "Troubleshooting", icon: Terminal },
    ],
  },
];

// ============================================================================
// Components
// ============================================================================

function Section({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm prose-invert max-w-none">{children}</CardContent>
      </Card>
    </section>
  );
}

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="mb-4">
      {title && <p className="text-xs text-muted-foreground mb-1">{title}</p>}
      <pre className="bg-secondary/50 rounded-lg p-4 overflow-x-auto text-sm font-mono">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function EnvVar({
  name,
  description,
  example,
  required = true,
}: {
  name: string;
  description: string;
  example: string;
  required?: boolean;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center gap-2 mb-1">
        <code className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm font-mono">{name}</code>
        {required ? (
          <span className="text-xs text-destructive">Required</span>
        ) : (
          <span className="text-xs text-muted-foreground">Optional</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-1">{description}</p>
      <code className="text-xs text-muted-foreground">{example}</code>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function DocsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    "getting-started": true,
    setup: true,
    features: true,
    reference: true,
  });
  const [activeSection, setActiveSection] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  // Filter sections by search query
  const filteredCategories = DOC_CATEGORIES.map((category) => ({
    ...category,
    sections: category.sections.filter(
      (section) =>
        section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        category.label.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((cat) => cat.sections.length > 0);

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return;

      const sections = contentRef.current.querySelectorAll("section[id]");
      let currentSection = activeSection;

      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= 150) {
          currentSection = section.id;
        }
      });

      if (currentSection !== activeSection) {
        setActiveSection(currentSection);
      }
    };

    const container = contentRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [activeSection]);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="sticky top-0 h-screen border-r border-border/50 bg-card/50 overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-semibold">Documentation</h2>
              </div>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search docs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary/50 border border-border/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-3">
              {filteredCategories.map((category) => {
                const CategoryIcon = category.icon;
                const isExpanded = expandedCategories[category.id];

                return (
                  <div key={category.id} className="mb-2">
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <CategoryIcon className="h-4 w-4" />
                        {category.label}
                      </span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded ? "rotate-180" : "")} />
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="ml-4 pl-3 border-l border-border/50 py-1">
                            {category.sections.map((section) => {
                              const SectionIcon = section.icon;
                              const isActive = activeSection === section.id;

                              return (
                                <button
                                  key={section.id}
                                  onClick={() => scrollToSection(section.id)}
                                  className={cn(
                                    "flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm transition-colors",
                                    isActive
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                                  )}
                                >
                                  <SectionIcon className="h-3.5 w-3.5" />
                                  {section.title}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </nav>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="shrink-0 border-b border-border/50 bg-card/30 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Documentation</h1>
              <p className="text-xs text-muted-foreground">Setup guides and reference for Marczelloo Dashboard</p>
            </div>
          </div>
          <PageInfoButton {...PAGE_INFO.docs} />
        </header>

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Getting Started */}
            <Section id="overview" title="Overview" icon={Globe}>
              <p className="text-muted-foreground mb-4">
                Marczelloo Dashboard is a self-hosted project management panel designed for managing Docker containers,
                monitoring websites, and tracking project deployments on your Raspberry Pi infrastructure.
              </p>

              <h4 className="font-semibold mt-4 mb-2">Architecture</h4>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li>
                  <strong>Dashboard</strong> — Next.js web app (port 3100)
                </li>
                <li>
                  <strong>Runner</strong> — Local service for git/Docker operations (port 8787)
                </li>
                <li>
                  <strong>Portainer</strong> — Docker container management UI (port 9200)
                </li>
                <li>
                  <strong>AtlasHub</strong> — Database API for persistent storage
                </li>
              </ul>
            </Section>

            <Section id="quick-start" title="Quick Start Checklist" icon={CheckCircle}>
              <h4 className="font-semibold mb-3">Docker Deployment (Recommended)</h4>
              <ol className="text-muted-foreground space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <Badge className="shrink-0">1</Badge>
                  <span>
                    Clone the repository and copy <code>.env.example</code> to <code>.env</code>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge className="shrink-0">2</Badge>
                  <span>
                    Set required env vars: <code>ATLASHUB_API_URL</code>, <code>ATLASHUB_SECRET_KEY</code>,{" "}
                    <code>RUNNER_TOKEN</code>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge className="shrink-0">3</Badge>
                  <span>
                    Run <code>docker-compose up -d --build</code>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge className="shrink-0">4</Badge>
                  <span>
                    Open Portainer at <code>http://localhost:9200</code> and create admin account
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge className="shrink-0">5</Badge>
                  <span>
                    Get Portainer JWT token and add <code>PORTAINER_TOKEN</code> to <code>.env</code>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge className="shrink-0">6</Badge>
                  <span>
                    Restart dashboard: <code>docker-compose restart dashboard</code>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge className="shrink-0">7</Badge>
                  <span>
                    Open dashboard at <code>http://localhost:3100</code>
                  </span>
                </li>
              </ol>
            </Section>

            <Section id="docker-deployment" title="Docker Deployment" icon={Package}>
              <p className="text-muted-foreground mb-4">
                The entire stack can be deployed with a single Docker Compose command.
              </p>

              <h4 className="font-semibold mt-4 mb-2">Quick Start</h4>
              <CodeBlock title="Start all services">
                {`# Clone the repository
git clone https://github.com/yourusername/marczelloo-dashboard.git
cd marczelloo-dashboard

# Configure environment
cp .env.example .env

# Start everything
docker-compose up -d --build`}
              </CodeBlock>

              <h4 className="font-semibold mt-4 mb-2">Services Started</h4>
              <ul className="text-muted-foreground space-y-2 text-sm">
                <li className="flex gap-2">
                  <code className="bg-primary/20 text-primary px-2 py-0.5 rounded shrink-0">dashboard</code>
                  <span>— Web UI on port 3100</span>
                </li>
                <li className="flex gap-2">
                  <code className="bg-primary/20 text-primary px-2 py-0.5 rounded shrink-0">runner</code>
                  <span>— Deploy service on port 8787 (internal only)</span>
                </li>
                <li className="flex gap-2">
                  <code className="bg-primary/20 text-primary px-2 py-0.5 rounded shrink-0">portainer</code>
                  <span>— Docker management on port 9200</span>
                </li>
              </ul>

              <h4 className="font-semibold mt-4 mb-2">Common Commands</h4>
              <CodeBlock>
                {`# View logs
docker-compose logs -f dashboard

# Restart a service
docker-compose restart runner

# Rebuild after code changes
docker-compose up -d --build dashboard

# Stop everything
docker-compose down`}
              </CodeBlock>
            </Section>

            {/* Setup sections */}
            <Section id="atlashub" title="AtlasHub (Database)" icon={Database}>
              <p className="text-muted-foreground mb-4">AtlasHub is the primary data store for all dashboard data.</p>

              <h4 className="font-semibold mt-4 mb-2">Connection</h4>
              <CodeBlock>
                {`ATLASHUB_API_URL=https://api-atlashub.marczelloo.dev
ATLASHUB_SECRET_KEY=sk_your_secret_key_here`}
              </CodeBlock>

              <h4 className="font-semibold mt-4 mb-2">Tables Used</h4>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li>
                  <code className="bg-secondary px-1 rounded">projects</code> — Your projects and metadata
                </li>
                <li>
                  <code className="bg-secondary px-1 rounded">services</code> — Docker/Vercel/external services
                </li>
                <li>
                  <code className="bg-secondary px-1 rounded">work_items</code> — Tasks and issues
                </li>
                <li>
                  <code className="bg-secondary px-1 rounded">env_vars</code> — Encrypted environment variables
                </li>
                <li>
                  <code className="bg-secondary px-1 rounded">deploys</code> — Deployment history
                </li>
                <li>
                  <code className="bg-secondary px-1 rounded">uptime_checks</code> — Monitoring history
                </li>
                <li>
                  <code className="bg-secondary px-1 rounded">audit_logs</code> — Security audit trail
                </li>
              </ul>
            </Section>

            <Section id="portainer" title="Portainer (Docker Management)" icon={Container}>
              <p className="text-muted-foreground mb-4">Portainer provides the API for managing Docker containers.</p>

              <h4 className="font-semibold mt-4 mb-2">Connection</h4>
              <CodeBlock>
                {`PORTAINER_URL=http://localhost:9000
PORTAINER_USERNAME=admin
PORTAINER_PASSWORD=your_password_here`}
              </CodeBlock>

              <h4 className="font-semibold mt-4 mb-2">Features Available</h4>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li>View running containers and their status</li>
                <li>Start/Stop/Restart containers</li>
                <li>View container logs (tail)</li>
                <li>Recreate containers from updated images</li>
                <li>Manage Docker Compose stacks</li>
              </ul>
            </Section>

            <Section id="runner" title="Runner (Deploy Service)" icon={Play}>
              <p className="text-muted-foreground mb-4">
                The Runner handles git operations and Docker rebuilds with an allowlist for security.
              </p>

              <h4 className="font-semibold mt-4 mb-2">Connection</h4>
              <CodeBlock>
                {`RUNNER_URL=http://runner:8787
RUNNER_TOKEN=your_secure_runner_token`}
              </CodeBlock>

              <h4 className="font-semibold mt-4 mb-2">Security</h4>
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-warning mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <strong className="text-sm">Important Security Note</strong>
                </div>
                <p className="text-sm text-muted-foreground">
                  The Runner uses an allowlist to restrict operations. Only pre-configured paths can be used.
                </p>
              </div>

              <h4 className="font-semibold mt-4 mb-2">Available Operations</h4>
              <ul className="text-muted-foreground space-y-2 text-sm">
                <li>
                  <code className="bg-secondary px-1 rounded">pull</code> — Run <code>git pull</code>
                </li>
                <li>
                  <code className="bg-secondary px-1 rounded">rebuild</code> — Run{" "}
                  <code>docker compose up -d --build</code>
                </li>
                <li>
                  <code className="bg-secondary px-1 rounded">restart</code> — Run <code>docker compose restart</code>
                </li>
                <li>
                  <code className="bg-secondary px-1 rounded">logs</code> — Fetch recent container logs
                </li>
              </ul>
            </Section>

            <Section id="auth" title="Authentication & Security" icon={Shield}>
              <h4 className="font-semibold mb-2">Cloudflare Access</h4>
              <p className="text-muted-foreground text-sm mb-4">
                The dashboard is protected by Cloudflare Access. Only allowlisted emails can access it.
              </p>

              <h4 className="font-semibold mt-4 mb-2">Development Mode</h4>
              <CodeBlock>
                {`DEV_USER_EMAIL=your@email.com
DEV_SKIP_PIN=true`}
              </CodeBlock>

              <h4 className="font-semibold mt-4 mb-2">PIN Protection</h4>
              <p className="text-muted-foreground text-sm mb-2">Sensitive operations require a PIN:</p>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li>Creating, updating, or deleting projects/services</li>
                <li>Viewing/editing environment variables</li>
                <li>Triggering deployments</li>
                <li>Container actions (start/stop/restart)</li>
              </ul>
            </Section>

            {/* Features sections */}
            <Section id="projects" title="Creating a Project" icon={FolderPlus}>
              <p className="text-muted-foreground mb-4">Projects are the main way to organize your work.</p>

              <h4 className="font-semibold mt-4 mb-2">Required Fields</h4>
              <div className="space-y-3 text-sm">
                <div className="border border-border rounded-lg p-3">
                  <div className="font-medium text-foreground">Name</div>
                  <p className="text-muted-foreground">Display name for your project</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <div className="font-medium text-foreground">Slug</div>
                  <p className="text-muted-foreground">URL-friendly identifier, auto-generated from name</p>
                </div>
              </div>

              <h4 className="font-semibold mt-4 mb-2">Status Options</h4>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="success">active</Badge>
                <Badge variant="secondary">inactive</Badge>
                <Badge variant="warning">maintenance</Badge>
                <Badge variant="outline">archived</Badge>
              </div>
            </Section>

            <Section id="services" title="Adding a Service" icon={Layers}>
              <p className="text-muted-foreground mb-4">
                Services represent deployable units - Docker containers, Vercel deployments, or external APIs.
              </p>

              <h4 className="font-semibold mt-4 mb-2">Service Types</h4>
              <div className="space-y-3 text-sm">
                <div className="border border-blue-500/20 bg-blue-500/5 rounded-lg p-3">
                  <div className="font-medium text-blue-400">Docker</div>
                  <p className="text-muted-foreground">Containers managed via Portainer</p>
                </div>
                <div className="border border-purple-500/20 bg-purple-500/5 rounded-lg p-3">
                  <div className="font-medium text-purple-400">Vercel</div>
                  <p className="text-muted-foreground">Projects hosted on Vercel (monitoring only)</p>
                </div>
                <div className="border border-orange-500/20 bg-orange-500/5 rounded-lg p-3">
                  <div className="font-medium text-orange-400">External</div>
                  <p className="text-muted-foreground">Any external service or API to monitor</p>
                </div>
              </div>

              <h4 className="font-semibold mt-4 mb-2">Deploy Strategies</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex gap-2">
                  <code className="bg-primary/20 text-primary px-2 py-0.5 rounded shrink-0">pull_restart</code>
                  <span>— Git pull + docker restart</span>
                </div>
                <div className="flex gap-2">
                  <code className="bg-primary/20 text-primary px-2 py-0.5 rounded shrink-0">pull_rebuild</code>
                  <span>— Git pull + docker compose build</span>
                </div>
                <div className="flex gap-2">
                  <code className="bg-primary/20 text-primary px-2 py-0.5 rounded shrink-0">compose_up</code>
                  <span>— Full docker compose up -d --build</span>
                </div>
              </div>
            </Section>

            <Section id="work-items" title="Managing Work Items" icon={ClipboardList}>
              <p className="text-muted-foreground mb-4">Track tasks, bugs, and changes for each project.</p>

              <h4 className="font-semibold mt-4 mb-2">Work Item Types</h4>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="default">Todo</Badge>
                <Badge variant="danger">Bug</Badge>
                <Badge variant="warning">Change</Badge>
              </div>

              <h4 className="font-semibold mt-4 mb-2">Status Workflow</h4>
              <div className="flex flex-wrap gap-2 text-sm items-center">
                <Badge variant="secondary">Open</Badge>
                <span className="text-muted-foreground">→</span>
                <Badge className="bg-blue-500/20 text-blue-400">In Progress</Badge>
                <span className="text-muted-foreground">→</span>
                <Badge variant="success">Done</Badge>
              </div>
            </Section>

            <Section id="github" title="GitHub App Integration" icon={Github}>
              <p className="text-muted-foreground mb-4">
                Deep integration with GitHub for repository management, releases, and issue tracking.
              </p>

              <h4 className="font-semibold mt-4 mb-2">Features</h4>
              <div className="grid gap-2 text-sm">
                <div className="border border-border rounded-lg p-3">
                  <div className="font-medium text-foreground">Activity Dashboard</div>
                  <p className="text-muted-foreground">View commits, PRs, and releases from the project page</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <div className="font-medium text-foreground">Release Management</div>
                  <p className="text-muted-foreground">Create releases with auto-generated versions</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <div className="font-medium text-foreground">File Browser</div>
                  <p className="text-muted-foreground">Navigate repository files directly from dashboard</p>
                </div>
              </div>

              <h4 className="font-semibold mt-4 mb-2">Environment Variables</h4>
              <CodeBlock>
                {`GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY=base64_encoded_private_key
GITHUB_APP_INSTALLATION_ID=12345678`}
              </CodeBlock>
            </Section>

            <Section id="monitoring" title="Website Monitoring" icon={Server}>
              <p className="text-muted-foreground mb-4">
                Automatic monitoring for uptime, latency, and SSL certificate expiry.
              </p>

              <h4 className="font-semibold mt-4 mb-2">What&apos;s Monitored</h4>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li>HTTP status code (2xx = healthy)</li>
                <li>Response latency in milliseconds</li>
                <li>SSL certificate expiry (warns at 30/14/7 days)</li>
              </ul>

              <h4 className="font-semibold mt-4 mb-2">Configuration</h4>
              <p className="text-muted-foreground text-sm">
                Set <code className="bg-secondary px-1 rounded">MONITORING_INTERVAL_MS</code> to configure the interval
                (default: 5 minutes).
              </p>
            </Section>

            <Section id="notifications" title="Notifications" icon={Webhook}>
              <p className="text-muted-foreground mb-4">Get notified about downtime, deployments, and other events.</p>

              <h4 className="font-semibold mt-4 mb-2">Discord Webhook</h4>
              <CodeBlock>{`DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...`}</CodeBlock>

              <h4 className="font-semibold mt-4 mb-2">Email (Optional)</h4>
              <CodeBlock>
                {`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=app_password`}
              </CodeBlock>
            </Section>

            {/* Reference sections */}
            <Section id="env-vars" title="Environment Variables" icon={Key}>
              <h4 className="font-semibold mb-4">Required Variables</h4>
              <EnvVar
                name="ATLASHUB_API_URL"
                description="Base URL for the AtlasHub REST API"
                example="https://api-atlashub.marczelloo.dev"
              />
              <EnvVar
                name="ATLASHUB_SECRET_KEY"
                description="Secret key for AtlasHub API authentication"
                example="sk_Xxk48sbg..."
              />
              <EnvVar
                name="RUNNER_TOKEN"
                description="Shared secret for Runner service authentication"
                example="your_random_64_char_hex_token"
              />

              <h4 className="font-semibold mt-6 mb-4">Optional Variables</h4>
              <EnvVar
                name="DEV_USER_EMAIL"
                description="Email to use in development mode"
                example="admin@marczelloo.local"
                required={false}
              />
              <EnvVar
                name="MONITORING_INTERVAL_MS"
                description="Uptime monitoring interval in milliseconds"
                example="300000"
                required={false}
              />
              <EnvVar
                name="DISCORD_WEBHOOK_URL"
                description="Discord webhook for notifications"
                example="https://discord.com/api/webhooks/..."
                required={false}
              />
            </Section>

            <Section id="settings-page" title="Settings Dashboard" icon={Settings}>
              <p className="text-muted-foreground mb-4">
                The Settings page provides tools to configure and monitor your infrastructure.
              </p>

              <h4 className="font-semibold mt-4 mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Monitoring Interval
              </h4>
              <p className="text-muted-foreground text-sm mb-4">
                Configure how often automatic uptime monitoring runs (default: 5 minutes).
              </p>

              <h4 className="font-semibold mt-4 mb-2 flex items-center gap-2">
                <Network className="h-4 w-4" />
                Port Tracker
              </h4>
              <p className="text-muted-foreground text-sm mb-4">
                Scan which ports are currently in use on your machine.
              </p>

              <h4 className="font-semibold mt-4 mb-2 flex items-center gap-2">
                <List className="h-4 w-4" />
                Runner Allowlist
              </h4>
              <p className="text-muted-foreground text-sm">
                Manage which repositories, Docker Compose projects, and containers the Runner can access.
              </p>
            </Section>

            <Section id="troubleshooting" title="Troubleshooting" icon={Terminal}>
              <h4 className="font-semibold mb-2">&quot;Failed to connect to AtlasHub&quot;</h4>
              <ul className="text-muted-foreground space-y-1 text-sm mb-4">
                <li>
                  Check that <code>ATLASHUB_API_URL</code> is correct
                </li>
                <li>Verify the secret key is valid</li>
                <li>Ensure the AtlasHub service is running</li>
              </ul>

              <h4 className="font-semibold mb-2">&quot;Portainer connection failed&quot;</h4>
              <ul className="text-muted-foreground space-y-1 text-sm mb-4">
                <li>
                  Verify Portainer is running: <code>docker ps | grep portainer</code>
                </li>
                <li>Check the URL and credentials in your environment</li>
              </ul>

              <h4 className="font-semibold mb-2">&quot;Runner not responding&quot;</h4>
              <ul className="text-muted-foreground space-y-1 text-sm mb-4">
                <li>
                  Check if Running: <code>curl http://127.0.0.1:8787/health</code>
                </li>
                <li>
                  Verify the <code>RUNNER_TOKEN</code> matches on both sides
                </li>
              </ul>

              <h4 className="font-semibold mb-2">&quot;Operation not allowed&quot; from Runner</h4>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li>The repo path or compose project is not in the allowlist</li>
                <li>
                  Edit <code>runner/allowlist.json</code> to add allowed paths
                </li>
              </ul>
            </Section>
          </div>
        </div>
      </main>
    </div>
  );
}
