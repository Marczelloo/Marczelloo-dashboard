/** Plausible container output for the public demo, where no docker host is reachable. */

const LINES = [
  "GET /api/health 200 in 4ms",
  "GET /api/projects 200 in 38ms",
  "POST /api/deploys 202 in 61ms",
  "cache hit ratio 0.94 over 500 requests",
  "scheduled uptime sweep finished in 812ms",
  "GET /api/overview 200 in 96ms",
  "warn: upstream took 1.4s, above the 1s budget",
  "connection pool resized to 8",
  "GET /_next/static/chunks/main.js 200 in 2ms",
  "background queue drained, 0 jobs pending",
];

const BOOT = ["listening on 0.0.0.0", "loaded 14 routes", "database connection established", "ready"];

/** Deterministic per container, so a refresh in the demo does not shuffle the output. */
export function demoContainerLogs(containerId: string, tail: number, timestamps: boolean): string {
  const seed = [...containerId].reduce((total, character) => total + character.charCodeAt(0), 0);
  const count = Math.min(tail, 120);
  const now = Date.now();
  const lines: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const fromEnd = count - index;
    const at = new Date(now - fromEnd * 4_000);
    const body = index < BOOT.length ? BOOT[index] : LINES[(seed + index) % LINES.length];
    lines.push(timestamps ? `${at.toISOString()} ${body}` : body);
  }

  return lines.join("\n");
}

export function demoContainerStats(containerId: string) {
  const seed = [...containerId].reduce((total, character) => total + character.charCodeAt(0), 0);
  const memoryLimit = 1024 * 1024 * 1024;
  const memoryUsage = Math.round(memoryLimit * (0.18 + ((seed % 40) / 100)));
  return {
    cpu_percent: Number((2 + (seed % 170) / 10).toFixed(1)),
    memory_usage: memoryUsage,
    memory_limit: memoryLimit,
    memory_percent: Number(((memoryUsage / memoryLimit) * 100).toFixed(1)),
  };
}
