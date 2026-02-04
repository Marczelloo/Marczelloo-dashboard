import { Header } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
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
} from "lucide-react";

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
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

export default function DocsPage() {
  return (
    <>
      <Header title="Documentation" description="Setup guides and configuration reference for Marczelloo Dashboard" />

      <div className="p-6 space-y-6 max-w-4xl">
        {/* Overview */}
        <Section title="Overview" icon={Globe}>
          <p className="text-muted-foreground mb-4">
            Marczelloo Dashboard (Marczelloo Dashboard) is a self-hosted project management panel designed for managing
            Docker containers, monitoring websites, and tracking project deployments on your Raspberry Pi
            infrastructure.
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

        {/* Docker Deployment */}
        <Section title="Docker Deployment" icon={Package}>
          <p className="text-muted-foreground mb-4">
            The entire stack can be deployed with a single Docker Compose command. All services are containerized for
            easy setup and portability.
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

          <h4 className="font-semibold mt-4 mb-2">Persistent Volumes</h4>
          <ul className="text-muted-foreground space-y-1 text-sm">
            <li>
              <code className="bg-secondary px-1 rounded">runner_data</code> — Runner allowlist and state
            </li>
            <li>
              <code className="bg-secondary px-1 rounded">portainer_data</code> — Portainer configuration
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

        {/* Creating a Project */}
        <Section title="Creating a Project" icon={FolderPlus}>
          <p className="text-muted-foreground mb-4">
            Projects are the main way to organize your work. Each project can have multiple services, work items, and
            deployments.
          </p>

          <h4 className="font-semibold mt-4 mb-2">Required Fields</h4>
          <div className="space-y-3 text-sm">
            <div className="border border-border rounded-lg p-3">
              <div className="font-medium text-foreground">Name</div>
              <p className="text-muted-foreground">
                Display name for your project (e.g., &quot;Portfolio Website&quot;)
              </p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="font-medium text-foreground">Slug</div>
              <p className="text-muted-foreground">
                URL-friendly identifier, auto-generated from name (e.g., &quot;portfolio-website&quot;)
              </p>
            </div>
          </div>

          <h4 className="font-semibold mt-4 mb-2">Optional Fields</h4>
          <div className="space-y-3 text-sm">
            <div className="border border-border rounded-lg p-3">
              <div className="font-medium text-foreground">Description</div>
              <p className="text-muted-foreground">Brief description of what the project does</p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="font-medium text-foreground">Status</div>
              <p className="text-muted-foreground">
                <code className="bg-success/20 text-success px-1 rounded">active</code> — Currently in
                development/production
                <br />
                <code className="bg-secondary text-muted-foreground px-1 rounded">inactive</code> — Paused development
                <br />
                <code className="bg-warning/20 text-warning px-1 rounded">maintenance</code> — In maintenance mode
                <br />
                <code className="bg-muted text-muted-foreground px-1 rounded">archived</code> — No longer maintained
              </p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="font-medium text-foreground">Tags</div>
              <p className="text-muted-foreground">
                Comma-separated labels for filtering (e.g., &quot;nextjs, typescript, api&quot;)
              </p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="font-medium text-foreground">GitHub URL</div>
              <p className="text-muted-foreground">
                Link to the repository (e.g., &quot;https://github.com/user/repo&quot;)
              </p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="font-medium text-foreground">Production URL</div>
              <p className="text-muted-foreground">Live site URL for quick access and monitoring</p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="font-medium text-foreground">Vercel URL</div>
              <p className="text-muted-foreground">If deployed on Vercel, the project URL</p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="font-medium text-foreground">Notes</div>
              <p className="text-muted-foreground">Any additional notes or documentation</p>
            </div>
          </div>
        </Section>

        {/* Adding Services */}
        <Section title="Adding a Service" icon={Layers}>
          <p className="text-muted-foreground mb-4">
            Services represent deployable units - Docker containers, Vercel deployments, or external APIs. They can be
            attached to a project or standalone (like Portainer, databases).
          </p>

          <h4 className="font-semibold mt-4 mb-2">Service Types</h4>
          <div className="space-y-3 text-sm">
            <div className="border border-blue-500/20 bg-blue-500/5 rounded-lg p-3">
              <div className="font-medium text-blue-400">Docker</div>
              <p className="text-muted-foreground">
                Containers managed via Portainer. Supports start/stop/restart, logs, and automated deploys.
              </p>
            </div>
            <div className="border border-purple-500/20 bg-purple-500/5 rounded-lg p-3">
              <div className="font-medium text-purple-400">Vercel</div>
              <p className="text-muted-foreground">
                Projects hosted on Vercel. Monitoring only (deploys handled by Vercel).
              </p>
            </div>
            <div className="border border-orange-500/20 bg-orange-500/5 rounded-lg p-3">
              <div className="font-medium text-orange-400">External</div>
              <p className="text-muted-foreground">
                Any external service or API you want to monitor (third-party APIs, external websites).
              </p>
            </div>
          </div>

          <h4 className="font-semibold mt-4 mb-2">Docker Service Fields</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <code className="bg-secondary px-2 py-0.5 rounded shrink-0">container_id</code>
              <span>
                — The Docker container ID (get from Portainer or <code>docker ps</code>)
              </span>
            </div>
            <div className="flex gap-2">
              <code className="bg-secondary px-2 py-0.5 rounded shrink-0">portainer_endpoint_id</code>
              <span>
                — Usually <code>2</code> for local Docker (check Portainer → Endpoints)
              </span>
            </div>
            <div className="flex gap-2">
              <code className="bg-secondary px-2 py-0.5 rounded shrink-0">stack_id</code>
              <span>— If using Docker Compose stacks in Portainer (optional)</span>
            </div>
            <div className="flex gap-2">
              <code className="bg-secondary px-2 py-0.5 rounded shrink-0">repo_path</code>
              <span>
                — Full path on Pi (e.g., <code>/home/pi/projects/my-app</code>) for git pulls
              </span>
            </div>
            <div className="flex gap-2">
              <code className="bg-secondary px-2 py-0.5 rounded shrink-0">compose_project</code>
              <span>— Docker Compose project name for rebuild commands</span>
            </div>
          </div>

          <h4 className="font-semibold mt-4 mb-2">Deploy Strategies</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <code className="bg-primary/20 text-primary px-2 py-0.5 rounded shrink-0">pull_restart</code>
              <span>— Git pull + docker restart (fast, for config changes)</span>
            </div>
            <div className="flex gap-2">
              <code className="bg-primary/20 text-primary px-2 py-0.5 rounded shrink-0">pull_rebuild</code>
              <span>— Git pull + docker compose build (for code changes)</span>
            </div>
            <div className="flex gap-2">
              <code className="bg-primary/20 text-primary px-2 py-0.5 rounded shrink-0">compose_up</code>
              <span>— Full docker compose up -d --build</span>
            </div>
            <div className="flex gap-2">
              <code className="bg-secondary px-2 py-0.5 rounded shrink-0">manual</code>
              <span>— No automated deploy (default)</span>
            </div>
          </div>

          <h4 className="font-semibold mt-4 mb-2">Getting Container ID from Portainer</h4>
          <ol className="text-muted-foreground space-y-2 text-sm list-decimal list-inside">
            <li>
              Open Portainer at <code>http://localhost:9000</code>
            </li>
            <li>
              Go to <strong>Containers</strong> in the sidebar
            </li>
            <li>Click on your container name</li>
            <li>
              Copy the <strong>Container ID</strong> (first 12 chars are enough)
            </li>
            <li>
              Note the <strong>Endpoint</strong> number from the URL (usually 2)
            </li>
          </ol>

          <h4 className="font-semibold mt-4 mb-2">Monitoring Fields</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <code className="bg-secondary px-2 py-0.5 rounded shrink-0">url</code>
              <span>— Public URL for uptime monitoring</span>
            </div>
            <div className="flex gap-2">
              <code className="bg-secondary px-2 py-0.5 rounded shrink-0">health_url</code>
              <span>
                — Optional dedicated health check endpoint (e.g., <code>/api/health</code>)
              </span>
            </div>
          </div>
        </Section>

        {/* Work Items */}
        <Section title="Managing Work Items" icon={ClipboardList}>
          <p className="text-muted-foreground mb-4">
            Work items help you track tasks, bugs, and changes for each project.
          </p>

          <h4 className="font-semibold mt-4 mb-2">Work Item Types</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-16 text-primary font-medium">Todo</span>
              <span className="text-muted-foreground">— Feature to implement or task to complete</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 text-danger font-medium">Bug</span>
              <span className="text-muted-foreground">— Issue or defect to fix</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 text-warning font-medium">Change</span>
              <span className="text-muted-foreground">— Modification or refactor request</span>
            </div>
          </div>

          <h4 className="font-semibold mt-4 mb-2">Status Workflow</h4>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="px-2 py-1 rounded bg-secondary">Open</span>
            <span className="text-muted-foreground">→</span>
            <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">In Progress</span>
            <span className="text-muted-foreground">→</span>
            <span className="px-2 py-1 rounded bg-success/20 text-success">Done</span>
          </div>
          <p className="text-muted-foreground text-sm mt-2">
            Use <span className="px-2 py-0.5 rounded bg-warning/20 text-warning">Blocked</span> for items waiting on
            external dependencies.
          </p>

          <h4 className="font-semibold mt-4 mb-2">Priority Levels</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">Low</span>
              <span className="text-muted-foreground">— Nice to have, no deadline</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-secondary text-foreground">Medium</span>
              <span className="text-muted-foreground">— Normal priority (default)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-warning/20 text-warning">High</span>
              <span className="text-muted-foreground">— Important, should be done soon</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-danger/20 text-danger">Critical</span>
              <span className="text-muted-foreground">— Urgent, blocking production</span>
            </div>
          </div>

          <h4 className="font-semibold mt-4 mb-2">Labels</h4>
          <p className="text-muted-foreground text-sm">
            Add comma-separated labels for categorization (e.g., &quot;frontend, ui, performance&quot;). Useful for
            filtering work items by area.
          </p>
        </Section>

        {/* AtlasHub Setup */}
        <Section title="AtlasHub (Database)" icon={Database}>
          <p className="text-muted-foreground mb-4">
            AtlasHub is the primary data store for all dashboard data. It provides a REST API for CRUD operations on
            tables.
          </p>

          <h4 className="font-semibold mt-4 mb-2">Connection</h4>
          <CodeBlock>
            {`ATLASHUB_API_URL=https://api-atlashub.marczelloo.dev
ATLASHUB_SECRET_KEY=sk_your_secret_key_here`}
          </CodeBlock>

          <h4 className="font-semibold mt-4 mb-2">Tables Used</h4>
          <ul className="text-muted-foreground space-y-1 text-sm">
            <li>
              <code className="bg-secondary px-1 rounded">projects</code> — Your projects and their metadata
            </li>
            <li>
              <code className="bg-secondary px-1 rounded">services</code> — Docker/Vercel/external services
            </li>
            <li>
              <code className="bg-secondary px-1 rounded">work_items</code> — Tasks and issues for projects
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

          <h4 className="font-semibold mt-4 mb-2">API Examples</h4>
          <CodeBlock title="Get all projects">
            {`GET /v1/db/projects
Headers: x-api-key: sk_your_secret_key`}
          </CodeBlock>
          <CodeBlock title="Create a project">
            {`POST /v1/db/projects
Headers: x-api-key: sk_your_secret_key
Body: { "name": "My Project", "status": "active" }`}
          </CodeBlock>
          <CodeBlock title="Filter by column">
            {`GET /v1/db/services?filters=[{"operator":"eq","column":"type","value":"docker"}]`}
          </CodeBlock>
        </Section>

        {/* GitHub Integration */}
        <Section title="GitHub App Integration" icon={Github}>
          <p className="text-muted-foreground mb-4">
            Deep integration with GitHub through a GitHub App for repository management, releases, and issue tracking.
          </p>

          <h4 className="font-semibold mt-4 mb-2">Features</h4>
          <div className="space-y-3 text-sm">
            <div className="border border-border rounded-lg p-3">
              <div className="font-medium text-foreground">Activity Dashboard</div>
              <p className="text-muted-foreground">
                View recent commits, pull requests, and releases in a tabbed interface directly from the project page.
              </p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="font-medium text-foreground">Branch Deploys</div>
              <p className="text-muted-foreground">
                Deploy from any branch using the branch selector dropdown. Fetches branches directly from GitHub.
              </p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="font-medium text-foreground">README Viewer</div>
              <p className="text-muted-foreground">
                Render repository README with full markdown support including code blocks, tables, and images.
              </p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="font-medium text-foreground">File Browser</div>
              <p className="text-muted-foreground">
                Navigate repository files and directories directly from the dashboard with file icons and sizes.
              </p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="font-medium text-foreground">Release Management</div>
              <p className="text-muted-foreground">
                Create releases with auto-generated semantic versions (v1.0.0 → v1.0.1) and GitHub-generated release
                notes.
              </p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="font-medium text-foreground">Changelog Generator</div>
              <p className="text-muted-foreground">
                Generate changelogs between any two releases. Copy or download as markdown.
              </p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="font-medium text-foreground">Work Item → GitHub Issue</div>
              <p className="text-muted-foreground">
                Create GitHub issues directly from work items with auto-applied labels based on type and priority.
              </p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="font-medium text-foreground">PR Linking</div>
              <p className="text-muted-foreground">
                Link work items to pull requests for tracking development progress.
              </p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="font-medium text-foreground">Repository Sync</div>
              <p className="text-muted-foreground">
                Auto-import all accessible GitHub repositories as dashboard projects, or import individual repos.
              </p>
            </div>
          </div>

          <h4 className="font-semibold mt-4 mb-2">Setup</h4>
          <ol className="text-muted-foreground space-y-2 text-sm list-decimal list-inside">
            <li>Create a GitHub App in your GitHub account/organization settings</li>
            <li>
              Configure permissions: Contents (read), Issues (read/write), PRs (read), Releases (read/write), Metadata
              (read)
            </li>
            <li>Generate and download a private key (.pem file)</li>
            <li>Install the app on your repositories</li>
            <li>Note your App ID and Installation ID</li>
          </ol>

          <h4 className="font-semibold mt-4 mb-2">Environment Variables</h4>
          <CodeBlock>
            {`# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY=base64_encoded_private_key
GITHUB_APP_INSTALLATION_ID=12345678`}
          </CodeBlock>

          <h4 className="font-semibold mt-4 mb-2">Encoding the Private Key</h4>
          <p className="text-muted-foreground text-sm mb-2">
            Convert your .pem file to base64 for use in environment variables:
          </p>
          <CodeBlock title="Linux/macOS">{`cat private-key.pem | base64 -w 0`}</CodeBlock>
          <CodeBlock title="PowerShell (Windows)">
            {`[Convert]::ToBase64String([IO.File]::ReadAllBytes("private-key.pem"))`}
          </CodeBlock>

          <h4 className="font-semibold mt-4 mb-2">Actions Available</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <code className="bg-secondary px-2 py-0.5 rounded shrink-0">createReleaseAction</code>
              <span>— Create a release with auto version or custom tag</span>
            </div>
            <div className="flex gap-2">
              <code className="bg-secondary px-2 py-0.5 rounded shrink-0">createDeployReleaseAction</code>
              <span>— Create release after successful deploy</span>
            </div>
            <div className="flex gap-2">
              <code className="bg-secondary px-2 py-0.5 rounded shrink-0">syncGitHubReposAction</code>
              <span>— Sync all repos to projects</span>
            </div>
            <div className="flex gap-2">
              <code className="bg-secondary px-2 py-0.5 rounded shrink-0">importGitHubRepoAction</code>
              <span>— Import single repo as project</span>
            </div>
            <div className="flex gap-2">
              <code className="bg-secondary px-2 py-0.5 rounded shrink-0">createGitHubIssueFromWorkItemAction</code>
              <span>— Create issue from work item</span>
            </div>
            <div className="flex gap-2">
              <code className="bg-secondary px-2 py-0.5 rounded shrink-0">linkWorkItemToPRAction</code>
              <span>— Link work item to PR</span>
            </div>
          </div>
        </Section>

        {/* Portainer Setup */}
        <Section title="Portainer (Docker Management)" icon={Container}>
          <p className="text-muted-foreground mb-4">
            Portainer provides the API for managing Docker containers on your Raspberry Pi.
          </p>

          <h4 className="font-semibold mt-4 mb-2">Connection</h4>
          <CodeBlock>
            {`PORTAINER_URL=http://localhost:9000
PORTAINER_USERNAME=admin
PORTAINER_PASSWORD=your_password_here`}
          </CodeBlock>

          <h4 className="font-semibold mt-4 mb-2">Setting Up Portainer</h4>
          <ol className="text-muted-foreground space-y-2 text-sm list-decimal list-inside">
            <li>Install Portainer on your Raspberry Pi via Docker Compose or as a standalone container</li>
            <li>
              Access the web UI at <code>http://your-pi-ip:9000</code>
            </li>
            <li>Create an admin user on first access</li>
            <li>Connect your local Docker environment as an endpoint</li>
          </ol>

          <h4 className="font-semibold mt-4 mb-2">Features Available</h4>
          <ul className="text-muted-foreground space-y-1 text-sm">
            <li>View running containers and their status</li>
            <li>Start/Stop/Restart containers</li>
            <li>View container logs (tail)</li>
            <li>Recreate containers from updated images</li>
            <li>Manage Docker Compose stacks</li>
          </ul>

          <h4 className="font-semibold mt-4 mb-2">Linking Services to Containers</h4>
          <p className="text-muted-foreground text-sm">
            When creating a service of type &quot;docker&quot;, you can link it to a Portainer container by setting the{" "}
            <code>container_id</code> field. This allows the dashboard to show live status and provide quick actions.
          </p>
        </Section>

        {/* Runner Setup */}
        <Section title="Runner (Deploy Service)" icon={Play}>
          <p className="text-muted-foreground mb-4">
            The Runner is a local service that handles git operations and Docker rebuilds. It runs in Docker alongside
            the dashboard and validates all operations against an allowlist.
          </p>

          <h4 className="font-semibold mt-4 mb-2">Connection</h4>
          <CodeBlock>
            {`# In Docker Compose (default)
RUNNER_URL=http://runner:8787
RUNNER_TOKEN=your_secure_runner_token

# Local development
RUNNER_URL=http://127.0.0.1:8787`}
          </CodeBlock>

          <h4 className="font-semibold mt-4 mb-2">API Endpoints</h4>
          <div className="space-y-2 text-sm">
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <code className="bg-success/20 text-success px-2 py-0.5 rounded">GET</code>
                <code className="text-foreground">/health</code>
                <span className="text-muted-foreground text-xs">(no auth)</span>
              </div>
              <p className="text-muted-foreground">Health check endpoint for container health probes</p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <code className="bg-success/20 text-success px-2 py-0.5 rounded">GET</code>
                <code className="text-foreground">/status</code>
                <span className="text-muted-foreground text-xs">(no auth)</span>
              </div>
              <p className="text-muted-foreground">Service status with uptime and version info</p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <code className="bg-success/20 text-success px-2 py-0.5 rounded">GET</code>
                <code className="text-foreground">/allowlist</code>
                <span className="text-muted-foreground text-xs">(auth required)</span>
              </div>
              <p className="text-muted-foreground">Retrieve current allowlist configuration</p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <code className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">PUT</code>
                <code className="text-foreground">/allowlist</code>
                <span className="text-muted-foreground text-xs">(auth required)</span>
              </div>
              <p className="text-muted-foreground">Update allowlist (persisted to disk)</p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <code className="bg-warning/20 text-warning px-2 py-0.5 rounded">POST</code>
                <code className="text-foreground">/execute</code>
                <span className="text-muted-foreground text-xs">(auth required)</span>
              </div>
              <p className="text-muted-foreground">Execute git/docker operations</p>
            </div>
          </div>

          <h4 className="font-semibold mt-4 mb-2">Security</h4>
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 text-warning mb-2">
              <AlertTriangle className="h-4 w-4" />
              <strong className="text-sm">Important Security Note</strong>
            </div>
            <p className="text-sm text-muted-foreground">
              The Runner uses an allowlist to restrict operations. Only pre-configured repository paths, Docker Compose
              project names, and container names can be used. Configure via Settings → Runner Allowlist.
            </p>
          </div>

          <h4 className="font-semibold mt-4 mb-2">Allowlist Configuration</h4>
          <CodeBlock title="runner/data/allowlist.json">
            {`{
  "repo_paths": [
    "/home/pi/projects/my-app",
    "/home/pi/projects/api-server"
  ],
  "compose_projects": ["my-app", "api-server"],
  "container_names": ["my-app-web", "my-app-api"]
}`}
          </CodeBlock>

          <h4 className="font-semibold mt-4 mb-2">Available Operations</h4>
          <ul className="text-muted-foreground space-y-2 text-sm">
            <li>
              <code className="bg-secondary px-1 rounded">pull</code> — Run <code>git pull</code> in the repo
            </li>
            <li>
              <code className="bg-secondary px-1 rounded">rebuild</code> — Run <code>docker compose up -d --build</code>
            </li>
            <li>
              <code className="bg-secondary px-1 rounded">restart</code> — Run <code>docker compose restart</code>
            </li>
            <li>
              <code className="bg-secondary px-1 rounded">logs</code> — Fetch recent container logs
            </li>
          </ul>
        </Section>

        {/* Authentication */}
        <Section title="Authentication & Security" icon={Shield}>
          <h4 className="font-semibold mb-2">Cloudflare Access</h4>
          <p className="text-muted-foreground text-sm mb-4">
            The dashboard is protected by Cloudflare Access. Only emails in your allowlist can access the application.
          </p>

          <h4 className="font-semibold mt-4 mb-2">Development Mode</h4>
          <p className="text-muted-foreground text-sm mb-2">For local development, you can bypass authentication:</p>
          <CodeBlock>
            {`DEV_USER_EMAIL=your@email.com
DEV_SKIP_PIN=true`}
          </CodeBlock>

          <h4 className="font-semibold mt-4 mb-2">PIN Protection</h4>
          <p className="text-muted-foreground text-sm mb-2">
            Sensitive operations require a PIN for additional security:
          </p>
          <ul className="text-muted-foreground space-y-1 text-sm">
            <li>Creating, updating, or deleting projects/services</li>
            <li>Viewing/editing environment variables</li>
            <li>Triggering deployments</li>
            <li>Container actions (start/stop/restart)</li>
          </ul>
        </Section>

        {/* Monitoring */}
        <Section title="Website Monitoring" icon={Server}>
          <p className="text-muted-foreground mb-4">
            The dashboard automatically monitors your websites and APIs for uptime, latency, and SSL certificate expiry.
          </p>

          <h4 className="font-semibold mt-4 mb-2">Automatic Monitoring</h4>
          <p className="text-muted-foreground text-sm mb-2">
            Monitoring runs automatically in-process when the dashboard starts. No external cron job required.
          </p>
          <ul className="text-muted-foreground space-y-1 text-sm">
            <li>Default interval: 5 minutes (configurable in Settings)</li>
            <li>Checks all services with a URL or health_url defined</li>
            <li>
              Stores results in the <code className="bg-secondary px-1 rounded">uptime_checks</code> table
            </li>
            <li>Sends Discord alerts on downtime detection</li>
          </ul>

          <h4 className="font-semibold mt-4 mb-2">What&apos;s Monitored</h4>
          <ul className="text-muted-foreground space-y-1 text-sm">
            <li>HTTP status code (2xx = healthy)</li>
            <li>Response latency in milliseconds</li>
            <li>SSL certificate expiry (warns at 30/14/7 days)</li>
          </ul>

          <h4 className="font-semibold mt-4 mb-2">Health URLs</h4>
          <p className="text-muted-foreground text-sm mb-2">
            Add a dedicated <code className="bg-secondary px-1 rounded">health_url</code> to services for more reliable
            checks. If not set, the main URL is used.
          </p>
          <CodeBlock>
            {`// Example health endpoint (/api/health)
export async function GET() {
  return Response.json({ status: "ok" });
}`}
          </CodeBlock>

          <h4 className="font-semibold mt-4 mb-2">Configuring Interval</h4>
          <p className="text-muted-foreground text-sm">
            Set <code className="bg-secondary px-1 rounded">MONITORING_INTERVAL_MS</code> environment variable, or
            change it in Settings → Monitoring Interval. Requires server restart.
          </p>
        </Section>

        {/* Notifications */}
        <Section title="Notifications" icon={Webhook}>
          <p className="text-muted-foreground mb-4">Get notified about downtime, deployments, and other events.</p>

          <h4 className="font-semibold mt-4 mb-2">Discord Webhook</h4>
          <CodeBlock>{`DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...`}</CodeBlock>
          <p className="text-muted-foreground text-sm">
            Alerts are sent for: service downtime, deployment success/failure, SSL expiry warnings.
          </p>

          <h4 className="font-semibold mt-4 mb-2">Email (Optional)</h4>
          <CodeBlock>
            {`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=app_password`}
          </CodeBlock>
        </Section>

        {/* Settings Page */}
        <Section title="Settings Dashboard" icon={Settings}>
          <p className="text-muted-foreground mb-4">
            The Settings page provides tools to configure and monitor your dashboard infrastructure.
          </p>

          <h4 className="font-semibold mt-4 mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Monitoring Interval
          </h4>
          <p className="text-muted-foreground text-sm mb-2">
            Configure how often the automatic uptime monitoring runs. Default is 5 minutes (300000ms).
          </p>
          <ul className="text-muted-foreground space-y-1 text-sm">
            <li>Adjustable from 1 to 60 minutes</li>
            <li>Changes take effect on server restart</li>
            <li>
              Set via <code className="bg-secondary px-1 rounded">MONITORING_INTERVAL_MS</code> env var
            </li>
          </ul>

          <h4 className="font-semibold mt-4 mb-2 flex items-center gap-2">
            <Network className="h-4 w-4" />
            Port Tracker
          </h4>
          <p className="text-muted-foreground text-sm mb-2">
            Scan which ports are currently in use on your machine. Useful for:
          </p>
          <ul className="text-muted-foreground space-y-1 text-sm">
            <li>Finding available ports for new services</li>
            <li>Avoiding port conflicts</li>
            <li>Auditing what&apos;s running locally</li>
          </ul>

          <h4 className="font-semibold mt-4 mb-2 flex items-center gap-2">
            <List className="h-4 w-4" />
            Runner Allowlist
          </h4>
          <p className="text-muted-foreground text-sm mb-2">
            Manage which repositories, Docker Compose projects, and containers the Runner can access. All operations are
            validated against this allowlist.
          </p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <code className="bg-secondary px-2 py-0.5 rounded shrink-0">repo_paths</code>
              <span>— Full paths to git repositories (e.g., /home/pi/projects/app)</span>
            </div>
            <div className="flex gap-2">
              <code className="bg-secondary px-2 py-0.5 rounded shrink-0">compose_projects</code>
              <span>— Docker Compose project names</span>
            </div>
            <div className="flex gap-2">
              <code className="bg-secondary px-2 py-0.5 rounded shrink-0">container_names</code>
              <span>— Specific container names for restart operations</span>
            </div>
          </div>
          <p className="text-muted-foreground text-sm mt-3">
            Changes are persisted to <code className="bg-secondary px-1 rounded">runner/data/allowlist.json</code>
          </p>

          <h4 className="font-semibold mt-4 mb-2">Connection Tests</h4>
          <p className="text-muted-foreground text-sm">
            Test connectivity to Portainer, Runner, and Discord webhook from the Settings page. Useful for
            troubleshooting configuration issues.
          </p>
        </Section>

        {/* Environment Variables Reference */}
        <Section title="Environment Variables" icon={Key}>
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

          <h4 className="font-semibold mt-6 mb-4">Docker Compose Variables</h4>

          <EnvVar
            name="PORTAINER_URL"
            description="Portainer URL (use http://portainer:9000 in Docker)"
            example="http://portainer:9000"
            required={false}
          />
          <EnvVar
            name="PORTAINER_TOKEN"
            description="Portainer JWT token for API access"
            example="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            required={false}
          />
          <EnvVar
            name="RUNNER_URL"
            description="Runner service URL (use http://runner:8787 in Docker)"
            example="http://runner:8787"
            required={false}
          />

          <h4 className="font-semibold mt-6 mb-4">Optional Variables</h4>

          <EnvVar
            name="DEV_USER_EMAIL"
            description="Email to use in development mode (bypasses Cloudflare)"
            example="admin@marczelloo.local"
            required={false}
          />
          <EnvVar
            name="MONITORING_INTERVAL_MS"
            description="Uptime monitoring interval in milliseconds (default: 5 min)"
            example="300000"
            required={false}
          />
          <EnvVar
            name="DISCORD_WEBHOOK_URL"
            description="Discord webhook for notifications"
            example="https://discord.com/api/webhooks/..."
            required={false}
          />
          <EnvVar
            name="ENCRYPTION_KEY"
            description="32-byte base64 key for encrypting env vars"
            example="base64_encoded_32_byte_key"
            required={false}
          />
        </Section>

        {/* Quick Start */}
        <Section title="Quick Start Checklist" icon={CheckCircle}>
          <h4 className="font-semibold mb-3">Docker Deployment (Recommended)</h4>
          <ol className="text-muted-foreground space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                1
              </span>
              <span>
                Clone the repository and copy <code>.env.example</code> to <code>.env</code>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                2
              </span>
              <span>
                Set required env vars: <code>ATLASHUB_API_URL</code>, <code>ATLASHUB_SECRET_KEY</code>,{" "}
                <code>RUNNER_TOKEN</code>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                3
              </span>
              <span>
                Run <code>docker-compose up -d --build</code>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                4
              </span>
              <span>
                Open Portainer at <code>http://localhost:9200</code> and create admin account
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                5
              </span>
              <span>
                Get Portainer JWT token and add <code>PORTAINER_TOKEN</code> to <code>.env</code>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                6
              </span>
              <span>
                Restart dashboard: <code>docker-compose restart dashboard</code>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                7
              </span>
              <span>
                Open dashboard at <code>http://localhost:3100</code>
              </span>
            </li>
          </ol>

          <h4 className="font-semibold mt-6 mb-3">Local Development</h4>
          <ol className="text-muted-foreground space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-foreground text-xs font-bold shrink-0">
                1
              </span>
              <span>
                Run <code>npm install</code>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-foreground text-xs font-bold shrink-0">
                2
              </span>
              <span>
                Copy <code>.env.example</code> to <code>.env.local</code>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-foreground text-xs font-bold shrink-0">
                3
              </span>
              <span>
                Start runner: <code>cd runner && npx tsx index.ts</code>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-foreground text-xs font-bold shrink-0">
                4
              </span>
              <span>
                Start dashboard: <code>npm run dev</code>
              </span>
            </li>
          </ol>
        </Section>

        {/* Troubleshooting */}
        <Section title="Troubleshooting" icon={Terminal}>
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
            <li>Ensure port 9000 is accessible</li>
          </ul>

          <h4 className="font-semibold mb-2">&quot;Runner not responding&quot;</h4>
          <ul className="text-muted-foreground space-y-1 text-sm mb-4">
            <li>
              Check if the Runner is running: <code>curl http://127.0.0.1:8787/health</code>
            </li>
            <li>
              Verify the <code>RUNNER_TOKEN</code> matches on both sides
            </li>
            <li>Check Runner logs for errors</li>
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
    </>
  );
}
