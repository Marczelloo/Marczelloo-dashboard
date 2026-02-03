/**
 * Database Setup Script
 *
 * Run with: npm run db:setup
 *
 * This script creates all necessary tables in AtlasHub.
 * Note: AtlasHub may require tables to be created via its admin interface.
 * This script is provided as a reference for the table schemas.
 */

const ATLASHUB_API_URL = process.env.ATLASHUB_API_URL || "http://localhost:3001";
const ATLASHUB_SECRET_KEY = process.env.ATLASHUB_SECRET_KEY;

if (!ATLASHUB_SECRET_KEY) {
  console.error("Error: ATLASHUB_SECRET_KEY environment variable is required");
  process.exit(1);
}

interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
}

interface TableSchema {
  name: string;
  columns: TableColumn[];
}

const tables: TableSchema[] = [
  {
    name: "projects",
    columns: [
      { name: "id", type: "uuid", nullable: false, defaultValue: "gen_random_uuid()" },
      { name: "name", type: "varchar(100)", nullable: false },
      { name: "slug", type: "varchar(50)", nullable: false },
      { name: "description", type: "text", nullable: true },
      { name: "status", type: "varchar(20)", nullable: false, defaultValue: "'active'" },
      { name: "tags", type: "jsonb", nullable: false, defaultValue: "'[]'" },
      { name: "github_url", type: "text", nullable: true },
      { name: "prod_url", type: "text", nullable: true },
      { name: "vercel_url", type: "text", nullable: true },
      { name: "notes", type: "text", nullable: true },
      { name: "created_at", type: "timestamptz", nullable: false, defaultValue: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, defaultValue: "now()" },
    ],
  },
  {
    name: "services",
    columns: [
      { name: "id", type: "uuid", nullable: false, defaultValue: "gen_random_uuid()" },
      { name: "project_id", type: "uuid", nullable: false },
      { name: "name", type: "varchar(100)", nullable: false },
      { name: "type", type: "varchar(20)", nullable: false },
      { name: "url", type: "text", nullable: true },
      { name: "health_url", type: "text", nullable: true },
      { name: "portainer_endpoint_id", type: "integer", nullable: true },
      { name: "container_id", type: "varchar(100)", nullable: true },
      { name: "stack_id", type: "integer", nullable: true },
      { name: "repo_path", type: "text", nullable: true },
      { name: "compose_project", type: "varchar(100)", nullable: true },
      { name: "deploy_strategy", type: "varchar(20)", nullable: false, defaultValue: "'manual'" },
      { name: "created_at", type: "timestamptz", nullable: false, defaultValue: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, defaultValue: "now()" },
    ],
  },
  {
    name: "work_items",
    columns: [
      { name: "id", type: "uuid", nullable: false, defaultValue: "gen_random_uuid()" },
      { name: "project_id", type: "uuid", nullable: false },
      { name: "type", type: "varchar(20)", nullable: false },
      { name: "title", type: "varchar(200)", nullable: false },
      { name: "description", type: "text", nullable: true },
      { name: "status", type: "varchar(20)", nullable: false, defaultValue: "'open'" },
      { name: "priority", type: "varchar(20)", nullable: false, defaultValue: "'medium'" },
      { name: "labels", type: "jsonb", nullable: false, defaultValue: "'[]'" },
      { name: "created_at", type: "timestamptz", nullable: false, defaultValue: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, defaultValue: "now()" },
    ],
  },
  {
    name: "env_vars",
    columns: [
      { name: "id", type: "uuid", nullable: false, defaultValue: "gen_random_uuid()" },
      { name: "service_id", type: "uuid", nullable: false },
      { name: "key", type: "varchar(100)", nullable: false },
      { name: "value_encrypted", type: "text", nullable: false },
      { name: "is_secret", type: "boolean", nullable: false, defaultValue: "true" },
      { name: "updated_at", type: "timestamptz", nullable: false, defaultValue: "now()" },
    ],
  },
  {
    name: "deploys",
    columns: [
      { name: "id", type: "uuid", nullable: false, defaultValue: "gen_random_uuid()" },
      { name: "service_id", type: "uuid", nullable: false },
      { name: "started_at", type: "timestamptz", nullable: false, defaultValue: "now()" },
      { name: "finished_at", type: "timestamptz", nullable: true },
      { name: "status", type: "varchar(20)", nullable: false, defaultValue: "'pending'" },
      { name: "commit_sha", type: "varchar(40)", nullable: true },
      { name: "logs_object_key", type: "text", nullable: true },
      { name: "triggered_by", type: "varchar(100)", nullable: false },
      { name: "error_message", type: "text", nullable: true },
    ],
  },
  {
    name: "uptime_checks",
    columns: [
      { name: "id", type: "uuid", nullable: false, defaultValue: "gen_random_uuid()" },
      { name: "service_id", type: "uuid", nullable: false },
      { name: "checked_at", type: "timestamptz", nullable: false, defaultValue: "now()" },
      { name: "status_code", type: "integer", nullable: true },
      { name: "latency_ms", type: "integer", nullable: true },
      { name: "ssl_days_left", type: "integer", nullable: true },
      { name: "ok", type: "boolean", nullable: false },
      { name: "error", type: "text", nullable: true },
    ],
  },
  {
    name: "audit_logs",
    columns: [
      { name: "id", type: "uuid", nullable: false, defaultValue: "gen_random_uuid()" },
      { name: "at", type: "timestamptz", nullable: false, defaultValue: "now()" },
      { name: "actor_email", type: "varchar(100)", nullable: false },
      { name: "action", type: "varchar(30)", nullable: false },
      { name: "entity_type", type: "varchar(30)", nullable: false },
      { name: "entity_id", type: "uuid", nullable: true },
      { name: "meta_json", type: "jsonb", nullable: true },
    ],
  },
];

