import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import type { ErrorResponse, Page, PaginatedResponse, SuccessResponse } from '@/types/api';

/**
 * The single HTTP client for the app.
 *
 * Everything goes through here so that base URL, credentials, timeouts and error
 * normalisation are defined once. Components never import axios directly; they use
 * the resource modules in this folder via the hooks in `src/hooks`.
 */

/** Vite inlines only `VITE_*` variables, so no server secret can reach this bundle. */
const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

export const http: AxiosInstance = axios.create({
  baseURL,
  timeout: 15_000,
  // Required for the refresh-token cookie once auth lands in Phase 5.
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

/**
 * Normalised error surface.
 *
 * Components should never have to know whether a failure was an HTTP status, a network
 * outage or a timeout: they branch on `isNetworkError` and show `message`.
 */
export class ApiError extends Error {
  readonly status: number | null;
  readonly errorCode: string;
  readonly details?: unknown;
  readonly isNetworkError: boolean;

  constructor(init: {
    message: string;
    status: number | null;
    errorCode: string;
    details?: unknown;
    isNetworkError?: boolean;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.errorCode = init.errorCode;
    this.details = init.details;
    this.isNetworkError = init.isNetworkError ?? false;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** Retrying these may succeed; 4xx generally will not. */
  get isRetryable(): boolean {
    return this.isNetworkError || this.status === null || this.status >= 500 || this.status === 429;
  }
}

const isErrorResponse = (value: unknown): value is ErrorResponse =>
  typeof value === 'object' &&
  value !== null &&
  'success' in value &&
  (value).success === false;

const toApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<unknown>;

    // No response at all: server down, DNS failure, CORS block or timeout.
    if (!axiosError.response) {
      const timedOut = axiosError.code === 'ECONNABORTED';
      return new ApiError({
        message: timedOut
          ? 'The request took too long. Please try again.'
          : 'Cannot reach the NewsFlow API. Check that the server is running on port 4000.',
        status: null,
        errorCode: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
        isNetworkError: true,
      });
    }

    const { status, data } = axiosError.response;
    if (isErrorResponse(data)) {
      return new ApiError({
        message: data.message,
        status,
        errorCode: data.errorCode,
        details: data.details,
      });
    }

    return new ApiError({
      message: `Request failed with status ${status}`,
      status,
      errorCode: 'UNEXPECTED_RESPONSE',
    });
  }

  return new ApiError({
    message: error instanceof Error ? error.message : 'Something went wrong',
    status: null,
    errorCode: 'UNKNOWN',
  });
};

// Convert every rejection into an ApiError at the boundary, so no other layer has to
// know about axios internals.
http.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiError(error)),
);

/** GET returning the unwrapped `data` field of a success envelope. */
export const getData = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  const response: AxiosResponse<SuccessResponse<T>> = await http.get(url, config);
  return response.data.data;
};

/** GET returning both items and pagination metadata. */
export const getPage = async <T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<Page<T>> => {
  const response: AxiosResponse<PaginatedResponse<T>> = await http.get(url, config);
  return { items: response.data.data, pagination: response.data.pagination };
};

/**
 * Drops `undefined`, `null` and empty-string values.
 *
 * Without this, axios serialises `?category=&page=1`, and the server's strict Zod
 * validators reject the empty string rather than treating it as absent.
 */
export const cleanParams = <T extends Record<string, unknown>>(params: T): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
