import { describe, expect, it } from "vitest";
import { formatUptime, toPiMetrics } from "./metrics";

const GiB = 1024 ** 3;

describe("toPiMetrics", () => {
  it("maps the agent host report to the Pi page shape", () => {
    const metrics = toPiMetrics({
      hostname: "raspberrypi",
      uptimeSeconds: 90_061,
      loadavg: [2, 1.5, 1],
      cores: 4,
      memory: { totalBytes: 8 * GiB, availableBytes: 6 * GiB },
      disk: { path: "/home/pi/projects", totalBytes: 200 * GiB, freeBytes: 150 * GiB },
      temperatureC: 51.2,
      docker: { running: 17, stopped: 1, images: 40 },
      publishedPorts: [],
    });
    expect(metrics).toEqual({
      hostname: "raspberrypi",
      uptime: "1 day, 1 hour, 1 minute",
      cpu: { usage: 50, cores: 4, load1: 2, load5: 1.5, load15: 1 },
      memory: { total: 8192, used: 2048, free: 6144, available: 6144, usagePercent: 25 },
      disk: { total: "200.0G", used: "50.0G", available: "150.0G", usagePercent: 25, mount: "/home/pi/projects" },
      temperature: 51.2,
      docker: { containersRunning: 17, containersStopped: 1, imagesCount: 40 },
      network: { ip: "—" },
    });
  });

  it("formats short uptimes", () => {
    expect(formatUptime(125)).toBe("2 minutes");
  });
});
