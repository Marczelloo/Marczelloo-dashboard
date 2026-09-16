/**
 * Creates tables for stage 1 import. Idempotent.
 * Run with the dashboard env: npx tsx scripts/migrations/2026-09-16-app-import-tables.ts
 */
export {};

const apiUrl = process.env.ATLASHUB_API_URL;
const secretKey = process.env.ATLASHUB_SECRET_KEY;

const id = { name: "id", type: "uuid", primaryKey: true, defaultValue: "gen_random_uuid()" };
const createdAt = { name: "created_at", type: "timestamptz", nullable: false, defaultValue: "now()" };
const updatedAt = { name: "updated_at", type: "timestamptz", nullable: false, defaultValue: "now()" };

const tables = [
  {
    name: "app_configs",
    columns: [
      id,
      { name: "project_id", type: "uuid", nullable: false, unique: true },
      { name: "compose_project", type: "varchar(100)", nullable: false, unique: true },
      { name: "working_dir", type: "text", nullable: true },
      { name: "config_files", type: "jsonb", nullable: false, defaultValue: "'[]'" },
      { name: "state", type: "varchar(20)", nullable: false, defaultValue: "'imported'" },
      { name: "source", type: "jsonb", nullable: false, defaultValue: "'{}'" },
      { name: "processes", type: "jsonb", nullable: false, defaultValue: "'[]'" },
      { name: "auto_deploy", type: "boolean", nullable: false, defaultValue: "false" },
      createdAt,
      updatedAt,
    ],
  },
  {
    name: "app_env_versions",
    columns: [
      id,
      { name: "project_id", type: "uuid", nullable: false },
      { name: "version", type: "integer", nullable: false },
      { name: "keys", type: "jsonb", nullable: false },
      { name: "payload_encrypted", type: "text", nullable: false },
      { name: "fingerprint", type: "varchar(64)", nullable: false },
      { name: "note", type: "text", nullable: true },
      { name: "created_by", type: "varchar(100)", nullable: false },
      createdAt,
    ],
  },
  {
    name: "app_routes",
    columns: [
      id,
      { name: "project_id", type: "uuid", nullable: true },
      { name: "position", type: "integer", nullable: false },
      { name: "hostname", type: "varchar(253)", nullable: true },
      { name: "path", type: "text", nullable: true },
      { name: "service", type: "text", nullable: false },
      { name: "origin_request", type: "jsonb", nullable: true },
      { name: "target", type: "jsonb", nullable: false },
      { name: "source", type: "varchar(20)", nullable: false, defaultValue: "'imported'" },
      createdAt,
      updatedAt,
    ],
  },
  {
    name: "app_snapshots",
    columns: [
      id,
      { name: "project_id", type: "uuid", nullable: true },
      { name: "kind", type: "varchar(30)", nullable: false },
      { name: "payload_encrypted", type: "text", nullable: false },
      createdAt,
    ],
  },
];

const indexes = [
  { name: "idx_app_env_versions_project_version", table: "app_env_versions", columns: ["project_id", "version"], unique: true },
  { name: "idx_app_routes_source", table: "app_routes", columns: ["source"] },
  { name: "idx_app_snapshots_project", table: "app_snapshots", columns: ["project_id", "created_at"] },
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
