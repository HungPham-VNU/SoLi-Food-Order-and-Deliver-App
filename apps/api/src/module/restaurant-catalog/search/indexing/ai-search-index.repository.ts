import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import { menuItemNutrition } from '@/module/restaurant-catalog/nutrition/domain/nutrition.schema';
import { menuCategories, menuItems } from '../../menu/menu.schema';
import { restaurants } from '../../restaurant/restaurant.schema';
import {
  aiSearchEmbeddingJobs,
  type AiSearchEmbeddingJob,
  type AiSearchEmbeddingTargetType,
} from './ai-search-embedding-job.schema';
import {
  buildSearchDocument,
  type SearchDocumentResult,
} from './ai-search-document';
import {
  AiSearchEmbeddingService,
  type AiSearchEmbeddingConfig,
} from './ai-search-embedding.service';

type SearchIndexDb = Pick<
  NodePgDatabase,
  'select' | 'insert' | 'update' | 'delete' | 'execute'
>;

export interface EmbeddingTarget {
  targetType: AiSearchEmbeddingTargetType;
  targetId: string;
  searchDocument: string;
  contentHash: string;
}

export interface BackfillResult {
  scanned: number;
  changed: number;
  queued: number;
  skipped: number;
  failed: number;
  failures: string[];
}

interface MenuItemSearchDocumentRow {
  id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  categoryName: string | null;
  restaurantName: string;
  cuisineType: string | null;
  searchContentHash: string | null;
  embedding: number[] | null;
  embeddingModel: string | null;
  embeddingVersion: string | null;
  embeddingGeneratedAt: Date | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  verifiedByRestaurant: boolean | null;
  ingredients: string[] | null;
}

interface MenuItemSearchMetadataUpdate {
  id: string;
  searchDocument: string;
  contentHash: string;
}

interface EmbeddingJobInput {
  targetId: string;
  contentHash: string;
}

