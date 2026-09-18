import { describe, expect, it } from "vitest";
import { diskPercent, formatBytes, formatUptime, hostAlerts, isPublic, loadPercent, memoryPercent, GB } from "./host";
import type { HostInfo } from "@agent/types";

const host = (overrides: Partial<HostInfo> = {}): HostInfo => ({
  hostname: "raspberrypi",
  uptimeSeconds: 3 * 86_400,
  loadavg: [0.8, 0.7, 0.6],
  cores: 4,
  memory: { totalBytes: 4 * GB, availableBytes: 2 * GB },
  disk: { path: "/", totalBytes: 58 * GB, freeBytes: 32 * GB },
  temperatureC: 48,
  docker: { running: 5, stopped: 0, images: 12 },
  publishedPorts: [],
  ...overrides,
});

describe("host readings", () => {
  it("reads load against the core count", () => {
    expect(loadPercent(host({ loadavg: [2, 1, 1], cores: 4 }))).toBe(50);
    expect(loadPercent(host({ loadavg: [8, 1, 1], cores: 4 }))).toBe(100);
  });

  it("reports memory and disk use", () => {
    expect(memoryPercent(host())).toBe(50);
    expect(diskPercent(host())).toBe(45);
  });

  it("formats sizes and uptime", () => {
    expect(formatBytes(2 * GB)).toBe("2 GB");
    expect(formatBytes(null)).toBe("—");
    expect(formatUptime(3 * 86_400 + 4 * 3_600)).toBe("3d 4h");
    expect(formatUptime(90 * 60)).toBe("1h 30m");
  });

  it("counts a loopback binding as private", () => {
    expect(isPublic("127.0.0.1")).toBe(false);
    expect(isPublic("0.0.0.0")).toBe(true);
  });
});

describe("hostAlerts", () => {
  it("stays quiet on a healthy host", () => {
    expect(hostAlerts(host(), null)).toEqual([]);
  });

  it("raises throttling as an error above 80 °C", () => {
    const [alert] = hostAlerts(host({ temperatureC: 82 }), null);
    expect(alert.id).toBe("temperature");
    expect(alert.tone).toBe("err");
  });

  it("warns about a full disk, stopped containers and exposed ports", () => {
    const alerts = hostAlerts(
      host({
        disk: { path: "/", totalBytes: 58 * GB, freeBytes: 2 * GB },
        docker: { running: 4, stopped: 2, images: 12 },
        publishedPorts: [{ container: "portainer", hostIp: "0.0.0.0", hostPort: 9443, containerPort: 9443, protocol: "tcp" }],
      }),
      null
    );
    expect(alerts.map((alert) => alert.id)).toEqual(["disk", "containers", "ports"]);
  });
});
