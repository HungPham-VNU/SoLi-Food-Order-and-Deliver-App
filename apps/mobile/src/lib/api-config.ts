import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_API_PORT = '3000';

function isLoopbackHost(host: string): boolean {
  const normalizedHost = host.replace(/^\[|\]$/g, '').toLowerCase();

  return (
    normalizedHost === 'localhost' ||
    normalizedHost === '127.0.0.1' ||
    normalizedHost === '0.0.0.0' ||
    normalizedHost === '::1'
  );
}

function getExpoDevServerHost(): string | undefined {
  const hostUri = Constants.expoConfig?.hostUri;

  if (!hostUri) {
    return undefined;
  }

  return hostUri.split(':')[0];
}

function getNativeDevHost(): string | undefined {
  const expoHost = getExpoDevServerHost();

  if (expoHost && !isLoopbackHost(expoHost)) {
    return expoHost;
  }

  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }

  return expoHost;
}

function normalizeApiUrl(apiUrl: string): string {
  const trimmedUrl = apiUrl.trim().replace(/\/+$/, '');

  try {
    const url = new URL(trimmedUrl);
    const nativeDevHost = getNativeDevHost();

    if (Platform.OS !== 'web' && nativeDevHost && isLoopbackHost(url.hostname)) {
      url.hostname = nativeDevHost;
    }

    return url.toString().replace(/\/+$/, '');
  } catch {
    return trimmedUrl;
  }
}

export function getApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL;

  if (configuredUrl?.trim()) {
    return normalizeApiUrl(configuredUrl);
  }

  const devHost = Platform.OS === 'web' ? 'localhost' : getNativeDevHost();
  return `http://${devHost ?? 'localhost'}:${DEFAULT_API_PORT}`;
}

export const BASE_URL = getApiBaseUrl();
