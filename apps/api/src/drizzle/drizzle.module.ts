import { Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DrizzleBootstrap } from './drizzle.bootstrap';
import { DB_CONNECTION } from './drizzle.constants';
import {
  getNodePostgresSslConfig,
  requireDatabaseUrl,
} from './postgres-connection';

@Module({
  providers: [
    {
      provide: DB_CONNECTION,
      useFactory: () => {
        const databaseUrl = requireDatabaseUrl();
        return drizzle({
          connection: {
            connectionString: databaseUrl,
            ssl: getNodePostgresSslConfig(databaseUrl),
          },
        });
      },
    },
    DrizzleBootstrap,
  ],
  exports: [DB_CONNECTION],
})
export class DatabaseModule {}
