/**
 * GitHub API Client - GitHub App authentication and API access
 *
 * Uses GitHub App JWT authentication with installation tokens.
 * All tokens are cached and auto-refreshed when expired.
 */

import "server-only";
import * as nodeCrypto from "crypto";
import type {
  GitHubRepository,
  GitHubCommit,
  GitHubBranch,
  GitHubPullRequest,
  GitHubRelease,
  GitHubSecurityAlert,
  GitHubIssue,
  GitHubContributor,
  GitHubWorkflowRun,
  GitHubContent,
  GitHubRateLimit,
  GitHubApiResponse,
  GitHubPagination,
} from "@/types/github";

// ========================================
// Configuration
// ========================================

const GITHUB_API_URL = "https://api.github.com";

// Installation token cache
let cachedInstallationToken: string | null = null;
let tokenExpiresAt: Date | null = null;
let tokenRefreshPromise: Promise<string> | null = null;

// Rate limit tracking
let lastRateLimit: GitHubRateLimit | null = null;

/**
 * Get configured GitHub App credentials
 */
function getConfig() {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyBase64 = process.env.GITHUB_PRIVATE_KEY_BASE64;
  const installationId = process.env.GITHUB_INSTALLATION_ID;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!appId || !privateKeyBase64 || !installationId) {
    throw new GitHubError(
      "GitHub App not configured. Set GITHUB_APP_ID, GITHUB_PRIVATE_KEY_BASE64, and GITHUB_INSTALLATION_ID.",
      500
    );
  }

  // Decode private key from base64
  const privateKey = Buffer.from(privateKeyBase64, "base64").toString("utf-8");

  return {
    appId,
    privateKey,
    installationId: parseInt(installationId, 10),
    webhookSecret: webhookSecret || null,
  };
}

// ========================================
// JWT Generation (GitHub App Authentication)
// ========================================

/**
 * Create a JWT for GitHub App authentication
 * JWT is valid for 10 minutes max per GitHub's requirements
 */
async function createAppJWT(): Promise<string> {
  const config = getConfig();

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 30, // Issued 30 seconds ago (clock drift tolerance)
    exp: now + 540, // Expires in 9 minutes (under GitHub's 10-minute limit)
    iss: config.appId,
  };

  // Use RS256 signing with Node.js crypto
  const header = { alg: "RS256", typ: "JWT" };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Import the private key and sign
  const signature = signRS256(signingInput, config.privateKey);

  return `${signingInput}.${signature}`;
}

/**
 * Base64 URL encode (no padding)
 */
