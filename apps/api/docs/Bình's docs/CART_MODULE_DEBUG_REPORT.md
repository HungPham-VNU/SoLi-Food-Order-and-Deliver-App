# Cart Module Debug Report

**Date:** 2026-05-12  
**Scope:** `src/module/ordering/cart/` + `test/e2e/cart.e2e-spec.ts`  
**Status:** All bugs fixed, 730/730 E2E tests passing (15/15 suites)

---

## 1. Reported Bug

**Symptom:** Client sends `selectedModifiers: [{ groupId, groupName, name: "Tô vừa", price: 5000, optionId }]` but the response shows `selectedModifiers: [{ optionName: "Tô nhỏ", price: 0 }]` (wrong option — the default), and `totalAmount: 170000` instead of the expected `180000`.

**Numerical breakdown:**
- Expected: `(85000 + 5000) × 2 = 180000`
- Actual:   `(85000 + 0) × 2 = 170000`

---

## 2. Root Cause Analysis

### Primary Bug: Field Name Mismatch in Request DTOs

**Files affected:**
- `src/module/ordering/cart/dto/cart.dto.ts`
- `src/module/ordering/cart/cart.service.ts`

**The problem:** The request DTOs used the field name `selectedOptions`, while the response DTO used `selectedModifiers`. This created a silent data-loss trap:

| Direction | DTO Class | Field Name |
|-----------|-----------|------------|
| Request (add item) | `AddItemToCartDto` | `selectedOptions` ← **wrong** |
| Request (update modifiers) | `UpdateCartItemModifiersDto` | `selectedOptions` ← **wrong** |
| Response | `CartItemResponseDto` | `selectedModifiers` ✓ correct |

**The NestJS `whitelist: true` amplifier:**  
The global `ValidationPipe` is configured with `whitelist: true` in `src/main.ts`. This means any property not declared in the DTO class is **silently stripped** before the handler receives the request. A client who naturally copies the response shape to build a request will send `selectedModifiers` — which gets stripped without any error, warning, or log entry.

### Bug Chain (step by step)

```
Client sends:  selectedModifiers: [{ groupId: X, optionId: Y }]
                      ↓
NestJS ValidationPipe (whitelist: true)
                      ↓
strips "selectedModifiers" because AddItemToCartDto only declares "selectedOptions"
                      ↓
dto.selectedOptions = undefined
                      ↓
CartService.validateAndResolveModifiers():
  const selectedOptions = dto.selectedOptions ?? []  →  []
                      ↓
resolveModifierOptions(snapshotModifiers, []):
  Step 2: Auto-inject defaults for required groups (minSelections > 0, no explicit selection)
  → Injects default "Tô nhỏ" (price: 0) for the required group
                      ↓
Cart stored with: selectedModifiers: [{ optionName: "Tô nhỏ", price: 0 }]
                      ↓
totalAmount = (85000 + 0) × 2 = 170000  ← BUG
```

### Secondary Finding: Auto-Inject Behavior

The `resolveModifierOptions` method in `cart.service.ts` intentionally auto-injects the default option for any required modifier group where the client sends no explicit selection. This is a valid UX convenience feature — but it becomes a silent data corruption trap when combined with the field name mismatch, because sending `[]` (which triggers auto-inject) is indistinguishable from sending nothing (no field at all).

After the field name fix, this behavior is **correct and intentional**: if a client genuinely omits a required group, the default is auto-injected rather than returning a 400 error.

---

## 3. Fixes Applied

### Fix 1: Rename `selectedOptions` → `selectedModifiers` in Request DTOs

**File:** `src/module/ordering/cart/dto/cart.dto.ts`

```diff
// In AddItemToCartDto:
-  selectedOptions?: SelectedOptionDto[];
+  selectedModifiers?: SelectedOptionDto[];

// In UpdateCartItemModifiersDto:
-  selectedOptions!: SelectedOptionDto[];
+  selectedModifiers!: SelectedOptionDto[];
```

