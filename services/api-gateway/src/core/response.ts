export interface PaginationMeta {
  total: number;
  limit: number;
  page: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message: string;
  meta?: PaginationMeta | null;
}

export function ok<T>(data: T, message = "OK"): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    meta: null,
  };
}

export function fail(message: string, error?: string): ApiResponse<never> {
  return {
    success: false,
    message,
    error,
    meta: null,
  };
}
