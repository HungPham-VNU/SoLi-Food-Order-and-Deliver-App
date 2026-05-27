/* eslint-disable react-refresh/only-export-components */
import { PostHogProvider } from '@posthog/react';
import posthog from 'posthog-js';
import type { Properties } from 'posthog-js';
import type { ReactNode } from 'react';
import type { Location } from 'react-router-dom';

const SENSITIVE_PROPERTY_PATTERN =
  /authorization|cookie|token|secret|password|pass|email|phone|address|card/i;

let initialized = false;

function appMetadata(): Properties {
  return {
    app_env:
      import.meta.env.VITE_APP_ENV ??
      import.meta.env.VITE_SENTRY_ENVIRONMENT ??
      import.meta.env.MODE,
    app_version: import.meta.env.VITE_APP_VERSION,
    commit_sha: import.meta.env.VITE_COMMIT_SHA,
    surface: 'web',
  };
}

function safeProperties(properties: Properties = {}): Properties {
  return Object.fromEntries(
    Object.entries(properties).filter(
      ([key, value]) =>
        value !== undefined && !SENSITIVE_PROPERTY_PATTERN.test(key),
    ),
  );
}

export function initAnalytics(onLoaded?: () => void): void {
  if (initialized) return;

  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  if (!apiKey) return;

  initialized = true;

  posthog.init(apiKey, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://app.posthog.com',
    capture_pageview: false,
    disable_session_recording: true,
    autocapture: false,
    loaded: (client) => {
      client.register(appMetadata());
      onLoaded?.();
    },
  });
}

export function isAnalyticsEnabled(): boolean {
  return initialized;
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  if (!initialized) return <>{children}</>;

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}

export function trackEvent(name: string, properties?: Properties): void {
  if (!initialized) return;
  posthog.capture(name, {
    ...appMetadata(),
    ...safeProperties(properties),
  });
}

export function trackPageView(location: Location): void {
  if (!initialized) return;

  trackEvent('$pageview', {
    path: `${location.pathname}${location.search}`,
    pathname: location.pathname,
    title: document.title,
    url: window.location.href,
  });
}

export function identifyUser(userId: string | undefined): void {
  if (!initialized || !userId) return;
  posthog.identify(userId);
}

export function resetAnalyticsIdentity(): void {
  if (!initialized) return;
  posthog.reset();
}
