import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface PortInfo {
  port: number;
  protocol: string;
  state: string;
  process: string;
  pid: number | null;
}

// GET - Scan local ports
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rangeStart = parseInt(searchParams.get("start") || "3000", 10);
  const rangeEnd = parseInt(searchParams.get("end") || "9999", 10);

  try {
    let ports: PortInfo[] = [];

    // Detect OS and run appropriate command
    const isWindows = process.platform === "win32";

    if (isWindows) {
      // Windows: Use netstat
      const { stdout } = await execAsync("netstat -ano -p TCP");
      const lines = stdout.split("\n").filter((line) => line.includes("LISTENING"));

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const address = parts[1];
          const portMatch = address.match(/:(\d+)$/);
          if (portMatch) {
            const port = parseInt(portMatch[1], 10);
            if (port >= rangeStart && port <= rangeEnd) {
              const pid = parseInt(parts[4], 10);
              let processName = "unknown";

              try {
                const { stdout: procOut } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
                const procParts = procOut.split(",");
                if (procParts.length > 0) {
                  processName = procParts[0].replace(/"/g, "");
                }
              } catch {
                // Ignore errors getting process name
              }

              ports.push({
                port,
                protocol: "TCP",
                state: "LISTENING",
                process: processName,
                pid,
              });
            }
          }
        }
      }
    } else {
      // Linux/Mac: Use ss or netstat
      try {
        const { stdout } = await execAsync("ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null");
        const lines = stdout.split("\n").slice(1); // Skip header

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 4) {
            const address = parts[3] || parts[2];
            const portMatch = address.match(/:(\d+)$/);
            if (portMatch) {
              const port = parseInt(portMatch[1], 10);
              if (port >= rangeStart && port <= rangeEnd) {
                // Try to get process info
                let processName = "unknown";
                let pid: number | null = null;

                const pidMatch = line.match(/pid=(\d+)/);
                if (pidMatch) {
                  pid = parseInt(pidMatch[1], 10);
                }

                const processMatch = line.match(/users:\(\("([^"]+)"/);
                if (processMatch) {
                  processName = processMatch[1];
                }

                ports.push({
                  port,
                  protocol: "TCP",
                  state: "LISTENING",
                  process: processName,
                  pid,
                });
              }
            }
          }
        }
      } catch {
        // Fallback if ss/netstat not available
      }
    }

    // Sort by port number and remove duplicates
    ports = ports.filter((p, i, arr) => arr.findIndex((x) => x.port === p.port) === i).sort((a, b) => a.port - b.port);

    // Common ports reference
    const commonPorts: Record<number, string> = {
      22: "SSH",
      80: "HTTP",
      443: "HTTPS",
      3000: "Node.js/AtlasHub",
      3100: "Dashboard",
      5432: "PostgreSQL",
      6379: "Redis",
      8080: "HTTP Alt",
      8787: "Runner",
      9000: "Portainer/MinIO",
      9200: "Portainer",
      27017: "MongoDB",
    };

    // Add common port labels
    const portsWithLabels = ports.map((p) => ({
      ...p,
      label: commonPorts[p.port] || null,
    }));

    return NextResponse.json({
      success: true,
      ports: portsWithLabels,
      range: { start: rangeStart, end: rangeEnd },
      platform: process.platform,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to scan ports",
      },
      { status: 500 }
    );
  }
}
