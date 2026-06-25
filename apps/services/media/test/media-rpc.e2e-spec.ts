import 'reflect-metadata';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import {
  ClientProxyFactory,
  type ClientProxy,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Pool } from 'pg';
import {
  MEDIA_RPC_PATTERNS,
  signInternalJwt,
  type ImageRecord,
  type ListImagesResponse,
  type UploadSignatureResponse,
} from '@uitfood/contracts';
import { AppModule } from '../src/app.module';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not allocate a TCP port'));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

describe('Media TCP RPC', () => {
  let service: Awaited<ReturnType<typeof NestFactory.createMicroservice>>;
  let client: ClientProxy;
  let pool: Pool;
  const createdIds: string[] = [];
  const internalAuth = () =>
    signInternalJwt({
      issuer: 'uitfood-gateway',
      subject: 'user:e2e',
      audience: 'media',
      roles: ['admin'],
      secret: process.env.INTERNAL_AUTH_JWT_SECRET!,
      correlationId: randomUUID(),
      ttlSeconds: 60,
    });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    process.env.INTERNAL_AUTH_JWT_SECRET =
      'internal_auth_secret_for_local_dev_only_32_chars';
    const port = await freePort();

    service = await NestFactory.createMicroservice(AppModule, {
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port },
    });
    await service.listen();

    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port },
    });
    await client.connect();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }, 30_000);

  afterAll(async () => {
    if (createdIds.length > 0) {
      await pool.query('delete from images where id = any($1::uuid[])', [
        createdIds,
      ]);
    }
    await pool.end();
    await client.close();
    await service.close();
  });

  it('creates once when an idempotent request is retried', async () => {
    const suffix = randomUUID();
    const request = {
      internalAuth: internalAuth(),
      idempotencyKey: `e2e:${suffix}`,
      image: {
        publicId: `e2e/${suffix}`,
        secureUrl: `https://res.cloudinary.com/demo/image/upload/${suffix}.jpg`,
        width: 800,
        height: 600,
      },
    };

    const first = await firstValueFrom<ImageRecord>(
      client.send(MEDIA_RPC_PATTERNS.createImage, request),
    );
    const replay = await firstValueFrom<ImageRecord>(
      client.send(MEDIA_RPC_PATTERNS.createImage, request),
    );
    createdIds.push(first.id);

    expect(replay.id).toBe(first.id);
    expect(first.createdAt).toMatch(/Z$/);
  });

  it('lists images and creates a Cloudinary signature', async () => {
    const list = await firstValueFrom<ListImagesResponse>(
      client.send(MEDIA_RPC_PATTERNS.listImages, { offset: 0, limit: 20 }),
    );
    const signature = await firstValueFrom<UploadSignatureResponse>(
      client.send(MEDIA_RPC_PATTERNS.createUploadSignature, {
        internalAuth: internalAuth(),
        folder: 'e2e-images',
      }),
    );

    expect(list.total).toBeGreaterThanOrEqual(1);
    expect(signature).toEqual(
      expect.objectContaining({
        cloudName: 'test-cloud',
        apiKey: 'test-key',
        folder: 'e2e-images',
      }),
    );
  });
});
