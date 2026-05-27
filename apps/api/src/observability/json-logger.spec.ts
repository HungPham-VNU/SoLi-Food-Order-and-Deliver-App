import { JsonLogger } from './json-logger';

interface LogRecord {
  level: string;
  context?: string;
  message: string;
  stack?: string;
  extras?: unknown[];
}

function firstLoggedLine(spy: jest.SpyInstance): string {
  const calls = spy.mock.calls as unknown[][];
  return String(calls[0]?.[0]);
}

describe('JsonLogger', () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('writes structured JSON logs', () => {
    new JsonLogger().log('hello', 'TestContext');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const record = JSON.parse(firstLoggedLine(logSpy)) as LogRecord;
    expect(record).toMatchObject({
      level: 'info',
      context: 'TestContext',
      message: 'hello',
    });
  });

  it('redacts sensitive values before writing', () => {
    new JsonLogger().error('token=secret', 'stack', 'AuthContext');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const record = JSON.parse(firstLoggedLine(errorSpy)) as LogRecord;
    expect(record.message).toBe('token=[REDACTED]');
  });

  it('does not treat plain string params as stack traces', () => {
    new JsonLogger().error('failed', 'plain detail', { attempt: 1 });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const record = JSON.parse(firstLoggedLine(errorSpy)) as LogRecord;
    expect(record.stack).toBeUndefined();
    expect(record.extras).toEqual(['plain detail', { attempt: 1 }]);
  });
});
