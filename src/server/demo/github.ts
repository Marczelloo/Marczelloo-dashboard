/** Deterministic GitHub-shaped fixtures for the public demo. */
import { createHash } from "node:crypto";
import type {
  GitHubBranch,
  GitHubCommit,
  GitHubContent,
  GitHubContributor,
  GitHubIssue,
  GitHubPullRequest,
  GitHubRelease,
  GitHubRepository,
  GitHubSecurityAlert,
  GitHubUser,
} from "@/types/github";

type PaginationOptions = {
  page?: number;
  perPage?: number;
};

type RepoDefinition = {
  slug: string;
  name: string;
  description: string;
  language: string;
  topics: string[];
  commitMessages: string[];
  pullTitles: string[];
  releaseNotes: string[];
  issueTitles: string[];
  readmeIntro: string;
  features: string[];
  securityCount: number;
  isGo?: boolean;
};

export type CodeScanningAlert = {
  number: number;
  created_at: string;
  updated_at: string;
  url: string;
  html_url: string;
  state: "open" | "closed" | "dismissed" | "fixed";
  dismissed_by: { login: string } | null;
  dismissed_at: string | null;
  dismissed_reason: string | null;
  rule: {
    id: string;
    severity: "none" | "note" | "warning" | "error";
    security_severity_level: "low" | "medium" | "high" | "critical" | null;
    description: string;
    name: string;
    tags: string[];
  };
  tool: { name: string; version: string | null };
  most_recent_instance: {
    ref: string;
    state: string;
    commit_sha: string;
    message: { text: string };
    location: {
      path: string;
      start_line: number;
      end_line: number;
      start_column: number;
      end_column: number;
    };
  };
};

export type DemoGithubRepository = {
  repository: GitHubRepository;
  branches: Array<GitHubBranch & { ahead_by: number; behind_by: number }>;
  commits: GitHubCommit[];
  pulls: GitHubPullRequest[];
  releases: GitHubRelease[];
  contributors: GitHubContributor[];
  issues: GitHubIssue[];
  security: GitHubSecurityAlert[];
  codeScanning: CodeScanningAlert[];
  dependencies: Array<{
    name: string;
    version: string;
    ecosystem: string;
    downloadLocation: string;
  }>;
  contents: Record<string, GitHubContent | GitHubContent[]>;
};

const OWNER = "marczelloo";
const AVATAR_URL = "https://github.com/marczelloo.png";
const USER: GitHubUser = {
  login: OWNER,
  id: 1,
  node_id: "MDQ6VXNlcjE=",
  avatar_url: AVATAR_URL,
  html_url: `https://github.com/${OWNER}`,
  type: "User",
};
const BOT: GitHubUser = {
  login: "dependabot[bot]",
  id: 2,
  node_id: "BOT_2",
  avatar_url: "https://avatars.githubusercontent.com/in/29110",
  html_url: "https://github.com/apps/dependabot",
  type: "Bot",
};

