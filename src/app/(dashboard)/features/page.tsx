"use client";

import { useState } from "react";
import { PageInfoButton } from "@/components/layout/page-info-button";
import { PAGE_INFO } from "@/lib/page-info";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FolderGit2,
  Container,
  Server,
  CheckSquare,
  Activity,
  Bell,
  Terminal,
  Settings,
  Shield,
  Github,
  Search,
  ExternalLink,
  ChevronDown,
  Rocket,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface Feature {
  name: string;
  description: string;
  status: "implemented" | "planned" | "beta";
  testLocation?: string;
  testPath?: string;
}

interface FeatureCategory {
  title: string;
  icon: React.ElementType;
  color: string;
  description: string;
  features: Feature[];
}

const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    title: "Project Management",
    icon: FolderGit2,
    color: "text-blue-400",
    description: "Organize and track your projects with rich metadata",
    features: [
      {
        name: "Project CRUD",
        description: "Create, read, update, delete projects with full metadata support",
        status: "implemented",
        testLocation: "Projects page",
        testPath: "/projects",
      },
      {
        name: "Import from GitHub",
        description: "Create projects directly from your GitHub repositories",
        status: "implemented",
        testLocation: "New Project → From GitHub",
        testPath: "/projects/new",
      },
      {
        name: "Technology Badges",
        description: "Auto-detected tech stack with documentation links",
        status: "implemented",
        testLocation: "Project detail page",
      },
      {
        name: "Project Status",
        description: "Track active, inactive, maintenance, and archived states",
        status: "implemented",
        testLocation: "Project list & detail",
        testPath: "/projects",
      },
      {
        name: "Tags & Filtering",
        description: "Categorize projects with tags for easy filtering",
        status: "implemented",
        testLocation: "Projects page",
        testPath: "/projects",
      },
      {
        name: "Project Notes",
        description: "Add documentation and notes per project",
        status: "implemented",
        testLocation: "Project detail sidebar",
      },
    ],
  },
  {
    title: "GitHub Integration",
    icon: Github,
    color: "text-purple-400",
    description: "Deep integration with GitHub through GitHub App authentication",
    features: [
      {
        name: "Activity Dashboard",
        description: "View commits, PRs, and releases in tabbed interface",
        status: "implemented",
        testLocation: "Project detail → GitHub Activity",
      },
      {
        name: "Branch Deploys",
        description: "Deploy from any branch with branch selector dropdown",
        status: "implemented",
        testLocation: "Deploy button → Branch selector",
      },
      {
        name: "README Viewer",
        description: "Render repository README with full markdown support",
        status: "implemented",
        testLocation: "Project detail → Repository section",
      },
      {
        name: "File Browser",
        description: "Navigate repository files and directories",
        status: "implemented",
        testLocation: "Project detail → Repository section",
      },
      {
        name: "Release Creator",
        description: "Create releases with auto-generated semantic versions",
        status: "implemented",
        testLocation: "Project detail → GitHub Actions section",
      },
      {
        name: "Changelog Generator",
        description: "Generate changelogs between any two releases",
        status: "implemented",
        testLocation: "Project detail → GitHub Actions section",
      },
      {
        name: "Work Item → Issue",
        description: "Create GitHub issues from work items with auto-labels",
        status: "implemented",
        testLocation: "Work item detail → Create Issue button",
      },
      {
        name: "Branch Status",
        description: "Compare branches with ahead/behind counts",
        status: "implemented",
        testLocation: "Project detail → Repository section",
      },
      {
        name: "Security Dashboard",
        description: "View code scanning alerts and vulnerabilities",
        status: "implemented",
        testLocation: "Project detail → Code Quality section",
      },
      {
        name: "Dependencies Viewer",
        description: "Analyze package.json dependencies",
        status: "implemented",
        testLocation: "Project detail → Code Quality section",
      },
      {
        name: "Contributors List",
        description: "View repository contributors",
        status: "implemented",
        testLocation: "Project detail → GitHub Info card",
      },
      {
        name: "PR Linking",
        description: "Link work items to pull requests",
        status: "planned",
      },
    ],
  },
  {
    title: "Container Management",
    icon: Container,
    color: "text-cyan-400",
    description: "Manage Docker containers through Portainer integration",
    features: [
      {
        name: "Container List",
        description: "View all running containers with status",
        status: "implemented",
        testLocation: "Containers page",
        testPath: "/containers",
      },
      {
        name: "Start/Stop/Restart",
        description: "Control container lifecycle with one click",
        status: "implemented",
        testLocation: "Container actions dropdown",
        testPath: "/containers",
      },
      {
        name: "Container Logs",
        description: "View real-time container logs (tail)",
        status: "implemented",
        testLocation: "Container → View Logs",
        testPath: "/containers",
      },
      {
        name: "Container Stats",
        description: "CPU, memory, and network usage",
        status: "implemented",
        testLocation: "Container detail",
      },
      {
        name: "Recreate Container",
        description: "Recreate from updated image",
        status: "implemented",
        testLocation: "Container actions",
      },
      {
        name: "Execute Commands",
        description: "Run commands inside containers",
        status: "implemented",
        testLocation: "Container → Exec",
      },
    ],
  },
  {
    title: "Service Management",
    icon: Server,
    color: "text-green-400",
    description: "Track Docker, Vercel, and external services",
    features: [
      {
        name: "Service Types",
        description: "Support for Docker, Vercel, and external services",
        status: "implemented",
        testLocation: "Add Service form",
      },
      {
        name: "Deploy Strategies",
        description: "pull_restart, pull_rebuild, compose_up options",
        status: "implemented",
        testLocation: "Service configuration",
      },
      {
        name: "Deploy All",
        description: "Batch deploy all services in a project",
        status: "implemented",
        testLocation: "Project detail → Deploy All button",
      },
      {
        name: "Health URLs",
        description: "Custom health check endpoints per service",
        status: "implemented",
        testLocation: "Service configuration",
      },
      {
        name: "Environment Variables",
        description: "Encrypted storage with reveal/copy features",
        status: "implemented",
        testLocation: "Service detail → Env Manager",
      },
      {
        name: "Load .env Files",
        description: "Import variables from .env files",
        status: "implemented",
        testLocation: "Env Manager → Load from file",
      },
    ],
  },
  {
    title: "Work Items",
    icon: CheckSquare,
    color: "text-yellow-400",
    description: "Track tasks, bugs, and features per project",
    features: [
      {
        name: "Work Item Types",
        description: "TODO, Bug, Feature, Change categories",
        status: "implemented",
        testLocation: "Work Items page",
      },
      {
        name: "Priority Levels",
        description: "Low, Medium, High, Critical priorities",
        status: "implemented",
        testLocation: "Work Item form",
      },
      {
        name: "Status Workflow",
        description: "Open → In Progress → Done / Blocked",
        status: "implemented",
        testLocation: "Work Item detail",
      },
      {
        name: "Labels",
        description: "Custom labels for categorization",
        status: "implemented",
        testLocation: "Work Item form",
      },
      {
        name: "Due Dates",
        description: "Set deadlines for work items",
        status: "implemented",
        testLocation: "Work Item form",
      },
      {
        name: "Quick Add",
        description: "Rapidly add work items from project page",
        status: "implemented",
        testLocation: "Project detail → Work Items card",
      },
    ],
  },
  {
    title: "Monitoring",
    icon: Activity,
    color: "text-red-400",
    description: "Automatic uptime monitoring for all services",
    features: [
      {
        name: "Automatic Checks",
        description: "Configurable interval monitoring (1-60 min)",
        status: "implemented",
        testLocation: "Settings → Monitoring Interval",
        testPath: "/settings",
      },
      {
        name: "HTTP Status",
        description: "Monitor response codes (2xx = healthy)",
        status: "implemented",
        testLocation: "Monitoring page",
        testPath: "/monitoring",
      },
      {
        name: "Latency Tracking",
        description: "Response time in milliseconds",
        status: "implemented",
        testLocation: "Monitoring page",
        testPath: "/monitoring",
      },
      {
        name: "SSL Expiry",
        description: "Certificate expiry warnings (30/14/7 days)",
        status: "implemented",
        testLocation: "Service detail",
      },
      {
        name: "Historical Data",
        description: "Uptime history with charts",
        status: "implemented",
        testLocation: "Monitoring page",
        testPath: "/monitoring",
      },
      {
        name: "Manual Check",
        description: "Trigger checks on demand",
        status: "implemented",
        testLocation: "Monitoring → Refresh button",
      },
    ],
  },
  {
    title: "Notifications",
    icon: Bell,
    color: "text-orange-400",
    description: "Alerts for important events",
    features: [
      {
        name: "Discord Webhooks",
        description: "Downtime alerts to Discord channel",
        status: "implemented",
        testLocation: "Settings → Connection Tests",
        testPath: "/settings",
      },
      {
        name: "Deploy Notifications",
        description: "Success/failure alerts for deployments",
        status: "implemented",
        testLocation: "After deploy",
      },
      {
        name: "SSL Warnings",
        description: "Certificate expiry notifications",
        status: "implemented",
        testLocation: "Automatic when SSL < 30 days",
      },
      {
        name: "Email Notifications",
        description: "SMTP email alerts",
        status: "planned",
      },
    ],
  },
  {
    title: "Terminal",
    icon: Terminal,
    color: "text-emerald-400",
    description: "SSH access to your Raspberry Pi",
    features: [
      {
        name: "Full Terminal",
        description: "SSH-like terminal in the browser",
        status: "implemented",
        testLocation: "Terminal page",
        testPath: "/terminal",
      },
      {
        name: "Project Shortcuts",
        description: "Quick navigation to project directories",
        status: "implemented",
        testLocation: "Terminal → Project selector",
        testPath: "/terminal",
      },
      {
        name: "Session Persistence",
        description: "Maintain terminal state across navigations",
        status: "implemented",
        testLocation: "Terminal page",
        testPath: "/terminal",
      },
    ],
  },
  {
    title: "Deployments",
    icon: Rocket,
    color: "text-pink-400",
    description: "Git pull + Docker rebuild automation",
    features: [
      {
        name: "One-Click Deploy",
        description: "Deploy with a single click",
        status: "implemented",
        testLocation: "Project detail → Deploy button",
      },
      {
        name: "Branch Selection",
        description: "Choose which branch to deploy from",
        status: "implemented",
        testLocation: "Deploy button → Branch dropdown",
      },
      {
        name: "Deploy Logs",
        description: "Real-time streaming deploy output",
        status: "implemented",
        testLocation: "During deployment",
      },
      {
        name: "Deploy History",
        description: "Track all deployment records",
        status: "implemented",
        testLocation: "Project detail → Recent Deploys",
      },
      {
        name: "Auto-Create Release",
        description: "Create GitHub release after deploy",
        status: "implemented",
        testLocation: "Deploy button → Options",
      },
      {
        name: "Runner Allowlist",
        description: "Security allowlist for operations",
        status: "implemented",
        testLocation: "Settings → Runner Allowlist",
        testPath: "/settings",
      },
    ],
  },
  {
    title: "Security",
    icon: Shield,
    color: "text-indigo-400",
    description: "Protect your dashboard and data",
    features: [
      {
        name: "Cloudflare Access",
        description: "Zero Trust authentication layer",
        status: "implemented",
        testLocation: "External - Cloudflare dashboard",
      },
      {
        name: "PIN Protection",
        description: "Second factor for sensitive operations",
        status: "implemented",
        testLocation: "Any sensitive action",
      },
      {
        name: "Encrypted Env Vars",
        description: "AES-256-GCM encryption for secrets",
        status: "implemented",
        testLocation: "Env Manager",
      },
      {
        name: "Audit Logging",
        description: "Complete activity history",
        status: "implemented",
        testLocation: "Audit Log page",
        testPath: "/audit",
      },
      {
        name: "Email Allowlist",
        description: "Only approved emails can access",
        status: "implemented",
        testLocation: "Cloudflare Access settings",
      },
    ],
  },
  {
    title: "Settings & Configuration",
    icon: Settings,
    color: "text-gray-400",
    description: "Configure your dashboard",
    features: [
      {
        name: "Monitoring Interval",
        description: "Adjust uptime check frequency",
        status: "implemented",
        testLocation: "Settings page",
        testPath: "/settings",
      },
      {
        name: "Port Tracker",
        description: "Scan ports in use on host",
        status: "implemented",
        testLocation: "Settings page",
        testPath: "/settings",
      },
      {
        name: "Runner Allowlist",
        description: "Manage Runner security allowlist",
        status: "implemented",
        testLocation: "Settings page",
        testPath: "/settings",
      },
      {
        name: "Connection Tests",
        description: "Test Portainer, Runner, Discord connections",
        status: "implemented",
        testLocation: "Settings page",
        testPath: "/settings",
      },
    ],
  },
];

