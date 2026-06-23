import type { RequestHandler } from 'http-proxy-middleware';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';
import { createApiProxy } from './proxy/api-proxy.factory';
import { requestContext } from './common/request-context.middleware';

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
export interface GatewayOverrides {
  /** Override the upstream target (used by tests to point at a stub). */
  target?: string;
  /** Override the proxy timeout in ms. */
  proxyTimeoutMs?: number;
}

export async function createGatewayApp(overrides: GatewayOverrides = {}): Promise<{
  app: INestApplication;
  proxy: RequestHandler;
}> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableShutdownHooks();

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  // Non-null: these keys are zod-validated with defaults, so they are always set.
  const target =
    overrides.target ?? config.get('MONOLITH_UPSTREAM_URL', { infer: true })!;
  const proxyTimeoutMs =
    overrides.proxyTimeoutMs ??
    config.get('GATEWAY_PROXY_TIMEOUT_MS', { infer: true })!;

  // 1. Strip internal/trust headers + ensure x-request-id (before proxying).
  app.use(requestContext);

  // 2. Proxy everything except the gateway's own management paths.
  const proxy = createApiProxy({ target, proxyTimeoutMs });
  app.use(proxy);

  return { app, proxy };
}
