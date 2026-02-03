import { NextRequest, NextResponse } from "next/server";

interface PortInfo {
  port: number;
  protocol: string;
  state: string;
  process: string;
  pid: number | null;
}

const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;

// GET - Scan host ports via runner (not container ports)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rangeStart = parseInt(searchParams.get("start") || "3000", 10);
  const rangeEnd = parseInt(searchParams.get("end") || "9999", 10);

  try {
    if (!RUNNER_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Runner not configured. Set RUNNER_TOKEN in environment." },
        { status: 500 }
      );
    }

    // Execute ss command on host via runner
    const response = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({
        command: "ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { success: false, error: `Runner error: ${error}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    let ports: PortInfo[] = [];

    if (result.stdout) {
      const lines = result.stdout.split("\n").slice(1); // Skip header

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
    }

    // Sort by port number and remove duplicates
    ports = ports.filter((p, i, arr) => arr.findIndex((x) => x.port === p.port) === i).sort((a, b) => a.port - b.port);

    // Common ports reference
    const commonPorts: Record<number, string> = {
      22: "SSH",
      80: "HTTP",
      443: "HTTPS",
      3000: "Node.js/AtlasHub",
      3001: "AtlasHub API",
      3100: "Dashboard",
      5432: "PostgreSQL",
      6379: "Redis",
      8080: "HTTP Alt",
      8787: "Runner",
      9000: "Portainer/MinIO",
      9200: "Portainer",
      9201: "Portainer Alt",
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
      platform: "linux (via runner)",
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
