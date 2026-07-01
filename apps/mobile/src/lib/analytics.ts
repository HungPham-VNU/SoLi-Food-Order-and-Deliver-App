import { Sentry } from '@/src/lib/observability';

export function trackMobileEvent(
  eventName: string,
  properties?: Record<string, string | number | boolean | undefined>,
): void {
  if (__DEV__) {
    console.log('[analytics]', eventName, properties);
  }

  Sentry.addBreadcrumb({
    category: 'app.event',
    message: eventName,
    level: 'info',
    data: properties,
  });
}
