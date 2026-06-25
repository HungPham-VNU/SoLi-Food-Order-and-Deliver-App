import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { Env } from '@/config/env.schema';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { IDENTITY_TCP_CLIENT } from '@/integration/identity/identity-client.constants';
import { IdentityUserDirectoryRpcAdapter } from '@/integration/identity/identity-user-directory.adapter';
import { USER_DIRECTORY_PORT } from '@/shared/ports/user-directory.port';
import { UserDirectoryAdapter } from './user-directory.adapter';

@Module({
  imports: [ConfigModule, DatabaseModule],
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
    UserDirectoryAdapter,
    IdentityUserDirectoryRpcAdapter,
    {
      provide: USER_DIRECTORY_PORT,
      inject: [
        ConfigService,
        UserDirectoryAdapter,
        IdentityUserDirectoryRpcAdapter,
      ],
      useFactory: (
        config: ConfigService<Env, true>,
        local: UserDirectoryAdapter,
        remote: IdentityUserDirectoryRpcAdapter,
      ) =>
        config.get('IDENTITY_RPC_ENABLED', { infer: true }) ? remote : local,
    },
  ],
  exports: [USER_DIRECTORY_PORT],
})
export class IdentityModule {}
