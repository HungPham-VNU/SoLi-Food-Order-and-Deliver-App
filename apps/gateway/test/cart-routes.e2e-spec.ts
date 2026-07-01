import type { INestApplication } from '@nestjs/common';
import { ORDERING_RPC_PATTERNS } from '@uitfood/contracts';
import request from 'supertest';
import type { OrderingRpcGateway } from '../src/ordering/ordering.interfaces';
import type { AuthenticatedGatewaySession } from '../src/identity/identity.interfaces';
import { createGatewayApp } from '../src/gateway.factory';

describe('Gateway Cart Routes (E2E)', () => {
  let app: INestApplication;
  let client: ReturnType<typeof request>;
  let gatewaySession: AuthenticatedGatewaySession | null;

  const orderingClient: OrderingRpcGateway = {
    send: jest.fn().mockResolvedValue({ status: 'ok' }),
  };

  beforeAll(async () => {
    gatewaySession = {
      userId: 'user-1',
      roles: ['user'],
      email: 'user@example.test',
      sessionId: 'session-1',
    };
    const built = await createGatewayApp({
      proxyTimeoutMs: 5000,
      orderingRoutesEnabled: true,
      orderingClient,
      orderingSessionAuthenticator: {
        authenticate: jest.fn(async () => gatewaySession),
      },
    });
    app = built.app;
    await app.init();
    client = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GW-CART-01 forwards add item to Ordering RPC with internal token', async () => {
    const dto = { menuItemId: 'item-1', quantity: 2 };
    const response = await client.post('/api/carts/my/items').send(dto);

    expect(response.status).toBe(201);
    expect(orderingClient.send).toHaveBeenCalledWith(
      ORDERING_RPC_PATTERNS.addCartItem,
      expect.objectContaining({
        internalAuth: expect.any(String),
        dto,
      }),
    );
  });

  it('GW-CART-02 forwards checkout request to Ordering RPC and captures IP', async () => {
    const dto = { paymentMethodId: 'pm-1' };
    const response = await client
      .post('/api/carts/my/checkout')
      .set('x-idempotency-key', 'idemp-123')
      .set('x-forwarded-for', '192.168.1.1')
      .send(dto);

    expect(response.status).toBe(201);
    expect(orderingClient.send).toHaveBeenCalledWith(
      ORDERING_RPC_PATTERNS.checkout,
      expect.objectContaining({
        internalAuth: expect.any(String),
        dto,
        idempotencyKey: 'idemp-123',
        ipAddr: '192.168.1.1',
      }),
    );
  });
});
