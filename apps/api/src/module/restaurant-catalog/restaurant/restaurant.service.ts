import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  RestaurantRepository,
  type PaginatedResult,
} from './restaurant.repository';
import { CreateRestaurantDto, UpdateRestaurantDto } from './dto/restaurant.dto';
import type { Restaurant } from '@/module/restaurant-catalog/restaurant/restaurant.schema';
import { RestaurantUpdatedEvent } from '@/shared/events/restaurant-updated.event';
import { ImageService } from '@/module/image/image.service';
import type { CreateImageDto } from '@/module/image/dto/image.dto';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import * as schema from '@/drizzle/schema';

// ---------------------------------------------------------------------------
// Pagination constants — enforced in all list/search endpoints (Issue #5)
// ---------------------------------------------------------------------------
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class RestaurantService {
  constructor(
    private readonly repo: RestaurantRepository,
    private readonly eventBus: EventBus,
    private readonly imageService: ImageService,
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

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
    const restaurant = await this.repo.create(ownerId, dto);
    this.publishRestaurantEvent(restaurant);
    return restaurant;
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
    const updated = await this.repo.update(id, dto);
    // Defensive guard: repo.update() returns undefined if the row was deleted
    // between the findOne() check above and this write (rare race condition).
    if (!updated) throw new NotFoundException(`Restaurant ${id} not found`);
    this.publishRestaurantEvent(updated);
    return updated;
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
    await this.repo.remove(id);
    // Invalidate the Ordering BC snapshot by publishing with isOpen/isApproved=false.
    // Without this event the snapshot row persists with the old values indefinitely.
    this.eventBus.publish(
      new RestaurantUpdatedEvent(
        restaurant.id,
        restaurant.name,
        false, // isOpen — treat as closed after deletion
        false, // isApproved — treat as not approved after deletion
        restaurant.address,
        restaurant.ownerId,
        restaurant.latitude ?? null,
        restaurant.longitude ?? null,
        restaurant.cuisineType ?? null,
      ),
    );
  }

  async setApproved(id: string, isApproved: boolean): Promise<Restaurant> {
    const updated = await this.repo.update(id, { isApproved });
    if (!updated) {
      throw new NotFoundException(`Restaurant ${id} not found`);
    }
    // When approving, promote the owner's role to 'restaurant' so they gain
    // access to restaurant-scoped features immediately without re-logging in.
    // IMPORTANT: only promote 'user' → 'restaurant'. Admins must not be demoted
    // (admins can own restaurants), and existing 'restaurant' owners stay put.
    if (isApproved) {
      await this.db
        .update(schema.user)
        .set({ role: 'restaurant' })
        .where(
          and(eq(schema.user.id, updated.ownerId), eq(schema.user.role, 'user')),
        );
    }
    this.publishRestaurantEvent(updated);
    return updated;
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

  /**
   * Publishes a RestaurantUpdatedEvent using the current DB state of the restaurant.
   * Centralising this here ensures the event is always emitted after any mutation
   * that changes the restaurant's observable state (create, update, approve, etc.).
   */
  private publishRestaurantEvent(restaurant: Restaurant): void {
    this.eventBus.publish(
      new RestaurantUpdatedEvent(
        restaurant.id,
        restaurant.name,
        restaurant.isOpen ?? false,
        restaurant.isApproved ?? false,
        restaurant.address,
        restaurant.ownerId,
        restaurant.latitude ?? null,
        restaurant.longitude ?? null,
        restaurant.cuisineType ?? null,
      ),
    );
  }

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
    const updated = await this.repo.update(id, {
      [targetField]: dto.secureUrl,
    } satisfies UpdateRestaurantDto);
    if (!updated) throw new NotFoundException(`Restaurant ${id} not found`);
    this.publishRestaurantEvent(updated);
    return updated;
  }
}