function base64UrlEncode(str: string): string {
  const base64 = Buffer.from(str).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Sign data with RS256 algorithm using Node.js crypto
 * Supports both PKCS#1 (RSA PRIVATE KEY) and PKCS#8 (PRIVATE KEY) formats
 */
function signRS256(data: string, privateKeyPem: string): string {
  // Use Node.js crypto module which handles both PKCS#1 and PKCS#8
  const sign = nodeCrypto.createSign("RSA-SHA256");
  sign.update(data);
  sign.end();

  const signature = sign.sign(privateKeyPem, "base64");

  // Convert to base64url
  return signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ========================================
// Installation Token Management
// ========================================

/**
 * Get or refresh the installation access token
 * Installation tokens are valid for 1 hour
 * Uses a lock to prevent concurrent refresh attempts
 */
async function getInstallationToken(): Promise<string> {
  // Check if we have a valid cached token (with 5 minute buffer)
  if (cachedInstallationToken && tokenExpiresAt && tokenExpiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return cachedInstallationToken;
  }

  // If already refreshing, wait for that to complete (prevents race condition)
  if (tokenRefreshPromise) {
    return tokenRefreshPromise;
  }

  // Start refresh with a lock
  tokenRefreshPromise = (async () => {
    try {
      const config = getConfig();
      const jwt = await createAppJWT();

      console.log("[GitHub] Refreshing installation token...");

      const response = await fetch(`${GITHUB_API_URL}/app/installations/${config.installationId}/access_tokens`, {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${jwt}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("[GitHub] Failed to get installation token:", response.status, error);
        throw new GitHubError(`Failed to get installation token: ${response.status}`, response.status);
      }

      const data = await response.json();
      cachedInstallationToken = data.token;
      tokenExpiresAt = new Date(data.expires_at);

      console.log(`[GitHub] Installation token refreshed, expires at ${tokenExpiresAt.toISOString()}`);

      return cachedInstallationToken!;
    } finally {
      tokenRefreshPromise = null;
    }
  })();

  return tokenRefreshPromise;
}

/**
 * Clear cached tokens (call on auth errors)
 */
export function clearTokenCache() {
  cachedInstallationToken = null;
  tokenExpiresAt = null;
  console.log("[GitHub] Token cache cleared");
}

// ========================================
// HTTP Client
// ========================================

interface RequestOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
  parseJson?: boolean;
}

/**
 * Make an authenticated request to GitHub API
 */
export async function githubRequest<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const token = await getInstallationToken();
  const url = path.startsWith("http") ? path : `${GITHUB_API_URL}${path}`;

  const { parseJson = true, headers = {}, ...fetchOptions } = options;

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...headers,
    },
    cache: "no-store",
  });

  // Track rate limits
  updateRateLimit(response.headers);

  // Handle 401 - token expired, retry once
  if (response.status === 401 && !isRetry) {
    console.log("[GitHub] Got 401, clearing token and retrying...");
    clearTokenCache();
    return githubRequest<T>(path, options, true);
  }

  // Handle rate limiting
  if (response.status === 403) {
    const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
    if (rateLimitRemaining === "0") {
      const resetTime = response.headers.get("x-ratelimit-reset");
      const resetDate = resetTime ? new Date(parseInt(resetTime, 10) * 1000) : null;
      throw new GitHubError(`Rate limit exceeded. Resets at ${resetDate?.toISOString() || "unknown"}`, 429);
    }
  }

  if (!response.ok) {
    const error = await response.text().catch(() => response.statusText);
    throw new GitHubError(`GitHub API error: ${response.status} - ${error}`, response.status);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  const text = await response.text();
  if (!text || !parseJson) {
    return text as T;
  }

  return JSON.parse(text);
}

/**
 * Make a paginated request to GitHub API
 */
async function githubPaginatedRequest<T>(path: string, options: RequestOptions = {}): Promise<GitHubApiResponse<T[]>> {
  const token = await getInstallationToken();
  const url = path.startsWith("http") ? path : `${GITHUB_API_URL}${path}`;

  const { headers = {}, ...fetchOptions } = options;

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...headers,
    },
    cache: "no-store",
  });

  updateRateLimit(response.headers);

  if (!response.ok) {
    const error = await response.text().catch(() => response.statusText);
    throw new GitHubError(`GitHub API error: ${response.status} - ${error}`, response.status);
  }

  const data = await response.json();
  const pagination = parseLinkHeader(response.headers.get("link"));

  return {
    data,
    pagination,
    rateLimit: lastRateLimit || undefined,
  };
}

/**
 * Update rate limit tracking from response headers
 */
function updateRateLimit(headers: Headers) {
  const limit = headers.get("x-ratelimit-limit");
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");
  const used = headers.get("x-ratelimit-used");
  const resource = headers.get("x-ratelimit-resource");

  if (limit && remaining && reset) {
    lastRateLimit = {
      limit: parseInt(limit, 10),
      remaining: parseInt(remaining, 10),
      reset: parseInt(reset, 10),
      used: used ? parseInt(used, 10) : 0,
      resource: resource || "core",
    };
  }
}

/**
 * Parse GitHub Link header for pagination
 */
function parseLinkHeader(linkHeader: string | null): GitHubPagination | undefined {
  if (!linkHeader) return undefined;

  const pagination: GitHubPagination = {};
  const links = linkHeader.split(",");

  for (const link of links) {
    const match = link.match(/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="(\w+)"/);
    if (match) {
      const page = parseInt(match[1], 10);
      const rel = match[2];

      switch (rel) {
        case "next":
          pagination.nextPage = page;
          break;
        case "prev":
          pagination.prevPage = page;
          break;
        case "last":
          pagination.lastPage = page;
          break;
        case "first":
          pagination.firstPage = page;
          break;
      }
    }
  }

  return Object.keys(pagination).length > 0 ? pagination : undefined;
}

