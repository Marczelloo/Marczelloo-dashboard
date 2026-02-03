# Marczelloo Dashboard

A private, self-hosted project manager panel for managing projects, Docker containers, and website monitoring on a Raspberry Pi.

## Features

- **Project Management**: CRUD for projects with metadata, status, tags, technologies, and links
- **Service Management**: Track Docker containers, Vercel deployments, and external services
- **Work Items**: Track TODOs, bugs, features, and changes per project
- **Website Monitoring**: Automatic uptime checks with configurable intervals and Discord alerts
- **Container Management**: Start/stop/restart containers via Portainer API
- **Deployments**: Git pull + Docker rebuild/restart automation via Runner service
- **Deploy All**: Batch deploy all services in a project with selectable strategy
- **Terminal**: Full SSH-like terminal access to Pi through the dashboard
- **Environment Variables**: Encrypted storage with ability to load from .env files
- **Settings Dashboard**: Configure monitoring intervals, port tracker, runner allowlists
- **Notifications**: Discord webhooks for downtime alerts
- **Audit Log**: Complete activity history
- **Cloudflare Zero Trust**: Protected by Cloudflare Access with email allowlist

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components, Framer Motion
- **Data**: AtlasHub REST API (self-hosted)
- **Container Management**: Portainer CE
- **Infrastructure**: Raspberry Pi, Docker, Cloudflare Tunnel

## Quick Start with Docker

### 1. Clone and Configure

```bash
git clone https://github.com/yourusername/marczelloo-dashboard.git
cd marczelloo-dashboard
cp .env.example .env
```

### 2. Edit Environment Variables

```bash
# Required
ATLASHUB_API_URL=https://api-atlashub.marczelloo.dev
ATLASHUB_SECRET_KEY=sk_your_secret_key
RUNNER_TOKEN=your_random_token  # Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Optional
DEV_USER_EMAIL=admin@example.com
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
MONITORING_INTERVAL_MS=300000  # 5 minutes
```

### 3. Start All Services

```bash
docker-compose up -d --build
```

This starts:

- **Dashboard** on port `3100`
- **Runner** on port `8787`
- **Portainer** on port `9200`

### 4. Initial Setup

1. Open Portainer at `http://localhost:9200` and create admin account
2. Get JWT token: POST to `/api/auth` with username/password
3. Add `PORTAINER_TOKEN` to your `.env` file
4. Restart dashboard: `docker-compose restart dashboard`

## Services

### Dashboard (port 3100)

Main web interface for managing projects, services, and monitoring.

**Key Features:**

- Project/service CRUD
- Uptime monitoring with configurable intervals
- Container management via Portainer
- Audit logging

### Runner (port 8787)

Local service for executing git and Docker operations securely.

**Endpoints:**
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check |
| `/status` | GET | No | Service status |
| `/allowlist` | GET | Yes | Get allowlist |
| `/allowlist` | PUT | Yes | Update allowlist |
| `/execute` | POST | Yes | Run operations |

**Allowlist Configuration:**

The runner only executes operations for items in its allowlist. Configure via:

1. **Dashboard**: Settings → Runner Allowlist
2. **File**: `runner/data/allowlist.json`

```json
{
  "repo_paths": ["/home/pi/projects/my-app"],
  "compose_projects": ["my-app"],
  "container_names": ["my-container"]
}
```

### Portainer (port 9200)

Docker management UI. Dashboard uses Portainer API for container operations.

## Terminal SSH Setup

The dashboard terminal feature requires SSH access from the runner container to the Pi host.

### 1. Generate SSH Key (on Pi)

```bash
# Generate a dedicated SSH key for the dashboard
ssh-keygen -t rsa -N "" -f ~/.ssh/dashboard_runner

# Add to authorized_keys
cat ~/.ssh/dashboard_runner.pub >> ~/.ssh/authorized_keys

# Ensure correct permissions
chmod 600 ~/.ssh/authorized_keys
```

### 2. Configure Environment

Add to your `.env` file:

```bash
SSH_USER=pi                          # Your Pi username
SSH_KEY_PATH=~/.ssh/dashboard_runner # Path to private key
DEFAULT_CWD=/home/pi                 # Default terminal directory
PROJECTS_DIR=/home/pi/projects       # Projects directory
```

### 3. Restart Services

```bash
docker-compose down
docker-compose up -d --build
```

### 4. Verify SSH Connection

Check runner status at `http://localhost:8787/status` - you should see:

```json
{
  "ssh": {
    "enabled": true,
    "configured": true,
    "host": "host.docker.internal",
    "user": "pi"
  }
}
```

**Note:** If `configured: false`, the SSH key mount failed. Check the key path exists.

## Settings Page Features

### Monitoring Interval

