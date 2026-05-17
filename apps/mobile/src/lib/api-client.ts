import Constants from 'expo-constants';

import { authClient } from '@/src/lib/auth-client';

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(':')[0] || 'localhost';
  return `http://${localhost}:3000`.replace(/\/+$/, '');
};

export const BASE_URL = getBaseUrl();

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith('/')
    ? endpoint
    : `/${endpoint}`;
  const url = `${BASE_URL}${normalizedEndpoint}`;

  const method = (options.method || 'GET').toUpperCase();
  const hasBody = !!options.body;
  const isStringBody = typeof options.body === 'string';
  const isFormOrBlob =
    options.body instanceof FormData || options.body instanceof Blob;
  const skipJsonHeader = ['GET', 'HEAD'].includes(method) || isFormOrBlob;

  const headers = { ...options.headers } as Record<string, string>;

  // Better Auth stores the session cookie in SecureStore on native.
  // Requests to the API need that cookie forwarded explicitly.
  try {
    const cookies = authClient.getCookie();

    if (cookies) {
      headers['Cookie'] = cookies;
    }
  } catch (error) {
    console.error('Failed to retrieve auth token:', error);
  }

  if (hasBody && isStringBody && !skipJsonHeader && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: 'omit',
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!response.ok) {
    let errorMessage = `API error: ${response.status}`;
    let bodyText = '';

    try {
      bodyText = await response.text();
      if (isJson && bodyText) {
        const errorData = JSON.parse(bodyText);
        errorMessage = errorData.message || errorMessage;
      }
    } catch {
      errorMessage = `${errorMessage} (Failed to parse error body)`;
    }

    throw new Error(
      `${errorMessage}\nStatus: ${response.status}\nBody: ${bodyText}`,
    );
  }

  if (isJson) {
    return response.json();
  }

  const textBody = await response.text();
  return textBody as any;
}
