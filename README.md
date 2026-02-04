# Marczelloo Dashboard

<div align="center">

**A self-hosted project manager for Docker, GitHub, and website monitoring**

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?style=flat-square&logo=tailwindcss)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker)

</div>

---

## Overview

A private, self-hosted project manager panel for managing projects, Docker containers, and website monitoring. Designed for Raspberry Pi infrastructure with Docker, Portainer, and Cloudflare Tunnel.

**Key highlights:**

- 🚀 **One-click deploys** via git pull + Docker rebuild
- 📊 **GitHub integration** with commits, PRs, releases, and changelogs
- 📡 **Uptime monitoring** with Discord/email alerts
- 🔒 **Secure** with Cloudflare Access + PIN protection
- 🖥️ **Terminal access** to your Pi through the dashboard

---

## Features

### 📁 Project Management

- CRUD for projects with metadata, status, tags, technologies, and links
- **Import from GitHub** - Create projects directly from your GitHub repositories
- Technology badges with documentation links
- Project notes and detailed tracking

### 🐳 Container Management

- Start/stop/restart containers via Portainer API
- View container logs (tail) in real-time
- Container stats and health monitoring
- Docker Compose stack management

### 🔧 Service Management

- Track **Docker containers**, **Vercel deployments**, and **external services**
- Environment variables with encrypted storage
- Deploy strategies: `pull_restart`, `pull_rebuild`, `compose_up`
- **Deploy All** - Batch deploy all services in a project

### 📋 Work Items

- Track TODOs, bugs, features, and changes per project
- Priority levels: Low, Medium, High, Critical
- Status workflow: Open → In Progress → Done / Blocked
- Labels for categorization and filtering

### 📡 Website Monitoring

- Automatic uptime checks (configurable interval 1-60 min)
- HTTP status, latency, and SSL certificate expiry tracking
- Health check endpoints support
- Historical data with charts

### 🔔 Notifications

- **Discord webhooks** for downtime alerts, deploy results
- SSL expiry warnings (30/14/7 days)
- Optional SMTP email notifications

### 🖥️ Terminal

- Full SSH-like terminal access to Raspberry Pi
- Project directory shortcuts
- Session persistence

### ⚙️ Settings Dashboard

- Monitoring interval configuration
- Port tracker (scan used ports)
- Runner allowlist management
- Connection tests (Portainer, Runner, Discord)

### 📝 Audit Log

- Complete activity history
- Track all sensitive operations
- User and timestamp tracking

### 🔒 Security

- **Cloudflare Zero Trust** protection with email allowlist
- **PIN protection** for sensitive operations
- Encrypted environment variables (AES-256-GCM)

---

## GitHub Integration

Deep integration through a GitHub App for comprehensive repository management:

| Feature                 | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| **Activity Dashboard**  | View commits, pull requests, and releases in tabbed interface |
| **Branch Deploys**      | Deploy from any branch with branch selector                   |
| **README Viewer**       | Render repository README with full markdown support           |
| **File Browser**        | Navigate repository files/directories directly                |
| **Release Creator**     | Create releases with auto-generated semantic versions         |
| **Changelog Generator** | Generate changelogs between any two releases                  |
| **Work Item → Issue**   | Create GitHub issues from work items with auto-labels         |
| **Repository Sync**     | Import GitHub repositories as dashboard projects              |
| **Security Dashboard**  | View code scanning alerts and vulnerabilities                 |
| **Dependencies Viewer** | Analyze project dependencies from package.json                |
| **Branch Status**       | Compare branches, view ahead/behind counts                    |
| **Contributors**        | View repository contributors                                  |

### GitHub App Setup

1. Create a GitHub App in your GitHub settings
2. Configure permissions: Contents, Issues, PRs, Releases, Metadata
3. Generate and download a private key (.pem file)
4. Install the app on your repositories
5. Set environment variables:

```bash
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY=base64_encoded_private_key
GITHUB_APP_INSTALLATION_ID=12345678
```

---

## Tech Stack

| Layer              | Technologies                                  |
| ------------------ | --------------------------------------------- |
| **Frontend**       | Next.js 15 (App Router), React 19, TypeScript |
| **Styling**        | Tailwind CSS, shadcn/ui, Framer Motion        |
| **Data**           | AtlasHub REST API (self-hosted)               |
| **Containers**     | Portainer CE, Docker Compose                  |
| **Infrastructure** | Raspberry Pi, Cloudflare Tunnel               |

---

## Quick Start

### Docker Deployment (Recommended)

```bash
# Clone and configure
git clone https://github.com/yourusername/marczelloo-dashboard.git
cd marczelloo-dashboard
cp .env.example .env

# Edit .env with your values (see Environment Variables section)

# Start all services
docker-compose up -d --build
```

This starts:

- **Dashboard** on port `3100`
- **Runner** on port `8787` (internal)
- **Portainer** on port `9200`

