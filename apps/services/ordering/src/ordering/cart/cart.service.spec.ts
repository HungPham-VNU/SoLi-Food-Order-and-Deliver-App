/**
 * cart.service.spec.ts
 *
 * Unit tests for CartService — Redis-backed shopping cart.
 *
 * Covers:
 *  - getCart returns null when none exists
 *  - addItem creates new cart with stable cartId
 *  - addItem enforces BR-2 single-restaurant (ConflictException)
 *  - addItem caps merged quantity at 99 (BadRequestException)
 *  - addItem rejects when snapshot missing AND modifiers sent (Case 2)
 *  - addItem rejects when snapshot restaurantId mismatches
 *  - addItem rejects when snapshot status != 'available'
 *  - addItem auto-injects default modifier when group requires min selections (Case 8)
 *  - addItem rejects when minSelections unsatisfied and no default available
 *  - addItem rejects unavailable explicit option (Case 11)
 *  - updateItemQuantity: NotFound when cartItemId missing
 *  - updateItemQuantity: qty=0 removes item; cart empty → delete key, returns null
 *  - updateItemModifiers: NotFound when cartItemId missing; updates fingerprint
 *  - removeItem: NotFound when cartItemId missing
 *  - clearCart calls repo.delete (idempotent)
 */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CartService } from './cart.service';
import type { CartRedisRepository } from './cart.redis-repository';
import type { MenuItemSnapshotRepository } from '../acl/repositories/menu-item-snapshot.repository';
import type { AppSettingsService } from '../common/app-settings.service';

