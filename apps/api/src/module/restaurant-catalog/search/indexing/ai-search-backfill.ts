import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { validate } from '@/config/env.schema';
import { recordAiSearchBackfill } from '@/observability/domain-metrics';
import { AiSearchIndexModule } from './ai-search-index.module';
import { AiSearchEmbeddingService } from './ai-search-embedding.service';
import { AiSearchEmbeddingWorker } from './ai-search-embedding.worker';
import { AiSearchIndexRepository } from './ai-search-index.repository';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    AiSearchIndexModule,
  ],
})
class AiSearchBackfillModule {}

interface BackfillOptions {
  limit?: number;
  maxJobs?: number;
  metadataOnly: boolean;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(
    AiSearchBackfillModule,
    {
      logger: ['log', 'warn', 'error'],
    },
  );

  try {
    const repo = app.get(AiSearchIndexRepository, { strict: false });
    const embeddings = app.get(AiSearchEmbeddingService, { strict: false });
    const worker = app.get(AiSearchEmbeddingWorker, { strict: false });

    console.log('[ai-search-backfill] refreshing search documents');
    const metadata = await repo.backfillSearchMetadata(options.limit);
    recordAiSearchBackfill({ status: 'queued', count: metadata.queued });
    recordAiSearchBackfill({ status: 'skipped', count: metadata.skipped });
    recordAiSearchBackfill({ status: 'failed', count: metadata.failed });
    console.log(
      `[ai-search-backfill] documents scanned=${metadata.scanned} queued=${metadata.queued} skipped=${metadata.skipped} failed=${metadata.failed}`,
    );
    for (const failure of metadata.failures.slice(0, 20)) {
      console.warn(`[ai-search-backfill] ${failure}`);
    }
    if (metadata.failures.length > 20) {
      console.warn(
        `[ai-search-backfill] ${metadata.failures.length - 20} additional document failure(s) omitted`,
      );
    }

    if (options.metadataOnly) return;

    const processed = await drainEmbeddingJobs(
      repo,
      worker,
      embeddings,
      options.maxJobs,
    );
    console.log(`[ai-search-backfill] embedding jobs processed=${processed}`);
  } finally {
    await app.close();
  }
}

async function drainEmbeddingJobs(
  repo: AiSearchIndexRepository,
  worker: AiSearchEmbeddingWorker,
  embeddings: AiSearchEmbeddingService,
  maxJobs = Number.POSITIVE_INFINITY,
): Promise<number> {
  const config = embeddings.getConfig();
  const delayMs = Math.ceil(60_000 / config.rateLimitPerMinute);
  let processed = 0;

  while (processed < maxJobs) {
    const remaining = maxJobs - processed;
    const jobs = await repo.lockPendingEmbeddingJobs(
      Math.min(config.batchSize, remaining),
    );
    if (jobs.length === 0) break;

    console.log(
      `[ai-search-backfill] locked ${jobs.length} embedding job(s); processed=${processed}`,
    );
    for (const job of jobs) {
      await worker.processJob(job);
      processed++;
      if (delayMs > 0 && processed < maxJobs) {
        await sleep(delayMs);
      }
    }
  }

  return processed;
}

function parseOptions(args: string[]): BackfillOptions {
  return {
    limit: readPositiveIntArg(args, 'limit'),
    maxJobs: readPositiveIntArg(args, 'max-jobs'),
    metadataOnly: args.includes('--metadata-only'),
  };
}

function readPositiveIntArg(args: string[], name: string): number | undefined {
  const prefix = `--${name}=`;
  const raw = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(
    `[ai-search-backfill] failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
