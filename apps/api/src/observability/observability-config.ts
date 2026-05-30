export const HEALTH_PATHS = new Set([
  '/live',
  '/ready',
  '/health',
  '/api/live',
  '/api/ready',
  '/api/health',
]);

/** High-traffic, non-business paths that should not appear in traces or logs. */
export const NOISE_PATHS = new Set(['/api-spec.json', '/docs']);

export function isHealthPath(path: string): boolean {
  return HEALTH_PATHS.has(path);
}

export function isNoisePath(path: string): boolean {
  return NOISE_PATHS.has(path) || path.startsWith('/docs/');
}

/** Returns true for any path that should be excluded from telemetry. */
export function isSilentPath(path: string): boolean {
  return isHealthPath(path) || isNoisePath(path);
}

export function isOtelLogsEnabled(): boolean {
  return (process.env.OTEL_LOGS_EXPORTER ?? 'none').toLowerCase() !== 'none';
}
