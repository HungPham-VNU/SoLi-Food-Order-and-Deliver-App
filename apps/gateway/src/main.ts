import 'reflect-metadata';
import type { Server } from 'http';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './config/env.schema';
import { createGatewayApp } from './gateway.factory';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Gateway');

  const { app, proxy } = await createGatewayApp();

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const target = config.get('MONOLITH_UPSTREAM_URL', { infer: true });
  const port = config.get('PORT', { infer: true });

  const server = (await app.listen(port)) as Server;

  // WebSocket / Socket.IO upgrade passthrough (notifications gateway).
  server.on('upgrade', proxy.upgrade);

  logger.log(`Gateway listening on :${port} → proxying to ${target}`);
}

void bootstrap();
