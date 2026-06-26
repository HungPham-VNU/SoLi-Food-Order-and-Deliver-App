import type { EventBus } from '@nestjs/cqrs';
import {
  createEnvelope,
  EVENT_NAMES,
  type DomainEventEnvelope,
} from '@uitfood/contracts';
import { MenuItemUpdatedEvent } from '@/shared/events/menu-item-updated.event';
import { RestaurantUpdatedEvent } from '@/shared/events/restaurant-updated.event';
import { DeliveryZoneSnapshotUpdatedEvent } from '@/shared/events/delivery-zone-snapshot-updated.event';
import { EventBusBridgeConsumer } from './eventbus-bridge.consumer';
import type { RabbitMqConsumer } from '../rabbitmq/rabbitmq.consumer';
import type { InboxConsumer } from '../inbox/inbox.consumer';

/**
 * Verifies the Phase-6 step-6 contract: `catalog.*.changed.v1` events emitted by
 * the EXTRACTED Catalog service are bridged into the in-process events that the
 * monolith's Ordering ACL projectors consume — keeping Ordering's snapshots in
 * sync without any shared schema or SQL join.
 */
describe('EventBusBridgeConsumer — catalog → Ordering snapshot bridge', () => {
  function setup() {
    let captured: (env: DomainEventEnvelope) => Promise<void> = async () => {};
    const consumer = {
      subscribe: jest.fn((opts: { handler: typeof captured }) => {
        captured = opts.handler;
      }),
    } as unknown as RabbitMqConsumer;

    // Inbox runs the handler exactly once (dedupe is covered elsewhere).
    const inbox = {
      consume: jest.fn(
        async (_c: string, _e: unknown, handler: () => Promise<void>) =>
          handler(),
      ),
    } as unknown as InboxConsumer;

    const published: object[] = [];
    const eventBus = {
      publish: jest.fn((e: object) => published.push(e)),
    } as unknown as EventBus;

    const bridge = new EventBusBridgeConsumer(consumer, inbox, eventBus);
    bridge.onApplicationBootstrap();

    return { deliver: (env: DomainEventEnvelope) => captured(env), published };
  }

  const envelope = (eventType: string, payload: unknown): DomainEventEnvelope =>
    createEnvelope({
      eventType,
      eventVersion: 1,
      aggregateId: '11111111-1111-4111-8111-111111111111',
      aggregateVersion: 0,
      producer: 'catalog-service',
      payload,
    });

  it('subscribes to the catalog change routing keys', () => {
    const consumer = {
      subscribe: jest.fn(),
    } as unknown as RabbitMqConsumer;
    const bridge = new EventBusBridgeConsumer(
      consumer,
      { consume: jest.fn() } as unknown as InboxConsumer,
      { publish: jest.fn() } as unknown as EventBus,
    );
    bridge.onApplicationBootstrap();
    const keys = (consumer.subscribe as jest.Mock).mock.calls[0][0]
      .routingKeys as string[];
    expect(keys).toEqual(
      expect.arrayContaining([
        EVENT_NAMES.CatalogMenuItemChanged,
        EVENT_NAMES.CatalogRestaurantChanged,
        EVENT_NAMES.CatalogDeliveryZoneChanged,
      ]),
    );
  });

  it('bridges catalog.menu-item.changed.v1 → MenuItemUpdatedEvent', async () => {
    const { deliver, published } = setup();
    await deliver(
      envelope(EVENT_NAMES.CatalogMenuItemChanged, {
        menuItemId: '22222222-2222-4222-8222-222222222222',
        restaurantId: '33333333-3333-4333-8333-333333333333',
        name: 'Pho',
        price: 50000,
        status: 'available',
        modifiers: [],
      }),
    );
    expect(published).toHaveLength(1);
    const e = published[0] as MenuItemUpdatedEvent;
    expect(e).toBeInstanceOf(MenuItemUpdatedEvent);
    expect(e.menuItemId).toBe('22222222-2222-4222-8222-222222222222');
    expect(e.price).toBe(50000);
    expect(e.status).toBe('available');
  });

  it('bridges catalog.restaurant.changed.v1 → RestaurantUpdatedEvent', async () => {
    const { deliver, published } = setup();
    await deliver(
      envelope(EVENT_NAMES.CatalogRestaurantChanged, {
        restaurantId: '33333333-3333-4333-8333-333333333333',
        name: 'Bistro',
        isOpen: false,
        isApproved: false,
        address: '1 Test St',
        ownerId: '44444444-4444-4444-8444-444444444444',
        latitude: null,
        longitude: null,
        cuisineType: null,
      }),
    );
    const e = published[0] as RestaurantUpdatedEvent;
    expect(e).toBeInstanceOf(RestaurantUpdatedEvent);
    expect(e.isOpen).toBe(false);
    expect(e.isApproved).toBe(false);
  });

  it('bridges catalog.delivery-zone.changed.v1 → DeliveryZoneSnapshotUpdatedEvent (incl. tombstone)', async () => {
    const { deliver, published } = setup();
    await deliver(
      envelope(EVENT_NAMES.CatalogDeliveryZoneChanged, {
        zoneId: '55555555-5555-4555-8555-555555555555',
        restaurantId: '33333333-3333-4333-8333-333333333333',
        name: 'Zone A',
        radiusKm: 5,
        baseFee: 15000,
        perKmRate: 3000,
        avgSpeedKmh: 20,
        prepTimeMinutes: 15,
        bufferMinutes: 5,
        isActive: true,
        isDeleted: true,
      }),
    );
    const e = published[0] as DeliveryZoneSnapshotUpdatedEvent;
    expect(e).toBeInstanceOf(DeliveryZoneSnapshotUpdatedEvent);
    expect(e.isDeleted).toBe(true);
  });

  it('ignores unbridged event types', async () => {
    const { deliver, published } = setup();
    await deliver(envelope('some.unknown.event.v1', { foo: 'bar' }));
    expect(published).toHaveLength(0);
  });
});
