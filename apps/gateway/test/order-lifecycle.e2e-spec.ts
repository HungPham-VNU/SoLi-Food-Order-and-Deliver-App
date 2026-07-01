import type { INestApplication } from '@nestjs/common';
import { ORDERING_RPC_PATTERNS } from '@uitfood/contracts';
import request from 'supertest';
import type { OrderingRpcGateway } from '../src/ordering/ordering.interfaces';
import type { AuthenticatedGatewaySession } from '../src/identity/identity.interfaces';
import { createGatewayApp } from '../src/gateway.factory';

describe('Gateway Order Lifecycle Routes (E2E)', () => {
  let app: INestApplication;
  let client: ReturnType<typeof request>;
  let gatewaySession: AuthenticatedGatewaySession | null;

  const orderingClient: OrderingRpcGateway = {
    send: jest.fn().mockResolvedValue({ success: true }),
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

  it('GW-ORDER-01 forwards patch /confirm to transitionOrder RPC', async () => {
    const response = await client.patch('/api/orders/order-1/confirm');

    expect(response.status).toBe(200);
    expect(orderingClient.send).toHaveBeenCalledWith(
      ORDERING_RPC_PATTERNS.transitionOrder,
      expect.objectContaining({
        internalAuth: expect.any(String),
        orderId: 'order-1',
        toStatus: 'confirmed',
      }),
    );
  });

  it('GW-ORDER-02 forwards post /refund with cancel body to transitionOrder RPC', async () => {
    const response = await client.post('/api/orders/order-2/refund').send({
      reason: 'Customer requested',
      reasonCode: 'CUSTOMER_REQUEST',
    });

    expect(response.status).toBe(200);
    expect(orderingClient.send).toHaveBeenCalledWith(
      ORDERING_RPC_PATTERNS.transitionOrder,
      expect.objectContaining({
        internalAuth: expect.any(String),
        orderId: 'order-2',
        toStatus: 'refunded',
        cancellationReason: 'CUSTOMER_REQUEST',
        note: 'Customer requested',
      }),
    );
  });
});
