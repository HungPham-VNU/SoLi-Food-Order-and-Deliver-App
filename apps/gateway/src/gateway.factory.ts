import type { RequestHandler } from 'http-proxy-middleware';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';
import { createApiProxy } from './proxy/api-proxy.factory';
import { requestContext } from './common/request-context.middleware';
import { json } from 'express';
import type { MediaRouteOverrides } from './media/media.interfaces';
import {
  isIdentityPublicRoute,
  isMediaPublicRoute,
  isNotificationPublicRoute,
  isCatalogPublicRoute,
} from './proxy/api-proxy.factory';
import { createMediaCors } from './media/media-cors.middleware';
import { createCatalogCors } from './catalog/catalog-cors.middleware';
import type { CatalogRouteOverrides } from './catalog/catalog.interfaces';
import type { IdentityRouteOverrides } from './identity/identity.interfaces';
import { IdentityHttpProxyService } from './identity/identity-http-proxy.service';
import type { NotificationRouteOverrides } from './notification/notification.interfaces';
import { createNotificationCors } from './notification/notification-cors.middleware';

/**
 * Builds the fully-wired gateway application WITHOUT listening.
 *
 * Shared by main.ts (which adds listen + WebSocket upgrade) and the E2E suite
 * (which drives it via supertest). Keeping the wiring here guarantees the test
 * exercises the exact same middleware chain as production.
 *
 * `bodyParser: false` is the load-bearing setting: the gateway never consumes
 * the request body so the proxy streams it upstream untouched.
 */
export interface GatewayOverrides
  extends MediaRouteOverrides,
    IdentityRouteOverrides,
    NotificationRouteOverrides,
    CatalogRouteOverrides {
  /** Override the upstream target (used by tests to point at a stub). */
  target?: string;
  /** Override the proxy timeout in ms. */
  proxyTimeoutMs?: number;
  /** Override the Media route cutover flag. */
  mediaRoutesEnabled?: boolean;
  /** Override the Identity route cutover flag. */
  identityRoutesEnabled?: boolean;
  /** Override the Notification route cutover flag. */
  notificationRoutesEnabled?: boolean;
  /** Override the Catalog route cutover flag. */
  catalogRoutesEnabled?: boolean;
}

export async function createGatewayApp(
  overrides: GatewayOverrides = {},
): Promise<{
  app: INestApplication;
  proxy: RequestHandler;
}> {
  const app = await NestFactory.create(AppModule.register(overrides), {
    bodyParser: false,
  });
  app.enableShutdownHooks();

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  // Non-null: these keys are zod-validated with defaults, so they are always set.
  const target =
    overrides.target ?? config.get('MONOLITH_UPSTREAM_URL', { infer: true })!;
  if (overrides.target) {
    // Keep local route dependencies (for example session introspection) on the
    // same overridden upstream used by the proxy in component tests.
    config.set('MONOLITH_UPSTREAM_URL', overrides.target);
  }
  const proxyTimeoutMs =
    overrides.proxyTimeoutMs ??
    config.get('GATEWAY_PROXY_TIMEOUT_MS', { infer: true })!;
  const mediaRoutesEnabled =
    overrides.mediaRoutesEnabled ??
    config.get('MEDIA_ROUTES_ENABLED', { infer: true }) ??
    false;
  const identityRoutesEnabled =
    overrides.identityRoutesEnabled ??
    config.get('IDENTITY_ROUTES_ENABLED', { infer: true }) ??
    false;
  const notificationRoutesEnabled =
    overrides.notificationRoutesEnabled ??
    config.get('NOTIFICATION_ROUTES_ENABLED', { infer: true }) ??
    false;
  const catalogRoutesEnabled =
    overrides.catalogRoutesEnabled ??
    config.get('CATALOG_ROUTES_ENABLED', { infer: true }) ??
    false;

  // 1. Strip internal/trust headers + ensure x-request-id (before proxying).
  app.use(requestContext);

  if (identityRoutesEnabled) {
    const identityProxy = app.get(IdentityHttpProxyService);
    app.use((req, res, next) =>
      isIdentityPublicRoute(req.path)
        ? void identityProxy.handle(req, res, next)
        : next(),
    );
  }

  if (mediaRoutesEnabled) {
    const allowedOrigins = new Set(
      config
        .get('GATEWAY_CORS_ORIGINS', { infer: true })
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    );
    app.use(createMediaCors(allowedOrigins));
    const jsonParser = json({ limit: '1mb' });
    app.use((req, res, next) =>
      isMediaPublicRoute(req.path) ? jsonParser(req, res, next) : next(),
    );
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
  }

  if (notificationRoutesEnabled) {
    const allowedOrigins = new Set(
      config
        .get('GATEWAY_CORS_ORIGINS', { infer: true })
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    );
    app.use(createNotificationCors(allowedOrigins));
    const jsonParser = json({ limit: '1mb' });
    app.use((req, res, next) =>
      isNotificationPublicRoute(req.path) ? jsonParser(req, res, next) : next(),
    );
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
  }

  if (catalogRoutesEnabled) {
    const allowedOrigins = new Set(
      config
        .get('GATEWAY_CORS_ORIGINS', { infer: true })
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    );
    app.use(createCatalogCors(allowedOrigins));
    const jsonParser = json({ limit: '1mb' });
    app.use((req, res, next) =>
      isCatalogPublicRoute(req.path) ? jsonParser(req, res, next) : next(),
    );
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
  }

  // 2. Proxy everything except the gateway's own management paths.
  const proxy = createApiProxy({
    target,
    proxyTimeoutMs,
    mediaRoutesEnabled,
    identityRoutesEnabled,
    notificationRoutesEnabled,
    notificationSocketTarget: `http://${config.get('NOTIFICATION_TCP_HOST', { infer: true })}:${config.get('NOTIFICATION_MANAGEMENT_PORT', { infer: true })}`,
    catalogRoutesEnabled,
  });
  app.use(proxy);

  return { app, proxy };
}
