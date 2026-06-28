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
  isPromotionPublicRoute,
  isPaymentPublicRoute,
  isReviewPublicRoute,
  isOrderingPublicRoute,
  isReportingPublicRoute,
} from './proxy/api-proxy.factory';
import { createMediaCors } from './media/media-cors.middleware';
import { createCatalogCors } from './catalog/catalog-cors.middleware';
import type { CatalogRouteOverrides } from './catalog/catalog.interfaces';
import { createPromotionCors } from './promotion/promotion-cors.middleware';
import type { PromotionRouteOverrides } from './promotion/promotion.interfaces';
import type { IdentityRouteOverrides } from './identity/identity.interfaces';
import { IdentityHttpProxyService } from './identity/identity-http-proxy.service';
import type { NotificationRouteOverrides } from './notification/notification.interfaces';
import { createNotificationCors } from './notification/notification-cors.middleware';
import type { PaymentRouteOverrides } from './payment/payment.interfaces';
import { createReviewCors } from './review/review-cors.middleware';
import type { ReviewRouteOverrides } from './review/review.interfaces';
import { createOrderingCors } from './ordering/ordering-cors.middleware';
import type { OrderingRouteOverrides } from './ordering/ordering.interfaces';
import { createReportingCors } from './reporting/reporting-cors.middleware';
import type { ReportingRouteOverrides } from './reporting/reporting.interfaces';

/**
 * Builds the fully-wired gateway application WITHOUT listening.
 *
 * Shared by main.ts (which adds listen + WebSocket upgrade) and the E2E suite
 * (which drives it via supertest). Keeping the wiring here guarantees the test
 * exercises the exact same middleware chain as production.
 *
 * `bodyParser: false` lets Identity auth requests and Socket.IO traffic keep
 * their raw request streams where needed.
 */
export interface GatewayOverrides
  extends
    MediaRouteOverrides,
    IdentityRouteOverrides,
    NotificationRouteOverrides,
    CatalogRouteOverrides,
    PromotionRouteOverrides,
    PaymentRouteOverrides,
    ReviewRouteOverrides,
    OrderingRouteOverrides,
    ReportingRouteOverrides {
  /** Override the Socket.IO proxy timeout in ms. */
  proxyTimeoutMs?: number;
  /** Override the Media route cutover flag. */
  mediaRoutesEnabled?: boolean;
  /** Override the Identity route cutover flag. */
  identityRoutesEnabled?: boolean;
  /** Override the Notification route cutover flag. */
  notificationRoutesEnabled?: boolean;
  /** Override the Catalog route cutover flag. */
  catalogRoutesEnabled?: boolean;
  /** Override the Promotion route cutover flag. */
  promotionRoutesEnabled?: boolean;
  /** Override the Payment route cutover flag. */
  paymentRoutesEnabled?: boolean;
  /** Override the Review route cutover flag. */
  reviewRoutesEnabled?: boolean;
  /** Override the Ordering route cutover flag. */
  orderingRoutesEnabled?: boolean;
  /** Override the Reporting route cutover flag. */
  reportingRoutesEnabled?: boolean;
}

