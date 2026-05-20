# Menu Management — API Integration Session

## Overview

This session covered the full integration of the menu management feature for the web dashboard (`apps/web`), connecting it to the NestJS backend (`apps/api`). Work spanned from CORS fixes to image upload via Cloudinary.

---

## 1. CORS & Auth Fixes

**Problem:** Register/login form showed "Failed to fetch" — the API rejected all browser requests.

**Root causes fixed:**

| File | Change |
|---|---|
| `apps/api/src/main.ts` | Added `app.enableCors({ origin, credentials: true })` — was completely missing |
| `apps/api/src/lib/auth.ts` | Added `http://localhost:5173` to `trustedOrigins` |
| `apps/api/.env` | Created `CORS_ORIGIN=http://localhost:5173` and `PORT=3002` |
| `apps/web/.env` | Created with `VITE_API_BASE_URL=http://localhost:3002` |

---

## 2. Menu Types & API Layer

**New files created:**

### `apps/web/src/features/menu/types/index.ts`
Defines all TypeScript interfaces matching the API response DTOs:
- `MenuItemStatus` — `'available' | 'unavailable' | 'out_of_stock'`
- `MenuItem` — full item shape including `price` (integer VND), `categoryId` (UUID), `tags`
- `MenuCategory` — per-restaurant category with `displayOrder`
- `MenuItemListResponse` — paginated `{ data, total }`
- `MenuOverview` — stats object: `totalItems`, `availableItems`, `unavailableItems`, `outOfStockItems`, `categories`

### `apps/web/src/features/menu/api/menu.api.ts`
Axios calls to all menu endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| `getItems(restaurantId, params?)` | `GET /api/menu-items` | List items (passes `status: 'all'` for owner view) |
| `getItem(id)` | `GET /api/menu-items/:id` | Single item |
| `getCategories(restaurantId)` | `GET /api/menu-items/categories` | Categories for a restaurant |
| `createItem(dto)` | `POST /api/menu-items` | Create item (requires `restaurant` role) |
| `updateItem(id, dto)` | `PATCH /api/menu-items/:id` | Update item fields |
| `toggleSoldOut(id)` | `PATCH /api/menu-items/:id/sold-out` | Toggle sold-out state |
| `deleteItem(id)` | `DELETE /api/menu-items/:id` | Delete item |
| `createCategory(dto)` | `POST /api/menu-items/categories` | Create category |
| `deleteCategory(id)` | `DELETE /api/menu-items/categories/:id` | Delete category |

---

## 3. React Query Hooks

### `apps/web/src/features/menu/hooks/useMenu.ts`
Query hooks with `menuKeys` factory:
- `useMenuItems(restaurantId)` — fetches all items for owner dashboard
- `useMenuCategories(restaurantId)` — fetches categories
- `useMenuItem(id)` — fetches single item

### `apps/web/src/features/menu/hooks/useMenuMutations.ts`
Mutation hooks — all invalidate the appropriate query keys on success:
- `useCreateMenuItem(restaurantId)`
- `useUpdateMenuItem(restaurantId)`
- `useToggleSoldOut(restaurantId)`
- `useDeleteMenuItem(restaurantId)`
- `useCreateCategory(restaurantId)`

### `apps/web/src/features/restaurant/hooks/useRestaurants.ts`
Added `useUpdateRestaurant()` — calls `PATCH /api/restaurants/:id`, invalidates `restaurantKeys.all` on success.

---

## 4. Form Schema

### `apps/web/src/features/menu/schemas/menu.schema.ts`
Zod schema for the create item form:

```ts
name:        z.string().min(2)
price:       z.number().int().min(1000)   // VND integer, min 1,000₫
categoryId:  z.string().uuid().optional()
description: z.string().optional()
sku:         z.string().optional()
imageUrl:    z.string().url().optional().or(z.literal(''))
tags:        z.array(z.string()).optional()
```

---

## 5. Page Rewrites

