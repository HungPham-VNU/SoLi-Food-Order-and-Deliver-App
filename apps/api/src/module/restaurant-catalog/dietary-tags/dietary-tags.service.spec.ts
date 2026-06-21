import { ConflictException, NotFoundException } from '@nestjs/common';
import type { DietaryTag } from './domain/dietary-tag.schema';
import { DietaryTagsRepository } from './dietary-tags.repository';
import { DietaryTagsService } from './dietary-tags.service';

const tag: DietaryTag = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Vegan',
  slug: 'vegan',
  description: null,
  category: 'dietary',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('DietaryTagsService', () => {
  let repository: jest.Mocked<DietaryTagsRepository>;
  let service: DietaryTagsService;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findActive: jest.fn(),
      findById: jest.fn(),
      findConflict: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<DietaryTagsRepository>;
    service = new DietaryTagsService(repository);
  });

  it('lists active tags by category', async () => {
    repository.findActive.mockResolvedValue([tag]);

    await expect(service.listActive('dietary')).resolves.toEqual([tag]);
    expect(repository.findActive).toHaveBeenCalledWith('dietary');
  });

  it('creates an active tag and normalizes an empty description', async () => {
    repository.findConflict.mockResolvedValue(null);
    repository.create.mockResolvedValue(tag);

    await expect(
      service.create({
        name: 'Vegan',
        slug: 'vegan',
        description: '',
        category: 'dietary',
      }),
    ).resolves.toEqual(tag);
    expect(repository.create).toHaveBeenCalledWith({
      name: 'Vegan',
      slug: 'vegan',
      description: null,
      category: 'dietary',
      isActive: true,
    });
  });

  it('rejects a duplicate slug', async () => {
    repository.findConflict.mockResolvedValue(tag);

    await expect(
      service.create({
        name: 'Plant Based',
        slug: 'vegan',
        category: 'dietary',
      }),
    ).rejects.toThrow(ConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('updates only supplied fields while checking the final identity', async () => {
    const updated = { ...tag, isActive: false };
    repository.findById.mockResolvedValue(tag);
    repository.findConflict.mockResolvedValue(null);
    repository.update.mockResolvedValue(updated);

    await expect(service.update(tag.id, { isActive: false })).resolves.toEqual(
      updated,
    );
    expect(repository.findConflict).toHaveBeenCalledWith(
      tag.name,
      tag.slug,
      tag.id,
    );
    expect(repository.update).toHaveBeenCalledWith(tag.id, { isActive: false });
  });

  it('rejects updates for a missing tag', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.update(tag.id, { name: 'Updated' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects deletion for a missing tag', async () => {
    repository.delete.mockResolvedValue(null);

    await expect(service.delete(tag.id)).rejects.toThrow(NotFoundException);
  });
});
