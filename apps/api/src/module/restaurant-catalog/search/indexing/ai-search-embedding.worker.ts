import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  recordAiSearchEmbeddingJob,
  recordAiSearchStaleEmbeddings,
} from '@/observability/domain-metrics';
import { AiSearchEmbeddingService } from './ai-search-embedding.service';
import { AiSearchIndexRepository } from './ai-search-index.repository';
import type { AiSearchEmbeddingJob } from './ai-search-embedding-job.schema';

const WORKER_INTERVAL_MS = 10_000;

@Injectable()
export class AiSearchEmbeddingWorker {
  private readonly logger = new Logger(AiSearchEmbeddingWorker.name);
  private isRunning = false;

  constructor(
    @Inject(AiSearchIndexRepository)
    private readonly repo: AiSearchIndexRepository,
    @Inject(AiSearchEmbeddingService)
    private readonly embeddings: AiSearchEmbeddingService,
  ) {}

  @Interval(WORKER_INTERVAL_MS)
  async runOnce(): Promise<void> {
    const config = this.embeddings.getConfig();
    if (!config.workerEnabled || this.isRunning) return;

    this.isRunning = true;
    const startedAt = Date.now();
    try {
      const jobs = await this.repo.lockPendingEmbeddingJobs(config.batchSize);
      const delayMs = Math.ceil(60_000 / config.rateLimitPerMinute);

      for (const job of jobs) {
        await this.processJob(job);
        if (delayMs > 0) await sleep(delayMs);
      }

      const pendingCount = await this.repo.countPendingEmbeddingJobs();
      recordAiSearchStaleEmbeddings(pendingCount);
      if (jobs.length > 0) {
        this.logger.log(
          `Processed ${jobs.length} AI search embedding job(s) in ${
            Date.now() - startedAt
          }ms; pending=${pendingCount}`,
        );
      }
    } finally {
      this.isRunning = false;
    }
  }

  async processJob(job: AiSearchEmbeddingJob): Promise<void> {
    const startedAt = Date.now();
    try {
      const target = await this.repo.findEmbeddingTarget(job);
      if (!target) {
        await this.repo.completeJob(job.id);
        recordAiSearchEmbeddingJob({
          status: 'completed',
          targetType: job.targetType,
          latencyMs: Date.now() - startedAt,
        });
        return;
      }

      if (target.contentHash !== job.contentHash) {
        await this.repo.enqueueEmbeddingJob(
          target.targetType,
          target.targetId,
          target.contentHash,
        );
        await this.repo.completeJob(job.id);
        recordAiSearchEmbeddingJob({
          status: 'stale',
          targetType: job.targetType,
          latencyMs: Date.now() - startedAt,
        });
        return;
      }

      const embedding = await this.embeddings.embedSearchDocument(
        target.searchDocument,
      );
      const stored = await this.repo.storeEmbedding(
        target,
        embedding,
        this.embeddings.getConfig(),
      );

      if (!stored) {
        await this.repo.enqueueEmbeddingJob(
          target.targetType,
          target.targetId,
          target.contentHash,
        );
      }

      await this.repo.completeJob(job.id);
      recordAiSearchEmbeddingJob({
        status: stored ? 'completed' : 'stale',
        targetType: job.targetType,
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      await this.repo.failJob(job, error);
      recordAiSearchEmbeddingJob({
        status: 'failed',
        targetType: job.targetType,
        latencyMs: Date.now() - startedAt,
      });
      this.logger.warn(
        `AI search embedding job failed (${job.targetType}:${job.targetId}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
