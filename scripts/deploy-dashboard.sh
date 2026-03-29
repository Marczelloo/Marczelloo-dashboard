#!/bin/bash
# Helper script to deploy dashboard via terminal
# Run this from the dashboard's web terminal

echo "🚀 Starting Dashboard Deployment..."
echo ""

# Get the dashboard repo path from environment or use default
DASHBOARD_REPO="${DASHBOARD_REPO_PATH:-/home/Marczelloo_pi/projects/Marczelloo-dashboard}"

echo "📍 Dashboard repo: $DASHBOARD_REPO"
echo ""

# Check if we're in the right directory
if [ ! -d "$DASHBOARD_REPO" ]; then
    echo "❌ Dashboard directory not found: $DASHBOARD_REPO"
    echo "Please check DASHBOARD_REPO_PATH environment variable"
    exit 1
fi

cd "$DASHBOARD_REPO" || exit 1

echo "✅ Changed to dashboard directory"
echo ""

# Pull latest changes
echo "📥 Pulling latest changes..."
if git pull origin main; then
    echo "✅ Git pull successful"
else
    echo "❌ Git pull failed"
    exit 1
fi

echo ""

# Build containers
echo "🔨 Building dashboard and runner containers..."
if docker compose build dashboard runner; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

echo ""

# Restart containers
echo "🔄 Restarting containers..."
if docker compose up -d --force-recreate dashboard runner; then
    echo "✅ Containers restarted"
else
    echo "❌ Failed to restart containers"
    exit 1
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Container status:"
docker ps --filter "name=marczelloo" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Dashboard logs (last 10 lines):"
docker logs marczelloo-dashboard --tail 10