### Initial Setup

1. Open Portainer at `http://localhost:9200` and create admin account
2. Get JWT token from Portainer API
3. Add `PORTAINER_TOKEN` to `.env`
4. Restart: `docker-compose restart dashboard`
5. Open dashboard at `http://localhost:3100`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Access                        │
│                   (Authentication Layer)                    │
└─────────────────────────────┬───────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │    Dashboard      │
                    │   (Next.js App)   │
                    │   Port: 3100      │
                    └─────────┬─────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼───────┐    ┌────────▼────────┐   ┌───────▼───────┐
│   AtlasHub    │    │     Runner      │   │   Portainer   │
│  (Database)   │    │ (Git/Docker Ops)│   │ (Containers)  │
│   External    │    │   Port: 8787    │   │  Port: 9200   │
└───────────────┘    └─────────────────┘   └───────────────┘
```

---

## Directory Structure

```
├── docker-compose.yml     # Full stack deployment
├── Dockerfile             # Dashboard container
├── runner/
│   ├── Dockerfile         # Runner container
│   ├── index.ts           # Runner service
│   └── data/              # Persistent allowlist
├── src/
│   ├── app/               # Next.js pages & API routes
│   │   ├── (dashboard)/   # Dashboard pages
│   │   └── api/           # API endpoints
│   ├── components/        # UI components
│   ├── server/            # Server-only modules
│   └── types/             # TypeScript types
└── docs/                  # Documentation
```

---

## Environment Variables

### Required

| Variable              | Description                   |
| --------------------- | ----------------------------- |
| `ATLASHUB_API_URL`    | AtlasHub API endpoint         |
| `ATLASHUB_SECRET_KEY` | AtlasHub API key              |
| `RUNNER_TOKEN`        | Shared secret for runner auth |

### GitHub Integration

| Variable                     | Description                |
| ---------------------------- | -------------------------- |
| `GITHUB_APP_ID`              | GitHub App ID              |
| `GITHUB_APP_PRIVATE_KEY`     | Base64-encoded private key |
| `GITHUB_APP_INSTALLATION_ID` | Installation ID            |

### Optional

| Variable                 | Default                  | Description              |
| ------------------------ | ------------------------ | ------------------------ |
| `PORTAINER_URL`          | `http://portainer:9000`  | Portainer URL            |
| `PORTAINER_TOKEN`        | -                        | Portainer JWT token      |
| `RUNNER_URL`             | `http://runner:8787`     | Runner service URL       |
| `DEV_USER_EMAIL`         | `admin@marczelloo.local` | Dev mode user email      |
| `MONITORING_INTERVAL_MS` | `300000`                 | Monitoring interval (ms) |
| `DISCORD_WEBHOOK_URL`    | -                        | Discord alerts           |
| `ENCRYPTION_KEY`         | -                        | Env vars encryption key  |

---

## Services

### Dashboard (port 3100)

Main web interface. Features:

- Project/service management
- GitHub integration
- Uptime monitoring
- Container controls

### Runner (port 8787)

Secure deploy service. Operations:

- `git pull` in allowed repo paths
- `docker compose up -d --build`
- `docker restart`
- Log fetching

**Security:** Only executes operations for items in the allowlist. Configure via Settings → Runner Allowlist.

### Portainer (port 9200)

Docker management UI. Dashboard uses Portainer API for:

- Container list and status
- Start/stop/restart
- Logs and stats

---

## Terminal SSH Setup

```bash
# Generate SSH key on Pi
ssh-keygen -t rsa -N "" -f ~/.ssh/dashboard_runner
cat ~/.ssh/dashboard_runner.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Add to .env
SSH_USER=pi
SSH_KEY_PATH=~/.ssh/dashboard_runner
DEFAULT_CWD=/home/pi
PROJECTS_DIR=/home/pi/projects
```

---

## Database Tables

All data stored in AtlasHub:

| Table           | Description                     |
| --------------- | ------------------------------- |
| `projects`      | Project metadata                |
| `services`      | Docker/Vercel/external services |
| `work_items`    | Tasks, bugs, features           |
| `env_vars`      | Encrypted environment variables |
| `deploys`       | Deployment history              |
| `uptime_checks` | Monitoring history              |
| `audit_logs`    | Activity history                |

---

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

# Build
npm run build
```

---

## Cloudflare Zero Trust Setup

1. Install cloudflared on Pi
2. Create tunnel: `cloudflared tunnel create marczelloo-dashboard`
3. Configure `~/.cloudflared/config.yml`
4. Create Cloudflare Access application with email allowlist
5. Start tunnel as service: `sudo cloudflared service install`

See full guide in `/docs` page.

---

## API Rate Limits

Using GitHub App installation tokens, you get:

- **5,000 requests/hour** per installation
- **30 requests/minute** for Search API
- **Completely free** - no charges for API calls

---

## License

Private - All rights reserved.