const REPOS: RepoDefinition[] = [
  {
    slug: "atlashub",
    name: "AtlasHub",
    description:
      "Self-hosted REST API backend for database and storage services.",
    language: "TypeScript",
    topics: ["api", "self-hosted", "storage"],
    commitMessages: [
      "feat(storage): add signed bucket upload URLs",
      "feat(policies): enforce row-level access checks",
      "feat(auth): rotate scoped API keys",
      "fix(storage): preserve content type during copy",
      "test(policies): cover tenant isolation rules",
      "docs(api): document bucket lifecycle endpoints",
      "refactor(auth): extract API key middleware",
      "fix(db): return useful conflict errors",
      "chore: update SQLite migration tooling",
      "feat(storage): add object metadata filters",
      "perf(api): batch policy lookups",
      "ci: run integration tests against ephemeral database",
      "fix(keys): reject expired API keys",
      "feat(policies): add service-role bypass",
      "build: update TypeScript configuration",
    ],
    pullTitles: [
      "feat(storage): support signed bucket uploads",
      "fix(policies): scope reads to the current tenant",
      "chore: update API key dependencies",
    ],
    releaseNotes: [
      "Signed upload URLs and object metadata filtering.",
      "Stronger row-level policy evaluation across database endpoints.",
      "Scoped API key rotation with clearer audit events.",
      "Reliability fixes for bucket copy and conflict handling.",
    ],
    issueTitles: [
      "Add bucket-level retention policies",
      "Expose API key last-used timestamp",
      "Document disaster recovery procedure",
    ],
    readmeIntro:
      "AtlasHub is the self-hosted API backbone behind the rest of this workspace, combining a small database API with S3-style storage primitives and tenant-aware access control.",
    features: [
      "Storage buckets with signed upload URLs",
      "Row-level policies for multi-tenant data",
      "Scoped API keys and audit-friendly access",
    ],
    securityCount: 2,
  },
  {
    slug: "portfolio",
    name: "Portfolio Website",
    description: "Personal portfolio and technical writing site.",
    language: "TypeScript",
    topics: ["nextjs", "portfolio", "mdx"],
    commitMessages: [
      "feat(posts): publish self-hosting notes in MDX",
      "perf(images): generate responsive image variants",
      "feat(og): add dynamic social preview images",
      "fix(mdx): render callout links correctly",
      "docs: add writing workflow to contributor guide",
      "test(posts): cover frontmatter validation",
      "feat(feed): include series metadata in RSS",
      "fix(images): retain focal point in thumbnails",
      "chore: update MDX compiler",
      "feat(og): add project card template",
      "style: tighten article code block spacing",
      "perf: prefetch adjacent posts",
      "fix(feed): escape ampersands in descriptions",
      "feat(posts): add reading time to article headers",
      "build: update sitemap generation",
    ],
    pullTitles: [
      "feat(og): introduce dynamic project preview images",
      "perf(images): optimise responsive image delivery",
      "feat(posts): add MDX series navigation",
    ],
    releaseNotes: [
      "Dynamic Open Graph images for posts and project pages.",
      "Sharper responsive images with less transfer on mobile.",
      "Improved MDX authoring flow and post navigation.",
      "RSS and sitemap refinements for published writing.",
    ],
    issueTitles: [
      "Add a visual archive for older posts",
      "Support external links in project metadata",
      "Document image optimisation conventions",
    ],
    readmeIntro:
      "A fast, content-first personal site built around MDX, showcasing selected projects alongside practical notes from running and maintaining them.",
    features: [
      "MDX posts with validated frontmatter",
      "Responsive image optimisation",
      "Generated Open Graph images and RSS feed",
    ],
    securityCount: 0,
  },
  {
    slug: "dashboard",
    name: "Dashboard",
    description:
      "A self-hosted dashboard for projects, services, and deployments.",
    language: "TypeScript",
    topics: ["nextjs", "docker", "devops"],
    commitMessages: [
      "feat(agent): stream deploy progress from runner",
      "feat(tunnels): surface Cloudflare route status",
      "feat(monitoring): add service latency trend",
      "fix(deploys): clear stale running status",
      "test(agent): cover retryable deploy failures",
      "refactor(tunnels): centralize route resolution",
      "feat(monitoring): show recent incident timeline",
      "fix(auth): preserve return path after access check",
      "chore: refresh container inspection fixtures",
      "feat(deploys): display build step durations",
      "perf(overview): memoize fleet summary",
      "ci: cache agent build artifacts",
      "fix(tunnels): report disabled route clearly",
      "feat(monitoring): add SSL expiry warning",
      "build: align Next.js runtime settings",
    ],
    pullTitles: [
      "feat(agent): report deploy progress in real time",
      "feat(monitoring): add tunnel and latency signals",
      "fix(deploys): reconcile completed runner jobs",
    ],
    releaseNotes: [
      "Live deploy-agent progress and per-step timing.",
      "Tunnel route visibility with clearer disabled-state handling.",
      "Monitoring trends, incident history, and SSL expiry warnings.",
      "Deployment reconciliation fixes for long-running jobs.",
    ],
    issueTitles: [
      "Add a deployment rollback timeline",
      "Show tunnel route ownership in service details",
      "Export monitoring incidents as CSV",
    ],
    readmeIntro:
      "Dashboard is a self-hosted operations console for keeping a small fleet of services, deploy agents, tunnels, and monitoring checks in one calm, useful place.",
    features: [
      "Deploy-agent job visibility",
      "Cloudflare tunnel route inspection",
      "Service monitoring, incidents, and SSL checks",
    ],
    securityCount: 1,
  },
  {
    slug: "snippets-api",
    name: "Code Snippets API",
    description: "REST API for storing and retrieving code snippets.",
    language: "Go",
    topics: ["go", "postgresql", "redis"],
    commitMessages: [
      "feat(handlers): add language filter to snippet list",
      "feat(postgres): add full-text search query",
      "perf(redis): cache popular snippet reads",
      "fix(handlers): return validation details for bad payloads",
      "test(postgres): cover expired snippet cleanup",
      "refactor(cache): isolate Redis key construction",
      "feat(handlers): add pagination links",
      "fix(redis): avoid caching missing snippets",
      "docs: add local Postgres setup notes",
      "feat(postgres): add snippet visibility index",
      "perf(handlers): stream large export responses",
      "ci: run Go race detector",
      "fix(queries): preserve created-at sort order",
      "feat(cache): add cache invalidation on update",
      "build: bump Go toolchain version",
    ],
    pullTitles: [
      "feat(postgres): add full-text snippet search",
      "perf(redis): cache popular snippet reads",
      "fix(handlers): return useful validation errors",
    ],
    releaseNotes: [
      "Postgres-backed full-text search for public snippets.",
      "Redis caching for frequently read snippets.",
      "More precise handler validation and pagination links.",
      "Query and cleanup reliability improvements.",
    ],
    issueTitles: [
      "Add a public snippet import endpoint",
      "Expose Redis cache hit rate in metrics",
      "Document Postgres backup and restore steps",
    ],
    readmeIntro:
      "Code Snippets API is a small Go service for saving, searching, and sharing code snippets, with PostgreSQL for durable queries and Redis for the hot read path.",
    features: [
      "HTTP handlers for creating and listing snippets",
      "PostgreSQL full-text search",
      "Redis cache invalidation on writes",
    ],
    securityCount: 0,
    isGo: true,
  },
];

