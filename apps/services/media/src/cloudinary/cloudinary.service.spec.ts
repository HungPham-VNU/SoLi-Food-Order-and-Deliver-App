import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { CloudinaryService } from './cloudinary.service';

describe('CloudinaryService', () => {
  const client = {
    utils: { api_sign_request: jest.fn().mockReturnValue('signed') },
  };
  const values: Record<string, string> = {
    CLOUDINARY_CLOUD_NAME: 'demo',
    CLOUDINARY_API_KEY: 'key',
    CLOUDINARY_API_SECRET: 'secret',
  };
  const config = {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;

  beforeEach(() => jest.clearAllMocks());

  it('signs the normalized folder without exposing the secret', () => {
    const service = new CloudinaryService(client as never, config as never);

    const result = service.getUploadSignature('menu-items');

    expect(result).toEqual(
      expect.objectContaining({
        cloudName: 'demo',
        apiKey: 'key',
        folder: 'menu-items',
        signature: 'signed',
      }),
    );
    expect(client.utils.api_sign_request).toHaveBeenCalledWith(
      expect.objectContaining({ folder: 'menu-items' }),
      'secret',
    );
    expect(result).not.toHaveProperty('apiSecret');
  });

  it.each(['/absolute', '../escape', 'bad folder'])(
    'rejects unsafe folder %s',
    (folder) => {
      const service = new CloudinaryService(client as never, config as never);
      expect(() => service.getUploadSignature(folder)).toThrow(
        BadRequestException,
      );
    },
  );
});