// ========================================
// Error Class
// ========================================

export class GitHubError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

// ========================================
// Rate Limit Helpers
// ========================================

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(): GitHubRateLimit | null {
  return lastRateLimit;
}

/**
 * Check if we're close to rate limit
 */
export function isRateLimitLow(): boolean {
  if (!lastRateLimit) return false;
  return lastRateLimit.remaining < 100;
}

// ========================================
// Repository APIs
// ========================================

/**
 * Get a repository by owner/repo
 */
export async function getRepository(owner: string, repo: string): Promise<GitHubRepository> {
  return githubRequest<GitHubRepository>(`/repos/${owner}/${repo}`);
}

/**
 * List repositories accessible to the installation
 */
export async function listRepositories(page = 1, perPage = 30): Promise<GitHubApiResponse<GitHubRepository[]>> {
  const response = await githubPaginatedRequest<GitHubRepository>(
    `/installation/repositories?page=${page}&per_page=${perPage}`
  );

  // GitHub wraps installation repos in a wrapper object
  const wrapper = response.data as unknown as { repositories: GitHubRepository[]; total_count: number };
  return {
    ...response,
    data: wrapper.repositories,
    pagination: {
      ...response.pagination,
      totalCount: wrapper.total_count,
    },
  };
}

// ========================================
// Commits APIs
// ========================================

/**
 * List commits for a repository
 */
export async function listCommits(
  owner: string,
  repo: string,
  options: {
    sha?: string;
    path?: string;
    author?: string;
    since?: string;
    until?: string;
    page?: number;
    perPage?: number;
  } = {}
): Promise<GitHubApiResponse<GitHubCommit[]>> {
  const params = new URLSearchParams();
  if (options.sha) params.set("sha", options.sha);
  if (options.path) params.set("path", options.path);
  if (options.author) params.set("author", options.author);
  if (options.since) params.set("since", options.since);
  if (options.until) params.set("until", options.until);
  params.set("page", String(options.page || 1));
  params.set("per_page", String(options.perPage || 30));

  return githubPaginatedRequest<GitHubCommit>(`/repos/${owner}/${repo}/commits?${params}`);
}

/**
 * Get a specific commit
 */
export async function getCommit(owner: string, repo: string, sha: string): Promise<GitHubCommit> {
  return githubRequest<GitHubCommit>(`/repos/${owner}/${repo}/commits/${sha}`);
}

// ========================================
// Branches APIs
// ========================================

/**
 * List branches for a repository
 */
export async function listBranches(
  owner: string,
  repo: string,
  options: { protected?: boolean; page?: number; perPage?: number } = {}
): Promise<GitHubApiResponse<GitHubBranch[]>> {
  const params = new URLSearchParams();
  if (options.protected !== undefined) params.set("protected", String(options.protected));
  params.set("page", String(options.page || 1));
  params.set("per_page", String(options.perPage || 30));

  return githubPaginatedRequest<GitHubBranch>(`/repos/${owner}/${repo}/branches?${params}`);
}

/**
 * Get a specific branch
 */
export async function getBranch(owner: string, repo: string, branch: string): Promise<GitHubBranch> {
  return githubRequest<GitHubBranch>(`/repos/${owner}/${repo}/branches/${branch}`);
}

// ========================================
// Pull Request APIs
// ========================================

/**
 * List pull requests for a repository
 */
