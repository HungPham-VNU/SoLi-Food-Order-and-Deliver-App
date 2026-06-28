import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config/env.schema';
import { IDENTITY_DATABASE } from '@/drizzle/database.constants';
import { DatabaseModule, type IdentityDatabase } from '@/drizzle/database.module';
import { createIdentityAuth, IDENTITY_AUTH } from './auth.factory';
import { IdentityAuthHttpService } from './identity-auth-http.service';
import { IdentityDirectoryService } from './identity-directory.service';
import { IdentityEventPublisher } from './identity-event.publisher';
import { IdentitySessionService } from './identity-session.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    IdentityEventPublisher,
    {
      provide: IDENTITY_AUTH,
      inject: [IDENTITY_DATABASE, ConfigService, IdentityEventPublisher],
      useFactory: (
        database: IdentityDatabase,
        config: ConfigService<Env, true>,
        events: IdentityEventPublisher,
      ) =>
        createIdentityAuth(
          database,
          {
            NODE_ENV: config.get('NODE_ENV', { infer: true }),
            DATABASE_URL: config.get('DATABASE_URL', { infer: true }),
            PORT: config.get('PORT', { infer: true }),
            IDENTITY_TCP_PORT: config.get('IDENTITY_TCP_PORT', {
              infer: true,
            }),
            IDENTITY_MANAGEMENT_PORT: config.get(
              'IDENTITY_MANAGEMENT_PORT',
              { infer: true },
            ),
            BETTER_AUTH_SECRET: config.get('BETTER_AUTH_SECRET', {
              infer: true,
            }),
            BETTER_AUTH_URL: config.get('BETTER_AUTH_URL', { infer: true }),
            GOOGLE_CLIENT_ID: config.get('GOOGLE_CLIENT_ID', { infer: true }),
            GOOGLE_CLIENT_SECRET: config.get('GOOGLE_CLIENT_SECRET', {
              infer: true,
            }),
          },
          events,
        ),
    },
    IdentityAuthHttpService,
    IdentityDirectoryService,
    IdentitySessionService,
  ],
  exports: [
    IDENTITY_AUTH,
    IdentityAuthHttpService,
    IdentityDirectoryService,
    IdentitySessionService,
  ],
})
export class AuthModule {}
