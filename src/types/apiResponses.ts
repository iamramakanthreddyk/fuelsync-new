export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string | { message?: string; details?: any };
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default ApiResponse;