export async function listPullRequests(
  owner: string,
  repo: string,
  options: {
    state?: "open" | "closed" | "all";
    sort?: string;
    direction?: string;
    page?: number;
    perPage?: number;
  } = {}
): Promise<GitHubApiResponse<GitHubPullRequest[]>> {
  const params = new URLSearchParams();
  params.set("state", options.state || "open");
  if (options.sort) params.set("sort", options.sort);
  if (options.direction) params.set("direction", options.direction);
  params.set("page", String(options.page || 1));
  params.set("per_page", String(options.perPage || 30));

  return githubPaginatedRequest<GitHubPullRequest>(`/repos/${owner}/${repo}/pulls?${params}`);
}

/**
 * Get a specific pull request
 */
export async function getPullRequest(owner: string, repo: string, pullNumber: number): Promise<GitHubPullRequest> {
  return githubRequest<GitHubPullRequest>(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
}

// ========================================
// Release APIs
// ========================================

/**
 * List releases for a repository
 */
export async function listReleases(
  owner: string,
  repo: string,
  options: { page?: number; perPage?: number } = {}
): Promise<GitHubApiResponse<GitHubRelease[]>> {
  const params = new URLSearchParams();
  params.set("page", String(options.page || 1));
  params.set("per_page", String(options.perPage || 30));

  return githubPaginatedRequest<GitHubRelease>(`/repos/${owner}/${repo}/releases?${params}`);
}

/**
 * Get the latest release
 */
export async function getLatestRelease(owner: string, repo: string): Promise<GitHubRelease | null> {
  try {
    return await githubRequest<GitHubRelease>(`/repos/${owner}/${repo}/releases/latest`);
  } catch (error) {
    if (error instanceof GitHubError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Get a specific release by tag
 */
export async function getReleaseByTag(owner: string, repo: string, tag: string): Promise<GitHubRelease | null> {
  try {
    return await githubRequest<GitHubRelease>(`/repos/${owner}/${repo}/releases/tags/${tag}`);
  } catch (error) {
    if (error instanceof GitHubError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

// ========================================
// Security Alerts APIs (Dependabot)
// ========================================

/**
 * List Dependabot alerts for a repository
 */
export async function listSecurityAlerts(
  owner: string,
  repo: string,
  options: { state?: "open" | "dismissed" | "fixed"; severity?: string; page?: number; perPage?: number } = {}
): Promise<GitHubApiResponse<GitHubSecurityAlert[]>> {
  const params = new URLSearchParams();
  if (options.state) params.set("state", options.state);
  if (options.severity) params.set("severity", options.severity);
  params.set("page", String(options.page || 1));
  params.set("per_page", String(options.perPage || 30));

  return githubPaginatedRequest<GitHubSecurityAlert>(`/repos/${owner}/${repo}/dependabot/alerts?${params}`);
}

/**
 * Get a specific Dependabot alert
 */
export async function getSecurityAlert(owner: string, repo: string, alertNumber: number): Promise<GitHubSecurityAlert> {
  return githubRequest<GitHubSecurityAlert>(`/repos/${owner}/${repo}/dependabot/alerts/${alertNumber}`);
}

// ========================================
// Issues APIs
// ========================================

/**
 * List issues for a repository
 */
export async function listIssues(
  owner: string,
  repo: string,
  options: {
    state?: "open" | "closed" | "all";
    labels?: string;
    sort?: string;
    direction?: string;
    since?: string;
    page?: number;
    perPage?: number;
  } = {}
): Promise<GitHubApiResponse<GitHubIssue[]>> {
  const params = new URLSearchParams();
  params.set("state", options.state || "open");
  if (options.labels) params.set("labels", options.labels);
  if (options.sort) params.set("sort", options.sort);
  if (options.direction) params.set("direction", options.direction);
  if (options.since) params.set("since", options.since);
  params.set("page", String(options.page || 1));
  params.set("per_page", String(options.perPage || 30));

  return githubPaginatedRequest<GitHubIssue>(`/repos/${owner}/${repo}/issues?${params}`);
}

/**
 * Get a specific issue
 */
export async function getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
  return githubRequest<GitHubIssue>(`/repos/${owner}/${repo}/issues/${issueNumber}`);
}

// ========================================
// Contributors APIs
// ========================================

/**
 * List contributors for a repository
 */
export async function listContributors(
  owner: string,
  repo: string,
  options: { anon?: boolean; page?: number; perPage?: number } = {}
): Promise<GitHubApiResponse<GitHubContributor[]>> {
  const params = new URLSearchParams();
  if (options.anon) params.set("anon", "true");
  params.set("page", String(options.page || 1));
  params.set("per_page", String(options.perPage || 30));

  return githubPaginatedRequest<GitHubContributor>(`/repos/${owner}/${repo}/contributors?${params}`);
}

// ========================================
// Workflow/Actions APIs
// ========================================

/**
 * List workflow runs for a repository
 */
export async function listWorkflowRuns(
  owner: string,
  repo: string,
  options: { branch?: string; event?: string; status?: string; page?: number; perPage?: number } = {}
): Promise<GitHubApiResponse<GitHubWorkflowRun[]>> {
  const params = new URLSearchParams();
  if (options.branch) params.set("branch", options.branch);
  if (options.event) params.set("event", options.event);
  if (options.status) params.set("status", options.status);
  params.set("page", String(options.page || 1));
  params.set("per_page", String(options.perPage || 30));

  const response = await githubPaginatedRequest<GitHubWorkflowRun>(`/repos/${owner}/${repo}/actions/runs?${params}`);

  // GitHub wraps workflow runs
  const wrapper = response.data as unknown as { workflow_runs: GitHubWorkflowRun[]; total_count: number };
  return {
    ...response,
    data: wrapper.workflow_runs,
    pagination: {
      ...response.pagination,
      totalCount: wrapper.total_count,
    },
  };
}

// ========================================
// Content APIs
// ========================================

/**
 * Get contents of a file or directory
 */
export async function getContents(
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<GitHubContent | GitHubContent[]> {
  const params = ref ? `?ref=${ref}` : "";
  return githubRequest<GitHubContent | GitHubContent[]>(`/repos/${owner}/${repo}/contents/${path}${params}`);
}

/**
 * Get README content
 */
export async function getReadme(owner: string, repo: string): Promise<GitHubContent | null> {
  try {
    return await githubRequest<GitHubContent>(`/repos/${owner}/${repo}/readme`);
  } catch (error) {
    if (error instanceof GitHubError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

// ========================================
// Webhook APIs
// ========================================

interface CreateWebhookInput {
  url: string;
  secret: string;
  events: string[];
  active?: boolean;
}

interface GitHubWebhook {
  id: number;
  type: string;
  name: string;
  active: boolean;
  events: string[];
  config: { url: string; content_type: string; secret?: string; insecure_ssl: string };
  created_at: string;
  updated_at: string;
}

/**
 * Create a webhook for a repository
 */
export async function createWebhook(owner: string, repo: string, input: CreateWebhookInput): Promise<GitHubWebhook> {
  return githubRequest<GitHubWebhook>(`/repos/${owner}/${repo}/hooks`, {
    method: "POST",
    body: JSON.stringify({
      name: "web",
      active: input.active ?? true,
      events: input.events,
      config: {
        url: input.url,
        content_type: "json",
        secret: input.secret,
        insecure_ssl: "0",
      },
    }),
  });
}

/**
 * Delete a webhook
 */
export async function deleteWebhook(owner: string, repo: string, hookId: number): Promise<void> {
  await githubRequest(`/repos/${owner}/${repo}/hooks/${hookId}`, { method: "DELETE" });
}

/**
 * List webhooks for a repository
 */
export async function listWebhooks(owner: string, repo: string): Promise<GitHubWebhook[]> {
  return githubRequest<GitHubWebhook[]>(`/repos/${owner}/${repo}/hooks`);
}

// ========================================
// Webhook Signature Verification
// ========================================

/**
 * Verify GitHub webhook signature
 */
export async function verifyWebhookSignature(payload: string, signature: string): Promise<boolean> {
  const config = getConfig();
  if (!config.webhookSecret) {
    console.warn("[GitHub] No webhook secret configured, skipping signature verification");
    return true;
  }

  // Extract algorithm and hash from signature header
  // Format: sha256=<hex-hash>
  const match = signature.match(/^sha256=([a-f0-9]+)$/i);
  if (!match) {
    console.error("[GitHub] Invalid signature format");
    return false;
  }

  const receivedHash = match[1];

  // Compute expected hash
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(config.webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expectedHash = Buffer.from(signatureBuffer).toString("hex");

  // Constant-time comparison
  if (receivedHash.length !== expectedHash.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < receivedHash.length; i++) {
    result |= receivedHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Create a new release for a repository
 */
export async function createRelease(
  owner: string,
  repo: string,
  tagName: string,
  options?: {
    name?: string;
    body?: string;
    draft?: boolean;
    prerelease?: boolean;
    targetCommitish?: string;
    generateReleaseNotes?: boolean;
  }
): Promise<GitHubRelease> {
  return githubRequest<GitHubRelease>(`/repos/${owner}/${repo}/releases`, {
    method: "POST",
    body: JSON.stringify({
      tag_name: tagName,
      name: options?.name || tagName,
      body: options?.body || "",
      draft: options?.draft || false,
      prerelease: options?.prerelease || false,
      target_commitish: options?.targetCommitish,
      generate_release_notes: options?.generateReleaseNotes || false,
    }),
  });
}

/**
 * Generate release notes between two tags/commits
 */
export async function generateReleaseNotes(
  owner: string,
  repo: string,
  tagName: string,
  previousTagName?: string,
  targetCommitish?: string
): Promise<{ name: string; body: string }> {
  return githubRequest<{ name: string; body: string }>(`/repos/${owner}/${repo}/releases/generate-notes`, {
    method: "POST",
    body: JSON.stringify({
      tag_name: tagName,
      previous_tag_name: previousTagName,
      target_commitish: targetCommitish,
    }),
  });
}

/**
 * Create an issue in a repository
 */
export async function createIssue(
  owner: string,
  repo: string,
  title: string,
  body?: string,
  options?: {
    labels?: string[];
    assignees?: string[];
    milestone?: number;
  }
): Promise<GitHubIssue> {
  return githubRequest<GitHubIssue>(`/repos/${owner}/${repo}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title,
      body,
      labels: options?.labels,
      assignees: options?.assignees,
      milestone: options?.milestone,
    }),
  });
}

/**
 * Update an issue
 */
export async function updateIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  updates: {
    title?: string;
    body?: string;
    state?: "open" | "closed";
    labels?: string[];
    assignees?: string[];
  }
): Promise<GitHubIssue> {
  return githubRequest<GitHubIssue>(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

/**
 * Add a comment to an issue or pull request
 */
export async function addIssueComment(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<{ id: number; body: string; created_at: string }> {
  return githubRequest<{ id: number; body: string; created_at: string }>(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    }
  );
}

/**
 * Compare two commits/branches/tags
 */
export async function compareCommits(
  owner: string,
  repo: string,
  base: string,
  head: string
): Promise<{
  status: string;
  ahead_by: number;
  behind_by: number;
  total_commits: number;
  commits: GitHubCommit[];
}> {
  return githubRequest<{
    status: string;
    ahead_by: number;
    behind_by: number;
    total_commits: number;
    commits: GitHubCommit[];
  }>(`/repos/${owner}/${repo}/compare/${base}...${head}`);
}

/**
 * Parse a GitHub URL to extract owner and repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // Handle various GitHub URL formats:
  // https://github.com/owner/repo
  // https://github.com/owner/repo.git
  // git@github.com:owner/repo.git
  // owner/repo

  const patterns = [
    /^https?:\/\/github\.com\/([^\/]+)\/([^\/\?#]+?)(?:\.git)?(?:\/.*)?$/,
    /^git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/,
    /^([^\/]+)\/([^\/]+)$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  }

  return null;
}

/**
 * Check if GitHub integration is configured
 */
export function isGitHubConfigured(): boolean {
  return !!(process.env.GITHUB_APP_ID && process.env.GITHUB_PRIVATE_KEY_BASE64 && process.env.GITHUB_INSTALLATION_ID);
}
