import type { INestApplication } from '@nestjs/common';
import { REVIEW_RPC_PATTERNS } from '@uitfood/contracts';
import request from 'supertest';
import type { AuthenticatedGatewaySession } from '../src/identity/identity.interfaces';
import type { ReviewRpcGateway } from '../src/review/review.interfaces';
import { createGatewayApp } from '../src/gateway.factory';

describe('Gateway Review route cutover', () => {
  let app: INestApplication;
  let client: ReturnType<typeof request>;
  let gatewaySession: AuthenticatedGatewaySession | null;

  const reviewResponse = {
    id: '00000000-0000-4000-8000-000000000001',
    orderId: '00000000-0000-4000-8000-000000000002',
    customerId: '00000000-0000-4000-8000-000000000003',
    restaurantId: '00000000-0000-4000-8000-000000000004',
    stars: 5,
    comment: 'Excellent',
    tags: ['fresh_food'],
    moderationStatus: 'visible',
    createdAt: '2026-06-21T00:00:00.000Z',
  };

  const reviewClient: ReviewRpcGateway = {
    send: jest.fn(async (pattern) =>
      pattern === REVIEW_RPC_PATTERNS.listRestaurantReviews
        ? {
            data: [
              {
                id: reviewResponse.id,
                stars: reviewResponse.stars,
                comment: reviewResponse.comment,
                tags: reviewResponse.tags,
                createdAt: reviewResponse.createdAt,
              },
            ],
            total: 1,
            page: 1,
            limit: 20,
          }
        : { ...reviewResponse, message: 'Thank you for your review.' },
    ),
  };

  beforeAll(async () => {
    gatewaySession = {
      userId: reviewResponse.customerId,
      roles: ['user'],
      email: 'customer@example.test',
      sessionId: 'session-1',
    };
    const built = await createGatewayApp({
      proxyTimeoutMs: 5000,
      reviewRoutesEnabled: true,
      reviewClient,
      reviewSessionAuthenticator: {
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
    gatewaySession = {
      userId: reviewResponse.customerId,
      roles: ['user'],
      email: 'customer@example.test',
      sessionId: 'session-1',
    };
  });

  it('GW-REVIEW-01 serves restaurant review reads through Review RPC', async () => {
    const response = await client.get(
      `/api/reviews/restaurant/${reviewResponse.restaurantId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(reviewClient.send).toHaveBeenCalledWith(
      REVIEW_RPC_PATTERNS.listRestaurantReviews,
      {
        restaurantId: reviewResponse.restaurantId,
        page: 1,
        limit: 20,
      },
    );
  });

  it('GW-REVIEW-02 requires a session for review submission', async () => {
    gatewaySession = null;

    const response = await client.post('/api/reviews').send({
      orderId: reviewResponse.orderId,
      stars: 5,
      comment: 'Excellent',
      tags: ['fresh_food'],
    });

    expect(response.status).toBe(401);
    expect(reviewClient.send).not.toHaveBeenCalled();
  });

  it('GW-REVIEW-03 submits reviews with an internal Review token', async () => {
    const response = await client.post('/api/reviews').send({
      orderId: reviewResponse.orderId,
      stars: 5,
      comment: 'Excellent',
      tags: ['fresh_food'],
    });

    expect(response.status).toBe(201);
    expect(reviewClient.send).toHaveBeenCalledWith(
      REVIEW_RPC_PATTERNS.submitReview,
      expect.objectContaining({
        internalAuth: expect.any(String),
        orderId: reviewResponse.orderId,
        stars: 5,
        comment: 'Excellent',
        tags: ['fresh_food'],
      }),
    );
  });

  it('GW-REVIEW-05 handles browser CORS preflight locally', async () => {
    const response = await client
      .options('/api/reviews')
      .set('origin', 'http://localhost:5173')
      .set('access-control-request-method', 'POST');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});
