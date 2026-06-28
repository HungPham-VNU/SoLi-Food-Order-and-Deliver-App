import { createHash } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { SessionAuthenticator } from '../src/identity/identity.interfaces';
import type { MediaRpcGateway } from '../src/media/media.interfaces';
import { createGatewayApp } from '../src/gateway.factory';

describe('Gateway Media route cutover', () => {
  let app: INestApplication;
  let client: ReturnType<typeof request>;

  const image = {
    id: '00000000-0000-4000-8000-000000000001',
    publicId: 'menu/example',
    secureUrl: 'https://res.cloudinary.com/demo/image/upload/example.jpg',
    width: 800,
    height: 600,
    createdAt: '2026-06-24T12:00:00.000Z',
  };
  const mediaClient: MediaRpcGateway = {
    listImages: jest.fn().mockResolvedValue({ data: [image], total: 1 }),
    createImage: jest.fn().mockResolvedValue(image),
    createUploadSignature: jest.fn().mockResolvedValue({
      cloudName: 'demo',
      apiKey: 'key',
      timestamp: 1715279900,
      signature: 'signed',
      folder: 'menu-items',
    }),
  };
  const sessionAuthenticator: SessionAuthenticator = {
    authenticate: jest.fn(async (req) =>
      req.headers.authorization === 'Bearer valid'
        ? {
            userId: 'user-1',
            roles: ['user'],
            email: 'user@example.test',
            sessionId: 'session-1',
          }
        : null,
    ),
  };

  beforeAll(async () => {
    const built = await createGatewayApp({
      proxyTimeoutMs: 5000,
      mediaRoutesEnabled: true,
      mediaClient,
      sessionAuthenticator,
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

  it('GW-MEDIA-01 serves public image reads through Media RPC', async () => {
    const response = await client.get('/api/images?offset=0&limit=20');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [image], total: 1 });
    expect(mediaClient.listImages).toHaveBeenCalledWith({
      offset: 0,
      limit: 20,
    });
  });

  it('GW-MEDIA-02 preserves authentication on image writes', async () => {
    const unauthorized = await client.post('/api/images').send({
      publicId: image.publicId,
      secureUrl: image.secureUrl,
      width: image.width,
      height: image.height,
    });
    expect(unauthorized.status).toBe(401);

    const authorized = await client
      .post('/api/images')
      .set('authorization', 'Bearer valid')
      .send({
        publicId: image.publicId,
        secureUrl: image.secureUrl,
        width: image.width,
        height: image.height,
      });

    expect(authorized.status).toBe(201);
    expect(mediaClient.createImage).toHaveBeenCalledWith({
      internalAuth: expect.any(String),
      idempotencyKey: `image:${createHash('sha256')
        .update(image.publicId)
        .digest('hex')}`,
      image: expect.objectContaining({ publicId: image.publicId }),
    });
  });

  it('GW-MEDIA-03 routes authenticated signature requests to Media', async () => {
    const response = await client
      .get('/api/cloudinary/signature?folder=menu-items')
      .set('authorization', 'Bearer valid');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({ folder: 'menu-items', signature: 'signed' }),
    );
    expect(mediaClient.createUploadSignature).toHaveBeenCalledWith({
      internalAuth: expect.any(String),
      folder: 'menu-items',
    });
  });

  it('GW-MEDIA-05 handles browser CORS preflight locally', async () => {
    const response = await client
      .options('/api/images')
      .set('origin', 'http://localhost:5173')
      .set('access-control-request-method', 'POST');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});
