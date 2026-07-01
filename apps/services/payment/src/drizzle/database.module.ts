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
import * as schema from './schema';
import { PAYMENT_DATABASE, PAYMENT_DATABASE_POOL } from './database.constants';

export type PaymentDatabase = NodePgDatabase<typeof schema>;

function sslFor(databaseUrl: string): false | { rejectUnauthorized: false } {
  const url = new URL(databaseUrl);
  if (['localhost', '127.0.0.1', 'postgres'].includes(url.hostname)) {
    return false;
  }
  return { rejectUnauthorized: false };
}

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(PAYMENT_DATABASE_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

@Module({
  providers: [
    {
      provide: PAYMENT_DATABASE_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const connectionString = config.get('DATABASE_URL', { infer: true });
        return new Pool({ connectionString, ssl: sslFor(connectionString) });
      },
    },
    {
      provide: PAYMENT_DATABASE,
      inject: [PAYMENT_DATABASE_POOL],
      useFactory: (pool: Pool): PaymentDatabase => drizzle(pool, { schema }),
    },
    DatabaseLifecycle,
  ],
  exports: [PAYMENT_DATABASE],
})
export class DatabaseModule {}
