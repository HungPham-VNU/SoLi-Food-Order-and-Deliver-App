import 'reflect-metadata';
import type { Server } from 'http';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './config/env.schema';
import { createGatewayApp } from './gateway.factory';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Gateway');

  const { app, proxy } = await createGatewayApp();

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('UITFood API')
    .setDescription('The UITFood Microservices API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const server = (await app.listen(port)) as Server;

  // WebSocket / Socket.IO upgrade passthrough (notifications gateway).
  server.on('upgrade', proxy.upgrade);

  logger.log(`Gateway listening on :${port}`);
  logger.log(`Swagger docs available at http://localhost:${port}/docs`);
}

void bootstrap();
