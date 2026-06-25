import { Test, TestingModule } from '@nestjs/testing';
import { DeviceTokenCleanupTask } from './device-token-cleanup.task';
import { DeviceTokenRepository } from '../repositories/device-token.repository';

/**
 * DeviceTokenCleanupTask unit tests
 *
 * The cron scheduling itself is not tested here (it is tested by
 * @nestjs/schedule integration tests).  We test the business logic of
 * cleanupStaleTokens() directly:
 *
 *  1.  Both cleanup passes execute and results are aggregated correctly.
 *  2.  Cutoff dates are computed from the static TTL constants.
 *  3.  Pass 1 failure (inactive cleanup) does not abort Pass 2.
 *  4.  Pass 2 failure (active cleanup) is caught, task completes normally.
 *  5.  Both passes fail — task still returns without throwing.
 *  6.  Zero deletions — summary shows 0s.
 *  7.  Cutoff date tolerance — within ±1 s of the expected threshold.
 *
 * Phase: N-5
 */

const MOCK_DEVICE_TOKEN_REPO: jest.Mocked<
  Pick<DeviceTokenRepository, 'deleteStaleInactive' | 'deleteStaleActive'>
> = {
  deleteStaleInactive: jest.fn(),
  deleteStaleActive: jest.fn(),
};

describe('DeviceTokenCleanupTask', () => {
  let task: DeviceTokenCleanupTask;
  let repo: jest.Mocked<
    Pick<DeviceTokenRepository, 'deleteStaleInactive' | 'deleteStaleActive'>
  >;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceTokenCleanupTask,
        {
          provide: DeviceTokenRepository,
          useValue: MOCK_DEVICE_TOKEN_REPO,
        },
      ],
    }).compile();

    task = module.get<DeviceTokenCleanupTask>(DeviceTokenCleanupTask);
    repo = module.get(DeviceTokenRepository);
  });

  // ── Happy-path ───────────────────────────────────────────────────────────────

  it('runs both cleanup passes and returns aggregate counts', async () => {
    repo.deleteStaleInactive.mockResolvedValue(5);
    repo.deleteStaleActive.mockResolvedValue(3);

    const result = await task.cleanupStaleTokens();

    expect(result).toEqual({ deletedInactive: 5, deletedStaleActive: 3 });
    expect(repo.deleteStaleInactive).toHaveBeenCalledTimes(1);
    expect(repo.deleteStaleActive).toHaveBeenCalledTimes(1);
  });

  it('returns zero counts when nothing is deleted', async () => {
    repo.deleteStaleInactive.mockResolvedValue(0);
    repo.deleteStaleActive.mockResolvedValue(0);

    const result = await task.cleanupStaleTokens();

    expect(result).toEqual({ deletedInactive: 0, deletedStaleActive: 0 });
  });

  // ── Cutoff date computation ──────────────────────────────────────────────────

  it('computes inactive cutoff from INACTIVE_TTL_DAYS constant', async () => {
    repo.deleteStaleInactive.mockResolvedValue(0);
    repo.deleteStaleActive.mockResolvedValue(0);

    const beforeCall = Date.now();
    await task.cleanupStaleTokens();
    const afterCall = Date.now();

    const [[inactiveCutoff]] = repo.deleteStaleInactive.mock.calls;
    const expectedMs =
      DeviceTokenCleanupTask.INACTIVE_TTL_DAYS * 24 * 60 * 60 * 1000;

    // The cutoff should be approximately `now - INACTIVE_TTL_DAYS` — allow ±500ms
    const expectedMin = beforeCall - expectedMs - 500;
    const expectedMax = afterCall - expectedMs + 500;

    expect(inactiveCutoff.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(inactiveCutoff.getTime()).toBeLessThanOrEqual(expectedMax);
  });

  it('computes active cutoff from ACTIVE_TTL_DAYS constant', async () => {
    repo.deleteStaleInactive.mockResolvedValue(0);
    repo.deleteStaleActive.mockResolvedValue(0);

    const beforeCall = Date.now();
    await task.cleanupStaleTokens();
    const afterCall = Date.now();

    const [[activeCutoff]] = repo.deleteStaleActive.mock.calls;
    const expectedMs =
      DeviceTokenCleanupTask.ACTIVE_TTL_DAYS * 24 * 60 * 60 * 1000;

    const expectedMin = beforeCall - expectedMs - 500;
    const expectedMax = afterCall - expectedMs + 500;

    expect(activeCutoff.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(activeCutoff.getTime()).toBeLessThanOrEqual(expectedMax);
  });

  // ── Error handling ───────────────────────────────────────────────────────────

  it('continues to Pass 2 even when Pass 1 (inactive cleanup) throws', async () => {
    repo.deleteStaleInactive.mockRejectedValue(new Error('DB connection lost'));
    repo.deleteStaleActive.mockResolvedValue(7);

    const result = await task.cleanupStaleTokens();

    // Pass 1 failed → count stays 0, Pass 2 still runs
    expect(result).toEqual({ deletedInactive: 0, deletedStaleActive: 7 });
    expect(repo.deleteStaleInactive).toHaveBeenCalledTimes(1);
    expect(repo.deleteStaleActive).toHaveBeenCalledTimes(1);
  });

  it('absorbs Pass 2 (active cleanup) failure and returns partial result', async () => {
    repo.deleteStaleInactive.mockResolvedValue(4);
    repo.deleteStaleActive.mockRejectedValue(new Error('Timeout'));

    const result = await task.cleanupStaleTokens();

    expect(result).toEqual({ deletedInactive: 4, deletedStaleActive: 0 });
    expect(repo.deleteStaleInactive).toHaveBeenCalledTimes(1);
    expect(repo.deleteStaleActive).toHaveBeenCalledTimes(1);
  });

  it('does not throw when both passes fail', async () => {
    repo.deleteStaleInactive.mockRejectedValue(new Error('Err1'));
    repo.deleteStaleActive.mockRejectedValue(new Error('Err2'));

    await expect(task.cleanupStaleTokens()).resolves.toEqual({
      deletedInactive: 0,
      deletedStaleActive: 0,
    });
  });

  // ── TTL constants sanity check ───────────────────────────────────────────────

  it('has INACTIVE_TTL_DAYS = 30', () => {
    expect(DeviceTokenCleanupTask.INACTIVE_TTL_DAYS).toBe(30);
  });

  it('has ACTIVE_TTL_DAYS = 90', () => {
    expect(DeviceTokenCleanupTask.ACTIVE_TTL_DAYS).toBe(90);
  });

  it('ACTIVE_TTL_DAYS > INACTIVE_TTL_DAYS (active threshold is more generous)', () => {
    expect(DeviceTokenCleanupTask.ACTIVE_TTL_DAYS).toBeGreaterThan(
      DeviceTokenCleanupTask.INACTIVE_TTL_DAYS,
    );
  });
});
