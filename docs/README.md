# Marczelloo Dashboard

A private, self-hosted project manager panel designed for managing and monitoring projects deployed via Docker, Portainer, and Cloudflare Tunnel. This dashboard features a modern dark-mode UI with a distinctive red accent theme.

## Table of Contents

- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [AtlasHub Integration](#atlashub-integration)
- [Portainer Integration](#portainer-integration)
- [Runner Service](#runner-service)
- [Authentication](#authentication)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Local Development](#local-development)
- [Deployment](#deployment)

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- AtlasHub instance (for data persistence)
- Docker & Portainer (optional, for container management)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/marczelloo-dashboard.git
cd marczelloo-dashboard

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Configure your .env.local (see Environment Variables section)

# Run development server
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

---

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# ============================================
# AtlasHub (Required)
# ============================================
ATLASHUB_API_URL=http://localhost:3001
ATLASHUB_SECRET_KEY=sk_your_secret_key

# ============================================
# Authentication
# ============================================
# Allowed owner email (matches Cloudflare Access header)
OWNER_EMAIL=you@example.com

# PIN for sensitive operations (bcrypt or argon2 hash)
PIN_HASH=$2b$10$...

# Encryption key for env var secrets (32 bytes, base64)
ENCRYPTION_KEY=your-32-byte-base64-key

# ============================================
# Development Only
# ============================================
# Skip Cloudflare Access email check in dev
DEV_USER_EMAIL=dev@example.com

# Skip PIN verification in dev (never in production!)
DEV_SKIP_PIN=true

# ============================================
# Portainer Integration (Optional)
# ============================================
PORTAINER_URL=http://localhost:9000
PORTAINER_TOKEN=your_portainer_jwt_token

# ============================================
# Runner Service (Optional)
# ============================================
RUNNER_URL=http://127.0.0.1:8787
RUNNER_TOKEN=your_runner_shared_secret

# ============================================
# Notifications (Optional)
# ============================================
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=dashboard@example.com
SMTP_TO=alerts@example.com
```

---

## AtlasHub Integration

This dashboard uses [AtlasHub](https://atlashub.dev) as its data layer. All CRUD operations are performed via the AtlasHub REST API.

### Required Tables

Create the following tables in your AtlasHub project:

#### `projects`

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  github_url TEXT,
  prod_url TEXT,
  vercel_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `services`

```sql
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,
  url TEXT,
  health_url TEXT,
  portainer_endpoint_id INTEGER,
  container_id VARCHAR(100),
  stack_id INTEGER,
  repo_path TEXT,
  compose_project VARCHAR(100),
  deploy_strategy VARCHAR(20) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `work_items`

```sql
CREATE TABLE work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  labels JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `deploys`

```sql
CREATE TABLE deploys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  commit_sha VARCHAR(50),
  logs_object_key TEXT,
  triggered_by VARCHAR(100) NOT NULL,
  error_message TEXT
);
```

#### `uptime_checks`

```sql
CREATE TABLE uptime_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_code INTEGER,
  latency_ms INTEGER,
  ssl_days_left INTEGER,
  ok BOOLEAN NOT NULL,
  error TEXT
);
```

#### `env_vars`

```sql
CREATE TABLE env_vars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  value_encrypted TEXT NOT NULL,
  is_secret BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `audit_logs`

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_email VARCHAR(200) NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  meta_json JSONB
);
```

### AtlasHub API Examples

```typescript
// Get all projects
const res = await fetch(`${ATLASHUB_API_URL}/v1/db/projects?order=created_at.desc`, {
  headers: { "x-api-key": ATLASHUB_SECRET_KEY },
});

// Create a project
const res = await fetch(`${ATLASHUB_API_URL}/v1/db/projects`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": ATLASHUB_SECRET_KEY,
  },
  body: JSON.stringify({
    rows: [
      {
        name: "My Project",
        slug: "my-project",
        status: "active",
      },
    ],
    returning: true,
  }),
});

