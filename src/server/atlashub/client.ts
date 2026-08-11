/**
 * AtlasHub Client - Server-only REST API wrapper
 *
 * All database operations go through this module.
 * NEVER import this in client components.
 */

import "server-only";
import type { AtlasHubResponse, QueryOptions, QueryFilter } from "@/types";

// ========================================
// Configuration
// ========================================

function getConfig() {
  const apiUrl = process.env.ATLASHUB_API_URL;
  const secretKey = process.env.ATLASHUB_SECRET_KEY;

  if (!apiUrl) {
    throw new Error("ATLASHUB_API_URL environment variable is not set");
  }
  if (!secretKey) {
    throw new Error("ATLASHUB_SECRET_KEY environment variable is not set");
  }

  return { apiUrl, secretKey };
}

// ========================================
// Query Builder Helpers
// ========================================

function buildQueryString(options?: QueryOptions): string {
  if (!options) return "";

  const params = new URLSearchParams();

  if (options.select?.length) {
    params.set("select", options.select.join(","));
  }

  if (options.order) {
    params.set("order", `${options.order.column}.${options.order.direction}`);
  }

  if (options.limit) {
    params.set("limit", String(options.limit));
  }

  if (options.offset) {
    params.set("offset", String(options.offset));
  }

  if (options.filters?.length) {
    for (const filter of options.filters) {
      const value = Array.isArray(filter.value) ? filter.value.join(",") : String(filter.value);
      params.set(`${filter.operator}.${filter.column}`, value);
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

function buildFilterQueryString(filters: QueryFilter[]): string {
  if (!filters.length) return "";

  const params = new URLSearchParams();
  for (const filter of filters) {
    const value = Array.isArray(filter.value) ? filter.value.join(",") : String(filter.value);
    params.set(`${filter.operator}.${filter.column}`, value);
  }

  return `?${params.toString()}`;
}

// ========================================
// HTTP Client
// ========================================

const GET_CACHE_TTL_MS = 3000;
const MAX_RETRIES = 2;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

type CachedGetRequest = {
  expiresAt: number;
  promise: Promise<unknown>;
};

// The dashboard renders multiple server components at once. Keep one
// in-flight GET per URL so parallel components do not multiply API traffic.
const getRequestCache = new Map<string, CachedGetRequest>();

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) {
      return Math.min(Math.max(seconds * 1000, 250), 3000);
    }

    const retryAt = Date.parse(retryAfter);
    if (!Number.isNaN(retryAt)) {
      return Math.min(Math.max(retryAt - Date.now(), 250), 3000);
    }
  }

  return Math.min(250 * 2 ** attempt, 3000);
}

async function requestWithRetry<T>(
  url: string,
  options: RequestInit,
  secretKey: string,
  revalidate?: number
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const canRetry = method === "GET" || method === "HEAD" || method === "OPTIONS";
  const headers: HeadersInit = {
    "x-api-key": secretKey,
    ...options.headers,
  };

  if (options.body) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response: Response;

    try {
      response = await fetch(url, {
        ...options,
        headers,
        next: revalidate !== undefined ? { revalidate } : undefined,
      });
    } catch (error) {
      if (!canRetry || attempt === MAX_RETRIES || options.signal?.aborted) {
        throw error;
      }

      console.warn(`[AtlasHub Retry] Network error, retrying request (${attempt + 1}/${MAX_RETRIES})`, {
        url,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      await wait(250 * 2 ** attempt);
      continue;
    }

    if (response.ok) {
      if (response.status === 204) {
        return {} as T;
      }

      return response.json();
    }

    if (canRetry && RETRYABLE_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES) {
      const delayMs = getRetryDelay(response, attempt);
      console.warn(`[AtlasHub Retry] HTTP ${response.status}, retrying request (${attempt + 1}/${MAX_RETRIES})`, {
        url,
        delayMs,
      });
      await wait(delayMs);
      continue;
    }

    let errorBody: { error?: string; message?: string; details?: unknown } = {
      error: "UNKNOWN_ERROR",
      message: `HTTP ${response.status}: ${response.statusText}`,
    };

    try {
      errorBody = await response.json();
    } catch {
      // Use default errorBody
    }

    console.error("[AtlasHub Error]", {
      url,
      status: response.status,
      error: errorBody,
      method,
    });

    throw new AtlasHubError(
      errorBody.error || "UNKNOWN_ERROR",
      errorBody.message || response.statusText,
      response.status
    );
  }

  throw new Error("AtlasHub request failed after retries");
}

async function atlasRequest<T>(path: string, options: RequestInit = {}, revalidate?: number): Promise<T> {
  const config = getConfig();
  const url = `${config.apiUrl}${path}`;
  const method = (options.method || "GET").toUpperCase();
  const cacheKey = method === "GET" ? `${method}:${url}:${revalidate ?? "dynamic"}` : null;

  if (cacheKey) {
    const cached = getRequestCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.promise as Promise<T>;
    }
    if (cached) getRequestCache.delete(cacheKey);
  } else {
    // Do not serve stale reads after a mutation.
    getRequestCache.clear();
  }

  const request = requestWithRetry<T>(url, options, config.secretKey, revalidate);

  if (cacheKey) {
    getRequestCache.set(cacheKey, {
      expiresAt: Date.now() + GET_CACHE_TTL_MS,
      promise: request,
    });

    request.catch(() => {
      const cached = getRequestCache.get(cacheKey);
      if (cached?.promise === request) getRequestCache.delete(cacheKey);
    });
  }

  return request;
}

