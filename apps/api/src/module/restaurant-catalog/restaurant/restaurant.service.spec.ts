/**
 * restaurant.service.spec.ts
 *
 * Unit tests for RestaurantService — UC-27 admin approval workflow,
 * pagination clamping, ownership checks, and event publication.
 *
 * Covers:
 *  - findAll caps limit at MAX_PAGE_SIZE and forces approvedOnly:true
 *  - findAllAdmin uses approvedOnly:false
 *  - findOne throws NotFoundException for missing restaurant
 *  - create publishes RestaurantUpdatedEvent
 *  - update enforces ownership (non-admin non-owner → Forbidden)
 *  - update returning undefined → NotFoundException
 *  - remove publishes RestaurantUpdatedEvent with isOpen=false, isApproved=false
 *  - setApproved publishes event AND promotes owner role 'user' → 'restaurant' when approving
 *  - setApproved with isApproved=false does NOT touch user role
 *  - assertOpenAndApproved throws when not approved / not open
 */
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RestaurantService } from './restaurant.service';
import { RestaurantUpdatedEvent } from '@/shared/events/restaurant-updated.event';
import type { Restaurant } from './restaurant.schema';
import { RestaurantRepository } from './restaurant.repository';
import { EventBus } from '@nestjs/cqrs';
import type { CreateRestaurantDto } from './dto/restaurant.dto';

function makeRestaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: 'rest-1',
    ownerId: 'owner-1',
    name: 'Sunset Bistro',
    address: '123 Main',
    isOpen: true,
    isApproved: true,
    latitude: 10.7,
    longitude: 106.6,
    cuisineType: 'Vietnamese',
    ...overrides,
  } as unknown as Restaurant;
}

function buildService(opts?: {
  repoOverrides?: Partial<{
    findAll: jest.Mock;
    findById: jest.Mock;
    findByOwner: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    incrementRating: jest.Mock;
  }>;
}) {
  const repo = {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByOwner: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    incrementRating: jest.fn(),
    ...opts?.repoOverrides,
  };
  const eventBus = { publish: jest.fn() };
  const imageService = { create: jest.fn().mockResolvedValue(undefined) };
  const userDirectory = {
    promoteToRestaurant: jest.fn().mockResolvedValue(undefined),
  };
  const service = new RestaurantService(
    repo as unknown as RestaurantRepository,
    eventBus as unknown as EventBus,
    imageService,
    userDirectory,
  );
  return { service, repo, eventBus, imageService, userDirectory };
}

