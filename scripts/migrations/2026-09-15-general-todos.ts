/**
 * Creates the general_todos table used by /todos. Idempotent.
 * Run with the dashboard env: npx tsx scripts/migrations/2026-09-15-general-todos.ts
 */
async function main() {
  const apiUrl = process.env.ATLASHUB_API_URL;
  const secretKey = process.env.ATLASHUB_SECRET_KEY;
  if (!apiUrl || !secretKey) {
    console.error("ATLASHUB_API_URL and ATLASHUB_SECRET_KEY are required");
    process.exit(1);
  }

  const response = await fetch(`${apiUrl}/v1/db/schema/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": secretKey },
    body: JSON.stringify({
      name: "general_todos",
      ifNotExists: true,
      columns: [
        { name: "id", type: "uuid", primaryKey: true, defaultValue: "gen_random_uuid()" },
        { name: "title", type: "varchar(200)", nullable: false },
        { name: "description", type: "text", nullable: true },
        { name: "priority", type: "varchar(20)", nullable: false, defaultValue: "'medium'" },
        { name: "status", type: "varchar(20)", nullable: false, defaultValue: "'pending'" },
        { name: "due_date", type: "timestamptz", nullable: true },
        { name: "completed_at", type: "timestamptz", nullable: true },
        { name: "created_at", type: "timestamptz", nullable: false, defaultValue: "now()" },
        { name: "updated_at", type: "timestamptz", nullable: false, defaultValue: "now()" },
      ],
    }),
  });

  if (!response.ok) {
    console.error(`general_todos: HTTP ${response.status} ${await response.text()}`);
    process.exit(1);
  }
  console.log("general_todos: ready");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