Configure how often uptime checks run (1-60 minutes). Changes take effect on server restart.

### Port Tracker

Scan which ports are in use on the host machine. Useful for avoiding conflicts when self-hosting multiple apps.

### Runner Allowlist

Manage which repositories, compose projects, and containers the runner can access. All changes are persisted.

### Connection Tests

Test connectivity to Portainer, Runner, and Discord webhook.

## Directory Structure

```
├── docker-compose.yml     # Full stack deployment
├── Dockerfile             # Dashboard container
├── runner/
│   ├── Dockerfile         # Runner container
│   ├── index.ts           # Runner service
│   └── data/              # Persistent allowlist
├── src/
│   ├── app/               # Next.js pages & API
│   ├── components/        # UI components
│   ├── server/            # Server-only modules
│   └── types/             # TypeScript types
└── docs/                  # Documentation
```

## Environment Variables

| Variable                 | Required | Default                  | Description                   |
| ------------------------ | -------- | ------------------------ | ----------------------------- |
| `ATLASHUB_API_URL`       | Yes      | -                        | AtlasHub API endpoint         |
| `ATLASHUB_SECRET_KEY`    | Yes      | -                        | AtlasHub API key              |
| `PORTAINER_URL`          | No       | `http://portainer:9000`  | Portainer URL                 |
| `PORTAINER_TOKEN`        | No       | -                        | Portainer JWT token           |
| `RUNNER_URL`             | No       | `http://runner:8787`     | Runner service URL            |
| `RUNNER_TOKEN`           | Yes      | -                        | Shared secret for runner auth |
| `DEV_USER_EMAIL`         | No       | `admin@marczelloo.local` | User for audit logs           |
| `MONITORING_INTERVAL_MS` | No       | `300000`                 | Check interval (ms)           |
| `DISCORD_WEBHOOK_URL`    | No       | -                        | Discord alerts                |

## Database Tables

All data stored in AtlasHub:

- `projects` - Project metadata
- `services` - Docker/Vercel/external services
- `work_items` - TODOs, bugs, changes
- `uptime_checks` - Monitoring history
- `deploys` - Deployment records
- `audit_logs` - Activity history

Run `npm run db:setup` to create tables.

## Development

```bash
# Install dependencies
npm install

# Start dashboard (dev mode)
npm run dev

# Start runner (separate terminal)
cd runner && npx tsx index.ts

# Type check
npx tsc --noEmit
```

## License

Private - All rights reserved.

---

## Cloudflare Zero Trust Setup

This dashboard is designed to be protected by Cloudflare Access for secure remote access.

### Prerequisites

- Cloudflare account with Zero Trust enabled
- Domain managed by Cloudflare
- Cloudflare Tunnel (cloudflared) installed on Pi

### 1. Create Cloudflare Tunnel

```bash
# Install cloudflared on Pi
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Login and create tunnel
cloudflared tunnel login
cloudflared tunnel create marczelloo-dashboard

# Note the tunnel ID from output
```

### 2. Configure Tunnel

Create `/home/pi/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/pi/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: dashboard.marczelloo.dev
    service: http://localhost:3100
  - hostname: portainer.marczelloo.dev
    service: http://localhost:9201
  - service: http_status:404
```

### 3. Create DNS Records

```bash
cloudflared tunnel route dns marczelloo-dashboard dashboard.marczelloo.dev
cloudflared tunnel route dns marczelloo-dashboard portainer.marczelloo.dev
```

### 4. Create Cloudflare Access Application

1. Go to Cloudflare Zero Trust Dashboard → Access → Applications
2. Click "Add an application" → Self-hosted
3. Configure:
   - **Application name**: Marczelloo Dashboard
   - **Session duration**: 24 hours (or preferred)
   - **Application domain**: `dashboard.marczelloo.dev`
   - **Path**: Leave empty (protects entire app)

### 5. Create Access Policy

1. In the application, add a policy:
   - **Policy name**: Owner Access
   - **Action**: Allow
   - **Include**: Emails - your email address
2. (Optional) Add additional rules:
   - Require specific country
   - Require device posture
   - Add one-time PIN as second factor

### 6. Start Tunnel as Service

```bash
# Install as systemd service
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# Check status
sudo systemctl status cloudflared
```

### 7. Verify Setup

1. Access `https://dashboard.marczelloo.dev`
2. You should see Cloudflare Access login
3. Enter your email and verify with the link/code sent
4. After authentication, you're in the dashboard

### Reading Cloudflare Identity Headers

The dashboard can read authenticated user info from Cloudflare headers:

```typescript
// In API routes/server components
const userEmail = request.headers.get("cf-access-authenticated-user-email");
const userJwt = request.headers.get("cf-access-jwt-assertion");
```

---
