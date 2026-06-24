import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const tcpPort =
    config.get('PORT', { infer: true }) ??
    config.get('MEDIA_TCP_PORT', { infer: true });
  const managementPort = config.get('MEDIA_MANAGEMENT_PORT', { infer: true });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: { host: '0.0.0.0', port: tcpPort },
  });
  app.enableShutdownHooks();

  await app.startAllMicroservices();
  await app.listen(managementPort, '0.0.0.0');

  new Logger('MediaBootstrap').log(
    `Media TCP listening on :${tcpPort}; management HTTP on :${managementPort}`,
  );
}

void bootstrap();