const statusColors = {
  implemented: "bg-success/20 text-success border-success/30",
  beta: "bg-warning/20 text-warning border-warning/30",
  planned: "bg-muted text-muted-foreground border-border",
};

const statusLabels = {
  implemented: "Implemented",
  beta: "Beta",
  planned: "Planned",
};

export default function FeaturesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(FEATURE_CATEGORIES.map((c) => c.title))
  );
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const toggleCategory = (title: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedCategories(newExpanded);
  };

  const filteredCategories = FEATURE_CATEGORIES.map((category) => ({
    ...category,
    features: category.features.filter((feature) => {
      const matchesSearch =
        searchQuery === "" ||
        feature.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feature.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === null || feature.status === filterStatus;
      return matchesSearch && matchesStatus;
    }),
  })).filter((category) => category.features.length > 0);

  const totalFeatures = FEATURE_CATEGORIES.reduce((acc, cat) => acc + cat.features.length, 0);
  const implementedFeatures = FEATURE_CATEGORIES.reduce(
    (acc, cat) => acc + cat.features.filter((f) => f.status === "implemented").length,
    0
  );
  const plannedFeatures = FEATURE_CATEGORIES.reduce(
    (acc, cat) => acc + cat.features.filter((f) => f.status === "planned").length,
    0
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="shrink-0 border-b border-border/50 bg-card/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Features</h1>
              <p className="text-sm text-muted-foreground">Complete list of all dashboard functionalities</p>
            </div>
          </div>
          <PageInfoButton {...PAGE_INFO.features} />
        </div>
      </header>

      <div className="flex-1 p-6 space-y-6 max-w-5xl">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-success/5 border-success/20">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-success">{implementedFeatures}</div>
              <div className="text-sm text-muted-foreground">Implemented</div>
            </CardContent>
          </Card>
          <Card className="bg-warning/5 border-warning/20">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-warning">
                {totalFeatures - implementedFeatures - plannedFeatures}
              </div>
              <div className="text-sm text-muted-foreground">Beta</div>
            </CardContent>
          </Card>
          <Card className="bg-muted/50 border-border">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-muted-foreground">{plannedFeatures}</div>
              <div className="text-sm text-muted-foreground">Planned</div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search features..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filterStatus === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus(null)}
                >
                  All
                </Button>
                <Button
                  variant={filterStatus === "implemented" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus(filterStatus === "implemented" ? null : "implemented")}
                  className={filterStatus === "implemented" ? "bg-success hover:bg-success/90" : ""}
                >
                  Implemented
                </Button>
                <Button
                  variant={filterStatus === "planned" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus(filterStatus === "planned" ? null : "planned")}
                >
                  Planned
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Categories */}
        <div className="space-y-4">
          {filteredCategories.map((category) => {
            const Icon = category.icon;
            const isExpanded = expandedCategories.has(category.title);

            return (
              <Card key={category.title} className="overflow-hidden">
                <CardHeader
                  className="cursor-pointer hover:bg-secondary/30 transition-colors"
                  onClick={() => toggleCategory(category.title)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-secondary ${category.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{category.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{category.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-xs">
                        {category.features.filter((f) => f.status === "implemented").length}/{category.features.length}
                      </Badge>
                      <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      </motion.div>
                    </div>
                  </div>
                </CardHeader>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <CardContent className="pt-0">
                        <div className="grid gap-2">
                          {category.features.map((feature) => (
                            <div
                              key={feature.name}
                              className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 hover:bg-secondary/40 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{feature.name}</span>
                                  <Badge variant="outline" className={`text-xs ${statusColors[feature.status]}`}>
                                    {statusLabels[feature.status]}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{feature.description}</p>
                                {feature.testLocation && (
                                  <p className="text-xs text-primary/70 mt-1">📍 {feature.testLocation}</p>
                                )}
                              </div>
                              {feature.testPath && (
                                <Link href={feature.testPath}>
                                  <Button variant="ghost" size="sm" className="gap-1">
                                    Test
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                </Link>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
        </div>

        {filteredCategories.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No features match your search</p>
            </CardContent>
          </Card>
        )}

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Legend</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={statusColors.implemented}>
                Implemented
              </Badge>
              <span className="text-muted-foreground">Ready to use</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={statusColors.beta}>
                Beta
              </Badge>
              <span className="text-muted-foreground">Working but may have issues</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={statusColors.planned}>
                Planned
              </Badge>
              <span className="text-muted-foreground">Coming soon</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
