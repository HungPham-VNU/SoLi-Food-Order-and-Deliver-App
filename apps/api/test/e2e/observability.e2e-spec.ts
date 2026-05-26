import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, teardownTestApp } from '../setup/app-factory';

describe('Observability E2E', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await teardownTestApp(app);
  });

  it('GET /api/live returns liveness and request id header', async () => {
    const res = await http.get('/api/live').set('x-request-id', 'e2e-live');

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe('e2e-live');
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('GET /api/ready checks dependencies', async () => {
    const res = await http.get('/api/ready');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      checks: { redis: 'PONG', postgres: 'ok' },
    });
  });

  it('GET /api/health remains a readiness alias', async () => {
    const res = await http.get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      checks: { redis: 'PONG', postgres: 'ok' },
    });
  });

  it('CORS preflight allows observability headers', async () => {
    const res = await http
      .options('/api/live')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .set(
        'Access-Control-Request-Headers',
        'x-request-id,traceparent,tracestate,sentry-trace,baggage',
      );

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-headers']).toContain(
      'x-request-id',
    );
    expect(res.headers['access-control-expose-headers']).toContain(
      'traceparent',
    );
  });
});