@Injectable()
export class AiSearchIndexRepository {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase,
    @Inject(AiSearchEmbeddingService)
    private readonly embeddings: AiSearchEmbeddingService,
  ) {}

  async refreshMenuItemSearchMetadata(
    menuItemId: string,
    db: SearchIndexDb = this.db,
  ): Promise<boolean> {
    const current = await this.buildMenuItemDocument(menuItemId, db);
    if (!current) return false;

    const embeddingConfig = this.embeddings.getConfig();
    const modelChanged =
      current.embeddingModel !== embeddingConfig.model ||
      current.embeddingVersion !== embeddingConfig.version;
    const contentChanged =
      current.document.contentHash !== current.searchContentHash;
    const shouldQueue =
      contentChanged ||
      modelChanged ||
      current.embedding === null ||
      current.embeddingGeneratedAt === null;

    if (contentChanged || modelChanged) {
      await db
        .update(menuItems)
        .set({
          searchDocument: current.document.document,
          searchContentHash: current.document.contentHash,
          embedding: null,
          embeddingModel: null,
          embeddingVersion: null,
          embeddingGeneratedAt: null,
        })
        .where(eq(menuItems.id, menuItemId));
    }

    if (shouldQueue) {
      await this.enqueueEmbeddingJob(
        'menu_item',
        menuItemId,
        current.document.contentHash,
        db,
      );
    }

    return shouldQueue;
  }

  async refreshRestaurantSearchMetadata(
    restaurantId: string,
    db: SearchIndexDb = this.db,
  ): Promise<boolean> {
    const current = await this.buildRestaurantDocument(restaurantId, db);
    if (!current) return false;

    const embeddingConfig = this.embeddings.getConfig();
    const modelChanged =
      current.embeddingModel !== embeddingConfig.model ||
      current.embeddingVersion !== embeddingConfig.version;
    const contentChanged =
      current.document.contentHash !== current.searchContentHash;
    const shouldQueue =
      contentChanged ||
      modelChanged ||
      current.embedding === null ||
      current.embeddingGeneratedAt === null;

    if (contentChanged || modelChanged) {
      await db
        .update(restaurants)
        .set({
          searchDocument: current.document.document,
          searchContentHash: current.document.contentHash,
          embedding: null,
          embeddingModel: null,
          embeddingVersion: null,
          embeddingGeneratedAt: null,
        })
        .where(eq(restaurants.id, restaurantId));
    }

    if (shouldQueue) {
      await this.enqueueEmbeddingJob(
        'restaurant',
        restaurantId,
        current.document.contentHash,
        db,
      );
    }

    return shouldQueue;
  }

  async refreshMenuItemsForRestaurant(
    restaurantId: string,
    db: SearchIndexDb = this.db,
  ): Promise<number> {
    return this.refreshMenuItemSearchMetadataBatch(
      eq(menuItems.restaurantId, restaurantId),
      db,
    );
  }

  async refreshMenuItemsForCategory(
    categoryId: string,
    db: SearchIndexDb = this.db,
  ): Promise<number> {
    return this.refreshMenuItemSearchMetadataBatch(
      eq(menuItems.categoryId, categoryId),
      db,
    );
  }

  async enqueueEmbeddingJob(
    targetType: AiSearchEmbeddingTargetType,
    targetId: string,
    contentHash: string,
    db: SearchIndexDb = this.db,
  ): Promise<void> {
    await db
      .insert(aiSearchEmbeddingJobs)
      .values({
        targetType,
        targetId,
        contentHash,
        status: 'pending',
        attempts: 0,
        availableAt: new Date(),
        lockedAt: null,
        lastError: null,
      })
      .onConflictDoUpdate({
        target: [
          aiSearchEmbeddingJobs.targetType,
          aiSearchEmbeddingJobs.targetId,
        ],
        set: {
          contentHash,
          status: 'pending',
          attempts: 0,
          availableAt: new Date(),
          lockedAt: null,
          lastError: null,
          updatedAt: new Date(),
        },
      });
  }

  async lockPendingEmbeddingJobs(
    limit: number,
  ): Promise<AiSearchEmbeddingJob[]> {
    const result = await this.db.execute<{
      id: string;
      targetType: AiSearchEmbeddingTargetType;
      targetId: string;
      contentHash: string;
      status: AiSearchEmbeddingJob['status'];
      attempts: number;
      availableAt: Date;
      lockedAt: Date | null;
      lastError: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>(sql`
      WITH locked AS (
        SELECT id
        FROM ai_search_embedding_jobs
        WHERE status = 'pending'
          AND available_at <= now()
        ORDER BY available_at ASC, updated_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE ai_search_embedding_jobs AS jobs
      SET status = 'processing',
          attempts = jobs.attempts + 1,
          locked_at = now(),
          updated_at = now()
      FROM locked
      WHERE jobs.id = locked.id
      RETURNING
        jobs.id,
        jobs.target_type AS "targetType",
        jobs.target_id AS "targetId",
        jobs.content_hash AS "contentHash",
        jobs.status,
        jobs.attempts,
        jobs.available_at AS "availableAt",
        jobs.locked_at AS "lockedAt",
        jobs.last_error AS "lastError",
        jobs.created_at AS "createdAt",
        jobs.updated_at AS "updatedAt"
    `);

    return result.rows;
  }

  async countPendingEmbeddingJobs(): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(aiSearchEmbeddingJobs)
      .where(eq(aiSearchEmbeddingJobs.status, 'pending'));

    return Number(row?.total ?? 0);
  }

  async findEmbeddingTarget(
    job: Pick<AiSearchEmbeddingJob, 'targetType' | 'targetId'>,
  ): Promise<EmbeddingTarget | null> {
    if (job.targetType === 'menu_item') {
      const [row] = await this.db
        .select({
          searchDocument: menuItems.searchDocument,
          contentHash: menuItems.searchContentHash,
        })
        .from(menuItems)
        .where(eq(menuItems.id, job.targetId))
        .limit(1);
      if (!row?.searchDocument || !row.contentHash) return null;
      return {
        targetType: job.targetType,
        targetId: job.targetId,
        searchDocument: row.searchDocument,
        contentHash: row.contentHash,
      };
    }

    const [row] = await this.db
      .select({
        searchDocument: restaurants.searchDocument,
        contentHash: restaurants.searchContentHash,
      })
      .from(restaurants)
      .where(eq(restaurants.id, job.targetId))
      .limit(1);
    if (!row?.searchDocument || !row.contentHash) return null;
    return {
      targetType: job.targetType,
      targetId: job.targetId,
      searchDocument: row.searchDocument,
      contentHash: row.contentHash,
    };
  }

  async storeEmbedding(
    target: EmbeddingTarget,
    embedding: number[],
    embeddingConfig: AiSearchEmbeddingConfig,
  ): Promise<boolean> {
    if (target.targetType === 'menu_item') {
      const rows = await this.db
        .update(menuItems)
        .set({
          embedding,
          embeddingModel: embeddingConfig.model,
          embeddingVersion: embeddingConfig.version,
          embeddingGeneratedAt: new Date(),
        })
        .where(
          and(
            eq(menuItems.id, target.targetId),
            eq(menuItems.searchContentHash, target.contentHash),
          ),
        )
        .returning({ id: menuItems.id });
      return rows.length > 0;
    }

    const rows = await this.db
      .update(restaurants)
      .set({
        embedding,
        embeddingModel: embeddingConfig.model,
        embeddingVersion: embeddingConfig.version,
        embeddingGeneratedAt: new Date(),
      })
      .where(
        and(
          eq(restaurants.id, target.targetId),
          eq(restaurants.searchContentHash, target.contentHash),
        ),
      )
      .returning({ id: restaurants.id });
    return rows.length > 0;
  }

  async completeJob(jobId: string): Promise<void> {
    await this.db
      .update(aiSearchEmbeddingJobs)
      .set({
        status: 'completed',
        lockedAt: null,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(aiSearchEmbeddingJobs.id, jobId));
  }

  async failJob(
    job: AiSearchEmbeddingJob,
    error: unknown,
    maxAttempts = 5,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const failedPermanently = job.attempts >= maxAttempts;
    const delayMs = Math.min(15 * 60_000, 2 ** job.attempts * 30_000);

    await this.db
      .update(aiSearchEmbeddingJobs)
      .set({
        status: failedPermanently ? 'failed' : 'pending',
        availableAt: new Date(Date.now() + delayMs),
        lockedAt: null,
        lastError: message.slice(0, 2000),
        updatedAt: new Date(),
      })
      .where(eq(aiSearchEmbeddingJobs.id, job.id));
  }

  async backfillSearchMetadata(limit?: number): Promise<BackfillResult> {
    const result: BackfillResult = {
      scanned: 0,
      changed: 0,
      queued: 0,
      skipped: 0,
      failed: 0,
      failures: [],
    };

    const restaurantRows = await this.db
      .select({ id: restaurants.id })
      .from(restaurants)
      .orderBy(restaurants.createdAt)
      .limit(limit ?? 100_000);
    for (const row of restaurantRows) {
      result.scanned++;
      try {
        const queued = await this.refreshRestaurantSearchMetadata(row.id);
        if (queued) {
          result.changed++;
          result.queued++;
        } else {
          result.skipped++;
        }
      } catch (error) {
        result.failed++;
        result.failures.push(
          `restaurant:${row.id}: ${formatBackfillError(error)}`,
        );
      }
    }

    const menuRows = await this.db
      .select({ id: menuItems.id })
      .from(menuItems)
      .orderBy(menuItems.createdAt)
      .limit(limit ?? 100_000);
    for (const row of menuRows) {
      result.scanned++;
      try {
        const queued = await this.refreshMenuItemSearchMetadata(row.id);
        if (queued) {
          result.changed++;
          result.queued++;
        } else {
          result.skipped++;
        }
      } catch (error) {
        result.failed++;
        result.failures.push(
          `menu_item:${row.id}: ${formatBackfillError(error)}`,
        );
      }
    }

    return result;
  }

  private async buildMenuItemDocument(menuItemId: string, db: SearchIndexDb) {
    const [row] = await this.fetchMenuItemDocumentRows(
      eq(menuItems.id, menuItemId),
      db,
    );

    if (!row) return null;
    const document = this.buildMenuItemSearchDocument(row);

    return {
      searchContentHash: row.searchContentHash,
      embedding: row.embedding,
      embeddingModel: row.embeddingModel,
      embeddingVersion: row.embeddingVersion,
      embeddingGeneratedAt: row.embeddingGeneratedAt,
      document,
    } satisfies {
      searchContentHash: string | null;
      embedding: number[] | null;
      embeddingModel: string | null;
      embeddingVersion: string | null;
      embeddingGeneratedAt: Date | null;
      document: SearchDocumentResult;
    };
  }

  private async refreshMenuItemSearchMetadataBatch(
    whereCondition: SQL<unknown>,
    db: SearchIndexDb,
  ): Promise<number> {
    const rows = await this.fetchMenuItemDocumentRows(whereCondition, db);
    if (rows.length === 0) return 0;

    const embeddingConfig = this.embeddings.getConfig();
    const updates: MenuItemSearchMetadataUpdate[] = [];
    const jobs: EmbeddingJobInput[] = [];

    for (const row of rows) {
      const document = this.buildMenuItemSearchDocument(row);
      const modelChanged =
        row.embeddingModel !== embeddingConfig.model ||
        row.embeddingVersion !== embeddingConfig.version;
      const contentChanged = document.contentHash !== row.searchContentHash;
      const shouldQueue =
        contentChanged ||
        modelChanged ||
        row.embedding === null ||
        row.embeddingGeneratedAt === null;

      if (contentChanged || modelChanged) {
        updates.push({
          id: row.id,
          searchDocument: document.document,
          contentHash: document.contentHash,
        });
      }

      if (shouldQueue) {
        jobs.push({
          targetId: row.id,
          contentHash: document.contentHash,
        });
      }
    }

    await this.bulkUpdateMenuItemSearchMetadata(updates, db);
    await this.bulkEnqueueMenuItemEmbeddingJobs(jobs, db);

    return jobs.length;
  }

  private async fetchMenuItemDocumentRows(
    whereCondition: SQL<unknown>,
    db: SearchIndexDb,
  ): Promise<MenuItemSearchDocumentRow[]> {
    return db
      .select({
        id: menuItems.id,
        name: menuItems.name,
        description: menuItems.description,
        tags: menuItems.tags,
        categoryName: menuCategories.name,
        restaurantName: restaurants.name,
        cuisineType: restaurants.cuisineType,
        searchContentHash: menuItems.searchContentHash,
        embedding: menuItems.embedding,
        embeddingModel: menuItems.embeddingModel,
        embeddingVersion: menuItems.embeddingVersion,
        embeddingGeneratedAt: menuItems.embeddingGeneratedAt,
        calories: menuItemNutrition.calories,
        protein: menuItemNutrition.protein,
        carbs: menuItemNutrition.carbs,
        fat: menuItemNutrition.fat,
        verifiedByRestaurant: menuItemNutrition.verifiedByRestaurant,
        ingredients: sql<string[]>`COALESCE((
          SELECT array_agg(DISTINCT ingredient_name ORDER BY ingredient_name)
          FROM (
            SELECT trim(COALESCE(corrected_name, extracted_name)) AS ingredient_name
            FROM nutrition_analysis_ingredients
            WHERE analysis_session_id = (
              SELECT id
              FROM nutrition_analysis_sessions
              WHERE menu_item_id = ${menuItems.id}
                AND status = 'SAVED'
              ORDER BY updated_at DESC, created_at DESC
              LIMIT 1
            )
          ) AS saved_ingredients
          WHERE ingredient_name <> ''
        ), ARRAY[]::text[])`,
      })
      .from(menuItems)
      .innerJoin(restaurants, eq(menuItems.restaurantId, restaurants.id))
      .leftJoin(menuCategories, eq(menuItems.categoryId, menuCategories.id))
      .leftJoin(
        menuItemNutrition,
        eq(menuItemNutrition.menuItemId, menuItems.id),
      )
      .where(whereCondition);
  }

  private buildMenuItemSearchDocument(
    row: MenuItemSearchDocumentRow,
  ): SearchDocumentResult {
    return buildSearchDocument({
      primaryName: row.name,
      description: row.description,
      tags: row.tags,
      categoryName: row.categoryName,
      cuisineType: row.cuisineType,
      restaurantName: row.restaurantName,
      ingredients: row.ingredients,
      nutrition: {
        calories: numberOrNull(row.calories),
        protein: numberOrNull(row.protein),
        carbs: numberOrNull(row.carbs),
        fat: numberOrNull(row.fat),
        verifiedByRestaurant: row.verifiedByRestaurant ?? null,
      },
    });
  }

  private async bulkUpdateMenuItemSearchMetadata(
    updates: MenuItemSearchMetadataUpdate[],
    db: SearchIndexDb,
  ): Promise<void> {
    if (updates.length === 0) return;

    const values = updates.map(
      (update) =>
        sql`(${update.id}, ${update.searchDocument}, ${update.contentHash})`,
    );

    await db.execute(sql`
      UPDATE menu_items AS item
      SET search_document = data.search_document,
          search_content_hash = data.search_content_hash,
          embedding = NULL,
          embedding_model = NULL,
          embedding_version = NULL,
          embedding_generated_at = NULL
      FROM (VALUES ${sql.join(values, sql`, `)})
        AS data(id, search_document, search_content_hash)
      WHERE item.id = data.id::uuid
    `);
  }

  private async bulkEnqueueMenuItemEmbeddingJobs(
    jobs: EmbeddingJobInput[],
    db: SearchIndexDb,
  ): Promise<void> {
    if (jobs.length === 0) return;

    const values = jobs.map(
      (job) => sql`(${job.targetId}, ${job.contentHash})`,
    );

    await db.execute(sql`
      INSERT INTO ai_search_embedding_jobs (
        target_type,
        target_id,
        content_hash,
        status,
        attempts,
        available_at,
        locked_at,
        last_error,
        updated_at
      )
      SELECT
        'menu_item'::ai_search_embedding_target_type,
        data.target_id::uuid,
        data.content_hash,
        'pending'::ai_search_embedding_job_status,
        0,
        now(),
        NULL,
        NULL,
        now()
      FROM (VALUES ${sql.join(values, sql`, `)})
        AS data(target_id, content_hash)
      ON CONFLICT (target_type, target_id) DO UPDATE
      SET content_hash = EXCLUDED.content_hash,
          status = 'pending'::ai_search_embedding_job_status,
          attempts = 0,
          available_at = now(),
          locked_at = NULL,
          last_error = NULL,
          updated_at = now()
    `);
  }

  private async buildRestaurantDocument(
    restaurantId: string,
    db: SearchIndexDb,
  ) {
    const [row] = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        description: restaurants.description,
        cuisineType: restaurants.cuisineType,
        searchContentHash: restaurants.searchContentHash,
        embedding: restaurants.embedding,
        embeddingModel: restaurants.embeddingModel,
        embeddingVersion: restaurants.embeddingVersion,
        embeddingGeneratedAt: restaurants.embeddingGeneratedAt,
      })
      .from(restaurants)
      .where(eq(restaurants.id, restaurantId))
      .limit(1);

    if (!row) return null;

    return {
      searchContentHash: row.searchContentHash,
      embedding: row.embedding,
      embeddingModel: row.embeddingModel,
      embeddingVersion: row.embeddingVersion,
      embeddingGeneratedAt: row.embeddingGeneratedAt,
      document: buildSearchDocument({
        primaryName: row.name,
        description: row.description,
        cuisineType: row.cuisineType,
      }),
    } satisfies {
      searchContentHash: string | null;
      embedding: number[] | null;
      embeddingModel: string | null;
      embeddingVersion: string | null;
      embeddingGeneratedAt: Date | null;
      document: SearchDocumentResult;
    };
  }
}

function numberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function formatBackfillError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
