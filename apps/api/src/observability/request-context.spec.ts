import { EventEmitter } from 'node:events';
import { trace } from '@opentelemetry/api';
import { requestContextMiddleware, getRequestContext } from './request-context';

describe('requestContextMiddleware', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sets and stores x-request-id', () => {
    const response = new EventEmitter() as EventEmitter & {
      statusCode: number;
      setHeader: jest.Mock;
    };
    response.statusCode = 200;
    response.setHeader = jest.fn();

    const request = {
      method: 'GET',
      path: '/api/test',
      originalUrl: '/api/test',
      url: '/api/test',
      headers: { 'x-request-id': 'req-123' },
    };

    const next = jest.fn(() => {
      expect(getRequestContext()?.requestId).toBe('req-123');
    });

    requestContextMiddleware(request as never, response as never, next);

    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', 'req-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects unsafe x-request-id values', () => {
    const response = new EventEmitter() as EventEmitter & {
      statusCode: number;
      setHeader: jest.Mock;
    };
    response.statusCode = 200;
    response.setHeader = jest.fn();

    const request = {
      method: 'GET',
      path: '/api/test',
      originalUrl: '/api/test',
      url: '/api/test',
      headers: { 'x-request-id': 'req-123\r\nx-bad: injected' },
    };

    requestContextMiddleware(request as never, response as never, jest.fn());

    const setHeaderCalls = response.setHeader.mock.calls as Array<
      [string, string]
    >;
    const requestId = setHeaderCalls[0]?.[1] ?? '';
    expect(requestId).not.toBe('req-123\r\nx-bad: injected');
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('uses the span active during middleware execution for finish logs', () => {
    const spanContext = {
      traceId: '0'.repeat(32),
      spanId: '1'.repeat(16),
      traceFlags: 1,
    };
    const activeSpan = {
      spanContext: () => spanContext,
      setAttributes: jest.fn(),
    };
    const getActiveSpanSpy = jest
      .spyOn(trace, 'getActiveSpan')
      .mockReturnValue(activeSpan as never);
    const logSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    const response = new EventEmitter() as EventEmitter & {
      statusCode: number;
      setHeader: jest.Mock;
    };
    response.statusCode = 200;
    response.setHeader = jest.fn();

    const request = {
      method: 'GET',
      path: '/api/test',
      originalUrl: '/api/test',
      url: '/api/test',
      headers: {},
    };
    const next = jest.fn(() => {
      getActiveSpanSpy.mockReturnValue(undefined);
      response.emit('finish');
    });

    requestContextMiddleware(request as never, response as never, next);

    const record = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      traceId?: string;
      spanId?: string;
    };
    expect(record.traceId).toBe(spanContext.traceId);
    expect(record.spanId).toBe(spanContext.spanId);
  });

  it('logs client errors at warn level', () => {
    const logSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    const response = new EventEmitter() as EventEmitter & {
      statusCode: number;
      setHeader: jest.Mock;
    };
    response.statusCode = 404;
    response.setHeader = jest.fn();

    const request = {
      method: 'GET',
      path: '/api/missing',
      originalUrl: '/api/missing',
      url: '/api/missing',
      headers: {},
    };

    requestContextMiddleware(request as never, response as never, jest.fn());
    response.emit('finish');

    const record = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      level?: string;
    };
    expect(record.level).toBe('warn');
  });

  it('adds monitored route telemetry to request logs', () => {
    const logSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    const response = new EventEmitter() as EventEmitter & {
      statusCode: number;
      setHeader: jest.Mock;
    };
    response.statusCode = 200;
    response.setHeader = jest.fn();

    const request = {
      method: 'GET',
      path: '/api/carts/my/items',
      originalUrl: '/api/carts/my/items',
      url: '/api/carts/my/items',
      headers: {},
    };

    requestContextMiddleware(request as never, response as never, jest.fn());
    response.emit('finish');

    const record = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      routeTemplate?: string;
      routeGroup?: string;
      routeScope?: string;
      monitoredRoute?: boolean;
    };
    expect(record).toMatchObject({
      routeTemplate: '/api/carts/my/items',
      routeGroup: 'carts',
      routeScope: 'my',
      monitoredRoute: true,
    });
  });
});
