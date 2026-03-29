#!/bin/bash
# Ensure runner container is running and restart if needed

RUNNER_CONTAINER="marczelloo-runner"

echo "Checking runner container status..."

# Check if container exists
if ! docker ps -a --format "{{.Names}}" | grep -q "^${RUNNER_CONTAINER}$"; then
    echo "❌ Runner container does not exist, creating..."
    cd /home/Marczelloo_pi/projects/Marczelloo-dashboard
    docker compose up -d runner
    exit 0
fi

# Check if container is running
if docker ps --format "{{.Names}}" | grep -q "^${RUNNER_CONTAINER}$"; then
    echo "✅ Runner is running"
    docker ps --filter "name=${RUNNER_CONTAINER}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    exit 0
fi

# Container exists but not running
echo "⚠️  Runner exists but is not running"
echo "Container status:"
docker ps -a --filter "name=${RUNNER_CONTAINER}" --format "table {{.Names}}\t{{.Status}}"

# Check for recent errors
echo ""
echo "Recent logs:"
docker logs ${RUNNER_CONTAINER} --tail 20 2>&1

# Ask if user wants to restart
echo ""
echo "Runner is not running. Attempting to restart..."
cd /home/Marczelloo_pi/projects/Marczelloo-dashboard
docker compose up -d runner

echo ""
echo "Waiting for runner to start..."
sleep 5

# Check if it started successfully
if docker ps --format "{{.Names}}" | grep -q "^${RUNNER_CONTAINER}$"; then
    echo "✅ Runner restarted successfully"
    docker logs ${RUNNER_CONTAINER} --tail 10
else
    echo "❌ Runner failed to start. Run 'scripts/diagnose-runner.sh' for diagnostics"
    exit 1
fi
