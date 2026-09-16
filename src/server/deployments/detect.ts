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
    && !/^[A-Za-z]:[\\/]/.test(value)
    && !value.split(/[\\/]+/).includes("..");
}

export function isSafeCommand(value: string): boolean {
  return value.length >= 1 && value.length <= 300 && !/[\r\n\0`]/.test(value);
}

export function validateBuildSpec(spec: BuildSpec): string[] {
  const errors: string[] = [];

  if (spec.port !== null && (!Number.isInteger(spec.port) || spec.port < 1 || spec.port > 65535)) {
    errors.push("Port musi być liczbą całkowitą od 1 do 65535.");
  }

  for (const [label, command] of [
    ["Polecenie instalacji", spec.installCommand],
    ["Polecenie budowania", spec.buildCommand],
    ["Polecenie uruchomienia", spec.startCommand],
  ] as const) {
    if (command !== null && !isSafeCommand(command)) errors.push(`${label} jest nieprawidłowe.`);
  }

  for (const [label, path] of [
    ["Katalog wynikowy", spec.outputDir],
    ["Ścieżka Dockerfile", spec.dockerfile],
    ["Ścieżka Compose", spec.composeFile],
  ] as const) {
    if (path !== null && !isRelativePath(path)) errors.push(`${label} musi być ścieżką względną bez „..”.`);
  }

  if (spec.kind === "dockerfile" && !spec.dockerfile) errors.push("Dla Dockerfile wymagane jest wskazanie pliku Dockerfile.");
  if (spec.kind === "compose" && !spec.composeFile) errors.push("Dla Compose wymagane jest wskazanie pliku Compose.");
  if (spec.kind === "static" && !spec.outputDir) errors.push("Dla strony statycznej wymagany jest katalog wynikowy.");
  if ((spec.kind === "node" || spec.kind === "python") && !spec.startCommand) {
    errors.push("Dla tej aplikacji wymagane jest polecenie uruchomienia.");
  }

  return errors;
}

export function detectBuild(snapshot: RepositorySnapshot, runtime: DeploymentRuntimeKind): { spec: BuildSpec | null; reasons: string[] } {
  const files = new Set(snapshot.files);
  const composeFile = composeNames.find((name) => files.has(name));
  if (composeFile) {
    const spec = emptySpec("compose");
    spec.composeFile = composeFile;
    return { spec, reasons: [`Wykryto plik Compose: ${composeFile}.`] };
  }

  const dockerfile = ["Dockerfile", "dockerfile"].find((name) => files.has(name));
  if (dockerfile) {
    const spec = emptySpec("dockerfile");
    spec.dockerfile = dockerfile;
    const exposedPort = /^\s*EXPOSE\s+(\d{1,5})(?:\s|\/|$)/im.exec(snapshot.dockerfileContent ?? "")?.[1];
    const parsedPort = exposedPort ? Number(exposedPort) : null;
    spec.port = parsedPort && parsedPort <= 65535 ? parsedPort : runtime === "web" ? 3000 : null;
    return { spec, reasons: [`Wykryto ${dockerfile}${parsedPort ? ` z portem ${spec.port}` : ""}.`] };
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

    const serverFramework = ["next", "nuxt", "sveltekit", "remix", "express"].includes(framework ?? "");
    const isViteStatic = framework === "vite" && !serverFramework && (!scripts.start || scripts.start.trim() === "vite preview");
    const dependencies = { ...stringRecord(packageJson.dependencies), ...stringRecord(packageJson.devDependencies) };
    const isAstroStatic = framework === "astro" && !("@astrojs/node" in dependencies);

    if (isViteStatic || isAstroStatic) {
      spec.kind = "static";
      spec.buildCommand = runCommand(packageManager, "build");
      spec.outputDir = "dist";
      spec.port = 8080;
      const detected = framework === "vite" ? "Vite" : "Astro";
      return { spec, reasons: [`Wykryto statyczny projekt ${detected} (${packageManager === "npm" ? "package.json" : `${packageManager}-lockfile`}).`] };
    }

    spec.buildCommand = scripts.build ? runCommand(packageManager, "build") : null;
    spec.startCommand = scripts.start
      ? runCommand(packageManager, "start")
      : `node ${typeof packageJson.main === "string" && packageJson.main ? packageJson.main : "index.js"}`;
    spec.port = runtime === "web" ? 3000 : null;
    const frameworkName = framework ? framework === "next" ? "Next.js" : framework : "Node.js";
    return { spec, reasons: [`Wykryto ${frameworkName} (${packageManager === "npm" ? "npm" : `${packageManager}-lockfile`}).`] };
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
      return { spec, reasons: ["Wykryto FastAPI."] };
    }
    if (/\bflask\b/.test(source)) {
      spec.framework = "flask";
      spec.startCommand = "gunicorn -b 0.0.0.0:8000 app:app";
      return { spec, reasons: ["Wykryto Flask."] };
    }
    if (/\bdjango\b/.test(source)) {
      spec.framework = "django";
      return { spec, reasons: ["Wykryto Django; wskaż polecenie uruchomienia z nazwą projektu."] };
    }

    spec.startCommand = files.has("main.py") ? "python main.py" : files.has("bot.py") ? "python bot.py" : files.has("app.py") ? "python app.py" : null;
    return {
      spec,
      reasons: [spec.startCommand ? "Wykryto projekt Python." : "Wykryto projekt Python; wskaż polecenie uruchomienia."],
    };
  }

  if (files.has("index.html")) {
    const spec = emptySpec("static");
    spec.outputDir = ".";
    spec.port = 8080;
    return { spec, reasons: ["Wykryto statyczną stronę HTML."] };
  }

  return { spec: null, reasons: ["Nie rozpoznano typu projektu — dodaj Dockerfile albo docker-compose.yml."] };
}
