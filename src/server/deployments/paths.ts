import "server-only";

const ENV_FILENAME_PATTERN = /^\.env(?:\.[A-Za-z0-9_-]+)?$/;

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function allowedRoots(): string[] {
  return Array.from(
    new Set(
      [
        process.env.PROJECTS_DIR,
        process.env.DASHBOARD_REPO_PATH,
        "/home/Marczelloo_pi/projects",
        "/home/pi/projects",
      ]
        .filter((root): root is string => Boolean(root))
        .map(normalizePath)
    )
  );
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function validateRepoPath(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("repoPath is required");
  }

  const repoPath = normalizePath(value.trim());
  const hasParentTraversal = repoPath.split("/").some((part) => part === "..");
  const isAllowed = allowedRoots().some((root) => repoPath === root || repoPath.startsWith(`${root}/`));

  if (!repoPath.startsWith("/") || hasParentTraversal || !isAllowed) {
    throw new Error("repoPath must point to a configured project directory");
  }

  return repoPath;
}

export function validateEnvFilename(value: unknown): string {
  const filename = typeof value === "string" && value.trim() ? value.trim() : ".env";

  if (!ENV_FILENAME_PATTERN.test(filename)) {
    throw new Error("filename must be .env or a simple .env variant");
  }

  return filename;
}

export function getEnvFilePath(
  repoPath: unknown,
  filename: unknown
): { repoPath: string; filename: string; filePath: string } {
  const safeRepoPath = validateRepoPath(repoPath);
  const safeFilename = validateEnvFilename(filename);

  return {
    repoPath: safeRepoPath,
    filename: safeFilename,
    filePath: `${safeRepoPath}/${safeFilename}`,
  };
}
