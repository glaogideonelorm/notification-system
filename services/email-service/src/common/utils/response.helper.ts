import { ApiResponse, PaginationMeta } from '../../types';

export class ResponseHelper {
  static success<T>(
    data: T,
    message = 'Operation successful',
    meta?: Partial<PaginationMeta>,
  ): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      meta: {
        total: meta?.total || 0,
        limit: meta?.limit || 10,
        page: meta?.page || 1,
        total_pages: meta?.total_pages || 0,
        has_next: meta?.has_next || false,
        has_previous: meta?.has_previous || false,
      },
    };
  }

  static error(error: string, message = 'Operation failed'): ApiResponse<null> {
    return {
      success: false,
      error,
      message,
      meta: {
        total: 0,
        limit: 10,
        page: 1,
        total_pages: 0,
        has_next: false,
        has_previous: false,
      },
    };
  }
}
