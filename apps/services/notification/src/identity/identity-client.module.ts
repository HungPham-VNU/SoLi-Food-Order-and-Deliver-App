import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { Env } from '@/config/env.schema';
import { USER_DIRECTORY_PORT } from '@/shared/ports/user-directory.port';
import { IdentityUserDirectoryAdapter } from './identity-user-directory.adapter';
import { NestIdentityRpcClient } from './nest-identity-rpc.client';
import { SocketSessionAuthenticator } from './socket-session-authenticator';
import { IDENTITY_RPC_GATEWAY, IDENTITY_TCP_CLIENT } from './identity.tokens';

@Global()
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
    NestIdentityRpcClient,
    IdentityUserDirectoryAdapter,
    SocketSessionAuthenticator,
    { provide: IDENTITY_RPC_GATEWAY, useExisting: NestIdentityRpcClient },
    { provide: USER_DIRECTORY_PORT, useExisting: IdentityUserDirectoryAdapter },
  ],
  exports: [
    IDENTITY_RPC_GATEWAY,
    USER_DIRECTORY_PORT,
    SocketSessionAuthenticator,
  ],
})
export class IdentityClientModule {}