function dateAt(now: Date, daysAgo: number, hour = 10) {
  return new Date(
    now.getTime() - daysAgo * 86_400_000 + hour * 3_600_000,
  ).toISOString();
}

/** A stable, real-looking 40-character hex sha for a seed and position. */
function sha(seed: string, index: number) {
  return createHash("sha1").update(`${seed}:${index}`).digest("hex");
}

function createRepository(
  definition: RepoDefinition,
  now: Date,
): GitHubRepository {
  return {
    id: 1_000 + definition.slug.length,
    node_id: `R_${definition.slug}`,
    name: definition.slug,
    full_name: `${OWNER}/${definition.slug}`,
    owner: USER,
    private: false,
    html_url: `https://github.com/${OWNER}/${definition.slug}`,
    description: definition.description,
    fork: false,
    url: `https://api.github.com/repos/${OWNER}/${definition.slug}`,
    default_branch: "main",
    visibility: "public",
    pushed_at: dateAt(now, 1),
    created_at: dateAt(now, 120),
    updated_at: dateAt(now, 1),
    language: definition.language,
    stargazers_count: 8 + definition.slug.length,
    watchers_count: 3,
    forks_count: 2,
    open_issues_count: 2,
    topics: definition.topics,
    archived: false,
    disabled: false,
  };
}

function buildCommits(
  definition: RepoDefinition,
  repository: GitHubRepository,
  now: Date,
): GitHubCommit[] {
  return definition.commitMessages.map((message, index) => {
    const value = sha(definition.slug, index);
    const author = index % 5 === 2 ? BOT : USER;
    const email =
      author.type === "Bot"
        ? "49699333+dependabot[bot]@users.noreply.github.com"
        : "marczelloo@users.noreply.github.com";
    const date = dateAt(now, index + 1);

    return {
      sha: value,
      node_id: `C_${value}`,
      commit: {
        author: { name: author.login, email, date },
        committer: { name: author.login, email, date },
        message,
        tree: {
          sha: sha(definition.slug, index + 30),
          url: `${repository.url}/git/trees/${sha(definition.slug, index + 30)}`,
        },
        url: `${repository.url}/git/commits/${value}`,
        comment_count: 0,
        verification: {
          verified: index % 3 !== 0,
          reason: index % 3 !== 0 ? "valid" : "unsigned",
          signature: null,
          payload: null,
        },
      },
      url: `${repository.url}/commits/${value}`,
      html_url: `${repository.html_url}/commit/${value}`,
      author,
      committer: author,
      parents:
        index === definition.commitMessages.length - 1
          ? []
          : [
              {
                sha: sha(definition.slug, index + 1),
                url: `${repository.url}/commits/${sha(definition.slug, index + 1)}`,
                html_url: `${repository.html_url}/commit/${sha(definition.slug, index + 1)}`,
              },
            ],
    };
  });
}

