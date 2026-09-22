export type BuildKind = "compose" | "dockerfile" | "node" | "static" | "python";
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
export type DeploymentRuntimeKind = "web" | "worker" | "bot" | "stack";

export interface BuildSpec {
  kind: BuildKind;
  framework: string | null;
  packageManager: PackageManager | null;
  port: number | null;
  installCommand: string | null;
  buildCommand: string | null;
  startCommand: string | null;
  outputDir: string | null;
  dockerfile: string | null;
  composeFile: string | null;
}

export interface RepositorySnapshot {
  files: string[];
  packageJson: unknown | null;
  dockerfileContent: string | null;
  requirementsTxt: string | null;
  pyprojectToml: string | null;
}

type PackageJson = {
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  scripts?: Record<string, unknown>;
  main?: unknown;
  packageManager?: unknown;
};

const composeNames = ["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"];
const safePackageManagers: PackageManager[] = ["npm", "pnpm", "yarn", "bun"];

function emptySpec(kind: BuildKind): BuildSpec {
  return {
    kind,
    framework: null,
    packageManager: null,
    port: null,
    installCommand: null,
    buildCommand: null,
    startCommand: null,
    outputDir: null,
    dockerfile: null,
    composeFile: null,
  };
}

function asPackageJson(value: unknown): PackageJson | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as PackageJson) : null;
}

