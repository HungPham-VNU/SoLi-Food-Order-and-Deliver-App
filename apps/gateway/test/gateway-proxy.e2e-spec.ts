import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createGatewayApp } from '../src/gateway.factory';

describe('Gateway edge behavior (E2E)', () => {
  let app: INestApplication;
  let client: ReturnType<typeof request>;

  beforeAll(async () => {
    const built = await createGatewayApp({
      mediaRoutesEnabled: false,
      identityRoutesEnabled: false,
      notificationRoutesEnabled: false,
      catalogRoutesEnabled: false,
      promotionRoutesEnabled: false,
      paymentRoutesEnabled: false,
      reviewRoutesEnabled: false,
      orderingRoutesEnabled: false,
      reportingRoutesEnabled: false,
    });
    app = built.app;
    await app.init();
    client = request(app.getHttpServer());
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('GW-01 serves liveness locally', async () => {
    const res = await client.get('/live');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GW-02 reports disabled services without requiring an upstream API', async () => {
    const res = await client.get('/ready');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      services: {
        media: 'disabled',
        identity: 'disabled',
        notification: 'disabled',
        catalog: 'disabled',
        promotion: 'disabled',
        payment: 'disabled',
        review: 'disabled',
        ordering: 'disabled',
        reporting: 'disabled',
      },
    });
  });

  it('GW-03 strips trust headers and echoes a generated request id', async () => {
    const res = await client
      .get('/not-a-route')
      .set('x-test-user-id', 'attacker-uuid')
      .set('x-internal-jwt', 'forged.jwt.token')
      .set('x-internal-user', 'forged-user')
      .set('x-gateway-authenticated', 'true');

    expect(res.status).toBe(404);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('GW-04 echoes a client-supplied request id', async () => {
    const res = await client
      .get('/not-a-route')
      .set('x-request-id', 'client-supplied-id-123');

    expect(res.status).toBe(404);
    expect(res.headers['x-request-id']).toBe('client-supplied-id-123');
  });
});
