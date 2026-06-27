import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';

/**
 * Ordering hybrid bootstrap:
 *  - TCP listener for synchronous RPC (`@MessagePattern` controllers).
 *  - Private management HTTP listener (`/live`, `/ready`).
 *
 * RabbitMQ is consumed by a self-managed `RabbitMqConsumer` inside the messaging
 * module (raw JSON envelopes on a topic exchange), not a Nest `Transport.RMQ`
 * microservice, matching the catalog, notification, and payment services.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const tcpPort =
    config.get('PORT', { infer: true }) ??
    config.get('ORDERING_TCP_PORT', { infer: true });
  const managementPort = config.get('ORDERING_MANAGEMENT_PORT', {
    infer: true,
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: { host: '0.0.0.0', port: tcpPort },
  });
  app.enableShutdownHooks();

  await app.startAllMicroservices();
  await app.listen(managementPort, '0.0.0.0');

  new Logger('OrderingBootstrap').log(
    `Ordering TCP listening on :${tcpPort}; management HTTP on :${managementPort}`,
  );
}

void bootstrap();