function buildBranches(repository: GitHubRepository, commits: GitHubCommit[]) {
  return ["main", "develop", "feat/observability", "fix/session-timeout"].map(
    (name, index) => ({
      name,
      commit: { sha: commits[index].sha, url: commits[index].url },
      protected: index < 2,
      ...(index < 2
        ? { protection_url: `${repository.url}/branches/${name}/protection` }
        : {}),
      ahead_by: index === 0 ? 0 : index + 1,
      behind_by: index === 0 || index === 1 ? 0 : 1,
    }),
  );
}

function buildPulls(
  definition: RepoDefinition,
  repository: GitHubRepository,
  branches: DemoGithubRepository["branches"],
  commits: GitHubCommit[],
  now: Date,
): GitHubPullRequest[] {
  const labels = [
    {
      id: 1,
      node_id: "LA_enhancement",
      url: `${repository.url}/labels/enhancement`,
      name: "enhancement",
      color: "a2eeef",
      description: "New capability",
      default: true,
    },
  ];
  return definition.pullTitles.map((title, index) => ({
    id: 5_000 + index,
    number: 20 + index,
    node_id: `PR_${definition.slug}_${index}`,
    state: index === 0 ? "open" : "closed",
    locked: false,
    title,
    body: "## Summary\n\nA focused improvement with tests and an updated operational note where needed.",
    user: index === 2 ? BOT : USER,
    labels,
    html_url: `${repository.html_url}/pull/${20 + index}`,
    created_at: dateAt(now, 3 + index * 5),
    updated_at: dateAt(now, 1 + index * 4),
    closed_at: index ? dateAt(now, index * 4) : null,
    merged_at: index === 1 ? dateAt(now, 4) : null,
    merge_commit_sha: index === 1 ? commits[4].sha : null,
    draft: false,
    head: {
      label: `${OWNER}:${branches[index + 1].name}`,
      ref: branches[index + 1].name,
      sha: commits[index + 1].sha,
      user: USER,
      repo: repository,
    },
    base: {
      label: `${OWNER}:main`,
      ref: "main",
      sha: commits[0].sha,
      user: USER,
      repo: repository,
    },
    author_association: "OWNER",
    merged: index === 1,
    mergeable: true,
    mergeable_state: "clean",
    comments: index,
    review_comments: index + 1,
    commits: index + 1,
    additions: 42 + index * 8,
    deletions: 10 + index,
    changed_files: 3 + index,
  }));
}

function buildReleases(
  definition: RepoDefinition,
  repository: GitHubRepository,
  now: Date,
): GitHubRelease[] {
  return ["1.4.0", "1.3.0", "1.2.1", "1.2.0"].map((version, index) => ({
    id: 6_000 + index,
    tag_name: `v${version}`,
    target_commitish: "main",
    name: `${definition.name} v${version}`,
    body: `## What's changed\n\n- ${definition.releaseNotes[index]}\n\n**Full Changelog**: ${repository.html_url}/compare/v1.0.0...v${version}`,
    draft: false,
    prerelease: false,
    created_at: dateAt(now, 7 + index * 15),
    published_at: dateAt(now, 7 + index * 15),
    author: USER,
    html_url: `${repository.html_url}/releases/tag/v${version}`,
    tarball_url: `${repository.url}/tarball/v${version}`,
    zipball_url: `${repository.url}/zipball/v${version}`,
    assets: [],
  }));
}

