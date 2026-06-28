import axios, { type AxiosError } from 'axios';
import {
  addApiErrorBreadcrumb,
  captureApiError,
  createRequestId,
} from './observability';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  config.headers.set('x-request-id', createRequestId());
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; code?: string }>) => {
    addApiErrorBreadcrumb(error);
    captureApiError(error);

    const status = error.response?.status ?? 0;

    if (status === 401) {
      window.location.href = '/auth/login';
    }

    const message =
      error.response?.data?.message ?? error.message ?? 'Unknown error';
    const code = error.response?.data?.code ?? String(status);

    return Promise.reject(new ApiError(status, code, message));
  },
);
