import type { ServerResponse } from 'http';
import type { Socket } from 'net';
import { Logger } from '@nestjs/common';
import {
  createProxyMiddleware,
  type RequestHandler,
} from 'http-proxy-middleware';
import { GATEWAY_MANAGEMENT_PATHS } from './proxy.constants';

const logger = new Logger('GatewayProxy');

export interface ApiProxyOptions {
  /** End-to-end timeout (incoming socket + upstream request) in ms. */
  proxyTimeoutMs: number;
  /** When true, Notification HTTP routes are handled locally and Socket.IO targets Notification. */
  notificationRoutesEnabled: boolean;
  /** HTTP target for Notification Socket.IO polling/upgrade traffic. */
  notificationSocketTarget: string;
}

/**
 * Catalog-owned public routes: restaurants (+ nested delivery zones), menu items
 * (+ nested modifier groups), nutrition (under the singular `/api/restaurant/`
 * prefix), search, and dietary tags.
 */
export function isCatalogPublicRoute(pathname: string): boolean {
  return (
    pathname === '/api/restaurants' ||
    pathname.startsWith('/api/restaurants/') ||
    pathname === '/api/menu-items' ||
    pathname.startsWith('/api/menu-items/') ||
    pathname.startsWith('/api/restaurant/') ||
    pathname === '/api/search' ||
    pathname.startsWith('/api/search/') ||
    pathname === '/api/dietary-tags' ||
    pathname.startsWith('/api/dietary-tags/')
  );
}

/**
 * Promotion-owned public routes: active-promotion discovery, discount preview,
 * and coupon validation.
 */
export function isPromotionPublicRoute(pathname: string): boolean {
  return (
    pathname === '/api/promotions' || pathname.startsWith('/api/promotions/')
  );
}

/**
 * Payment-owned public routes. The customer cancellation route
 * `/api/payments/vnpay/orders/:orderId/cancel` intentionally stays proxied to
 * Ordering because it transitions the order after cancelling the payment.
 */
/**
 * Ordering-owned public routes: carts + checkout, single-order reads +
 * lifecycle transitions, the per-actor history lists, and the mobile VNPay
 * pending-payment cancellation.
 */
export function isOrderingPublicRoute(pathname: string): boolean {
  return (
    pathname === '/api/carts' ||
    pathname.startsWith('/api/carts/') ||
    pathname === '/api/orders' ||
    pathname.startsWith('/api/orders/') ||
    pathname === '/api/restaurant/orders' ||
    pathname.startsWith('/api/restaurant/orders/') ||
    pathname === '/api/shipper/orders' ||
    pathname.startsWith('/api/shipper/orders/') ||
    pathname === '/api/admin/orders' ||
    pathname.startsWith('/api/admin/orders/') ||
    pathname.startsWith('/api/payments/vnpay/orders/')
  );
}

export function isPaymentPublicRoute(pathname: string): boolean {
  return (
    pathname === '/api/payments/my' ||
    pathname === '/api/payments/vnpay/ipn' ||
    pathname === '/api/payments/vnpay/return' ||
    pathname === '/api/payments/vnpay/mobile-return'
  );
}

export function isReviewPublicRoute(pathname: string): boolean {
  return pathname === '/api/reviews' || pathname.startsWith('/api/reviews/');
}

/** Reporting-owned public routes: the admin analytics dashboard bundle. */
export function isReportingPublicRoute(pathname: string): boolean {
  return (
    pathname === '/api/admin/analytics' ||
    pathname.startsWith('/api/admin/analytics/')
  );
}

export function isMediaPublicRoute(pathname: string): boolean {
  return (
    pathname === '/api/images' ||
    pathname === '/api/images/' ||
    pathname === '/api/cloudinary/signature' ||
    pathname === '/api/cloudinary/signature/'
  );
}

export function isIdentityPublicRoute(pathname: string): boolean {
  return pathname === '/api/auth' || pathname.startsWith('/api/auth/');
}

export function isNotificationPublicRoute(pathname: string): boolean {
  return (
    pathname === '/api/notifications' ||
    pathname.startsWith('/api/notifications/')
  );
}

export function isSocketIoRoute(pathname: string): boolean {
  return pathname === '/socket.io' || pathname.startsWith('/socket.io/');
}

/**
 * Builds the Notification Socket.IO proxy.
 *
 * HTTP API routes are translated by gateway controllers to private TCP
 * services; unmatched routes are not proxied.
 *
 * Fidelity guarantees (why these options matter):
 *  - The request body is NOT parsed by the gateway (NestFactory bodyParser:false),
 *    so the raw stream — Better Auth rawBody, VNPay signatures, multipart uploads —
 *    reaches the Notification service untouched.
 *  - `xfwd: true` adds X-Forwarded-For/Host/Proto so the service can reconstruct
 *    the public origin.
 *  - `changeOrigin: true` sets the upstream Host to the service host; the
 *    client's Origin header is forwarded unchanged so Better Auth CORS/CSRF and
 *    service CORS/CSRF handling can use the public origin.
 *  - Multiple Set-Cookie response headers (Better Auth) are preserved by default.
 *  - `ws: true` enables Socket.IO/WebSocket upgrades (wired in main.ts).
 *
 * CORS for HTTP routes is handled by route-specific gateway middleware.
 */
export function createApiProxy({
  proxyTimeoutMs,
  notificationRoutesEnabled,
  notificationSocketTarget,
}: ApiProxyOptions): RequestHandler {
  return createProxyMiddleware({
    target: notificationSocketTarget,
    changeOrigin: true,
    xfwd: true,
    ws: true,
    proxyTimeout: proxyTimeoutMs,
    timeout: proxyTimeoutMs,
    // Only service-owned Socket.IO traffic is proxied. HTTP API routes are
    // translated by gateway controllers; unmatched routes return 404.
    pathFilter: (pathname: string) =>
      notificationRoutesEnabled &&
      isSocketIoRoute(pathname) &&
      !GATEWAY_MANAGEMENT_PATHS.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      ),
    on: {
      error: (err: Error, req, res) => {
        logger.error(
          `Socket proxy error for ${req.method ?? '?'} ${req.url ?? '?'}: ` +
            `${(err as NodeJS.ErrnoException).code ?? ''} ${err.message}`,
        );
        // For HTTP, res is a ServerResponse; for a failed WS upgrade it is a
        // raw Socket. Respond with a stable 502 envelope or close the socket.
        const httpRes = res as ServerResponse;
        if (typeof httpRes.writeHead === 'function') {
          if (!httpRes.headersSent) {
            httpRes.writeHead(502, { 'Content-Type': 'application/json' });
          }
          httpRes.end(
            JSON.stringify({
              statusCode: 502,
              error: 'Bad Gateway',
              message: 'Upstream service is unavailable.',
            }),
          );
          return;
        }
        (res as Socket).destroy(err);
      },
    },
  });
}