function buildIssues(
  definition: RepoDefinition,
  repository: GitHubRepository,
  now: Date,
): GitHubIssue[] {
  return definition.issueTitles.map((title, index) => ({
    id: 7_000 + index,
    number: 40 + index,
    node_id: `I_${definition.slug}_${index}`,
    title,
    body: "A focused follow-up that would make the operational workflow clearer for maintainers.",
    state: index === 2 ? "closed" : "open",
    state_reason: index === 2 ? "completed" : null,
    locked: false,
    user: USER,
    labels: [
      {
        id: 1,
        name: "enhancement",
        color: "a2eeef",
        description: "New capability",
      },
    ],
    assignee: index === 0 ? USER : null,
    assignees: index === 0 ? [USER] : [],
    milestone: null,
    comments: index,
    html_url: `${repository.html_url}/issues/${40 + index}`,
    created_at: dateAt(now, 9 + index * 4),
    updated_at: dateAt(now, 2 + index * 2),
    closed_at: index === 2 ? dateAt(now, 2) : null,
    closed_by: index === 2 ? USER : null,
    author_association: "OWNER",
  }));
}

function buildSecurity(
  definition: RepoDefinition,
  repository: GitHubRepository,
  now: Date,
): GitHubSecurityAlert[] {
  return Array.from({ length: definition.securityCount }, (_, index) => {
    const severity = index === 0 ? "high" : "medium";
    const packageName = index === 0 ? "axios" : "lodash";
    return {
      number: index + 1,
      state: "open",
      dependency: {
        package: { ecosystem: "npm", name: packageName },
        manifest_path: "/package-lock.json",
        scope: "runtime",
      },
      security_advisory: {
        ghsa_id: index === 0 ? "GHSA-8hc4-vh64-cxmj" : "GHSA-35jh-r3h4-6jhm",
        cve_id: null,
        summary:
          index === 0
            ? "Server-Side Request Forgery in axios"
            : "Prototype Pollution in lodash",
        description:
          "Update to a patched version to resolve this dependency vulnerability.",
        severity,
        vulnerabilities: [
          {
            package: { ecosystem: "npm", name: packageName },
            severity,
            vulnerable_version_range: "< patched",
            first_patched_version: { identifier: "latest" },
          },
        ],
        published_at: dateAt(now, 30),
        updated_at: dateAt(now, 2),
        withdrawn_at: null,
      },
      security_vulnerability: {
        package: { ecosystem: "npm", name: packageName },
        severity,
        vulnerable_version_range: "< patched",
        first_patched_version: { identifier: "latest" },
      },
      url: `${repository.url}/dependabot/alerts/${index + 1}`,
      html_url: `${repository.html_url}/security/dependabot/${index + 1}`,
      created_at: dateAt(now, 12 + index),
      updated_at: dateAt(now, 2),
      dismissed_at: null,
      dismissed_by: null,
      dismissed_reason: null,
      dismissed_comment: null,
      fixed_at: null,
    };
  });
}

function buildCodeScanning(
  repository: GitHubRepository,
  commits: GitHubCommit[],
  security: GitHubSecurityAlert[],
  now: Date,
): CodeScanningAlert[] {
  return security.slice(0, 2).map((_, index) => ({
    number: index + 1,
    created_at: dateAt(now, 10 + index),
    updated_at: dateAt(now, 2),
    url: `${repository.url}/code-scanning/alerts/${index + 1}`,
    html_url: `${repository.html_url}/security/code-scanning/${index + 1}`,
    state: "open",
    dismissed_by: null,
    dismissed_at: null,
    dismissed_reason: null,
    rule: {
      id: index === 0 ? "js/path-injection" : "js/sql-injection",
      severity: "error",
      security_severity_level: index === 0 ? "high" : "medium",
      description: "Untrusted input reaches a sensitive operation.",
      name:
        index === 0
          ? "Path injection"
          : "SQL query built from user-controlled sources",
      tags: ["security", "external/cwe/cwe-22"],
    },
    tool: { name: "CodeQL", version: "2.18.1" },
    most_recent_instance: {
      ref: "refs/heads/main",
      state: "open",
      commit_sha: commits[0].sha,
      message: { text: "Review this data flow before merging." },
      location: {
        path: "src/server/api.ts",
        start_line: 42,
        end_line: 42,
        start_column: 1,
        end_column: 18,
      },
    },
  }));
}

function file(
  repository: GitHubRepository,
  path: string,
  text: string,
): GitHubContent {
  const url = `${repository.url}/contents/${path}`;
  const contentSha = sha(repository.name, path.length);
  return {
    type: "file",
    encoding: "base64",
    size: text.length,
    name: path.split("/").pop()!,
    path,
    content: Buffer.from(text).toString("base64"),
    sha: contentSha,
    url,
    git_url: `${repository.url}/git/blobs/${contentSha}`,
    html_url: `${repository.html_url}/blob/main/${path}`,
    download_url: `https://raw.githubusercontent.com/${OWNER}/${repository.name}/main/${path}`,
  };
}

