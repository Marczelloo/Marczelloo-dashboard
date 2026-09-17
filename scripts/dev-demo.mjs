import { spawn } from "node:child_process";

// Local preview with mock data and no authentication (see src/proxy.ts).
const child = spawn("npx", ["next", "dev", "--port", "3100"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DEMO_MODE: "true" },
});
child.on("exit", (code) => process.exit(code ?? 0));
