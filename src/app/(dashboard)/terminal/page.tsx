"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import { PageInfoButton } from "@/components/layout/page-info-button";
import { PAGE_INFO } from "@/lib/page-info";
import { Terminal } from "@/components/features/terminal";
import {
  ChevronLeft,
  ChevronRight,
  Cpu,
  HardDrive,
  Network,
  Container,
  Clock,
  Zap,
  AlertTriangle,
  Shield,
  Play,
  Copy,
  Check,
} from "lucide-react";

// Quick command categories with their commands
const QUICK_COMMANDS = [
  {
    id: "system",
    label: "System",
    icon: Cpu,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    commands: [
      { label: "Hostname", command: "hostname", description: "Show system hostname" },
      { label: "Uptime", command: "uptime", description: "System uptime and load" },
      { label: "Memory Usage", command: "free -h", description: "RAM and swap usage" },
      { label: "CPU Info", command: "lscpu | head -20", description: "CPU details" },
      { label: "Temperature", command: "vcgencmd measure_temp", description: "Pi temperature" },
      { label: "Top Processes", command: "ps aux --sort=-%mem | head -10", description: "Memory usage by process" },
    ],
  },
  {
    id: "storage",
    label: "Storage",
    icon: HardDrive,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    commands: [
      { label: "Disk Space", command: "df -h /", description: "Root partition usage" },
      { label: "All Mounts", command: "df -h", description: "All mounted filesystems" },
      {
        label: "Disk Usage",
        command: "du -sh /* 2>/dev/null | sort -hr | head -10",
        description: "Largest directories",
      },
      { label: "IO Stats", command: "iostat -x 1 1", description: "Disk IO statistics" },
    ],
  },
  {
    id: "docker",
    label: "Docker",
    icon: Container,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    commands: [
      {
        label: "Running",
        command: 'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"',
        description: "Running containers",
      },
      {
        label: "All Containers",
        command: 'docker ps -a --format "table {{.Names}}\\t{{.Status}}"',
        description: "All containers",
      },
      {
        label: "Images",
        command: 'docker images --format "table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}"',
        description: "Docker images",
      },
      { label: "Docker Disk", command: "docker system df", description: "Docker disk usage" },
      { label: "Docker Stats", command: "docker stats --no-stream", description: "Container resource usage" },
      { label: "Networks", command: "docker network ls", description: "Docker networks" },
    ],
  },
  {
    id: "network",
    label: "Network",
    icon: Network,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    commands: [
      { label: "IP Address", command: "hostname -I", description: "Local IP addresses" },
      { label: "Open Ports", command: "ss -tlnp", description: "Listening TCP ports" },
      { label: "Connections", command: "ss -tuanp | head -20", description: "Active connections" },
      { label: "Interface Stats", command: "netstat -i", description: "Network interface stats" },
      { label: "DNS Test", command: "nslookup google.com", description: "DNS resolution test" },
    ],
  },
  {
    id: "services",
    label: "Services",
    icon: Zap,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    commands: [
      {
        label: "Running Services",
        command: "systemctl list-units --type=service --state=running | head -20",
        description: "Active services",
      },
      { label: "Failed Services", command: "systemctl --failed", description: "Failed services" },
      { label: "Recent Logs", command: "journalctl -n 20 --no-pager", description: "System logs" },
      { label: "Docker Logs", command: "journalctl -u docker --no-pager -n 20", description: "Docker service logs" },
    ],
  },
];

export default function TerminalPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeCategory, setActiveCategory] = useState("system");
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [executingCommand, setExecutingCommand] = useState<string | null>(null);

  const activeCommands = QUICK_COMMANDS.find((c) => c.id === activeCategory);

  const copyCommand = async (command: string) => {
    await navigator.clipboard.writeText(command);
    setCopiedCommand(command);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  // Note: For now, clicking execute just copies. To actually execute,
  // we'd need to pass a callback to the Terminal component.
  const executeCommand = async (command: string) => {
    setExecutingCommand(command);
    await copyCommand(command);
    // In future: actually execute via terminal ref
    setTimeout(() => setExecutingCommand(null), 1000);
  };

  return (
    <div className="flex h-[calc(100vh-1px)]">
      {/* Quick Commands Sidebar */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-r border-border/50 bg-card/50 overflow-hidden flex flex-col h-full"
          >
            <div className="p-4 border-b border-border/50 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-semibold">Quick Commands</h2>
              <Badge variant="outline" className="text-xs">
                {QUICK_COMMANDS.reduce((acc, cat) => acc + cat.commands.length, 0)} commands
              </Badge>
            </div>

            {/* Category tabs */}
            <div className="flex flex-wrap gap-1 p-3 border-b border-border/50 shrink-0">
              {QUICK_COMMANDS.map((category) => {
                const Icon = category.icon;
                const isActive = activeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                      isActive ? `${category.bgColor} ${category.color}` : "text-muted-foreground hover:bg-secondary/50"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {category.label}
                  </button>
                );
              })}
            </div>

            {/* Commands list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {activeCommands?.commands.map((cmd) => (
                <div
                  key={cmd.command}
                  className="group rounded-lg border border-border/50 bg-background/50 p-3 hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <span className="text-sm font-medium">{cmd.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{cmd.description}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => copyCommand(cmd.command)}
                        title="Copy command"
                      >
                        {copiedCommand === cmd.command ? (
                          <Check className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-primary hover:text-primary"
                        onClick={() => executeCommand(cmd.command)}
                        title="Copy to run"
                      >
                        {executingCommand === cmd.command ? (
                          <Check className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <code className="text-xs font-mono text-primary/80 break-all bg-secondary/30 px-2 py-1 rounded block">
                    {cmd.command}
                  </code>
                </div>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Terminal Area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Terminal Header */}
        <header className="shrink-0 border-b border-border/50 bg-card/30 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                Terminal
                <Badge variant="outline" className="text-xs font-normal">
                  <span className="h-1.5 w-1.5 rounded-full bg-success mr-1.5 animate-pulse" />
                  Connected
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground">Execute commands on Raspberry Pi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PageInfoButton {...PAGE_INFO.terminal} />
          </div>
        </header>

        {/* Terminal Content */}
        <div className="flex-1 p-4 flex flex-col min-h-0">
          <Terminal className="flex-1 min-h-0" />
        </div>

        {/* Security Footer */}
        <footer className="shrink-0 border-t border-border/50 bg-card/30 px-4 py-2">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span>PIN Protected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>All commands logged</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              <span>Dangerous commands blocked</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
