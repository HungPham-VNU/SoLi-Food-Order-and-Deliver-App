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
  /** Upstream monolith base URL. */
  target: string;
  /** End-to-end timeout (incoming socket + upstream request) in ms. */
  proxyTimeoutMs: number;
  /** When true, Media-owned public routes are handled locally over TCP. */
  mediaRoutesEnabled: boolean;
  /** When true, Better Auth routes are handled locally over Identity TCP. */
  identityRoutesEnabled: boolean;
  /** When true, Notification HTTP routes are handled locally and Socket.IO targets Notification. */
  notificationRoutesEnabled: boolean;
  /** HTTP target for Notification Socket.IO polling/upgrade traffic. */
  notificationSocketTarget: string;
  /** When true, Catalog-owned public routes are handled locally over TCP. */
  catalogRoutesEnabled: boolean;
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
 * Builds the transparent reverse proxy to the monolith.
 *
 * Phase 1 behaviour: forward EVERYTHING except the gateway's own management
 * paths (/live, /ready, /metrics) to the upstream, byte-for-byte. This covers
 * all of /api/**, plus the monolith's root-served assets (/docs,
 * /api-spec.json, /firebase-messaging-sw.js, etc.).
 *
 * Fidelity guarantees (why these options matter):
 *  - The request body is NOT parsed by the gateway (NestFactory bodyParser:false),
 *    so the raw stream — Better Auth rawBody, VNPay signatures, multipart uploads —
 *    reaches the monolith untouched.
 *  - `xfwd: true` adds X-Forwarded-For/Host/Proto so the monolith can reconstruct
 *    the public origin.
 *  - `changeOrigin: true` sets the upstream Host to the monolith's host; the
 *    client's Origin header is forwarded unchanged so Better Auth CORS/CSRF and
 *    the monolith's existing `enableCors()` keep working exactly as today.
 *  - Multiple Set-Cookie response headers (Better Auth) are preserved by default.
 *  - `ws: true` enables Socket.IO/WebSocket upgrades (wired in main.ts).
 *
 * CORS is intentionally NOT handled here in Phase 1 — the monolith continues to
 * own it, so there is no risk of duplicated Access-Control-* headers. Ownership
 * moves to the gateway in a later phase.
 */
export function createApiProxy({
  target,
  proxyTimeoutMs,
  mediaRoutesEnabled,
  identityRoutesEnabled,
  notificationRoutesEnabled,
  notificationSocketTarget,
  catalogRoutesEnabled,
}: ApiProxyOptions): RequestHandler {
  return createProxyMiddleware({
    target,
    router: (req) =>
      notificationRoutesEnabled && isSocketIoRoute(req.url?.split('?')[0] ?? '')
        ? notificationSocketTarget
        : target,
    changeOrigin: true,
    xfwd: true,
    ws: true,
    proxyTimeout: proxyTimeoutMs,
    timeout: proxyTimeoutMs,
    // Anything that is NOT a management path is proxied. Returning false makes
    // http-proxy-middleware call next(), letting the gateway's own controllers
    // (HealthController) serve /live and /ready.
    pathFilter: (pathname: string) =>
      !(mediaRoutesEnabled && isMediaPublicRoute(pathname)) &&
      !(identityRoutesEnabled && isIdentityPublicRoute(pathname)) &&
      !(
        notificationRoutesEnabled && isNotificationPublicRoute(pathname)
      ) &&
      !(catalogRoutesEnabled && isCatalogPublicRoute(pathname)) &&
      !GATEWAY_MANAGEMENT_PATHS.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      ),
    on: {
      error: (err: Error, req, res) => {
        logger.error(
          `Upstream proxy error for ${req.method ?? '?'} ${req.url ?? '?'}: ` +
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
