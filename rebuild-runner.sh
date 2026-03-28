#!/bin/bash
echo "Rebuilding runner container with latest code..."
cd /home/Marczelloo_pi/projects/Marczelloo-dashboard

# Pull latest changes
git pull origin main

# Rebuild just the runner
docker compose build runner

# Restart runner
docker compose up -d --force-recreate runner

echo "Runner rebuilt! Checking status..."
sleep 3
docker logs marczelloo-runner --tail 20
