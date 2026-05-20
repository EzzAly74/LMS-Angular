export type ApiStatus = 'success' | 'error' | 'fail';

export interface ApiResponse<T = unknown> {
  status: ApiStatus;
  message: string;
  result: T;
}

export interface PaginatedResponse<T = unknown> {
  status: ApiStatus;
  message: string;
  result: {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
  };
}

export interface ApiError {
  status: 'error' | 'fail';
  message: string;
  errors?: Record<string, string[]>;
}
