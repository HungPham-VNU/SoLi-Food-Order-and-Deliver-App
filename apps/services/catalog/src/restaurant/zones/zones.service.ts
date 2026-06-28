import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  createEnvelope,
  CATALOG_DELIVERY_ZONE_CHANGED_V1,
} from '@uitfood/contracts';
import { CATALOG_DATABASE } from '@/drizzle/database.constants';
import { OutboxWriter } from '@/messaging/outbox/outbox.writer';
import { ZonesRepository } from './zones.repository';
import { RestaurantService } from '../restaurant.service';
import { GeoService, type Coordinates } from '@/lib/geo/geo.service';
import { roundToNearest1000 } from '@/shared/validators/vnd-amount.validator';
import type {
  CreateDeliveryZoneDto,
  UpdateDeliveryZoneDto,
  DeliveryEstimateResponseDto,
  DeliveryFeeBreakdownDto,
} from './zones.dto';
import type { DeliveryZone } from '@/restaurant/restaurant.schema';

@Injectable()
export class ZonesService {
  constructor(
    private readonly repo: ZonesRepository,
    private readonly restaurantService: RestaurantService,
    private readonly geo: GeoService,
    @Inject(CATALOG_DATABASE) private readonly db: NodePgDatabase,
    private readonly outbox: OutboxWriter,
  ) {}

  /** Builds the catalog.delivery-zone.changed.v1 envelope for a zone mutation. */
  private zoneEnvelope(zone: DeliveryZone, isDeleted: boolean) {
    return createEnvelope({
      eventType: CATALOG_DELIVERY_ZONE_CHANGED_V1.eventType,
      eventVersion: CATALOG_DELIVERY_ZONE_CHANGED_V1.eventVersion,
      aggregateId: zone.id,
      aggregateVersion: 0,
      producer: 'catalog',
      payload: {
        zoneId: zone.id,
        restaurantId: zone.restaurantId,
        name: zone.name,
        radiusKm: zone.radiusKm,
        baseFee: zone.baseFee,
        perKmRate: zone.perKmRate,
        avgSpeedKmh: zone.avgSpeedKmh,
        prepTimeMinutes: zone.prepTimeMinutes,
        bufferMinutes: zone.bufferMinutes,
        isActive: zone.isActive,
        isDeleted,
      },
    });
  }

  async findByRestaurant(restaurantId: string): Promise<DeliveryZone[]> {
    await this.restaurantService.findOne(restaurantId);
    return this.repo.findByRestaurant(restaurantId);
  }

  async findOne(id: string, restaurantId: string): Promise<DeliveryZone> {
    const zone = await this.repo.findById(id);
    if (!zone || zone.restaurantId !== restaurantId) {
      throw new NotFoundException('Delivery zone not found');
    }
    return zone;
  }

  async create(
    restaurantId: string,
    requesterId: string,
    isAdmin: boolean,
    dto: CreateDeliveryZoneDto,
  ): Promise<DeliveryZone> {
    const restaurant = await this.restaurantService.findOne(restaurantId);
    if (!isAdmin && restaurant.ownerId !== requesterId) {
      throw new ForbiddenException('You do not own this restaurant');
    }
    // Persist the zone AND the snapshot event atomically (transactional outbox).
    return this.db.transaction(async (tx) => {
      const zone = await this.repo.create(restaurantId, dto, tx);
      await this.outbox.write(tx, this.zoneEnvelope(zone, false));
      return zone;
    });
  }

  async update(
    id: string,
    restaurantId: string,
    requesterId: string,
    isAdmin: boolean,
    dto: UpdateDeliveryZoneDto,
  ): Promise<DeliveryZone> {
    await this.findOne(id, restaurantId);
    const restaurant = await this.restaurantService.findOne(restaurantId);
    if (!isAdmin && restaurant.ownerId !== requesterId) {
      throw new ForbiddenException('You do not own this restaurant');
    }
    return this.db.transaction(async (tx) => {
      const zone = await this.repo.update(id, dto, tx);
      await this.outbox.write(tx, this.zoneEnvelope(zone, false));
      return zone;
    });
  }

