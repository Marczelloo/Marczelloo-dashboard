import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/lib/auth";

const RUNNER_URL = process.env.RUNNER_URL || "http://localhost:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;

interface PiMetrics {
  hostname: string;
  uptime: string;
  cpu: {
    usage: number;
    cores: number;
    load1: number;
    load5: number;
    load15: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    available: number;
    usagePercent: number;
  };
  disk: {
    total: string;
    used: string;
    available: string;
    usagePercent: number;
    mount: string;
  };
  temperature: number | null;
  docker: {
    containersRunning: number;
    containersStopped: number;
    imagesCount: number;
  };
  network: {
    ip: string;
  };
}

async function runCommand(command: string): Promise<string> {
  if (!RUNNER_TOKEN) {
    throw new Error("Runner not configured");
  }

  const response = await fetch(`${RUNNER_URL}/shell`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNNER_TOKEN}`,
    },
    body: JSON.stringify({ command }),
  });

  if (!response.ok) {
    throw new Error(`Command failed: ${response.status}`);
  }

  const result = await response.json();
  return (result.stdout || "").trim();
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!RUNNER_TOKEN) {
      return NextResponse.json({ success: false, error: "Runner not configured" }, { status: 500 });
    }

    // Run all commands in parallel for speed
    const [
      hostname,
      uptime,
      loadavg,
      cpuInfo,
      memInfo,
      diskInfo,
      tempInfo,
      dockerRunning,
      dockerStopped,
      dockerImages,
      ipInfo,
    ] = await Promise.all([
      runCommand("hostname").catch(() => "unknown"),
      runCommand("uptime -p").catch(() => "unknown"),
      runCommand("cat /proc/loadavg").catch(() => "0 0 0 0 0"),
      runCommand("nproc").catch(() => "4"),
      runCommand("free -m | awk '/Mem:/ {print $2,$3,$4,$7}'").catch(() => "0 0 0 0"),
      runCommand("df -h / | awk 'NR==2 {print $2,$3,$4,$5}'").catch(() => "0 0 0 0%"),
      runCommand("cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo 0").catch(() => "0"),
      runCommand("docker ps -q 2>/dev/null | wc -l").catch(() => "0"),
      runCommand("docker ps -aq --filter 'status=exited' 2>/dev/null | wc -l").catch(() => "0"),
      runCommand("docker images -q 2>/dev/null | wc -l").catch(() => "0"),
      runCommand("hostname -I | awk '{print $1}'").catch(() => "unknown"),
    ]);

    // Parse load average
    const loadParts = loadavg.split(" ");
    const load1 = parseFloat(loadParts[0]) || 0;
    const load5 = parseFloat(loadParts[1]) || 0;
    const load15 = parseFloat(loadParts[2]) || 0;

    // Parse CPU cores and estimate usage from load
    const cores = parseInt(cpuInfo) || 4;
    const cpuUsage = Math.min(100, Math.round((load1 / cores) * 100));

    // Parse memory info: total used free available
    const memParts = memInfo.split(" ");
    const memTotal = parseInt(memParts[0]) || 0;
    const memUsed = parseInt(memParts[1]) || 0;
    const memFree = parseInt(memParts[2]) || 0;
    const memAvailable = parseInt(memParts[3]) || 0;
    const memUsagePercent = memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0;

    // Parse disk info: total used available percent
    const diskParts = diskInfo.split(" ");
    const diskUsagePercent = parseInt(diskParts[3]?.replace("%", "")) || 0;

    // Parse temperature (Pi returns millidegrees)
    const tempRaw = parseInt(tempInfo) || 0;
    const temperature = tempRaw > 1000 ? tempRaw / 1000 : tempRaw;

    const metrics: PiMetrics = {
      hostname,
      uptime: uptime.replace("up ", ""),
      cpu: {
        usage: cpuUsage,
        cores,
        load1,
        load5,
        load15,
      },
      memory: {
        total: memTotal,
        used: memUsed,
        free: memFree,
        available: memAvailable,
        usagePercent: memUsagePercent,
      },
      disk: {
        total: diskParts[0] || "0G",
        used: diskParts[1] || "0G",
        available: diskParts[2] || "0G",
        usagePercent: diskUsagePercent,
        mount: "/",
      },
      temperature: temperature > 0 ? temperature : null,
      docker: {
        containersRunning: parseInt(dockerRunning) || 0,
        containersStopped: parseInt(dockerStopped) || 0,
        imagesCount: parseInt(dockerImages) || 0,
      },
      network: {
        ip: ipInfo || "unknown",
      },
    };

    return NextResponse.json({ success: true, data: metrics });
  } catch (error) {
    console.error("[Pi Metrics] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to get metrics" },
      { status: 500 }
    );
  }
}