function directory(repository: GitHubRepository, path: string): GitHubContent {
  const contentSha = sha(repository.name, path.length);
  return {
    type: "dir",
    size: 0,
    name: path.split("/").pop()!,
    path,
    sha: contentSha,
    url: `${repository.url}/contents/${path}`,
    git_url: `${repository.url}/git/trees/${contentSha}`,
    html_url: `${repository.html_url}/tree/main/${path}`,
    download_url: null,
  };
}

function buildReadme(definition: RepoDefinition) {
  const command = definition.isGo
    ? "go run ./cmd/server"
    : "npm install\nnpm run dev";
  return `# ${definition.name}\n\n${definition.readmeIntro}\n\n## Features\n\n${definition.features.map((feature) => `- ${feature}`).join("\n")}\n\n## Quick start\n\n\`\`\`sh\n${command}\n\`\`\`\n`;
}

function buildContents(
  definition: RepoDefinition,
  repository: GitHubRepository,
): DemoGithubRepository["contents"] {
  const readme = buildReadme(definition);
  if (definition.isGo) {
    const goMod =
      "module github.com/marczelloo/snippets-api\n\ngo 1.24\n\nrequire (\n\tgithub.com/jackc/pgx/v5 v5.7.2\n\tgithub.com/redis/go-redis/v9 v9.7.0\n)\n";
    const main =
      'package main\n\nimport (\n\t"log"\n\t"net/http"\n)\n\nfunc main() {\n\tlog.Fatal(http.ListenAndServe(":8080", nil))\n}\n';
    const handler =
      'package snippets\n\nimport "net/http"\n\nfunc List(w http.ResponseWriter, r *http.Request) {\n\tw.WriteHeader(http.StatusOK)\n}\n';
    return {
      "": [
        file(repository, "README.md", readme),
        file(repository, "go.mod", goMod),
        directory(repository, "cmd"),
        directory(repository, "internal"),
      ],
      cmd: [directory(repository, "cmd/server")],
      "cmd/server": [file(repository, "cmd/server/main.go", main)],
      internal: [directory(repository, "internal/snippets")],
      "internal/snippets": [
        file(repository, "internal/snippets/handler.go", handler),
      ],
      "README.md": file(repository, "README.md", readme),
      "go.mod": file(repository, "go.mod", goMod),
      "cmd/server/main.go": file(repository, "cmd/server/main.go", main),
      "internal/snippets/handler.go": file(
        repository,
        "internal/snippets/handler.go",
        handler,
      ),
    };
  }

  const packageJson = `${JSON.stringify({ name: definition.slug, private: true, version: "1.4.0", scripts: { dev: "next dev", build: "next build" }, dependencies: { next: "16.0.1", react: "19.0.0", zod: "3.23.8" } }, null, 2)}\n`;
  const source = `export function getStatus() {\n  return { ok: true, service: "${definition.slug}" };\n}\n`;
  const config =
    'export const config = { port: 3000, environment: process.env.NODE_ENV ?? "development" };\n';
  return {
    "": [
      file(repository, "README.md", readme),
      file(repository, "package.json", packageJson),
      directory(repository, "src"),
    ],
    src: [
      file(repository, "src/index.ts", source),
      file(repository, "src/config.ts", config),
    ],
    "README.md": file(repository, "README.md", readme),
    "package.json": file(repository, "package.json", packageJson),
    "src/index.ts": file(repository, "src/index.ts", source),
    "src/config.ts": file(repository, "src/config.ts", config),
  };
}

