#!/bin/bash
# Diagnose runner container startup issues

echo "=== Runner Container Diagnostics ==="
echo ""

# Check if runner container exists
echo "1. Checking if runner container exists..."
if docker ps -a --filter "name=marczelloo-runner" --format "{{.Names}}" | grep -q marczelloo-runner; then
    echo "   ✅ Runner container exists"
else
    echo "   ❌ Runner container does not exist"
    exit 1
fi

# Check container status
echo ""
echo "2. Checking container status..."
docker ps -a --filter "name=marczelloo-runner" --format "table {{.Names}}\t{{.Status}}\t{{.State}}"

# Check recent logs
echo ""
echo "3. Recent runner logs (last 30 lines):"
docker logs marczelloo-runner --tail 30 2>&1 || echo "   No logs available"

# Check if runner is responding
echo ""
echo "4. Testing runner health endpoint..."
if curl -s http://localhost:8787/health > /dev/null 2>&1; then
    echo "   ✅ Runner health endpoint responding"
    curl -s http://localhost:8787/health | head -5
else
    echo "   ❌ Runner health endpoint not responding"
fi

# Check SSH key mount
echo ""
echo "5. Checking SSH key mount..."
if docker exec marczelloo-runner ls -la /root/.ssh/id_rsa > /dev/null 2>&1; then
    echo "   ✅ SSH key is mounted"
    docker exec marczelloo-runner ls -la /root/.ssh/
else
    echo "   ⚠️  SSH key not found (runner will still work but SSH features disabled)"
fi

# Check projects mount
echo ""
echo "6. Checking projects directory mount..."
if docker exec marczelloo-runner ls /projects/ > /dev/null 2>&1; then
    echo "   ✅ Projects directory is mounted"
    docker exec marczelloo-runner ls /projects/
else
    echo "   ❌ Projects directory not mounted"
fi

# Check for common startup errors
echo ""
echo "7. Checking for common errors in logs..."
if docker logs marczelloo-runner 2>&1 | grep -qi "error\|fail\|cannot"; then
    echo "   ⚠️  Found errors in logs:"
    docker logs marczelloo-runner 2>&1 | grep -i "error\|fail\|cannot" | tail -5
else
    echo "   ✅ No obvious errors in logs"
fi

# Check restart count
echo ""
echo "8. Checking restart count..."
RESTART_COUNT=$(docker inspect marczelloo-runner --format='{{.RestartCount}}')
echo "   Container has restarted $RESTART_COUNT times"
if [ "$RESTART_COUNT" -gt 5 ]; then
    echo "   ⚠️  High restart count - container may be crashing"
fi

echo ""
echo "=== Diagnostics Complete ==="
echo ""
echo "To rebuild and restart runner:"
echo "  cd /home/Marczelloo_pi/projects/Marczelloo-dashboard"
echo "  docker compose build runner"
echo "  docker compose up -d --force-recreate runner"
echo ""
echo "To view runner logs in real-time:"
echo "  docker logs -f marczelloo-runner"