describe('RestaurantService', () => {
  describe('pagination', () => {
    it('findAll forces approvedOnly:true and uses default page size', async () => {
      const { service, repo } = buildService();
      repo.findAll.mockResolvedValue({ data: [], total: 0 });
      await service.findAll();
      expect(repo.findAll).toHaveBeenCalledWith({
        offset: undefined,
        limit: 20,
        approvedOnly: true,
      });
    });

    it('findAll clamps limit to MAX_PAGE_SIZE (100)', async () => {
      const { service, repo } = buildService();
      repo.findAll.mockResolvedValue({ data: [], total: 0 });
      await service.findAll(0, 9999);
      expect(repo.findAll).toHaveBeenCalledWith({
        offset: 0,
        limit: 100,
        approvedOnly: true,
      });
    });

    it('findAllAdmin uses approvedOnly:false', async () => {
      const { service, repo } = buildService();
      repo.findAll.mockResolvedValue({ data: [], total: 0 });
      await service.findAllAdmin(0, 50);
      expect(repo.findAll).toHaveBeenCalledWith({
        offset: 0,
        limit: 50,
        approvedOnly: false,
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when missing', async () => {
      const { service, repo } = buildService();
      repo.findById.mockResolvedValue(null);
      await expect(service.findOne('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the restaurant when found', async () => {
      const { service, repo } = buildService();
      const r = makeRestaurant();
      repo.findById.mockResolvedValue(r);
      expect(await service.findOne('rest-1')).toBe(r);
    });
  });

  describe('create', () => {
    it('publishes RestaurantUpdatedEvent', async () => {
      const { service, repo, eventBus } = buildService();
      const r = makeRestaurant();
      repo.create.mockResolvedValue(r);
      await service.create('owner-1', {} as unknown as CreateRestaurantDto);
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      expect(
        (eventBus.publish.mock.calls[0] as [RestaurantUpdatedEvent])[0],
      ).toBeInstanceOf(RestaurantUpdatedEvent);
    });
  });

  describe('update', () => {
    it('throws Forbidden when non-admin and not owner', async () => {
      const { service, repo } = buildService();
      repo.findById.mockResolvedValue(makeRestaurant({ ownerId: 'owner-1' }));
      await expect(
        service.update('rest-1', 'someone-else', false, {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows admin to update any restaurant', async () => {
      const { service, repo } = buildService();
      const r = makeRestaurant();
      repo.findById.mockResolvedValue(r);
      repo.update.mockResolvedValue({ ...r, name: 'New' });
      const result = await service.update('rest-1', 'admin-x', true, {
        name: 'New',
      });
      expect(result.name).toBe('New');
    });

    it('throws NotFoundException when repo.update returns undefined (race)', async () => {
      const { service, repo } = buildService();
      repo.findById.mockResolvedValue(makeRestaurant());
      repo.update.mockResolvedValue(undefined);
      await expect(
        service.update('rest-1', 'owner-1', false, {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('publishes event with isOpen=false and isApproved=false', async () => {
      const { service, repo, eventBus } = buildService();
      repo.findById.mockResolvedValue(makeRestaurant());
      repo.remove.mockResolvedValue(undefined);
      await service.remove('rest-1');
      const event = (
        eventBus.publish.mock.calls[0] as [RestaurantUpdatedEvent]
      )[0];
      expect(event.isOpen).toBe(false);
      expect(event.isApproved).toBe(false);
    });
  });

  describe('setApproved', () => {
    it('throws NotFoundException when repo returns undefined', async () => {
      const { service, repo } = buildService();
      repo.update.mockResolvedValue(undefined);
      await expect(service.setApproved('rest-1', true)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('promotes owner role user→restaurant when isApproved=true', async () => {
      const { service, repo, userDirectory } = buildService();
      repo.update.mockResolvedValue(makeRestaurant({ ownerId: 'owner-1' }));
      await service.setApproved('rest-1', true);
      expect(userDirectory.promoteToRestaurant).toHaveBeenCalledWith('owner-1');
    });

    it('does NOT touch user role when isApproved=false', async () => {
      const { service, repo, userDirectory } = buildService();
      repo.update.mockResolvedValue(makeRestaurant());
      await service.setApproved('rest-1', false);
      expect(userDirectory.promoteToRestaurant).not.toHaveBeenCalled();
    });

    it('publishes RestaurantUpdatedEvent', async () => {
      const { service, repo, eventBus } = buildService();
      repo.update.mockResolvedValue(makeRestaurant());
      await service.setApproved('rest-1', true);
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('assertOpenAndApproved', () => {
    it('throws Conflict when not approved', async () => {
      const { service, repo } = buildService();
      repo.findById.mockResolvedValue(makeRestaurant({ isApproved: false }));
      await expect(
        service.assertOpenAndApproved('rest-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws Conflict when not open', async () => {
      const { service, repo } = buildService();
      repo.findById.mockResolvedValue(
        makeRestaurant({ isApproved: true, isOpen: false }),
      );
      await expect(
        service.assertOpenAndApproved('rest-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('returns restaurant when open and approved', async () => {
      const { service, repo } = buildService();
      const r = makeRestaurant();
      repo.findById.mockResolvedValue(r);
      expect(await service.assertOpenAndApproved('rest-1')).toBe(r);
    });
  });
});
