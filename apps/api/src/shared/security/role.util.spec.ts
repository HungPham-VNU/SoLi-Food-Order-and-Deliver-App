/**
 * role.util.spec.ts
 *
 * Unit tests for hasRole — the foundation of RBAC checks across the API.
 * Coverage targets:
 *  - falsy inputs (undefined, null, empty string, whitespace, empty array)
 *  - single string role
 *  - comma-separated string roles
 *  - array of roles
 *  - case-insensitive matching (owner and required)
 *  - whitespace tolerance
 *  - multiple required roles (OR semantics)
 */
import { hasRole } from './role.util';

describe('hasRole', () => {
  describe('falsy inputs', () => {
    it('returns false when role is undefined', () => {
      expect(hasRole(undefined, 'admin')).toBe(false);
    });

    it('returns false when role is null', () => {
      expect(hasRole(null, 'admin')).toBe(false);
    });

    it('returns false when role is empty string', () => {
      expect(hasRole('', 'admin')).toBe(false);
    });

    it('returns false when role is whitespace only', () => {
      // Whitespace-only string becomes [''] which is then filtered out, leaving
      // an empty owned list. Required roles cannot match anything.
      expect(hasRole('   ', 'admin')).toBe(false);
    });

    it('returns false when role array is empty', () => {
      expect(hasRole([], 'admin')).toBe(false);
    });

    it('returns false when required list is empty', () => {
      // `required.some(...)` over an empty array always yields false.
      expect(hasRole('admin')).toBe(false);
    });
  });

  describe('single string role', () => {
    it('returns true when role matches exactly', () => {
      expect(hasRole('admin', 'admin')).toBe(true);
    });

    it('returns false when role does not match', () => {
      expect(hasRole('customer', 'admin')).toBe(false);
      expect(hasRole('customer', 'admin')).toBe(false);
    });
  });

  describe('comma-separated string roles', () => {
    it('matches when any comma-separated role is required', () => {
      expect(hasRole('user,restaurant', 'restaurant')).toBe(true);
    });

    it('tolerates whitespace around commas', () => {
      expect(hasRole(' user , restaurant ', 'restaurant')).toBe(true);
    });

    it('filters out empty segments', () => {
      // Empty segments (",,user,") should not match the empty required role.
      expect(hasRole(',,user,', '')).toBe(false);
      expect(hasRole(',,user,', 'user')).toBe(true);
    });
  });

  describe('array role input', () => {
    it('matches when array contains required role', () => {
      expect(hasRole(['user', 'restaurant'], 'restaurant')).toBe(true);
    });

    it('returns false when array has no overlap with required', () => {
      expect(hasRole(['user', 'shipper'], 'admin')).toBe(false);
    });
  });

  describe('case-insensitive matching', () => {
    it('matches when owned role is uppercase', () => {
      expect(hasRole('ADMIN', 'admin')).toBe(true);
    });

    it('matches when required role is uppercase', () => {
      expect(hasRole('admin', 'ADMIN')).toBe(true);
    });

    it('matches with mixed case', () => {
      expect(hasRole('Admin,Customer', 'CUSTOMER')).toBe(true);
    });
  });

  describe('multiple required roles (OR semantics)', () => {
    it('returns true when owner has any one of required roles', () => {
      expect(hasRole('customer', 'admin', 'customer')).toBe(true);
    });

    it('returns false when owner has none of required roles', () => {
      expect(hasRole('customer', 'admin', 'shipper')).toBe(false);
    });
  });
});
