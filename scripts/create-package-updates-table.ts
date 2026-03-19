/**
 * Migration: Create package_updates table
 *
 * Run: npx tsx scripts/create-package-updates-table.ts
 */

const TABLE_NAME = "package_updates";

const SQL = `
-- Create package_updates table
CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  ecosystem TEXT NOT NULL CHECK(ecosystem IN ('npm', 'yarn', 'pnpm', 'pip', 'poetry', 'cargo', 'composer')),
  packages_updated TEXT NOT NULL, -- JSON array
  old_versions TEXT NOT NULL,     -- JSON object
  new_versions TEXT NOT NULL,     -- JSON object
  status TEXT NOT NULL CHECK(status IN ('pending', 'success', 'failed', 'rolled_back')),
  test_output TEXT,
  error_message TEXT,
  branch_name TEXT,
  pr_url TEXT,
  rollback_data TEXT,             -- JSON backup of lockfiles
  rollback_from_id TEXT,          -- ID of update this rollback reverses (null for non-rollbacks)
  created_at TEXT NOT NULL DEFAULT (datetime('epoch')),
  completed_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Create index for fast project-based queries
CREATE INDEX IF NOT EXISTS idx_package_updates_project ON ${TABLE_NAME}(project_id, created_at DESC);

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_package_updates_status ON ${TABLE_NAME}(status);

-- Trigger for auto-generated IDs
CREATE TRIGGER IF NOT EXISTS trigger_package_updates_id
BEFORE INSERT ON ${TABLE_NAME}
WHEN NEW.id IS NULL
BEGIN
  SELECT 'pkg_' || lower(hex(randomblob(16))) INTO NEW.id;
END;
`;

async function createTable() {
  const apiUrl = process.env.ATLASHUB_API_URL;
  const secretKey = process.env.ATLASHUB_SECRET_KEY;

  if (!apiUrl || !secretKey) {
    console.error("Error: ATLASHUB_API_URL and ATLASHUB_SECRET_KEY must be set");
    process.exit(1);
  }

  try {
    // Execute raw SQL via AtlasHub
    const response = await fetch(`${apiUrl}/v1/raw`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": secretKey,
      },
      body: JSON.stringify({ sql: SQL }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create table: ${error}`);
    }

    const result = await response.json();
    console.log("✅ package_updates table created successfully");
    console.log("Result:", result);
  } catch (error) {
    console.error("❌ Error creating table:", error);
    process.exit(1);
  }
}

createTable();