function getAllowedOrigins(config: ConfigService<Env, true>): ReadonlySet<string> {
  const corsOrigins = config.get('GATEWAY_CORS_ORIGINS', {
    infer: true,
  }) as string;

  return new Set<string>(
    corsOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
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
  const promotionRoutesEnabled =
    overrides.promotionRoutesEnabled ??
    config.get('PROMOTION_ROUTES_ENABLED', { infer: true }) ??
    false;
  const paymentRoutesEnabled =
    overrides.paymentRoutesEnabled ??
    config.get('PAYMENT_ROUTES_ENABLED', { infer: true }) ??
    false;
  const reviewRoutesEnabled =
    overrides.reviewRoutesEnabled ??
    config.get('REVIEW_ROUTES_ENABLED', { infer: true }) ??
    false;
  const orderingRoutesEnabled =
    overrides.orderingRoutesEnabled ??
    config.get('ORDERING_ROUTES_ENABLED', { infer: true }) ??
    false;
  const reportingRoutesEnabled =
    overrides.reportingRoutesEnabled ??
    config.get('REPORTING_ROUTES_ENABLED', { infer: true }) ??
    false;

  config.set('MEDIA_ROUTES_ENABLED', mediaRoutesEnabled);
  config.set('IDENTITY_ROUTES_ENABLED', identityRoutesEnabled);
  config.set('NOTIFICATION_ROUTES_ENABLED', notificationRoutesEnabled);
  config.set('CATALOG_ROUTES_ENABLED', catalogRoutesEnabled);
  config.set('PROMOTION_ROUTES_ENABLED', promotionRoutesEnabled);
  config.set('PAYMENT_ROUTES_ENABLED', paymentRoutesEnabled);
  config.set('REVIEW_ROUTES_ENABLED', reviewRoutesEnabled);
  config.set('ORDERING_ROUTES_ENABLED', orderingRoutesEnabled);
  config.set('REPORTING_ROUTES_ENABLED', reportingRoutesEnabled);

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
    const allowedOrigins = getAllowedOrigins(config);
    app.use(createMediaCors(allowedOrigins));
    const jsonParser = json({ limit: '1mb' });
    app.use((req, res, next) =>
      isMediaPublicRoute(req.path) ? jsonParser(req, res, next) : next(),
    );
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
  }

  if (notificationRoutesEnabled) {
    const allowedOrigins = getAllowedOrigins(config);
    app.use(createNotificationCors(allowedOrigins));
    const jsonParser = json({ limit: '1mb' });
    app.use((req, res, next) =>
      isNotificationPublicRoute(req.path) ? jsonParser(req, res, next) : next(),
    );
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
  }

  if (catalogRoutesEnabled) {
    const allowedOrigins = getAllowedOrigins(config);
    app.use(createCatalogCors(allowedOrigins));
    const jsonParser = json({ limit: '1mb' });
    app.use((req, res, next) =>
      isCatalogPublicRoute(req.path) ? jsonParser(req, res, next) : next(),
    );
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
  }

  if (promotionRoutesEnabled) {
    const allowedOrigins = getAllowedOrigins(config);
    app.use(createPromotionCors(allowedOrigins));
    const jsonParser = json({ limit: '1mb' });
    app.use((req, res, next) =>
      isPromotionPublicRoute(req.path) ? jsonParser(req, res, next) : next(),
    );
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
  }

  if (paymentRoutesEnabled) {
    const jsonParser = json({ limit: '1mb' });
    app.use((req, res, next) =>
      isPaymentPublicRoute(req.path) ? jsonParser(req, res, next) : next(),
    );
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
  }

  if (reviewRoutesEnabled) {
    const allowedOrigins = getAllowedOrigins(config);
    app.use(createReviewCors(allowedOrigins));
    const jsonParser = json({ limit: '1mb' });
    app.use((req, res, next) =>
      isReviewPublicRoute(req.path) ? jsonParser(req, res, next) : next(),
    );
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
  }

  if (orderingRoutesEnabled) {
    const allowedOrigins = getAllowedOrigins(config);
    app.use(createOrderingCors(allowedOrigins));
    const jsonParser = json({ limit: '1mb' });
    app.use((req, res, next) =>
      isOrderingPublicRoute(req.path) ? jsonParser(req, res, next) : next(),
    );
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
  }

  if (reportingRoutesEnabled) {
    const allowedOrigins = getAllowedOrigins(config);
    app.use(createReportingCors(allowedOrigins));
    const jsonParser = json({ limit: '1mb' });
    app.use((req, res, next) =>
      isReportingPublicRoute(req.path) ? jsonParser(req, res, next) : next(),
    );
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
  }

  // 2. Proxy Notification Socket.IO traffic to the Notification service.
  const proxy = createApiProxy({
    proxyTimeoutMs,
    notificationRoutesEnabled,
    notificationSocketTarget: `http://${config.get('NOTIFICATION_TCP_HOST', { infer: true })}:${config.get('NOTIFICATION_MANAGEMENT_PORT', { infer: true })}`,
  });
  app.use(proxy);

  return { app, proxy };
}
