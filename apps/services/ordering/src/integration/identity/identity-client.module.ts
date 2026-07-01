import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { Env } from '@/config/env.schema';
import { USER_DIRECTORY_PORT } from '@/shared/ports/user-directory.port';
import { IDENTITY_TCP_CLIENT } from './identity-client.constants';
import { IdentityUserDirectoryRpcAdapter } from './identity-user-directory.adapter';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: IDENTITY_TCP_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: config.get('IDENTITY_TCP_HOST', { infer: true }),
            port: config.get('IDENTITY_TCP_PORT', { infer: true }),
          },
        }),
    },
    IdentityUserDirectoryRpcAdapter,
    {
      provide: USER_DIRECTORY_PORT,
      useExisting: IdentityUserDirectoryRpcAdapter,
    },
  ],
  exports: [USER_DIRECTORY_PORT],
})
export class IdentityClientModule {}
