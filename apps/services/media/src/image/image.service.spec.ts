import { ImageService } from './image.service';
import type { ImageRepository } from './image.repository';
import type { Image } from './image.schema';

const image: Image = {
  id: '00000000-0000-4000-8000-000000000001',
  publicId: 'menu/example',
  secureUrl: 'https://res.cloudinary.com/demo/image/upload/example.jpg',
  width: 1200,
  height: 800,
  idempotencyKey: 'test-key',
  createdAt: new Date('2026-06-24T12:00:00.000Z'),
};

function createService() {
  const repository = {
    findAll: jest.fn().mockResolvedValue({ data: [image], total: 1 }),
    createIdempotent: jest.fn().mockResolvedValue(image),
  } as unknown as ImageRepository;
  return { service: new ImageService(repository), repository };
}

describe('ImageService', () => {
  it('returns wire-safe ISO timestamps', async () => {
    const { service } = createService();

    await expect(service.findAll({ offset: 0, limit: 20 })).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: image.id,
          createdAt: '2026-06-24T12:00:00.000Z',
        }),
      ],
      total: 1,
    });
  });

  it('passes the idempotency key and metadata to the repository', async () => {
    const { service, repository } = createService();
    const input = {
      idempotencyKey: 'image:test-key',
      image: {
        publicId: image.publicId,
        secureUrl: image.secureUrl,
        width: image.width,
        height: image.height,
      },
    };

    await service.create(input);

    expect(repository.createIdempotent).toHaveBeenCalledWith({
      ...input.image,
      idempotencyKey: input.idempotencyKey,
    });
  });
});
