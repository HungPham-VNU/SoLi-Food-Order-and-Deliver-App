import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';

/**
 * Catalog hybrid bootstrap:
 *  - TCP listener for synchronous RPC (`@MessagePattern` controllers).
 *  - Private management HTTP listener (`/live`, `/ready`).
 *
 * The RabbitMQ listener is NOT a Nest `Transport.RMQ` microservice: the platform
 * publishes raw JSON envelopes to a topic exchange, so events are consumed by a
 * self-managed `RabbitMqConsumer` (amqp-connection-manager) inside the messaging
 * module, matching the notification/payment/ordering services. It starts on
 * application bootstrap and needs no `connectMicroservice` call here.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  const tcpPort =
    config.get('PORT', { infer: true }) ??
    config.get('CATALOG_TCP_PORT', { infer: true });
  const managementPort = config.get('CATALOG_MANAGEMENT_PORT', { infer: true });

  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: { host: '0.0.0.0', port: tcpPort },
  });
  app.enableShutdownHooks();

  await app.startAllMicroservices();
  await app.listen(managementPort, '0.0.0.0');

  new Logger('CatalogBootstrap').log(
    `Catalog TCP listening on :${tcpPort}; management HTTP on :${managementPort}`,
  );
}

void bootstrap();
