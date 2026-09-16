/**
 * Creates tables for monitoring v2 (stage 6). Idempotent.
 * Run with the dashboard env: npx tsx scripts/migrations/2026-09-17-monitoring-tables.ts
 */
export {};

const apiUrl = process.env.ATLASHUB_API_URL;
const secretKey = process.env.ATLASHUB_SECRET_KEY;

const id = { name: "id", type: "uuid", primaryKey: true, defaultValue: "gen_random_uuid()" };

const tables = [
  {
    name: "monitor_state",
    columns: [
      id,
      { name: "key", type: "varchar(300)", nullable: false, unique: true },
      { name: "kind", type: "varchar(20)", nullable: false },
      { name: "label", type: "varchar(300)", nullable: false },
      { name: "project_id", type: "uuid", nullable: true },
      { name: "status", type: "varchar(20)", nullable: false },
      { name: "fail_count", type: "integer", nullable: false, defaultValue: "0" },
      { name: "since", type: "timestamptz", nullable: false },
      { name: "last_checked_at", type: "timestamptz", nullable: true },
      { name: "last_error", type: "text", nullable: true },
      { name: "detail", type: "jsonb", nullable: false, defaultValue: "'{}'" },
      { name: "updated_at", type: "timestamptz", nullable: false, defaultValue: "now()" },
    ],
  },
  {
    name: "monitor_incidents",
    columns: [
      id,
      { name: "target_key", type: "varchar(300)", nullable: false },
      { name: "kind", type: "varchar(20)", nullable: false },
      { name: "label", type: "varchar(300)", nullable: false },
      { name: "project_id", type: "uuid", nullable: true },
      { name: "severity", type: "varchar(20)", nullable: false },
      { name: "reason", type: "text", nullable: true },
      { name: "open", type: "boolean", nullable: false, defaultValue: "true" },
      { name: "started_at", type: "timestamptz", nullable: false },
      { name: "ended_at", type: "timestamptz", nullable: true },
    ],
  },
];

const indexes = [
  { name: "idx_monitor_incidents_open", table: "monitor_incidents", columns: ["open", "ended_at"] },
  { name: "idx_monitor_incidents_started", table: "monitor_incidents", columns: ["started_at"] },
];

async function post(path: string, body: unknown) {
  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": secretKey! },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${await response.text()}`);
}

async function main() {
  if (!apiUrl || !secretKey) throw new Error("ATLASHUB_API_URL and ATLASHUB_SECRET_KEY are required");
  for (const table of tables) {
    await post("/v1/db/schema/tables", { ...table, ifNotExists: true });
    console.log(`${table.name}: ready`);
  }
  for (const index of indexes) {
    await post("/v1/db/schema/indexes", { ...index, ifNotExists: true });
    console.log(`${index.name}: ready`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
