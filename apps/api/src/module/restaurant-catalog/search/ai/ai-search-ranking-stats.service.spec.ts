import { AiSearchRankingStatsService } from './ai-search-ranking-stats.service';

describe('AiSearchRankingStatsService', () => {
  it('refreshes ranking stats from delivered non-test orders only', async () => {
    const execute = jest.fn(async () => undefined);
    const db = {
      transaction: jest.fn(async (callback: (tx: unknown) => Promise<void>) =>
        callback({ execute }),
      ),
    };
    const service = new AiSearchRankingStatsService(db as any);
    const now = new Date('2026-06-19T00:00:00.000Z');

    const result = await service.refresh(now);

    expect(result.refreshedAt).toBe(now);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(4);

    const serializedQueries = execute.mock.calls
      .map(([query]) => JSON.stringify(query))
      .join('\n');
    expect(serializedQueries).toContain("o.status = 'delivered'");
    expect(serializedQueries).toContain('%@test.com');
    expect(serializedQueries).toContain('%@test.soli');
    expect(serializedQueries).toContain('%@demo.com');
  });
});