function stringRecord(value: Record<string, unknown> | undefined): Record<string, string> {
  if (!value) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function detectPackageManager(files: Set<string>, packageJson: PackageJson): PackageManager {
  if (files.has("pnpm-lock.yaml")) return "pnpm";
  if (files.has("yarn.lock")) return "yarn";
  if (files.has("bun.lockb") || files.has("bun.lock")) return "bun";

  const declared = typeof packageJson.packageManager === "string" ? packageJson.packageManager.split("@", 1)[0] : null;
  return safePackageManagers.includes(declared as PackageManager) ? (declared as PackageManager) : "npm";
}

function installCommand(packageManager: PackageManager, files: Set<string>): string {
  switch (packageManager) {
    case "pnpm": return "pnpm install --frozen-lockfile";
    case "yarn": return "yarn install --frozen-lockfile";
    case "bun": return "bun install --frozen-lockfile";
    case "npm": return files.has("package-lock.json") ? "npm ci" : "npm install";
  }
}

function runCommand(packageManager: PackageManager, script: string): string {
  switch (packageManager) {
    case "npm": return `npm run ${script}`;
    case "pnpm": return `pnpm ${script}`;
    case "yarn": return `yarn ${script}`;
    case "bun": return `bun run ${script}`;
  }
}

function detectFramework(packageJson: PackageJson): string | null {
  const dependencies = { ...stringRecord(packageJson.dependencies), ...stringRecord(packageJson.devDependencies) };
  if ("next" in dependencies) return "next";
  if ("nuxt" in dependencies) return "nuxt";
  if ("astro" in dependencies) return "astro";
  if ("@sveltejs/kit" in dependencies) return "sveltekit";
  if (Object.keys(dependencies).some((name) => name.startsWith("@remix-run/"))) return "remix";
  if ("vite" in dependencies) return "vite";
  if ("express" in dependencies) return "express";
  return null;
}

function isRelativePath(value: string): boolean {
  return value.length > 0
    && !/^[\\/]/.test(value)
    && !/^[A-Za-z]:/.test(value)
    && !value.split(/[\\/]+/).includes("..");
}

export function isSafeCommand(value: string): boolean {
  return value.length >= 1 && value.length <= 300 && !/[\r\n\0`]/.test(value);
}

export function validateBuildSpec(spec: BuildSpec): string[] {
  const errors: string[] = [];

  if (spec.port !== null && (!Number.isInteger(spec.port) || spec.port < 1 || spec.port > 65535)) {
    errors.push("The port must be a whole number from 1 to 65535.");
  }

  for (const [label, command] of [
    ["Polecenie instalacji", spec.installCommand],
    ["Polecenie budowania", spec.buildCommand],
    ["Polecenie uruchomienia", spec.startCommand],
  ] as const) {
    if (command !== null && !isSafeCommand(command)) errors.push(`${label} is not valid.`);
  }

  for (const [label, path] of [
    ["Output directory", spec.outputDir],
    ["Dockerfile path", spec.dockerfile],
    ["Compose path", spec.composeFile],
  ] as const) {
    if (path !== null && !isRelativePath(path)) errors.push(`${label} must be a relative path without "..".`);
  }

  if (spec.kind === "dockerfile" && !spec.dockerfile) errors.push("A Dockerfile build needs the Dockerfile path.");
  if (spec.kind === "compose" && !spec.composeFile) errors.push("A Compose build needs the Compose file path.");
  if (spec.kind === "static" && !spec.outputDir) errors.push("A static site needs its output directory.");
  if ((spec.kind === "node" || spec.kind === "python") && !spec.startCommand) {
    errors.push("This app needs a start command.");
  }

  return errors;
}

export function detectBuild(snapshot: RepositorySnapshot, runtime: DeploymentRuntimeKind): { spec: BuildSpec | null; reasons: string[] } {
  const files = new Set(snapshot.files);
  const composeFile = composeNames.find((name) => files.has(name));
  if (composeFile) {
    const spec = emptySpec("compose");
    spec.composeFile = composeFile;
    return { spec, reasons: [`Compose file found: ${composeFile}.`] };
  }

  const dockerfile = ["Dockerfile", "dockerfile"].find((name) => files.has(name));
  if (dockerfile) {
    const spec = emptySpec("dockerfile");
    spec.dockerfile = dockerfile;
    const exposedPort = /^\s*EXPOSE\s+(\d{1,5})(?:\s|\/|$)/im.exec(snapshot.dockerfileContent ?? "")?.[1];
    const parsedPort = exposedPort ? Number(exposedPort) : null;
    spec.port = parsedPort && parsedPort <= 65535 ? parsedPort : runtime === "web" ? 3000 : null;
    return { spec, reasons: [`Found ${dockerfile}${parsedPort ? ` exposing port ${spec.port}` : ""}.`] };
  }

  const packageJson = asPackageJson(snapshot.packageJson);
  if (packageJson) {
    const packageManager = detectPackageManager(files, packageJson);
    const scripts = stringRecord(packageJson.scripts);
    const framework = detectFramework(packageJson);
    const spec = emptySpec("node");
    spec.framework = framework;
    spec.packageManager = packageManager;
    spec.installCommand = installCommand(packageManager, files);

    const dependencies = { ...stringRecord(packageJson.dependencies), ...stringRecord(packageJson.devDependencies) };
    const hasServerFramework = "next" in dependencies
      || "nuxt" in dependencies
      || "@sveltejs/kit" in dependencies
      || "express" in dependencies
      || Object.keys(dependencies).some((name) => name.startsWith("@remix-run/"));
    const isViteStatic = framework === "vite" && !hasServerFramework && (!scripts.start || scripts.start.trim() === "vite preview");
    const isAstroStatic = framework === "astro" && !("@astrojs/node" in dependencies);

    if (isViteStatic || isAstroStatic) {
      spec.kind = "static";
      spec.buildCommand = runCommand(packageManager, "build");
      spec.outputDir = "dist";
      spec.port = 8080;
      const detected = framework === "vite" ? "Vite" : "Astro";
      return { spec, reasons: [`Static ${detected} project detected (${packageManager === "npm" ? "package.json" : `${packageManager}-lockfile`}).`] };
    }

    spec.buildCommand = scripts.build ? runCommand(packageManager, "build") : null;
    spec.startCommand = scripts.start
      ? runCommand(packageManager, "start")
      : `node ${typeof packageJson.main === "string" && packageJson.main ? packageJson.main : "index.js"}`;
    spec.port = runtime === "web" ? 3000 : null;
    const frameworkName = framework ? framework === "next" ? "Next.js" : framework : "Node.js";
    return { spec, reasons: [`${frameworkName} detected (${packageManager === "npm" ? "npm" : `${packageManager}-lockfile`}).`] };
  }

  if (snapshot.requirementsTxt !== null || snapshot.pyprojectToml !== null) {
    const source = `${snapshot.requirementsTxt ?? ""}\n${snapshot.pyprojectToml ?? ""}`.toLowerCase();
    const spec = emptySpec("python");
    spec.installCommand = snapshot.requirementsTxt !== null
      ? "pip install --no-cache-dir -r requirements.txt"
      : "pip install --no-cache-dir .";
    spec.port = runtime === "web" ? 8000 : null;

    if (/\bfastapi\b/.test(source)) {
      spec.framework = "fastapi";
      spec.startCommand = files.has("app/")
        ? "uvicorn app.main:app --host 0.0.0.0 --port 8000"
        : "uvicorn main:app --host 0.0.0.0 --port 8000";
      return { spec, reasons: ["FastAPI detected."] };
    }
    if (/\bflask\b/.test(source)) {
      spec.framework = "flask";
      spec.startCommand = "gunicorn -b 0.0.0.0:8000 app:app";
      return { spec, reasons: ["Flask detected."] };
    }
    if (/\bdjango\b/.test(source)) {
      spec.framework = "django";
      return { spec, reasons: ["Django detected; give the start command with the project name."] };
    }

    spec.startCommand = files.has("main.py") ? "python main.py" : files.has("bot.py") ? "python bot.py" : files.has("app.py") ? "python app.py" : null;
    return {
      spec,
      reasons: [spec.startCommand ? "Python project detected." : "Python project detected; give the start command."],
    };
  }

  if (files.has("index.html")) {
    const spec = emptySpec("static");
    spec.outputDir = ".";
    spec.port = 8080;
    return { spec, reasons: ["Static HTML site detected."] };
  }

  return { spec: null, reasons: ["Could not tell what kind of project this is. Add a Dockerfile or docker-compose.yml."] };
}
