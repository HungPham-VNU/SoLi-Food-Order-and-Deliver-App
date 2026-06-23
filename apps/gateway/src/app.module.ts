import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.schema';
import { HealthModule } from './health/health.module';

/**
 * Gateway root module.
 *
 * Deliberately minimal: validated config + health endpoints. The reverse proxy
 * itself is wired in main.ts (it must run as raw Express middleware before body
 * parsing and needs the http.Server for WebSocket upgrades).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    HealthModule,
  ],
})
export class AppModule {}