// Update a project
const res = await fetch(`${ATLASHUB_API_URL}/v1/db/projects?eq.id=${projectId}`, {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": ATLASHUB_SECRET_KEY,
  },
  body: JSON.stringify({
    values: { status: "maintenance" },
    returning: true,
  }),
});

// Delete a project
const res = await fetch(`${ATLASHUB_API_URL}/v1/db/projects?eq.id=${projectId}`, {
  method: "DELETE",
  headers: { "x-api-key": ATLASHUB_SECRET_KEY },
});
```

---

## Portainer Integration

The dashboard integrates with Portainer to manage Docker containers.

### Configuration

1. Get your Portainer JWT token:

   ```bash
   curl -X POST https://your-portainer:9000/api/auth \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"your-password"}'
   ```

2. Set in `.env.local`:
   ```env
   PORTAINER_URL=http://localhost:9000
   PORTAINER_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### Supported Operations

- **List containers**: View all containers with status
- **View logs**: Tail container logs in real-time
- **Start/Stop/Restart**: Control container lifecycle
- **Inspect**: View container details

### Example: List Containers

```typescript
const containers = await portainer.getContainers(endpointId);
// Returns: [{ Id, Names, State, Status, ... }]
```

---

## Runner Service

The Runner is a lightweight local service that executes git pull + docker compose operations.

### Security Model

The Runner only accepts requests from localhost and validates a shared secret token. It maintains a strict allowlist of:

- Repository paths
- Compose project names
- Allowed operations

### Installation

```bash
cd runner
npm install
npm start
```

### Configuration

```env
# In runner/.env
RUNNER_PORT=8787
RUNNER_TOKEN=your_shared_secret
ALLOWED_REPOS=/home/pi/projects/app1,/home/pi/projects/app2
ALLOWED_PROJECTS=app1,app2
```

### API

```typescript
// POST /deploy
{
  "repo_path": "/home/pi/projects/my-app",
  "compose_project": "my-app",
  "operation": "pull_restart"
}

// Response
{
  "success": true,
  "commit_sha": "abc1234",
  "message": "Deployed successfully"
}
```

### Operations

| Operation      | Description                             |
| -------------- | --------------------------------------- |
| `pull_restart` | git pull + docker restart               |
| `pull_rebuild` | git pull + docker compose build + up -d |
| `compose_up`   | docker compose up -d                    |
| `logs`         | Tail container logs                     |

---

## Authentication

### Cloudflare Access

In production, the app is protected by Cloudflare Access:

1. Set up Cloudflare Tunnel to your app
2. Configure Access policies to restrict by email
3. The app reads `Cf-Access-Authenticated-User-Email` header

### PIN Verification

Sensitive operations require PIN re-authentication:

- Create/Update/Delete projects
- Reveal environment variables
- Deploy services
- Container actions

Generate a PIN hash:

```typescript
import bcrypt from "bcrypt";
const hash = await bcrypt.hash("1234", 10);
// Set PIN_HASH in .env.local
```

### Development Mode

For local development, set:

```env
DEV_USER_EMAIL=dev@example.com
DEV_SKIP_PIN=true
```

---

## API Reference

### Projects

| Method | Endpoint             | Description       |
| ------ | -------------------- | ----------------- |
| GET    | `/api/projects`      | List all projects |
| GET    | `/api/projects/[id]` | Get project by ID |
| POST   | `/api/projects`      | Create project    |
| PUT    | `/api/projects/[id]` | Update project    |
| DELETE | `/api/projects/[id]` | Delete project    |

### Services

| Method | Endpoint             | Description       |
| ------ | -------------------- | ----------------- |
| GET    | `/api/services/[id]` | Get service by ID |

### Work Items

| Method | Endpoint               | Description         |
| ------ | ---------------------- | ------------------- |
| GET    | `/api/work-items/[id]` | Get work item by ID |

