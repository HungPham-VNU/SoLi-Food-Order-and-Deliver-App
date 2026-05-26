import { EventEmitter } from 'node:events';
import { requestContextMiddleware, getRequestContext } from './request-context';

describe('requestContextMiddleware', () => {
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
});