function buildDependencies(definition: RepoDefinition) {
  if (definition.isGo) {
    return [
      {
        name: "github.com/jackc/pgx/v5",
        version: "v5.7.2",
        ecosystem: "go",
        downloadLocation:
          "https://proxy.golang.org/github.com/jackc/pgx/v5/@v/v5.7.2.zip",
      },
      {
        name: "github.com/redis/go-redis/v9",
        version: "v9.7.0",
        ecosystem: "go",
        downloadLocation:
          "https://proxy.golang.org/github.com/redis/go-redis/v9/@v/v9.7.0.zip",
      },
      {
        name: "github.com/go-chi/chi/v5",
        version: "v5.2.0",
        ecosystem: "go",
        downloadLocation:
          "https://proxy.golang.org/github.com/go-chi/chi/v5/@v/v5.2.0.zip",
      },
    ];
  }
  return [
    {
      name: "next",
      version: "16.0.1",
      ecosystem: "npm",
      downloadLocation: "https://registry.npmjs.org/next/-/next-16.0.1.tgz",
    },
    {
      name: "react",
      version: "19.0.0",
      ecosystem: "npm",
      downloadLocation: "https://registry.npmjs.org/react/-/react-19.0.0.tgz",
    },
    {
      name: "lodash",
      version: "4.17.20",
      ecosystem: "npm",
      downloadLocation:
        "https://registry.npmjs.org/lodash/-/lodash-4.17.20.tgz",
    },
  ];
}

function buildRepository(
  definition: RepoDefinition,
  now: Date,
): DemoGithubRepository {
  const repository = createRepository(definition, now);
  const commits = buildCommits(definition, repository, now);
  const branches = buildBranches(repository, commits);
  const security = buildSecurity(definition, repository, now);
  return {
    repository,
    branches,
    commits,
    pulls: buildPulls(definition, repository, branches, commits, now),
    releases: buildReleases(definition, repository, now),
    contributors: [
      {
        login: OWNER,
        id: 1,
        avatar_url: AVATAR_URL,
        html_url: USER.html_url,
        contributions: 128,
        type: "User",
      },
      {
        login: "alex-kowalski",
        id: 3,
        avatar_url: "https://github.com/identicons/alex-kowalski.png",
        html_url: "https://github.com/alex-kowalski",
        contributions: 24,
        type: "User",
      },
    ],
    issues: buildIssues(definition, repository, now),
    security,
    codeScanning: buildCodeScanning(repository, commits, security, now),
    dependencies: buildDependencies(definition),
    contents: buildContents(definition, repository),
  };
}

function paginate<T>(items: T[], options: PaginationOptions = {}) {
  const current = Math.max(1, options.page ?? 1);
  const size = Math.max(1, options.perPage ?? 30);
  return {
    data: items.slice((current - 1) * size, current * size),
    pagination: {
      firstPage: 1,
      lastPage: Math.max(1, Math.ceil(items.length / size)),
      totalCount: items.length,
      ...(current > 1 ? { prevPage: current - 1 } : {}),
      ...(current * size < items.length ? { nextPage: current + 1 } : {}),
    },
  };
}

/** Pass now in tests; production routes intentionally use the current time. */
export function demoGithubData(
  now = new Date(),
): Record<string, DemoGithubRepository> {
  return Object.fromEntries(
    REPOS.map((definition) => [
      definition.slug,
      buildRepository(definition, now),
    ]),
  );
}

export async function demoRepoFromParams(
  params: Promise<{ owner: string; repo: string }>,
) {
  const { owner, repo } = await params;
  if (owner.toLowerCase() !== OWNER) {
    return null;
  }
  return demoGithubData()[repo.toLowerCase()] ?? null;
}

export function pageOptions(searchParams: URLSearchParams) {
  return {
    page: parseInt(searchParams.get("page") || "1", 10),
    perPage: Math.min(parseInt(searchParams.get("per_page") || "30", 10), 100),
  };
}

export function listDemoGithubRepos(
  options?: PaginationOptions,
  now = new Date(),
) {
  return paginate(
    Object.values(demoGithubData(now)).map((item) => item.repository),
    options,
  );
}

export function demoGithubPage<T>(items: T[], options?: PaginationOptions) {
  return paginate(items, options);
}

export function demoGithubStats(data: DemoGithubRepository) {
  return {
    commits_count: data.commits.length,
    branches_count: data.branches.length,
    open_prs_count: data.pulls.filter((pull) => pull.state === "open").length,
    open_issues_count: data.issues.filter((issue) => issue.state === "open")
      .length,
    releases_count: data.releases.length,
    contributors_count: data.contributors.length,
    security_alerts_count: data.security.filter(
      (alert) => alert.state === "open",
    ).length,
    last_commit: data.commits[0] ?? null,
    last_release: data.releases[0] ?? null,
  };
}
