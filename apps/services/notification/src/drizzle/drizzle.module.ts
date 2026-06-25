import {
  Inject,
  Injectable,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { Env } from '@/config/env.schema';
import { notificationRestaurantSnapshots } from '@/notification/acl/notification-restaurant-snapshot.schema';
import { deviceTokens } from '@/notification/domain/device-token.schema';
import { notificationDeliveryLogs } from '@/notification/domain/notification-delivery-log.schema';
import { notificationPreferences } from '@/notification/domain/notification-preference.schema';
import { notifications } from '@/notification/domain/notification.schema';
import { inboxMessages } from '@/messaging/schema/inbox.schema';
import { DB_CONNECTION, NOTIFICATION_DATABASE_POOL } from './drizzle.constants';

export type NotificationDatabase = NodePgDatabase<{
  notifications: typeof notifications;
  notificationPreferences: typeof notificationPreferences;
  notificationDeliveryLogs: typeof notificationDeliveryLogs;
  deviceTokens: typeof deviceTokens;
  notificationRestaurantSnapshots: typeof notificationRestaurantSnapshots;
  inboxMessages: typeof inboxMessages;
}>;

function sslFor(databaseUrl: string): false | { rejectUnauthorized: false } {
  const url = new URL(databaseUrl);
  if (['localhost', '127.0.0.1', 'postgres'].includes(url.hostname)) {
    return false;
  }
  return { rejectUnauthorized: false };
}

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(
    @Inject(NOTIFICATION_DATABASE_POOL) private readonly pool: Pool,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

@Module({
  providers: [
    {
      provide: NOTIFICATION_DATABASE_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const connectionString = config.get('DATABASE_URL', { infer: true });
        return new Pool({ connectionString, ssl: sslFor(connectionString) });
      },
    },
    {
      provide: DB_CONNECTION,
      inject: [NOTIFICATION_DATABASE_POOL],
      useFactory: (pool: Pool): NotificationDatabase =>
        drizzle(pool, {
          schema: {
            notifications,
            notificationPreferences,
            notificationDeliveryLogs,
            deviceTokens,
            notificationRestaurantSnapshots,
            inboxMessages,
          },
        }),
    },
    DatabaseLifecycle,
  ],
  exports: [DB_CONNECTION],
})
export class DatabaseModule {}