### Notifications

| Method | Endpoint             | Description              |
| ------ | -------------------- | ------------------------ |
| GET    | `/api/notifications` | Get recent notifications |

---

## Database Schema

```
┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│   projects   │────<│   services    │────<│   deploys    │
└──────────────┘     └───────────────┘     └──────────────┘
       │                    │
       │                    │
       ▼                    ▼
┌──────────────┐     ┌───────────────┐
│  work_items  │     │   env_vars    │
└──────────────┘     └───────────────┘
                            │
                            ▼
                     ┌───────────────┐
                     │ uptime_checks │
                     └───────────────┘

┌───────────────┐
│  audit_logs   │
└───────────────┘
```

---

## Local Development

### Starting the Development Server

```bash
npm run dev
```

### Building for Production

```bash
npm run build
npm start
```

### Testing AtlasHub Connection

```bash
# List tables
curl -X GET "https://your-atlashub/v1/db/tables" \
  -H "x-api-key: sk_your_key"

# Test insert
curl -X POST "https://your-atlashub/v1/db/projects" \
  -H "x-api-key: sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"rows":[{"name":"Test","slug":"test"}],"returning":true}'
```

### Local Portainer Setup

```bash
# Run Portainer locally for testing
docker run -d \
  -p 9000:9000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  --name portainer \
  portainer/portainer-ce:latest
```

Access at `http://localhost:9000` and set up your admin credentials.

### Local Runner Setup

See the [Runner Service](#runner-service) section.

---

## Terminal

The dashboard includes a full SSH-like terminal for remote access to the Pi.

### Features

- **Inline typing experience**: Type directly in the terminal window
- **Command history**: Use up/down arrows to navigate history
- **Persistent working directory**: `cd` commands are tracked across commands
- **Full shell access**: Run any bash command

### How It Works

The terminal uses the Runner service's `/shell` endpoint:

```typescript
// POST /shell
{
  "command": "ls -la",
  "cwd": "/home/pi/projects"  // Optional, uses last cwd
}

// Response
{
  "success": true,
  "stdout": "total 48\ndrwxr-xr-x 6 pi pi 4096 ...",
  "stderr": "",
  "cwd": "/home/pi/projects"
}
```

### Security

- Only accessible through authenticated dashboard
- Runner validates shared secret token
- Commands executed in isolated bash subprocess
- Working directory is preserved between commands

---

## Deployment

### Docker Compose (Recommended)

The project includes a complete `docker-compose.yml` that runs:

- **Dashboard** (port 3100): Next.js app
- **Runner** (port 8787): Shell/deploy service
- **Portainer** (port 9201): Container management

```bash
# Start all services
docker compose up -d --build

# View logs
docker compose logs -f

# Restart specific service
docker compose restart dashboard
```

### Environment Variables

Create `.env` in the project root:

```yaml
# cloudflared config.yml
tunnel: your-tunnel-id
credentials-file: /etc/cloudflared/credentials.json

ingress:
  - hostname: dashboard.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

---

## Troubleshooting

### "Not Authenticated" Error

- In development, ensure `DEV_USER_EMAIL` is set in `.env.local`
- In production, verify Cloudflare Access is configured correctly

### "PIN Required" Error

- In development, set `DEV_SKIP_PIN=true` in `.env.local`
- In production, ensure `PIN_HASH` is set correctly

### AtlasHub Connection Errors

1. Verify `ATLASHUB_API_URL` is correct and reachable
2. Check that `ATLASHUB_SECRET_KEY` has the `sk_` prefix
3. Test with: `curl -H "x-api-key: sk_..." $ATLASHUB_API_URL/v1/db/tables`

### Work Item Creation Fails

- Ensure the `project_id` is a valid UUID from an existing project
- Check that required fields (type, title) are provided

---

## License

Private project - All rights reserved.
