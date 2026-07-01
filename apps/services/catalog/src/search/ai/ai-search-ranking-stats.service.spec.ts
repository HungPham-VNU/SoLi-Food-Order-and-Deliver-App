import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AiSearchRankingStatsService } from './ai-search-ranking-stats.service';

describe('AiSearchRankingStatsService', () => {
  it('refreshes ranking stats from local delivered-order snapshots', async () => {
    const execute = jest.fn(() => Promise.resolve());
    const db = {
      transaction: jest.fn(async (callback: (tx: unknown) => Promise<void>) =>
        callback({ execute }),
      ),
    };
    const service = new AiSearchRankingStatsService(
      db as unknown as NodePgDatabase<Record<string, never>>,
    );
    const now = new Date('2026-06-19T00:00:00.000Z');

    const result = await service.refresh(now);

    expect(result.refreshedAt).toBe(now);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(4);

    const serializedQueries = execute.mock.calls
      .map(([query]) => JSON.stringify(query))
      .join('\n');
    expect(serializedQueries).toContain('delivered_order_snapshots');
    expect(serializedQueries).toContain('delivered_order_item_snapshots');
    // No cross-DB references to ordering tables
    expect(serializedQueries).not.toContain('FROM orders');
    expect(serializedQueries).not.toContain('"user"');
  });
});