The `SelectedOptionDto` class itself (containing only `groupId` and `optionId`) is unchanged — the rename is purely at the containing DTO field level. The response `SelectedModifierResponseDto` class (containing `groupId`, `groupName`, `optionId`, `optionName`, `price`) is also unchanged.

### Fix 2: Update CartService to read `dto.selectedModifiers`

**File:** `src/module/ordering/cart/cart.service.ts`

```diff
// In validateAndResolveModifiers():
-  const selectedOptions = dto.selectedOptions ?? [];
+  const selectedOptions = dto.selectedModifiers ?? [];

// In updateItemModifiers():
   const resolved = await this.resolveOptions(
     existing.menuItemId,
     cart.restaurantId,
-    dto.selectedOptions,
+    dto.selectedModifiers,
   );
```

### Fix 3: Update controller JSDoc

**File:** `src/module/ordering/cart/cart.controller.ts`

Updated Swagger description for the PATCH modifiers endpoint from `result of selectedOptions` to `result of selectedModifiers` for consistency.

---

## 4. E2E Test Audit and Fixes

### Pre-existing Test Gap

The E2E tests in `test/e2e/cart.e2e-spec.ts` already used `selectedOptions` (the correct field name at the time), which is why they passed despite the production bug. Tests that correctly used `selectedOptions` would not have caught that a client sending `selectedModifiers` would silently get the wrong behavior.

### Tests Updated (field name rename)

All occurrences of `selectedOptions:` in request bodies across three E2E files were renamed to `selectedModifiers:`:

| File | Occurrences renamed |
|------|-------------------|
| `test/e2e/cart.e2e-spec.ts` | 16 |
| `test/e2e/order.e2e-spec.ts` | 1 |
| `test/e2e/spec-e2e.e2e-spec.ts` | 3 |

### Test Weaknesses Fixed

#### C-12 — "replaces modifier selection"

**Before:** Only checked that `selectedModifiers` array was defined (truthy check).  
**After:** Asserts `optionName`, `price`, and `subtotal` exactly:
```typescript
expect(wholeWheat?.optionName).toBe('Whole Wheat');
expect(wholeWheat?.price).toBe(500);
expect(extraCheese?.optionName).toBe('Extra Cheese');
expect(extraCheese?.price).toBe(1000);
expect(item!.subtotal).toBe(1515.0);  // (15.0 + 500 + 1000) × 1
```

#### C-13 — "clears all modifiers when selectedOptions is empty array"

**Before:** `expect([200, 400]).toContain(res.status)` — accepted both outcomes, making the test useless as a regression guard.  
**After:** Asserts the actual business rule — sending `[]` triggers auto-inject of the required group default, resulting in a `200` with the default option present and optional group options absent:
```typescript
expect(res.status).toBe(200);
expect(optionIds).toContain(defaultOptId);      // default was injected
expect(optionIds).not.toContain(optOptAId);    // optional group cleared
```

#### C-23 — "auto-injects default option"

**Before:** Only checked that `defaultOptId` was present in the `optionId` list.  
**After:** Asserts `optionName`, `price`, `subtotal`, and `totalAmount`:
```typescript
expect(wheatBread?.optionName).toBe('White Bread');
expect(wheatBread?.price).toBe(0);
expect(item.subtotal).toBe(15.0);   // (15.0 + 0) × 1
expect(res.body.totalAmount).toBe(15.0);
```

#### C-26 — Test description updated

Updated from "when item has no snapshot but `selectedOptions` are provided" to "when item has no snapshot but `selectedModifiers` are provided" for consistency.

### New Tests Added

#### C-23b — "explicit non-default modifier is stored with correct optionName and price"

Directly validates the reported bug scenario — sends an explicit non-default option and verifies that:
1. The stored `optionName` matches the snapshot (not the default)
2. The stored `price` matches the snapshot option price
3. `subtotal` correctly includes the modifier price

