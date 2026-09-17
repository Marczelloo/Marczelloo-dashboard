import { describe, expect, it } from "vitest";
import { hourlyUptime } from "./uptime";

const now = new Date("2026-09-17T12:30:00.000Z");

describe("hourlyUptime", () => {
  it("returns 24 hour buckets ending with the current hour", () => {
    const buckets = hourlyUptime([], "p", true, now);
    expect(buckets).toHaveLength(24);
    expect(buckets[0].start).toBe("2026-09-16T13:00:00.000Z");
    expect(buckets[23].start).toBe("2026-09-17T12:00:00.000Z");
    expect(buckets.every((bucket) => bucket.state === "ok")).toBe(true);
  });

  it("marks hours overlapped by this project's incidents, down winning over warning", () => {
    const buckets = hourlyUptime(
      [
        { project_id: "p", severity: "warning", started_at: "2026-09-17T09:50:00.000Z", ended_at: "2026-09-17T10:05:00.000Z" },
        { project_id: "p", severity: "down", started_at: "2026-09-17T10:40:00.000Z", ended_at: "2026-09-17T10:45:00.000Z" },
        { project_id: "p", severity: "down", started_at: "2026-09-17T12:16:00.000Z", ended_at: null },
        { project_id: "other", severity: "down", started_at: "2026-09-17T05:00:00.000Z", ended_at: null },
      ],
      "p",
      true,
      now
    );
    const byHour = Object.fromEntries(buckets.map((bucket) => [bucket.start.slice(11, 13), bucket.state]));
    expect(byHour["09"]).toBe("warn");
    expect(byHour["10"]).toBe("down");
    expect(byHour["11"]).toBe("ok");
    expect(byHour["12"]).toBe("down");
    expect(byHour["05"]).toBe("ok");
  });

  it("shows no data for projects without monitor targets", () => {
    expect(hourlyUptime([], "p", false, now).every((bucket) => bucket.state === "none")).toBe(true);
  });
});
