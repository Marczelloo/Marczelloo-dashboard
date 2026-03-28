/**
 * Migration: Create package_updates table using AtlasHub Schema API
 *
 * Run: npx tsx scripts/create-package-updates-table-api.ts
 */

const API_URL = process.env.ATLASHUB_API_URL;
const SECRET_KEY = process.env.ATLASHUB_SECRET_KEY;

if (!API_URL || !SECRET_KEY) {
  console.error("❌ Error: ATLASHUB_API_URL and ATLASHUB_SECRET_KEY must be set");
  process.exit(1);
}

async function createPackageUpdatesTable() {
  console.log("🔧 Creating package_updates table...");

  try {
    // Create the table using Schema API
    const response = await fetch(`${API_URL}/v1/db/schema/tables`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SECRET_KEY,
      },
      body: JSON.stringify({
        name: "package_updates",
        columns: [
          {
            name: "id",
            type: "text",
            primaryKey: true,
            nullable: false
          },
          {
            name: "project_id",
            type: "text",
            nullable: false
          },
          {
            name: "ecosystem",
            type: "varchar",
            nullable: false
          },
          {
            name: "packages_updated",
            type: "text",
            nullable: false
          },
          {
            name: "old_versions",
            type: "text",
            nullable: false
          },
          {
            name: "new_versions",
            type: "text",
            nullable: false
          },
          {
            name: "status",
            type: "varchar",
            nullable: false,
            defaultValue: "'pending'"
          },
          {
            name: "test_output",
            type: "text",
            nullable: true
          },
          {
            name: "error_message",
            type: "text",
            nullable: true
          },
          {
            name: "branch_name",
            type: "text",
            nullable: true
          },
          {
            name: "pr_url",
            type: "text",
            nullable: true
          },
          {
            name: "rollback_data",
            type: "text",
            nullable: true
          },
          {
            name: "rollback_from_id",
            type: "text",
            nullable: true,
            references: {
              table: "package_updates",
              column: "id"
            }
          },
          {
            name: "created_at",
            type: "timestamptz",
            nullable: false,
            defaultValue: "now()"
          },
          {
            name: "completed_at",
            type: "timestamptz",
            nullable: true
          }
        ],
        ifNotExists: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create table: ${error}`);
    }

    const result = await response.json();
    console.log("✅ package_updates table created successfully");
    console.log("Table created:", result);

    // Create indexes for better query performance
    console.log("🔧 Creating indexes...");

    const indexResponse = await fetch(`${API_URL}/v1/db/schema/indexes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SECRET_KEY,
      },
      body: JSON.stringify({
        name: "idx_package_updates_project",
        table: "package_updates",
        columns: ["project_id", "created_at"],
        ifNotExists: true
      })
    });

    if (indexResponse.ok) {
      console.log("✅ Index idx_package_updates_project created");
    } else {
      console.log("⚠️  Index creation failed (may already exist):", await indexResponse.text());
    }

    // Create status index
    const statusIndexResponse = await fetch(`${API_URL}/v1/db/schema/indexes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SECRET_KEY,
      },
      body: JSON.stringify({
        name: "idx_package_updates_status",
        table: "package_updates",
        columns: ["status"],
        ifNotExists: true
      })
    });

    if (statusIndexResponse.ok) {
      console.log("✅ Index idx_package_updates_status created");
    } else {
      console.log("⚠️  Status index creation failed (may already exist):", await statusIndexResponse.text());
    }

    console.log("\n🎉 Package updates table setup complete!");
  } catch (error) {
    console.error("❌ Error creating table:", error);
    process.exit(1);
  }
}

createPackageUpdatesTable();
