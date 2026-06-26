/**
 * transitions.spec.ts
 *
 * Structural tests for the order lifecycle state machine (D6-A — hand-crafted map).
 * These tests guard the single source of truth for who-can-do-what across all
 * 12 transitions (T-01..T-12). Any change to TRANSITIONS must be intentional and
 * accompanied by an audit-trail update; these tests catch silent edits.
 */
import { TRANSITIONS, ALLOWED_TRANSITIONS } from './transitions';
import type { OrderStatus } from '../../order/order.schema';

describe('TRANSITIONS map', () => {
  it('exposes exactly the 12 transitions defined in §5 of the proposal', () => {
    const keys = Object.keys(TRANSITIONS).sort();
    expect(keys).toEqual(
      [
        'confirmed→cancelled',
        'confirmed→preparing',
        'delivered→refunded',
        'delivering→delivered',
        'paid→cancelled',
        'paid→confirmed',
        'pending→cancelled',
        'pending→confirmed',
        'pending→paid',
        'picked_up→delivering',
        'preparing→ready_for_pickup',
        'ready_for_pickup→picked_up',
      ].sort(),
    );
  });

  describe('admin can perform all manual transitions', () => {
    // Admin must be present on every transition except 'pending→paid' (system-only)
    // so operations can intervene on stuck orders.
    const adminMustBePresentOn: Array<keyof typeof TRANSITIONS> = [
      'pending→confirmed',
      'pending→cancelled',
      'paid→confirmed',
      'paid→cancelled',
      'confirmed→preparing',
      'confirmed→cancelled',
      'preparing→ready_for_pickup',
      'ready_for_pickup→picked_up',
      'picked_up→delivering',
      'delivering→delivered',
      'delivered→refunded',
    ];

    it.each(adminMustBePresentOn)('%s includes admin', (key) => {
      const rule = TRANSITIONS[key];
      expect(rule.allowedRoles).toContain('admin');
    });

    it('pending→paid is system-only (no admin)', () => {
      expect(TRANSITIONS['pending→paid']!.allowedRoles).toEqual(['system']);
    });
  });

  describe('note requirement', () => {
    const mustRequireNote: Array<keyof typeof TRANSITIONS> = [
      'pending→cancelled', // T-03
      'paid→cancelled', // T-05
      'confirmed→cancelled', // T-07
      'delivered→refunded', // T-12
    ];

    it.each(mustRequireNote)('%s requires a note', (key) => {
      expect(TRANSITIONS[key]!.requireNote).toBe(true);
    });

    it('happy-path transitions do not require a note', () => {
      expect(TRANSITIONS['pending→confirmed']!.requireNote).toBeFalsy();
      expect(TRANSITIONS['confirmed→preparing']!.requireNote).toBeFalsy();
      expect(
        TRANSITIONS['preparing→ready_for_pickup']!.requireNote,
      ).toBeFalsy();
    });
  });

  describe('refund side effects', () => {
    it('paid→cancelled triggers refund (T-05)', () => {
      expect(TRANSITIONS['paid→cancelled']!.triggersRefundIfVnpay).toBe(true);
    });

    it('confirmed→cancelled triggers refund (T-07)', () => {
      expect(TRANSITIONS['confirmed→cancelled']!.triggersRefundIfVnpay).toBe(
        true,
      );
    });

    it('pending→cancelled does NOT trigger refund (no payment yet)', () => {
      expect(
        TRANSITIONS['pending→cancelled']!.triggersRefundIfVnpay,
      ).toBeFalsy();
    });
  });

  describe('shipper dispatch side effect', () => {
    it('preparing→ready_for_pickup triggers shipper dispatch (T-08)', () => {
      expect(
        TRANSITIONS['preparing→ready_for_pickup']!.triggersReadyForPickup,
      ).toBe(true);
    });

    it('no other transition triggers shipper dispatch', () => {
      for (const [key, rule] of Object.entries(TRANSITIONS)) {
        if (key !== 'preparing→ready_for_pickup') {
          expect(rule.triggersReadyForPickup).toBeFalsy();
        }
      }
    });
  });

  describe('T-12 delivered→refunded is admin-only', () => {
    it('only admin role allowed', () => {
      expect(TRANSITIONS['delivered→refunded']!.allowedRoles).toEqual([
        'admin',
      ]);
    });
  });

  describe('shipper-only forward transitions', () => {
    it.each([
      'ready_for_pickup→picked_up',
      'picked_up→delivering',
      'delivering→delivered',
    ] as const)('%s allows shipper', (key) => {
      expect(TRANSITIONS[key]!.allowedRoles).toContain('shipper');
    });

    it('customers cannot perform shipper transitions', () => {
      expect(
        TRANSITIONS['ready_for_pickup→picked_up']!.allowedRoles,
      ).not.toContain('customer');
    });
  });
});

describe('ALLOWED_TRANSITIONS', () => {
  it('terminal states have empty allowed-next lists', () => {
    expect(ALLOWED_TRANSITIONS.cancelled).toEqual([]);
    expect(ALLOWED_TRANSITIONS.refunded).toEqual([]);
  });

  it('every (from,to) pair in ALLOWED_TRANSITIONS has a TRANSITIONS rule', () => {
    for (const [from, toList] of Object.entries(ALLOWED_TRANSITIONS) as Array<
      [OrderStatus, OrderStatus[]]
    >) {
      for (const to of toList) {
        const key = `${from}→${to}`;
        expect(TRANSITIONS[key]).toBeDefined();
      }
    }
  });

  it('every TRANSITIONS key is reflected in ALLOWED_TRANSITIONS', () => {
    for (const key of Object.keys(TRANSITIONS)) {
      const [from, to] = key.split('→');
      expect(ALLOWED_TRANSITIONS[from]).toContain(to);
    }
  });
});