```typescript
// altOptId = "Whole Wheat", price = 500
// quantity = 2
expect(wholeWheat?.optionName).toBe('Whole Wheat');
expect(wholeWheat?.price).toBe(500);
expect(item.subtotal).toBe(1030.0);      // (15.0 + 500) × 2
expect(res.body.totalAmount).toBe(1030.0);
```

#### C-23c — "totalAmount sums all modifier prices across multiple options"

Validates modifier price accumulation with multiple selections:

```typescript
// reqGroup: altOptId (Whole Wheat, 500) + optGroup: optOptAId (Extra Cheese, 1000)
// quantity = 1
// modifiersTotal = 500 + 1000 = 1500
expect(item.subtotal).toBe(1515.0);       // (15.0 + 1500) × 1
expect(res.body.totalAmount).toBe(1515.0);
```

---

## 5. Architecture Notes

### Why `SelectedOptionDto` still uses only `groupId` + `optionId`

The request-side DTO intentionally accepts only the minimal selection identifiers. The server resolves the full `optionName`, `groupName`, and `price` from the ACL snapshot — client-supplied values for those fields are always ignored. This prevents price manipulation attacks where a malicious client could send `price: 0` for a paid modifier.

### Why the class is still named `SelectedOptionDto` (not `SelectedModifierDto`)

Renaming the class would require refactoring all internal usages. The class name describes its purpose (selecting a modifier option), while the DTO field name `selectedModifiers` aligns with the response shape. This is a naming inconsistency worth noting but not fixing in this scope.

### `resolveModifierOptions` auto-inject logic

The auto-inject step (Step 2 in `resolveModifierOptions`) fires **before** the `minSelections` validation check. This means:
- A required group (minSelections=1) with an explicit selection → uses the explicit selection
- A required group with **no** selection → auto-injects the default option (if one exists)
- A required group with no default → throws `BadRequestException` (minSelections not satisfied)

This behavior is correct and intentional after the field name fix.

---

## 6. Test Results

### Final Run (second execution after fixes)

```
Test Suites: 15 passed, 15 total
Tests:       730 passed, 730 total
Time:        ~124s
```

All 15 suites passing including:
- `cart.e2e-spec.ts` ✅ (includes C-23b and C-23c — new modifier price tests)
- `order.e2e-spec.ts` ✅
- `spec-e2e.e2e-spec.ts` ✅
- `modifiers.e2e-spec.ts` ✅
- `zones.e2e-spec.ts` ✅

### Note on First-Run Failures

The first E2E run showed 84 failures in `zones.e2e-spec.ts`, `search.e2e-spec.ts`, and `modifiers.e2e-spec.ts`. These are **pre-existing flaky tests** caused by Jest running test suites in parallel — when `zones.e2e-spec.ts` runs concurrently with a suite that calls `resetDb()`, the zone IDs created in `zones.e2e-spec.ts`'s `beforeAll` are wiped mid-test. These failures are not related to the cart module changes and pass on any sequential or isolated run.

---

## 7. Files Changed

| File | Change |
|------|--------|
| `src/module/ordering/cart/dto/cart.dto.ts` | Renamed `selectedOptions` → `selectedModifiers` in `AddItemToCartDto` and `UpdateCartItemModifiersDto` |
| `src/module/ordering/cart/cart.service.ts` | Updated `validateAndResolveModifiers` and `updateItemModifiers` to read `dto.selectedModifiers` |
| `src/module/ordering/cart/cart.controller.ts` | Updated Swagger JSDoc to reference `selectedModifiers` |
| `test/e2e/cart.e2e-spec.ts` | Renamed 16 request-body `selectedOptions:` → `selectedModifiers:`, strengthened C-12/C-13/C-23 assertions, added C-23b and C-23c |
| `test/e2e/order.e2e-spec.ts` | Renamed 1 request-body `selectedOptions:` → `selectedModifiers:` |
| `test/e2e/spec-e2e.e2e-spec.ts` | Renamed 3 request-body `selectedOptions:` → `selectedModifiers:` |
