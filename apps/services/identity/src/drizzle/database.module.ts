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
import * as schema from '@/auth/auth.schema';
import {
  IDENTITY_DATABASE,
  IDENTITY_DATABASE_POOL,
} from './database.constants';

export type IdentityDatabase = NodePgDatabase<typeof schema>;

function sslFor(databaseUrl: string): false | { rejectUnauthorized: false } {
  const url = new URL(databaseUrl);
  if (['localhost', '127.0.0.1', 'postgres'].includes(url.hostname)) {
    return false;
  }
  return { rejectUnauthorized: false };
}

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(IDENTITY_DATABASE_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

@Module({
  providers: [
    {
      provide: IDENTITY_DATABASE_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const connectionString = config.get('DATABASE_URL', { infer: true });
        return new Pool({ connectionString, ssl: sslFor(connectionString) });
      },
    },
    {
      provide: IDENTITY_DATABASE,
      inject: [IDENTITY_DATABASE_POOL],
      useFactory: (pool: Pool): IdentityDatabase => drizzle(pool, { schema }),
    },
    DatabaseLifecycle,
  ],
  exports: [IDENTITY_DATABASE],
})
export class DatabaseModule {}
