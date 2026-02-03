// ========================================
// AtlasHub API Response Types
// ========================================

export interface AtlasHubResponse<T> {
  data: T;
  meta?: {
    rowCount?: number;
  };
}

export interface AtlasHubError {
  error: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

// ========================================
// Filter Operators for AtlasHub queries
// ========================================

export type FilterOperator = "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "like" | "ilike" | "in";

export interface QueryFilter {
  operator: FilterOperator;
  column: string;
  value: string | number | boolean | (string | number)[];
}

export interface QueryOptions {
  select?: string[];
  order?: {
    column: string;
    direction: "asc" | "desc";
  };
  limit?: number;
  offset?: number;
  filters?: QueryFilter[];
}

// ========================================
// Storage Types
// ========================================

export interface SignedUploadResponse {
  objectKey: string;
  uploadUrl: string;
  expiresIn: number;
}

export interface SignedDownloadResponse {
  downloadUrl: string;
  expiresIn: number;
}

export interface StorageObject {
  key: string;
  size: number;
  lastModified: string;
}
