import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const aiSearchEmbeddingTargetTypeEnum = pgEnum(
  'ai_search_embedding_target_type',
  ['menu_item', 'restaurant'],
);

export const aiSearchEmbeddingJobStatusEnum = pgEnum(
  'ai_search_embedding_job_status',
  ['pending', 'processing', 'completed', 'failed'],
);

export const aiSearchEmbeddingJobs = pgTable(
  'ai_search_embedding_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    targetType: aiSearchEmbeddingTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    contentHash: text('content_hash').notNull(),
    status: aiSearchEmbeddingJobStatusEnum('status')
      .notNull()
      .default('pending'),
    attempts: integer('attempts').notNull().default(0),
    availableAt: timestamp('available_at').defaultNow().notNull(),
    lockedAt: timestamp('locked_at'),
    lastError: text('last_error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('ai_search_embedding_jobs_target_uidx').on(
      table.targetType,
      table.targetId,
    ),
    index('ai_search_embedding_jobs_status_available_idx').on(
      table.status,
      table.availableAt,
    ),
  ],
);

export type AiSearchEmbeddingTargetType =
  (typeof aiSearchEmbeddingTargetTypeEnum.enumValues)[number];
export type AiSearchEmbeddingJobStatus =
  (typeof aiSearchEmbeddingJobStatusEnum.enumValues)[number];
export type AiSearchEmbeddingJob = typeof aiSearchEmbeddingJobs.$inferSelect;
export type NewAiSearchEmbeddingJob = typeof aiSearchEmbeddingJobs.$inferInsert;
