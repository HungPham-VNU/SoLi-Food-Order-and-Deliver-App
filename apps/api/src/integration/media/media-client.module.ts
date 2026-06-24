import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { Env } from '@/config/env.schema';
import { IMAGE_MANAGEMENT_PORT } from '@/shared/ports/image-management.port';
import { MEDIA_TCP_CLIENT } from './media-client.constants';
import { MediaImageManagementAdapter } from './media-image-management.adapter';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MEDIA_TCP_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: config.get('MEDIA_TCP_HOST', { infer: true }),
            port: config.get('MEDIA_TCP_PORT', { infer: true }),
          },
        }),
    },
    MediaImageManagementAdapter,
    {
      provide: IMAGE_MANAGEMENT_PORT,
      useExisting: MediaImageManagementAdapter,
    },
  ],
  exports: [IMAGE_MANAGEMENT_PORT],
})
export class MediaClientModule {}
