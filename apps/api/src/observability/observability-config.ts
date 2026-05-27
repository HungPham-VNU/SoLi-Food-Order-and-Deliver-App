export const HEALTH_PATHS = new Set(['/api/live', '/api/ready', '/api/health']);

export function isHealthPath(path: string): boolean {
  return HEALTH_PATHS.has(path);
}

export function isOtelLogsEnabled(): boolean {
  return (process.env.OTEL_LOGS_EXPORTER ?? 'none').toLowerCase() !== 'none';
}
