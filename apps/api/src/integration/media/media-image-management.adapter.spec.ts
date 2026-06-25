import { of, throwError } from 'rxjs';
import type { ClientProxy } from '@nestjs/microservices';
import type { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { MediaImageManagementAdapter } from './media-image-management.adapter';

const image = {
  id: '00000000-0000-4000-8000-000000000001',
  publicId: 'menu/example',
  secureUrl: 'https://res.cloudinary.com/demo/image/upload/example.jpg',
  width: 800,
  height: 600,
  createdAt: '2026-06-24T12:00:00.000Z',
};

function buildAdapter() {
  const client = {
    connect: jest.fn(),
    close: jest.fn(),
    send: jest.fn().mockReturnValue(of(image)),
  } as unknown as ClientProxy;
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'MEDIA_RPC_REQUIRED') return false;
      if (key === 'MEDIA_RPC_MAX_ATTEMPTS') return 2;
      if (key === 'MEDIA_RPC_TIMEOUT_MS') return 100;
      if (key === 'INTERNAL_AUTH_JWT_ISSUER') return 'uitfood-api';
      if (key === 'INTERNAL_AUTH_JWT_SECRET') {
        return 'internal_auth_secret_for_local_dev_only_32_chars';
      }
      if (key === 'INTERNAL_AUTH_JWT_TTL_SECONDS') return 60;
      return undefined;
    }),
  } as unknown as ConfigService;
  return {
    adapter: new MediaImageManagementAdapter(client, config as never),
    client,
  };
}

describe('MediaImageManagementAdapter', () => {
  it('uses a stable image idempotency key', async () => {
    const { adapter, client } = buildAdapter();

    await adapter.create(image);

    expect(client.send).toHaveBeenCalledWith(
      'media.image.create.v1',
      expect.objectContaining({
        internalAuth: expect.any(String),
        idempotencyKey: `image:${createHash('sha256')
          .update(image.publicId)
          .digest('hex')}`,
        image: expect.objectContaining({ publicId: image.publicId }),
      }),
    );
  });

  it('does not retry a typed client error', async () => {
    const { adapter, client } = buildAdapter();
    (client.send as jest.Mock).mockReturnValue(
      throwError(() => ({
        statusCode: 409,
        code: 'MEDIA_CONFLICT',
        message: 'Idempotency conflict.',
      })),
    );

    await expect(adapter.create(image)).rejects.toMatchObject({ status: 409 });
    expect(client.send).toHaveBeenCalledTimes(1);
  });

  it('bounds retries and returns a service-unavailable error', async () => {
    const { adapter, client } = buildAdapter();
    (client.send as jest.Mock).mockReturnValue(
      throwError(() => new Error('connection reset')),
    );

    await expect(adapter.create(image)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(client.send).toHaveBeenCalledTimes(2);
  });
});
