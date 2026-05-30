import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from './drizzle.constants';
import * as schema from './schema';

/**
 * PostgreSQL extensions the search module depends on.
 *
 * `unaccent` powers accent-insensitive `ILIKE` matching (e.g. "pho" → "Phở")
 * and `pg_trgm` backs the trigram GIN indexes used to keep those `ILIKE`
 * scans fast. Without `unaccent` every text search throws
 * `function unaccent(text) does not exist` → HTTP 500.
 */
const REQUIRED_EXTENSIONS = ['unaccent', 'pg_trgm'] as const;

/**
 * Ensures the extensions required by the search module exist before the API
 * starts serving traffic.
 *
 * Deploys run only `node dist/main` with no migration step, and the database
 * may have been bootstrapped via `db:push` (which never creates extensions).
 * This idempotent startup check is the safety net that keeps search working
 * across fresh databases and redeploys.
 */
@Injectable()
export class DrizzleBootstrap implements OnModuleInit {
  private readonly logger = new Logger(DrizzleBootstrap.name);

  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async onModuleInit(): Promise<void> {
    // `CREATE EXTENSION IF NOT EXISTS` is idempotent. A create can still fail
    // when several instances boot concurrently, so we never trust the create
    // alone — the post-create verification below is the real gate.
    try {
      await this.db.execute(
        sql`CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public`,
      );
      await this.db.execute(
        sql`CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public`,
      );
    } catch (error) {
      // Swallow here; the verification step decides whether this is fatal so a
      // concurrent-boot race (another instance won) doesn't crash the app.
      this.logger.warn(
        `Could not create search extensions (will verify next): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    let missing: string[];
    try {
      missing = await this.findMissingExtensions();
    } catch (error) {
      // Verification itself failed (e.g. the database is unreachable at boot).
      this.fail(
        `Could not verify search extensions: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    if (missing.length === 0) {
      this.logger.log(
        `Search extensions ready: ${REQUIRED_EXTENSIONS.join(', ')}`,
      );
      return;
    }

    this.fail(
      `Missing required PostgreSQL extension(s): ${missing.join(', ')}. ` +
        `Text search (\`unaccent\`/\`pg_trgm\`) will fail until they are installed ` +
        `(e.g. \`CREATE EXTENSION IF NOT EXISTS unaccent\`).`,
    );
  }

  /**
   * In production a broken search dependency is fatal — fail the boot loudly
   * rather than silently shipping a broken /api/search. Elsewhere (local/test/
   * preview) warn so developers without superuser grants can still run the app.
   */
  private fail(message: string): void {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(message);
    }
    this.logger.warn(message);
  }

  private async findMissingExtensions(): Promise<string[]> {
    const result = await this.db.execute<{ extname: string }>(
      sql`SELECT extname FROM pg_extension WHERE extname IN ('unaccent', 'pg_trgm')`,
    );
    const present = new Set(result.rows.map((row) => row.extname));
    return REQUIRED_EXTENSIONS.filter((name) => !present.has(name));
  }
}