### `apps/web/src/app/pages/menu/MenuManagementPage.tsx`
- Replaced all mock data with live TanStack Query hooks
- `useMyRestaurant()` to get restaurant context
- `useMenuItems` / `useMenuCategories` for data
- `useDeleteMenuItem` / `useUpdateMenuItem` for mutations
- Fixed broken store toggle — was calling menu PATCH with `restaurant.id`; now calls `useUpdateRestaurant` with `{ isOpen: !restaurant.isOpen }`
- Category filter tabs wired to `activeCategoryId` state
- Loading and empty states added

### `apps/web/src/app/pages/menu/CreateMenuItemPage.tsx`
- Wrapped in `FormProvider` for child component access
- `useMyRestaurant()` provides `restaurantId`
- Explicit loading guard: shows spinner while restaurant loads
- Explicit not-found guard: shows red error block if restaurant isn't approved/found (previously silent)
- Removed `price: undefined` from defaultValues — was producing `NaN` via `valueAsNumber: true`

---

## 6. Component Updates

### `ProductEssenceCard`
- Accepts `restaurantId` prop
- Category Select now uses manual name lookup in the trigger (`categories.find(c => c.id === watch('categoryId'))?.name`) — fixes Radix UI showing UUID instead of label after selection
- Added inline category creation: `+` button next to the Select expands an input row; on confirm calls `useCreateCategory`, auto-selects the new category and closes the input
- Keyboard support: Enter to confirm, Escape to cancel

### `DietaryTagsCard`
- Replaced raw uncontrolled `<input type="checkbox">` with `useFormContext` — tags now actually submit with the form

### `MediaUploadCard`
- Fully rewritten from decorative placeholder to functional upload component (see §7)

### `MenuSidebar`
- Removed all hardcoded mock data (`|| 48`, `|| 3`, hardcoded `12`, `94%`)
- Stats (Active Items, Out of Stock, Hidden/Unavailable) now read from real `overview` props
- Inventory Health bar calculated as `Math.round((availableItems / totalItems) * 100)`
- Categories list renders real `overview.categories` from the API (was a static 3-item mock array)
- Empty state shown when no categories exist

---

## 7. Cloudinary Image Upload

**Architecture:** Signed upload — API secret never touches the browser.

```
Browser → GET /api/cloudinary/signature → gets { cloudName, apiKey, timestamp, signature, folder }
Browser → POST api.cloudinary.com/v1_1/{cloudName}/image/upload (with file + signature)
Cloudinary → returns { secure_url }
Browser → sets imageUrl in react-hook-form
```

### New files

**`apps/web/src/lib/cloudinary-upload.ts`**
- `uploadToCloudinary(file, folder)` — orchestrates the two-step flow
- Fetches signature from `/api/cloudinary/signature`
- POSTs FormData directly to Cloudinary
- Returns `secure_url` string

**`apps/web/src/features/menu/hooks/useImageUpload.ts`**
- Wraps `uploadToCloudinary` with `isUploading` and `uploadError` state

**`MediaUploadCard` UI states:**
- **Empty** — upload area with drag/drop hint
- **Uploading** — spinner + "Uploading…", non-clickable
- **Uploaded** — full image preview with ✕ remove button
- **Error** — red message below the area

### Required env vars (already set)
```env
# apps/api/.env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## 8. Known Limitations / Next Steps

| Area | Status | Notes |
|---|---|---|
| Image upload | Done | Requires real Cloudinary credentials in `apps/api/.env` |
| Category creation | Done | Inline on create form only; no delete/reorder UI yet |
| Store open/close toggle | Done | Fixed to call correct `PATCH /api/restaurants/:id` endpoint |
| Edit menu item page | Not started | Route `/menu/edit/:id` navigated to but page not built |
| Orders Kanban | Not started | Phase 4 — replace mock `orderStore.ts` |
| Dashboard live stats | Not started | Phase 5 |
| WebSocket notifications | Not started | Phase 7 |
| VNPay return page | Not started | Phase 8 |
| Auto role assignment | Backend gap | After `POST /api/restaurants`, user role must be manually set to `restaurant` via SQL |
