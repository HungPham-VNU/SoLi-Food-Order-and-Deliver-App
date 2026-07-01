import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  createEnvelope,
  CATALOG_RESTAURANT_CHANGED_V1,
} from '@uitfood/contracts';
import { CATALOG_DATABASE } from '@/drizzle/database.constants';
import { OutboxWriter } from '@/messaging/outbox/outbox.writer';
import {
  RestaurantRepository,
  type PaginatedResult,
} from './restaurant.repository';
import { CreateRestaurantDto, UpdateRestaurantDto } from './dto/restaurant.dto';
import type { Restaurant } from '@/restaurant/restaurant.schema';
import {
  IMAGE_MANAGEMENT_PORT,
  type IImageManagementPort,
} from '@/shared/ports/image-management.port';
import {
  USER_DIRECTORY_PORT,
  type IUserDirectoryPort,
} from '@/shared/ports/user-directory.port';
import type { IRestaurantAccessPort } from '@/shared/ports/restaurant-access.port';
import type { UnitOfWorkContext } from '@/shared/ports/unit-of-work-context';
import type { CreateImageDto } from '@/shared/contracts/image.dto';

// ---------------------------------------------------------------------------
// Pagination constants — enforced in all list/search endpoints (Issue #5)
// ---------------------------------------------------------------------------
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class RestaurantService implements IRestaurantAccessPort {
  constructor(
    private readonly repo: RestaurantRepository,
    @Inject(CATALOG_DATABASE) private readonly db: NodePgDatabase,
    private readonly outbox: OutboxWriter,
    @Inject(IMAGE_MANAGEMENT_PORT)
    private readonly imageService: IImageManagementPort,
    @Inject(USER_DIRECTORY_PORT)
    private readonly userDirectory: IUserDirectoryPort,
  ) {}

  /** Builds the catalog.restaurant.changed.v1 envelope from a restaurant row. */
  private restaurantEnvelope(
    restaurant: Restaurant,
    overrides?: Partial<{ isOpen: boolean; isApproved: boolean }>,
  ) {
    return createEnvelope({
      eventType: CATALOG_RESTAURANT_CHANGED_V1.eventType,
      eventVersion: CATALOG_RESTAURANT_CHANGED_V1.eventVersion,
      aggregateId: restaurant.id,
      aggregateVersion: 0,
      producer: 'catalog',
      payload: {
        restaurantId: restaurant.id,
        name: restaurant.name,
        isOpen: overrides?.isOpen ?? restaurant.isOpen ?? false,
        isApproved: overrides?.isApproved ?? restaurant.isApproved ?? false,
        address: restaurant.address,
        ownerId: restaurant.ownerId,
        latitude: restaurant.latitude ?? null,
        longitude: restaurant.longitude ?? null,
        cuisineType: restaurant.cuisineType ?? null,
      },
    });
  }

  async findAll(
    offset?: number,
    limit?: number,
  ): Promise<PaginatedResult<Restaurant>> {
    const safeLimit = Math.min(limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    // Public listing must only show approved restaurants (Issue #4).
    return this.repo.findAll({ offset, limit: safeLimit, approvedOnly: true });
  }

  async findAllAdmin(
    offset?: number,
    limit?: number,
  ): Promise<PaginatedResult<Restaurant>> {
    const safeLimit = Math.min(limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    // Admin view returns ALL restaurants including unapproved/pending.
    return this.repo.findAll({ offset, limit: safeLimit, approvedOnly: false });
  }

  /**
   * Returns the caller's restaurant regardless of approval status, or null
   * when they haven't submitted one yet. Used by the post-login redirect to
   * decide between the registration page and the pending-approval page.
   */
  async findMine(ownerId: string): Promise<Restaurant | null> {
    return this.repo.findByOwner(ownerId);
  }

  async findOne(id: string): Promise<Restaurant> {
    const restaurant = await this.repo.findById(id);
    if (!restaurant) {
      throw new NotFoundException(`Restaurant ${id} not found`);
    }
    return restaurant;
  }

  async create(ownerId: string, dto: CreateRestaurantDto): Promise<Restaurant> {
    return this.db.transaction(async (tx) => {
      const restaurant = await this.repo.create(ownerId, dto, tx);
      await this.outbox.write(tx, this.restaurantEnvelope(restaurant));
      return restaurant;
    });
  }

  async update(
    id: string,
    requesterId: string,
    isAdmin: boolean,
    dto: UpdateRestaurantDto,
  ): Promise<Restaurant> {
    const restaurant = await this.findOne(id);
    if (!isAdmin && restaurant.ownerId !== requesterId) {
      throw new ForbiddenException('You do not own this restaurant');
    }
    return this.db.transaction(async (tx) => {
      const updated = await this.repo.update(id, dto, tx);
      // Defensive guard: undefined if the row was deleted between findOne() and
      // this write (rare race). Throwing rolls back the (empty) transaction.
      if (!updated) throw new NotFoundException(`Restaurant ${id} not found`);
      await this.outbox.write(tx, this.restaurantEnvelope(updated));
      return updated;
    });
  }

  async updateLogoImage(
    id: string,
    requesterId: string,
    isAdmin: boolean,
    dto: CreateImageDto,
  ): Promise<Restaurant> {
    return this.attachImage(id, requesterId, isAdmin, dto, 'logoUrl');
  }

  async updateCoverImage(
    id: string,
    requesterId: string,
    isAdmin: boolean,
    dto: CreateImageDto,
  ): Promise<Restaurant> {
    return this.attachImage(id, requesterId, isAdmin, dto, 'coverImageUrl');
  }

  async remove(id: string): Promise<void> {
    const restaurant = await this.findOne(id);
    await this.db.transaction(async (tx) => {
      await this.repo.remove(id, tx);
      // Invalidate the Ordering snapshot: publish with isOpen/isApproved=false.
      await this.outbox.write(
        tx,
        this.restaurantEnvelope(restaurant, {
          isOpen: false,
          isApproved: false,
        }),
      );
    });
  }

  async setApproved(id: string, isApproved: boolean): Promise<Restaurant> {
    const updated = await this.db.transaction(async (tx) => {
      const row = await this.repo.update(id, { isApproved }, tx);
      if (!row) throw new NotFoundException(`Restaurant ${id} not found`);
      await this.outbox.write(tx, this.restaurantEnvelope(row));
      return row;
    });
    // When approving, promote the owner's role to 'restaurant' so they gain
    // access to restaurant-scoped features immediately. Done AFTER commit — it
    // is an external identity call, not part of the catalog write.
    if (isApproved) {
      await this.userDirectory.promoteToRestaurant(updated.ownerId);
    }
    return updated;
  }

  async assertOwner(restaurantId: string, userId: string): Promise<void> {
    const restaurant = await this.findOne(restaurantId);
    if (restaurant.ownerId !== userId) {
      throw new ForbiddenException('You do not own this restaurant');
    }
  }

  async incrementRating(
    restaurantId: string,
    stars: number,
    context?: UnitOfWorkContext,
  ): Promise<void> {
    await this.repo.incrementRating(restaurantId, stars, context);
  }
  async assertOpenAndApproved(id: string): Promise<Restaurant> {
    const restaurant = await this.findOne(id);
    if (!restaurant.isApproved) {
      throw new ConflictException('Restaurant is not approved');
    }
    if (!restaurant.isOpen) {
      throw new ConflictException('Restaurant is currently closed');
    }
    return restaurant;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async attachImage(
    id: string,
    requesterId: string,
    isAdmin: boolean,
    dto: CreateImageDto,
    targetField: 'logoUrl' | 'coverImageUrl',
  ): Promise<Restaurant> {
    const restaurant = await this.findOne(id);
    if (!isAdmin && restaurant.ownerId !== requesterId) {
      throw new ForbiddenException('You do not own this restaurant');
    }

    await this.imageService.create(dto);
    return this.db.transaction(async (tx) => {
      const updated = await this.repo.update(
        id,
        { [targetField]: dto.secureUrl } satisfies UpdateRestaurantDto,
        tx,
      );
      if (!updated) throw new NotFoundException(`Restaurant ${id} not found`);
      await this.outbox.write(tx, this.restaurantEnvelope(updated));
      return updated;
    });
  }
}
