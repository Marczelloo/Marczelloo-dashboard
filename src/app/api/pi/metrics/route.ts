import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/lib/auth";
import { isDemoMode } from "@/lib/demo-mode";
import { mockPiMetrics } from "@/lib/mock-data";

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

    // Return mock data in demo mode
    if (isDemoMode()) {
      return NextResponse.json({ success: true, data: mockPiMetrics });
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
      memInfoRaw,
      diskInfoRaw,
      tempInfo,
      dockerRunning,
      dockerStopped,
      dockerImages,
      ipInfoRaw,
    ] = await Promise.all([
      runCommand("hostname").catch(() => "unknown"),
      runCommand("uptime -p").catch(() => "unknown"),
      runCommand("cat /proc/loadavg").catch(() => "0 0 0 0 0"),
      runCommand("nproc").catch(() => "4"),
      runCommand("free -m").catch(() => ""),
      runCommand("df -h /").catch(() => ""),
      runCommand("cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo 0").catch(() => "0"),
      runCommand("docker ps -q 2>/dev/null | wc -l").catch(() => "0"),
      runCommand("docker ps -aq --filter status=exited 2>/dev/null | wc -l").catch(() => "0"),
      runCommand("docker images -q 2>/dev/null | wc -l").catch(() => "0"),
      runCommand("hostname -I").catch(() => "unknown"),
    ]);

    // Parse memory from raw free -m output
    // Format varies: "Mem:  total  used  free  shared  buff/cache  available"
    // or on some systems: "Mem:  total  used  free  shared  buffers  cached"
    let memTotal = 0,
      memUsed = 0,
      memFree = 0,
      memAvailable = 0;
    const memLines = memInfoRaw.split("\n");
    for (const line of memLines) {
      // Match "Mem:" case-insensitively, or lines that contain memory values
      if (line.toLowerCase().includes("mem")) {
        const parts = line.split(/\s+/).filter(Boolean);
        // parts: ["Mem:", total, used, free, shared, buff/cache, available]
        // Find the first numeric values after "Mem:"
        const numericParts = parts.filter((p) => /^\d+$/.test(p));
        if (numericParts.length >= 3) {
          memTotal = parseInt(numericParts[0]) || 0;
          memUsed = parseInt(numericParts[1]) || 0;
          memFree = parseInt(numericParts[2]) || 0;
          memAvailable = parseInt(numericParts[5]) || parseInt(numericParts[2]) || 0;
          break;
        }
      }
    }

    // Fallback: try parsing /proc/meminfo style if free -m failed
    if (memTotal === 0) {
      // Try an alternative approach using cat /proc/meminfo
      try {
        const meminfoRaw = await runCommand("cat /proc/meminfo");
        const meminfoLines = meminfoRaw.split("\n");
        for (const line of meminfoLines) {
          if (line.startsWith("MemTotal:")) {
            memTotal = Math.round(parseInt(line.match(/\d+/)?.[0] || "0") / 1024); // KB to MB
          } else if (line.startsWith("MemFree:")) {
            memFree = Math.round(parseInt(line.match(/\d+/)?.[0] || "0") / 1024);
          } else if (line.startsWith("MemAvailable:")) {
            memAvailable = Math.round(parseInt(line.match(/\d+/)?.[0] || "0") / 1024);
          }
        }
        memUsed = memTotal - memAvailable;
      } catch {
        // Ignore fallback errors
      }
    }

    // Parse disk from raw df -h output
    // Format: "Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        50G   20G   28G  42% /"
    let diskTotal = "0G",
      diskUsed = "0G",
      diskAvailable = "0G",
      diskUsagePercent = 0;
    const diskLines = diskInfoRaw.split("\n");
    for (let i = 1; i < diskLines.length; i++) {
      const line = diskLines[i];
      if (line.trim()) {
        const parts = line.split(/\s+/).filter(Boolean);
        // parts: [filesystem, size, used, avail, use%, mounted]
        if (parts.length >= 5) {
          diskTotal = parts[1] || "0G";
          diskUsed = parts[2] || "0G";
          diskAvailable = parts[3] || "0G";
          diskUsagePercent = parseInt(parts[4]?.replace("%", "")) || 0;
          break;
        }
      }
    }

    // Parse IP
    const ipInfo = ipInfoRaw.split(/\s+/)[0] || "unknown";

    // Parse load average
    const loadParts = loadavg.split(" ");
    const load1 = parseFloat(loadParts[0]) || 0;
    const load5 = parseFloat(loadParts[1]) || 0;
    const load15 = parseFloat(loadParts[2]) || 0;

    // Parse CPU cores and estimate usage from load
    const cores = parseInt(cpuInfo) || 4;
    const cpuUsage = Math.min(100, Math.round((load1 / cores) * 100));

    // Calculate memory usage percent
    const memUsagePercent = memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0;

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
        total: diskTotal,
        used: diskUsed,
        available: diskAvailable,
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
