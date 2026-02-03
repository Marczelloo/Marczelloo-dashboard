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

async function atlasRequest<T>(path: string, options: RequestInit = {}, revalidate?: number): Promise<T> {
  const config = getConfig();

  const url = `${config.apiUrl}${path}`;

  // Only set Content-Type for requests with body
  const headers: HeadersInit = {
    "x-api-key": config.secretKey,
    ...options.headers,
  };

  // Add Content-Type only if there's a body (POST/PUT/PATCH)
  if (options.body) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers,
    next: revalidate !== undefined ? { revalidate } : undefined,
  });

  if (!response.ok) {
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
      method: options.method || "GET",
    });

    throw new AtlasHubError(
      errorBody.error || "UNKNOWN_ERROR",
      errorBody.message || response.statusText,
      response.status
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
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
  return atlasRequest<AtlasHubResponse<T[]>>(`/v1/db/${table}${queryString}`, { method: "GET" }, revalidate);
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