function generateSQL(table: TableSchema): string {
  const columns = table.columns
    .map((col) => {
      let def = `  ${col.name} ${col.type}`;
      if (!col.nullable) def += " NOT NULL";
      if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
      return def;
    })
    .join(",\n");

  const primaryKey = table.columns.find((c) => c.name === "id") ? ",\n  PRIMARY KEY (id)" : "";

  return `CREATE TABLE IF NOT EXISTS ${table.name} (\n${columns}${primaryKey}\n);`;
}

async function main() {
  console.log("🗃️  Marczelloo Dashboard Database Setup");
  console.log("================================\n");
  console.log("AtlasHub URL:", ATLASHUB_API_URL);
  console.log("\n");

  // Generate SQL for reference
  console.log("📋 SQL Schema Reference:\n");
  for (const table of tables) {
    console.log(generateSQL(table));
    console.log("");
  }

  console.log("================================");
  console.log("");
  console.log("⚠️  Note: AtlasHub may require tables to be created via its admin interface.");
  console.log("   The SQL above is provided as a reference for the table schemas.");
  console.log("");
  console.log("   If AtlasHub supports table creation via API, you can implement that here.");
  console.log("");

  // Check if tables exist
  console.log("🔍 Checking existing tables...\n");
  try {
    const response = await fetch(`${ATLASHUB_API_URL}/v1/db/tables`, {
      headers: {
        "x-api-key": ATLASHUB_SECRET_KEY!,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const existingTables = data.data.map((t: { tableName: string }) => t.tableName);

    console.log("Existing tables:", existingTables.join(", ") || "(none)");
    console.log("");

    const missingTables = tables.filter((t) => !existingTables.includes(t.name));
    if (missingTables.length > 0) {
      console.log("Missing tables:", missingTables.map((t) => t.name).join(", "));
      console.log("");
      console.log("Please create these tables in AtlasHub admin or via the PostgreSQL console.");
    } else {
      console.log("✅ All required tables exist!");
    }
  } catch (error) {
    console.error("❌ Failed to connect to AtlasHub:", error);
  }
}

main().catch(console.error);
