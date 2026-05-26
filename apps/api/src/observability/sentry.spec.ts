import * as Sentry from '@sentry/node';
import { closeSentry, initSentry, isSentryEnabled } from './sentry';

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  close: jest.fn().mockResolvedValue(true),
  withScope: jest.fn(),
  captureException: jest.fn(),
  setupExpressErrorHandler: jest.fn(),
}));

describe('Sentry observability lifecycle', () => {
  const originalDsn = process.env.SENTRY_DSN;

  afterEach(async () => {
    if (isSentryEnabled()) {
      await closeSentry();
    }
    if (originalDsn === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = originalDsn;
    }
    jest.clearAllMocks();
  });

  it('allows reinitialization after close', async () => {
    process.env.SENTRY_DSN = 'https://public@example.com/1';

    initSentry();
    expect(isSentryEnabled()).toBe(true);

    await closeSentry();
    expect(Sentry.close).toHaveBeenCalledWith(2000);
    expect(isSentryEnabled()).toBe(false);

    initSentry();
    expect(Sentry.init).toHaveBeenCalledTimes(2);
    expect(isSentryEnabled()).toBe(true);
  });
});
