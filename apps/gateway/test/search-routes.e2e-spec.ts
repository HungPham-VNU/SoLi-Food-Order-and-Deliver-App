import type { INestApplication } from '@nestjs/common';
import { CATALOG_RPC_PATTERNS } from '@uitfood/contracts';
import request from 'supertest';
import type { CatalogRpcGateway } from '../src/catalog/catalog.interfaces';
import { createGatewayApp } from '../src/gateway.factory';

describe('Gateway Search Routes (E2E)', () => {
  let app: INestApplication;
  let client: ReturnType<typeof request>;

  const searchResponse = {
    restaurants: [{ id: 'rest-1', name: 'Test Restaurant' }],
    items: [{ id: 'item-1', name: 'Test Item' }],
    total: { restaurants: 1, items: 1 },
  };

  const catalogClient: CatalogRpcGateway = {
    send: jest.fn().mockResolvedValue(searchResponse),
  };

  beforeAll(async () => {
    const built = await createGatewayApp({
      proxyTimeoutMs: 5000,
      catalogRoutesEnabled: true,
      catalogClient,
    });
    app = built.app;
    await app.init();
    client = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it('GW-SEARCH-01 forwards search query to Catalog RPC', async () => {
    const response = await client.get('/api/search').query({
      q: 'burger',
      category: 'fast-food',
      lat: '10.7',
      lon: '106.6',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(searchResponse);
    expect(catalogClient.send).toHaveBeenCalledWith(
      CATALOG_RPC_PATTERNS.search,
      expect.objectContaining({
        q: 'burger',
        category: 'fast-food',
        lat: 10.7,
        lon: 106.6,
      }),
    );
  });
});