  async remove(
    id: string,
    restaurantId: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<void> {
    // Load zone before deletion so we have the full payload for the tombstone event.
    const zone = await this.findOne(id, restaurantId);
    const restaurant = await this.restaurantService.findOne(restaurantId);
    if (!isAdmin && restaurant.ownerId !== requesterId) {
      throw new ForbiddenException('You do not own this restaurant');
    }
    await this.db.transaction(async (tx) => {
      await this.repo.remove(id, tx);
      // Tombstone event so Ordering marks its snapshot row deleted (D3-B).
      await this.outbox.write(tx, this.zoneEnvelope(zone, true));
    });
  }

  // ---------------------------------------------------------------------------
  // Delivery estimate
  // ---------------------------------------------------------------------------

  /**
   * Calculates the delivery fee and estimated arrival time for a customer's
   * coordinates against the restaurant's active delivery zones.
   *
   * Throws:
   *  - 404 if restaurant not found
   *  - 422 if the restaurant has no geo coordinates configured
   *  - 422 if no active delivery zones exist
   *  - 422 if the customer is outside all delivery zones
   */
  async estimateDelivery(
    restaurantId: string,
    customerCoords: Coordinates,
  ): Promise<DeliveryEstimateResponseDto> {
    const restaurant = await this.restaurantService.findOne(restaurantId);

    if (restaurant.latitude == null || restaurant.longitude == null) {
      throw new UnprocessableEntityException(
        'This restaurant has not configured its location yet.',
      );
    }

    const restaurantCoords: Coordinates = {
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
    };

    const activeZones =
      await this.repo.findActiveByRestaurantOrderedByRadius(restaurantId);

    if (activeZones.length === 0) {
      throw new UnprocessableEntityException(
        'This restaurant has no active delivery zones.',
      );
    }

    const distanceKm = this.geo.calculateDistanceKm(
      restaurantCoords,
      customerCoords,
    );

    const eligibleZone = this.findEligibleZone(activeZones, distanceKm);
    if (!eligibleZone) {
      throw new UnprocessableEntityException(
        `Your location is ${distanceKm.toFixed(1)} km from the restaurant, which is outside all delivery zones.`,
      );
    }

    return this.buildEstimateResponse(restaurantId, distanceKm, eligibleZone);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns the innermost zone whose radius covers the given distance.
   * Zones are pre-sorted by radiusKm ASC from the repository.
   */
  private findEligibleZone(
    activeZones: DeliveryZone[],
    distanceKm: number,
  ): DeliveryZone | undefined {
    return activeZones.find((zone) => zone.radiusKm >= distanceKm);
  }

  private calculateDeliveryFee(zone: DeliveryZone, distanceKm: number): number {
    // baseFee and perKmRate are integer VND; the product distanceKm × perKmRate
    // is a float.  Round to the nearest 1 000 VND to match PlaceOrderHandler
    // and to prevent amounts like 19 992 from reaching the customer.
    return roundToNearest1000(zone.baseFee + distanceKm * zone.perKmRate);
  }

  private calculateEstimatedMinutes(
    zone: DeliveryZone,
    distanceKm: number,
  ): number {
    // Guard: clamp avgSpeedKmh to ≥ 1 to prevent division-by-zero on bad data.
    // (DTO validation enforces Min(1), but defensive in case of direct DB writes.)
    const safeSpeed = Math.max(zone.avgSpeedKmh, 1);
    const travelTimeMinutes = (distanceKm / safeSpeed) * 60;
    // Ceiling on the total (same formula as PlaceOrderHandler.estimateDeliveryMinutes)
    // so the preview matches the value stored on the order at checkout.
    return Math.ceil(
      zone.prepTimeMinutes + travelTimeMinutes + zone.bufferMinutes,
    );
  }

  private buildEstimateResponse(
    restaurantId: string,
    distanceKm: number,
    zone: DeliveryZone,
  ): DeliveryEstimateResponseDto {
    const deliveryFee = this.calculateDeliveryFee(zone, distanceKm);
    // Round to nearest 1 000 VND (same rule as calculateDeliveryFee / PlaceOrderHandler).
    // Because baseFee is always a multiple of 1 000, this guarantees:
    //   deliveryFee === baseFee + distanceFee  (breakdown is always internally consistent).
    const distanceFee = roundToNearest1000(distanceKm * zone.perKmRate);
    // Use the same safeSpeed guard as calculateEstimatedMinutes.
    const safeSpeed = Math.max(zone.avgSpeedKmh, 1);
    const travelTimeMinutes = Math.ceil((distanceKm / safeSpeed) * 60);
    const estimatedMinutes = this.calculateEstimatedMinutes(zone, distanceKm);

    const breakdown: DeliveryFeeBreakdownDto = {
      baseFee: zone.baseFee,
      distanceFee,
      prepTimeMinutes: zone.prepTimeMinutes,
      travelTimeMinutes,
      bufferMinutes: zone.bufferMinutes,
    };

    return {
      restaurantId,
      // Round to 2 dp for display — sub-metre precision is meaningless for delivery.
      distanceKm: Math.round(distanceKm * 100) / 100,
      zone: { id: zone.id, name: zone.name, radiusKm: zone.radiusKm },
      // deliveryFee is already a multiple of 1 000 from calculateDeliveryFee.
      deliveryFee,
      // Already an integer from Math.ceil in calculateEstimatedMinutes.
      estimatedMinutes,
      breakdown,
    };
  }
}
