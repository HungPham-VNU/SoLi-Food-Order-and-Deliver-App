import { isHealthPath } from './observability-config';

describe('observability config', () => {
  it.each([
    '/live',
    '/ready',
    '/health',
    '/api/live',
    '/api/ready',
    '/api/health',
  ])('treats %s as a health path', (path) => {
    expect(isHealthPath(path)).toBe(true);
  });

  it('does not treat non-health paths as health paths', () => {
    expect(isHealthPath('/api/orders')).toBe(false);
  });
});