// ========================================
// Error Class
// ========================================

export class AtlasHubError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AtlasHubError";
  }
}

// Re-export QueryFilter for type usage in repositories
export type { QueryFilter } from "@/types";

// ========================================
// Database Operations
// ========================================

/**
 * Select rows from a table with optional filtering, ordering, and pagination
 */
export async function select<T>(
  table: string,
  options?: QueryOptions,
  revalidate?: number
): Promise<AtlasHubResponse<T[]>> {
  const queryString = buildQueryString(options);
  const url = `/v1/db/${table}${queryString}`;
  console.log("[select] URL:", url);
  return atlasRequest<AtlasHubResponse<T[]>>(url, { method: "GET" }, revalidate);
}

/**
 * Select a single row by ID
 */
export async function selectById<T>(
  table: string,
  id: string,
  selectColumns?: string[],
  revalidate?: number
): Promise<T | null> {
  const options: QueryOptions = {
    select: selectColumns,
    filters: [{ operator: "eq", column: "id", value: id }],
    limit: 1,
  };

  const response = await select<T>(table, options, revalidate);
  return response.data[0] || null;
}

/**
 * Insert one or more rows into a table
 */
export async function insert<T>(
  table: string,
  rows: Partial<T> | Partial<T>[],
  returning = true
): Promise<AtlasHubResponse<T[]>> {
  const rowsArray = Array.isArray(rows) ? rows : [rows];

  return atlasRequest<AtlasHubResponse<T[]>>(`/v1/db/${table}`, {
    method: "POST",
    body: JSON.stringify({ rows: rowsArray, returning }),
  });
}

/**
 * Update rows matching filters
 */
export async function update<T>(
  table: string,
  values: Partial<T>,
  filters: QueryFilter[],
  returning = true
): Promise<AtlasHubResponse<T[]>> {
  if (!filters.length) {
    throw new Error("At least one filter is required for update operations");
  }

  const queryString = buildFilterQueryString(filters);

  return atlasRequest<AtlasHubResponse<T[]>>(`/v1/db/${table}${queryString}`, {
    method: "PATCH",
    body: JSON.stringify({ values, returning }),
  });
}

/**
 * Update a single row by ID
 */
export async function updateById<T>(
  table: string,
  id: string,
  values: Partial<T>,
  returning = true
): Promise<T | null> {
  const response = await update<T>(table, values, [{ operator: "eq", column: "id", value: id }], returning);
  return response.data[0] || null;
}

/**
 * Delete rows matching filters
 */
export async function deleteRows(table: string, filters: QueryFilter[]): Promise<{ deletedCount: number }> {
  if (!filters.length) {
    throw new Error("At least one filter is required for delete operations");
  }

  const queryString = buildFilterQueryString(filters);

  const response = await atlasRequest<{ data: { deletedCount: number } }>(`/v1/db/${table}${queryString}`, {
    method: "DELETE",
  });

  return response.data;
}

/**
 * Delete a single row by ID
 */
export async function deleteById(table: string, id: string): Promise<{ deletedCount: number }> {
  return deleteRows(table, [{ operator: "eq", column: "id", value: id }]);
}

// ========================================
// Table Discovery
// ========================================

export interface TableInfo {
  tableName: string;
  columns: {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue: string | null;
  }[];
}

export async function getTables(): Promise<TableInfo[]> {
  const response = await atlasRequest<{ data: TableInfo[] }>("/v1/db/tables", {
    method: "GET",
  });
  return response.data;
}
