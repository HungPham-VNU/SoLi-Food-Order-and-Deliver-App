import { trace, type Span } from '@opentelemetry/api';

export type ApiRouteGroup =
  | 'menu-items'
  | 'restaurants'
  | 'search'
  | 'promotions'
  | 'carts'
  | 'my'
  | 'restaurant'
  | 'payments'
  | 'other';

export interface RouteTelemetry {
  routeGroup: ApiRouteGroup;
  routeTemplate: string;
  routeScope?: 'my';
  monitoredRoute: boolean;
}

interface RouteGroupMatcher {
  readonly routeGroup: Exclude<ApiRouteGroup, 'other'>;
  readonly prefixes: readonly string[];
}

const ROUTE_GROUPS: readonly RouteGroupMatcher[] = [
  { routeGroup: 'menu-items', prefixes: ['/api/menu-items'] },
  { routeGroup: 'restaurants', prefixes: ['/api/restaurants'] },
  { routeGroup: 'search', prefixes: ['/api/search'] },
  { routeGroup: 'promotions', prefixes: ['/api/promotions'] },
  { routeGroup: 'carts', prefixes: ['/api/carts'] },
  { routeGroup: 'my', prefixes: ['/api/my'] },
  {
    routeGroup: 'restaurant',
    prefixes: ['/api/restaurant'],
  },
  { routeGroup: 'payments', prefixes: ['/api/payments'] },
] as const;

const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INTEGER_SEGMENT = /^\d+$/;

function normalizePath(path: string | undefined | null): string {
  const rawPath = (path ?? '').split('?')[0]?.trim() || '/';
  const pathWithLeadingSlash = rawPath.startsWith('/')
    ? rawPath
    : `/${rawPath}`;
  return pathWithLeadingSlash.length > 1
    ? pathWithLeadingSlash.replace(/\/+$/, '')
    : pathWithLeadingSlash;
}

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function routeGroupForPath(path: string): {
  routeGroup: ApiRouteGroup;
  monitoredRoute: boolean;
} {
  const match = ROUTE_GROUPS.find((group) =>
    group.prefixes.some((prefix) => matchesPrefix(path, prefix)),
  );

  return match
    ? { routeGroup: match.routeGroup, monitoredRoute: true }
    : { routeGroup: 'other', monitoredRoute: false };
}

function segmentTemplate(segment: string): string {
  if (UUID_SEGMENT.test(segment) || INTEGER_SEGMENT.test(segment)) {
    return ':id';
  }

  return segment;
}

function routeTemplateForPath(path: string): string {
  return `/${path.split('/').filter(Boolean).map(segmentTemplate).join('/')}`;
}

function routeScopeForPath(path: string): 'my' | undefined {
  return path.split('/').includes('my') ? 'my' : undefined;
}

export function describeRouteTelemetry(
  path: string | undefined | null,
): RouteTelemetry {
  const normalizedPath = normalizePath(path);
  const { routeGroup, monitoredRoute } = routeGroupForPath(normalizedPath);

  return {
    routeGroup,
    routeTemplate: routeTemplateForPath(normalizedPath),
    routeScope: routeScopeForPath(normalizedPath),
    monitoredRoute,
  };
}

export function setRouteTelemetrySpanAttributes(
  telemetry: RouteTelemetry,
  extras: Record<string, string | number | boolean | undefined> = {},
  span: Span | undefined = trace.getActiveSpan(),
): void {
  if (!span) return;

  const attributes: Record<string, string | number | boolean> = {
    'http.route': telemetry.routeTemplate,
    'app.route.group': telemetry.routeGroup,
    'app.route.monitored': telemetry.monitoredRoute,
  };

  if (telemetry.routeScope) {
    attributes['app.route.scope'] = telemetry.routeScope;
  }

  for (const [key, value] of Object.entries(extras)) {
    if (value !== undefined) attributes[key] = value;
  }

  span.setAttributes(attributes);
}
