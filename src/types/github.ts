// ========================================
// GitHub API Types
// ========================================

/**
 * GitHub Repository
 */
export interface GitHubRepository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  owner: GitHubUser;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  url: string;
  default_branch: string;
  visibility: "public" | "private" | "internal";
  pushed_at: string | null;
  created_at: string;
  updated_at: string;
  language: string | null;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  topics: string[];
  archived: boolean;
  disabled: boolean;
}

/**
 * GitHub User (author, committer, etc.)
 */
export interface GitHubUser {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  html_url: string;
  type: "User" | "Organization" | "Bot";
}

/**
 * GitHub Commit
 */
export interface GitHubCommit {
  sha: string;
  node_id: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
    tree: { sha: string; url: string };
    url: string;
    comment_count: number;
    verification?: {
      verified: boolean;
      reason: string;
      signature: string | null;
      payload: string | null;
    };
  };
  url: string;
  html_url: string;
  author: GitHubUser | null;
  committer: GitHubUser | null;
  parents: Array<{ sha: string; url: string; html_url: string }>;
}

/**
 * GitHub Branch
 */
export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
  protection_url?: string;
}

/**
 * GitHub Pull Request
 */
export interface GitHubPullRequest {
  id: number;
  number: number;
  node_id: string;
  state: "open" | "closed";
  locked: boolean;
  title: string;
  body: string | null;
  user: GitHubUser;
  labels: Array<{
    id: number;
    node_id: string;
    url: string;
    name: string;
    color: string;
    description: string | null;
    default: boolean;
  }>;
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  draft: boolean;
  head: {
    label: string;
    ref: string;
    sha: string;
    user: GitHubUser;
    repo: GitHubRepository;
  };
  base: {
    label: string;
    ref: string;
    sha: string;
    user: GitHubUser;
    repo: GitHubRepository;
  };
  author_association: string;
  merged: boolean;
  mergeable: boolean | null;
  mergeable_state: string;
  comments: number;
  review_comments: number;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
}

/**
 * GitHub Release
 */
export interface GitHubRelease {
  id: number;
  tag_name: string;
  target_commitish: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string | null;
  author: GitHubUser;
  html_url: string;
  tarball_url: string | null;
  zipball_url: string | null;
  assets: GitHubReleaseAsset[];
}

/**
 * GitHub Release Asset
 */
export interface GitHubReleaseAsset {
  id: number;
  name: string;
  label: string | null;
  state: string;
  content_type: string;
  size: number;
  download_count: number;
  created_at: string;
  updated_at: string;
  browser_download_url: string;
}

/**
 * GitHub Security Alert (Dependabot)
 */
export interface GitHubSecurityAlert {
  number: number;
  state: "open" | "dismissed" | "fixed";
  dependency: {
    package: {
      ecosystem: string;
      name: string;
    };
    manifest_path: string;
    scope: "development" | "runtime";
  };
  security_advisory: {
    ghsa_id: string;
    cve_id: string | null;
    summary: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    vulnerabilities: Array<{
      package: { ecosystem: string; name: string };
      severity: string;
      vulnerable_version_range: string;
      first_patched_version: { identifier: string } | null;
    }>;
    published_at: string;
    updated_at: string;
    withdrawn_at: string | null;
  };
  security_vulnerability: {
    package: { ecosystem: string; name: string };
    severity: "low" | "medium" | "high" | "critical";
    vulnerable_version_range: string;
    first_patched_version: { identifier: string } | null;
  };
  url: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  dismissed_at: string | null;
  dismissed_by: GitHubUser | null;
  dismissed_reason: string | null;
  dismissed_comment: string | null;
  fixed_at: string | null;
}

/**
 * GitHub Issue
 */
export interface GitHubIssue {
  id: number;
  number: number;
  node_id: string;
  title: string;
  body: string | null;
  state: "open" | "closed";
  state_reason: "completed" | "reopened" | "not_planned" | null;
  locked: boolean;
  user: GitHubUser;
  labels: Array<{
    id: number;
    name: string;
    color: string;
    description: string | null;
  }>;
  assignee: GitHubUser | null;
  assignees: GitHubUser[];
  milestone: {
    id: number;
    number: number;
    title: string;
    state: "open" | "closed";
  } | null;
  comments: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  closed_by: GitHubUser | null;
  author_association: string;
}

/**
 * GitHub Contributor
 */
export interface GitHubContributor {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type: "User" | "Bot";
}

/**
 * GitHub Workflow Run
 */