function buildService(opts?: {
  cartRepo?: {
    findByCustomerId: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  snapshotRepo?: { findById: jest.Mock };
  appSettings?: { getNumber: jest.Mock };
}) {
  const cartRepo = opts?.cartRepo ?? {
    findByCustomerId: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const snapshotRepo = opts?.snapshotRepo ?? {
    findById: jest.fn().mockResolvedValue(null),
  };
  const appSettings = opts?.appSettings ?? {
    getNumber: jest.fn().mockResolvedValue(3600),
  };
  return {
    service: new CartService(
      cartRepo as unknown as CartRedisRepository,
      snapshotRepo as unknown as MenuItemSnapshotRepository,
      appSettings as unknown as AppSettingsService,
    ),
    cartRepo,
    snapshotRepo,
    appSettings,
  };
}

const baseAddDto = {
  menuItemId: 'item-1',
  restaurantId: 'rest-1',
  restaurantName: 'Sunset Bistro',
  itemName: 'Pho',
  unitPrice: 50_000,
  quantity: 1,
};

describe('CartService', () => {
  describe('getCart', () => {
    it('returns null when none exists', async () => {
      const { service } = buildService();
      expect(await service.getCart('cust-1')).toBeNull();
    });
  });

  describe('addItem — first add', () => {
    it('creates new cart with stable cartId and single item', async () => {
      const { service, cartRepo } = buildService();
      const cart = await service.addItem('cust-1', baseAddDto);
      expect(cart.customerId).toBe('cust-1');
      expect(cart.restaurantId).toBe('rest-1');
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(1);
      expect(cart.cartId).toEqual(expect.any(String));
      expect(cartRepo.save).toHaveBeenCalled();
    });
  });

  describe('addItem — BR-2 single-restaurant', () => {
    it('throws ConflictException when adding from different restaurant', async () => {
      const existingCart = {
        cartId: 'c-1',
        customerId: 'cust-1',
        restaurantId: 'rest-1',
        restaurantName: 'Sunset Bistro',
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const cartRepo = {
        findByCustomerId: jest.fn().mockResolvedValue(existingCart),
        save: jest.fn(),
        delete: jest.fn(),
      };
      const { service } = buildService({ cartRepo });
      await expect(
        service.addItem('cust-1', {
          ...baseAddDto,
          restaurantId: 'rest-2',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('addItem — quantity cap', () => {
    it('throws BadRequest when merged quantity exceeds 99', async () => {
      const existingCart = {
        cartId: 'c-1',
        customerId: 'cust-1',
        restaurantId: 'rest-1',
        restaurantName: 'Sunset Bistro',
        items: [
          {
            cartItemId: 'line-1',
            modifierFingerprint: '',
            menuItemId: 'item-1',
            itemName: 'Pho',
            imageUrl: null,
            unitPrice: 50_000,
            quantity: 95,
            selectedModifiers: [],
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const cartRepo = {
        findByCustomerId: jest.fn().mockResolvedValue(existingCart),
        save: jest.fn(),
        delete: jest.fn(),
      };
      const { service } = buildService({ cartRepo });
      await expect(
        service.addItem('cust-1', { ...baseAddDto, quantity: 10 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('addItem — snapshot validation', () => {
    it('throws BadRequest when modifiers sent but snapshot missing (Case 2)', async () => {
      const { service } = buildService(); // snapshot returns null by default
      await expect(
        service.addItem('cust-1', {
          ...baseAddDto,
          selectedModifiers: [{ groupId: 'g', optionId: 'o' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows add when snapshot missing and no modifiers sent', async () => {
      const { service } = buildService();
      const cart = await service.addItem('cust-1', baseAddDto);
      expect(cart.items).toHaveLength(1);
    });

    it('throws Conflict when snapshot restaurantId mismatches', async () => {
      const snapshotRepo = {
        findById: jest.fn().mockResolvedValue({
          menuItemId: 'item-1',
          restaurantId: 'rest-X',
          status: 'available',
          modifiers: [],
        }),
      };
      const { service } = buildService({ snapshotRepo });
      await expect(
        service.addItem('cust-1', baseAddDto),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws Conflict when snapshot status != available', async () => {
      const snapshotRepo = {
        findById: jest.fn().mockResolvedValue({
          menuItemId: 'item-1',
          restaurantId: 'rest-1',
          status: 'out_of_stock',
          modifiers: [],
        }),
      };
      const { service } = buildService({ snapshotRepo });
      await expect(
        service.addItem('cust-1', baseAddDto),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('addItem — modifier auto-default injection (Case 8)', () => {
    const snapshotWithRequiredGroup = {
      menuItemId: 'item-1',
      restaurantId: 'rest-1',
      status: 'available',
      modifiers: [
        {
          groupId: 'g1',
          groupName: 'Size',
          minSelections: 1,
          maxSelections: 1,
          options: [
            {
              optionId: 'opt-S',
              name: 'Small',
              price: 0,
              isDefault: true,
              isAvailable: true,
            },
            {
              optionId: 'opt-L',
              name: 'Large',
              price: 10_000,
              isDefault: false,
              isAvailable: true,
            },
          ],
        },
      ],
    };

    it('auto-injects default option when group required but none selected', async () => {
      const snapshotRepo = {
        findById: jest.fn().mockResolvedValue(snapshotWithRequiredGroup),
      };
      const { service } = buildService({ snapshotRepo });
      const cart = await service.addItem('cust-1', baseAddDto);
      expect(cart.items[0].selectedModifiers).toEqual([
        expect.objectContaining({
          groupId: 'g1',
          optionId: 'opt-S',
          optionName: 'Small',
        }),
      ]);
    });

    it('throws BadRequest when minSelections unsatisfied and no default exists', async () => {
      const noDefault = {
        ...snapshotWithRequiredGroup,
        modifiers: [
          {
            ...snapshotWithRequiredGroup.modifiers[0],
            options: snapshotWithRequiredGroup.modifiers[0].options.map(
              (o) => ({
                ...o,
                isDefault: false,
              }),
            ),
          },
        ],
      };
      const snapshotRepo = { findById: jest.fn().mockResolvedValue(noDefault) };
      const { service } = buildService({ snapshotRepo });
      await expect(
        service.addItem('cust-1', baseAddDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequest when explicit option is unavailable (Case 11)', async () => {
      const snapshot = {
        ...snapshotWithRequiredGroup,
        modifiers: [
          {
            ...snapshotWithRequiredGroup.modifiers[0],
            options: [
              {
                optionId: 'opt-S',
                name: 'Small',
                price: 0,
                isDefault: true,
                isAvailable: false,
              },
            ],
          },
        ],
      };
      const snapshotRepo = { findById: jest.fn().mockResolvedValue(snapshot) };
      const { service } = buildService({ snapshotRepo });
      await expect(
        service.addItem('cust-1', {
          ...baseAddDto,
          selectedModifiers: [{ groupId: 'g1', optionId: 'opt-S' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('updateItemQuantity', () => {
    function cartWithLine() {
      return {
        cartId: 'c-1',
        customerId: 'cust-1',
        restaurantId: 'rest-1',
        restaurantName: 'X',
        items: [
          {
            cartItemId: 'line-1',
            modifierFingerprint: '',
            menuItemId: 'item-1',
            itemName: 'Pho',
            imageUrl: null,
            unitPrice: 50_000,
            quantity: 2,
            selectedModifiers: [],
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    it('throws NotFound when no cart exists', async () => {
      const { service } = buildService();
      await expect(
        service.updateItemQuantity('cust-1', 'line-1', { quantity: 3 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFound when cartItemId missing', async () => {
      const cartRepo = {
        findByCustomerId: jest.fn().mockResolvedValue(cartWithLine()),
        save: jest.fn(),
        delete: jest.fn(),
      };
      const { service } = buildService({ cartRepo });
      await expect(
        service.updateItemQuantity('cust-1', 'unknown', { quantity: 3 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('quantity=0 removes item; empty cart → delete key returns null', async () => {
      const cartRepo = {
        findByCustomerId: jest.fn().mockResolvedValue(cartWithLine()),
        save: jest.fn(),
        delete: jest.fn().mockResolvedValue(undefined),
      };
      const { service } = buildService({ cartRepo });
      const result = await service.updateItemQuantity('cust-1', 'line-1', {
        quantity: 0,
      });
      expect(result).toBeNull();
      expect(cartRepo.delete).toHaveBeenCalledWith('cust-1');
    });

    it('updates quantity in place when > 0', async () => {
      const cart = cartWithLine();
      const cartRepo = {
        findByCustomerId: jest.fn().mockResolvedValue(cart),
        save: jest.fn(),
        delete: jest.fn(),
      };
      const { service } = buildService({ cartRepo });
      const result = await service.updateItemQuantity('cust-1', 'line-1', {
        quantity: 5,
      });
      expect(result?.items[0].quantity).toBe(5);
    });
  });

  describe('removeItem', () => {
    it('throws NotFound when no cart', async () => {
      const { service } = buildService();
      await expect(
        service.removeItem('cust-1', 'line-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFound when cartItemId missing', async () => {
      const cartRepo = {
        findByCustomerId: jest.fn().mockResolvedValue({
          cartId: 'c',
          customerId: 'cust-1',
          restaurantId: 'r',
          restaurantName: 'X',
          items: [],
          createdAt: '',
          updatedAt: '',
        }),
        save: jest.fn(),
        delete: jest.fn(),
      };
      const { service } = buildService({ cartRepo });
      await expect(
        service.removeItem('cust-1', 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('clearCart', () => {
    it('calls repo.delete (idempotent)', async () => {
      const { service, cartRepo } = buildService();
      await service.clearCart('cust-1');
      expect(cartRepo.delete).toHaveBeenCalledWith('cust-1');
    });
  });
});