export interface GitHubWorkflowRun {
  id: number;
  name: string | null;
  node_id: string;
  head_branch: string | null;
  head_sha: string;
  run_number: number;
  event: string;
  status: "queued" | "in_progress" | "completed" | "waiting";
  conclusion: "success" | "failure" | "neutral" | "cancelled" | "skipped" | "timed_out" | "action_required" | null;
  workflow_id: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_started_at: string | null;
  actor: GitHubUser;
  triggering_actor: GitHubUser;
}

/**
 * GitHub Content (file/directory)
 */
export interface GitHubContent {
  type: "file" | "dir" | "symlink" | "submodule";
  encoding?: "base64";
  size: number;
  name: string;
  path: string;
  content?: string;
  sha: string;
  url: string;
  git_url: string | null;
  html_url: string | null;
  download_url: string | null;
}

// ========================================
// Webhook Payload Types
// ========================================

/**
 * Base webhook payload
 */
export interface GitHubWebhookPayload {
  action?: string;
  sender: GitHubUser;
  repository?: GitHubRepository;
  installation?: { id: number; node_id: string };
}

/**
 * Push event payload
 */
export interface GitHubPushPayload {
  ref: string;
  before: string;
  after: string;
  created: boolean;
  deleted: boolean;
  forced: boolean;
  base_ref: string | null;
  compare: string;
  commits: Array<{
    id: string;
    tree_id: string;
    distinct: boolean;
    message: string;
    timestamp: string;
    url: string;
    author: { name: string; email: string; username?: string };
    committer: { name: string; email: string; username?: string };
    added: string[];
    removed: string[];
    modified: string[];
  }>;
  head_commit: {
    id: string;
    tree_id: string;
    distinct: boolean;
    message: string;
    timestamp: string;
    url: string;
    author: { name: string; email: string; username?: string };
    committer: { name: string; email: string; username?: string };
    added: string[];
    removed: string[];
    modified: string[];
  } | null;
  repository: GitHubRepository;
  pusher: { name: string; email: string };
  sender: GitHubUser;
  installation?: { id: number; node_id: string };
}

/**
 * Release event payload
 */
export interface GitHubReleasePayload extends GitHubWebhookPayload {
  action: "published" | "unpublished" | "created" | "edited" | "deleted" | "prereleased" | "released";
  release: GitHubRelease;
}

/**
 * Pull request event payload
 */
export interface GitHubPullRequestPayload extends GitHubWebhookPayload {
  action:
    | "opened"
    | "edited"
    | "closed"
    | "reopened"
    | "synchronize"
    | "assigned"
    | "unassigned"
    | "labeled"
    | "unlabeled"
    | "review_requested"
    | "review_request_removed"
    | "ready_for_review"
    | "converted_to_draft"
    | "locked"
    | "unlocked";
  number: number;
  pull_request: GitHubPullRequest;
}

/**
 * Dependabot alert event payload
 */
export interface GitHubDependabotAlertPayload extends GitHubWebhookPayload {
  action: "created" | "dismissed" | "fixed" | "reintroduced" | "reopened";
  alert: GitHubSecurityAlert;
}

// ========================================
// API Response Types
// ========================================

/**
 * Pagination info from Link header
 */
export interface GitHubPagination {
  nextPage?: number;
  prevPage?: number;
  lastPage?: number;
  firstPage?: number;
  totalCount?: number;
}

/**
 * Rate limit info
 */
export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  used: number;
  resource: string;
}

/**
 * API response wrapper
 */
export interface GitHubApiResponse<T> {
  data: T;
  pagination?: GitHubPagination;
  rateLimit?: GitHubRateLimit;
}

// ========================================
// Internal Types (for dashboard)
// ========================================

/**
 * Linked GitHub repository (stored in DB)
 */
export interface GitHubRepo {
  id: string;
  project_id: string;
  owner: string;
  repo: string;
  default_branch: string;
  webhook_id: number | null;
  auto_deploy: boolean;
  deploy_branch: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Create GitHubRepo input
 */
export interface CreateGitHubRepoInput {
  project_id: string;
  owner: string;
  repo: string;
  default_branch: string;
  webhook_id?: number;
  auto_deploy?: boolean;
  deploy_branch?: string;
}

/**
 * Update GitHubRepo input
 */
export interface UpdateGitHubRepoInput {
  default_branch?: string;
  webhook_id?: number | null;
  auto_deploy?: boolean;
  deploy_branch?: string | null;
  last_synced_at?: string;
}

/**
 * Repository stats summary
 */
export interface GitHubRepoStats {
  commits_count: number;
  branches_count: number;
  open_prs_count: number;
  open_issues_count: number;
  releases_count: number;
  contributors_count: number;
  security_alerts_count: number;
  last_commit: GitHubCommit | null;
  last_release: GitHubRelease | null;
}
