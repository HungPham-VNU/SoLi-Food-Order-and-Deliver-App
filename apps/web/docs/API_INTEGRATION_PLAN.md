# Web API Integration Plan

## Context

The web app is a **restaurant management dashboard** (not a customer app). The logged-in user is a restaurant owner or admin. The mobile app handles the customer side.

This document is a step-by-step engineering plan for replacing every mock with real API calls, in dependency order. Each phase is independently shippable.

---

## Architecture Decisions

### 1. Auth Strategy
Better-auth provides two transport modes: cookie-session or Bearer token. The web app's current `api-client.ts` reads from `localStorage('auth_token')`. We will replace this with a proper `@better-auth/react` client that manages cookies/session internally — the same approach used on mobile but adapted for browser.

### 2. API Client
Keep axios (`lib/api-client.ts`) as the base HTTP layer. It already handles `Authorization: Bearer` injection. Enhance it with:
- Response interceptor to redirect to `/auth/login` on 401.
- Error normalisation helper so every TanStack Query hook sees a consistent `ApiError` shape.

### 3. Data Layer
- **Server state** → TanStack Query (already installed, zero usage). Every API resource gets a `use<Resource>Query` + `use<Resource>Mutations` hook pair.
- **Client state** → Zustand only for UI concerns (sidebar open, kanban drag preview). Remove mock data from the order store entirely.

### 4. Restaurant Context
The logged-in restaurant owner always operates on **their own restaurant**. Once authenticated, we fetch the user's restaurant once and store it in a Zustand `useRestaurantStore`. All subsequent queries are scoped by that restaurant ID, avoiding prop-drilling.

### 5. Type Strategy
The current frontend types (`order.types.ts`, `menu/types/index.ts`) are mock-oriented and do not match the API's DTO shapes. We replace them per-phase. The canonical source of truth is the API DTOs — the frontend types must reflect those shapes exactly.

---

## Folder Conventions

Every feature follows the structure from `project-structure.md`:

```
features/<name>/
├── api/          ← axios call functions (no hooks)
├── hooks/        ← useQuery / useMutation wrappers
├── stores/       ← Zustand stores (UI-only state)
├── types/        ← TypeScript types matching API DTOs
└── components/   ← UI components
```

`lib/api-client.ts` — shared axios instance (auth injected).
`lib/auth-client.ts` — better-auth client (new file).
`lib/query-client.ts` — QueryClient with global defaults (new file, extracted from provider).

---

## Phase 0 — Foundation (prerequisite for everything)

### 0-A: Auth Client

**File:** `src/lib/auth-client.ts`

```ts
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
});

export const { signIn, signUp, signOut, useSession } = authClient;
```

Better-auth's React client handles cookie or Bearer session transparently. The `useSession()` hook returns `{ data: session, isPending }` and is the single source of truth for auth state throughout the app.

### 0-B: Enhance api-client.ts

Add a 401 response interceptor and a typed error helper:

```ts
// lib/api-client.ts additions

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) { super(message); }
}

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.location.href = '/auth/login';
    }
    const { status, data } = err.response ?? {};
    return Promise.reject(new ApiError(status ?? 0, data?.error ?? 'unknown', data?.message ?? err.message));
  },
);
```

### 0-C: QueryClient Defaults

Extract from `provider.tsx` into `lib/query-client.ts` for reuse in tests:

```ts
// lib/query-client.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,      // 30 s — suits a live dashboard
      retry: (failCount, err) => err instanceof ApiError && err.status >= 500 && failCount < 2,
      refetchOnWindowFocus: false,
    },
  },
});
```

### 0-D: Route Guard

Add `<RequireAuth>` component that calls `useSession()` and redirects unauthenticated users to `/auth/login`:

```ts
// components/auth/RequireAuth.tsx
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();
  if (isPending) return <FullPageSpinner />;
  if (!session) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
}
```

Wrap the `MainLayout` route in `router.tsx` with `<RequireAuth>`.

### Deliverables
| File | Action |
|---|---|
| `src/lib/auth-client.ts` | Create |
| `src/lib/api-client.ts` | Add 401 interceptor + `ApiError` |
| `src/lib/query-client.ts` | Extract + configure defaults |
| `src/components/auth/RequireAuth.tsx` | Create |
| `src/app/provider.tsx` | Use `queryClient` from lib |
| `src/app/router.tsx` | Wrap MainLayout in `<RequireAuth>` |

---

## Phase 1 — Auth Integration

### Scope
Wire `LoginForm` and `RegisterForm` to the backend. On success, redirect to `/dashboard`.

### 1-A: Login

**File:** `features/auth/hooks/useSignIn.ts`

```ts
import { useMutation } from '@tanstack/react-query';
import { signIn } from '@/lib/auth-client';

export function useSignIn() {
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      signIn.email({ email: data.email, password: data.password }),
  });
}
```

**LoginForm.tsx** changes:
- Add `react-hook-form` + zod schema (email + password).
- Call `useSignIn().mutate(data)` on submit.
- On success: `router.push('/dashboard')`.
- On error: show inline error message.

### 1-B: Register (Part 1 — Create Account)

**File:** `features/auth/hooks/useSignUp.ts`

```ts
export function useSignUp() {
  return useMutation({
    mutationFn: (data: { email: string; password: string; name: string }) =>
      signUp.email(data),
  });
}
```

`RegisterForm.tsx`: wire fields + call `useSignUp`. On success redirect to `/auth/register/business`.

### 1-C: Register (Part 2 — Create Restaurant)

After account creation the user is authenticated. The `/auth/register/business` page calls:

**File:** `features/restaurant/api/restaurant.api.ts` (already exists, use `restaurantApi.create`)

```ts
// features/restaurant/hooks/useCreateRestaurant.ts
export function useCreateRestaurant() {
  return useMutation({
    mutationFn: restaurantApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: restaurantKeys.mine() }),
  });
}
```

On success, redirect to `/auth/register/pending` (awaiting admin approval).

### 1-D: Session-Aware AppHeader (future)

The `MainLayout` header can show the logged-in user avatar/name using `useSession().data.user`.

### Deliverables
| File | Action |
|---|---|
| `features/auth/hooks/useSignIn.ts` | Create |
| `features/auth/hooks/useSignUp.ts` | Create |
| `features/auth/components/login/LoginForm.tsx` | Wire to `useSignIn` |
| `features/auth/components/register/RegisterForm.tsx` | Wire to `useSignUp` |
| `features/auth/components/register/RegisterBusinessForm.tsx` | Wire to `useCreateRestaurant` |

---

## Phase 2 — Restaurant Context

This phase provides the restaurant ID that every subsequent phase needs.

### 2-A: Types

**File:** `features/restaurant/types/restaurant.types.ts`

```ts
export interface Restaurant {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  phone: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  cuisineType: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  isOpen: boolean;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 2-B: API Functions

`features/restaurant/api/restaurant.api.ts` already exists with axios calls. Add a `getAll` call and align return types with the new `Restaurant` interface. Unwrap `.data` from axios responses in the hooks (not the api layer — keep api functions returning `AxiosResponse` for flexibility).

### 2-C: Query Hooks

**File:** `features/restaurant/hooks/useRestaurants.ts`

```ts
export const restaurantKeys = {
  all: () => ['restaurants'] as const,
  mine: () => ['restaurants', 'mine'] as const,
};

// For admin: paginated list of all restaurants
export function useRestaurants() {
  return useQuery({
    queryKey: restaurantKeys.all(),
    queryFn: () => restaurantApi.getAll().then((r) => r.data),
  });
}
```

### 2-D: Restaurant Store (Current User's Restaurant)

**File:** `features/restaurant/stores/restaurantStore.ts`

```ts
// Zustand store — holds the restaurant that belongs to the logged-in user.
// Populated once after login, invalidated on logout.
type RestaurantStore = {
  restaurant: Restaurant | null;
  setRestaurant: (r: Restaurant | null) => void;
};
```

After login, fetch `GET /api/restaurants` filtered by `ownerId` (or let the backend derive it from session). Cache in the store. All child features read `useRestaurantStore(s => s.restaurant)` for the current restaurant ID.

> **Note:** The API's `GET /api/restaurants` returns all restaurants. There is no `GET /api/restaurants/mine` endpoint. See `INTEGRATION_ISSUES.md` → Issue #3.

### Deliverables
| File | Action |
|---|---|
| `features/restaurant/types/restaurant.types.ts` | Create |
| `features/restaurant/api/restaurant.api.ts` | Align types |
| `features/restaurant/hooks/useRestaurants.ts` | Create |
| `features/restaurant/hooks/useRestaurantMutations.ts` | Create (update, toggle open) |
| `features/restaurant/stores/restaurantStore.ts` | Create |

---

## Phase 3 — Menu Integration

Replaces all mock data in `MenuManagementPage` and `CreateMenuItemPage`.

### 3-A: Types

Replace `features/menu/types/index.ts` with API-accurate types:

```ts
// API status values
export type MenuItemStatus = 'available' | 'unavailable' | 'out_of_stock';

export interface MenuCategory {
  id: string;           // UUID (not a string enum)
  restaurantId: string;
  name: string;
  displayOrder: number;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  price: number;        // integer VND
  description: string | null;
  sku: string | null;
  categoryId: string | null;
  status: MenuItemStatus;
  imageUrl: string | null;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
}
```

### 3-B: API Functions

**File:** `features/menu/api/menu.api.ts` (new — replaces the mock `menu.ts`)

```ts
export const menuApi = {
  getCategories: (restaurantId: string) =>
    apiClient.get<MenuCategory[]>('/api/menu-items/categories', { params: { restaurantId } }),
  createCategory: (dto: CreateMenuCategoryDto) =>
    apiClient.post<MenuCategory>('/api/menu-items/categories', dto),
  getItems: (restaurantId: string, params?: MenuItemQueryParams) =>
    apiClient.get<MenuItem[]>('/api/menu-items', { params: { restaurantId, ...params } }),
  getItem: (id: string) =>
    apiClient.get<MenuItem>(`/api/menu-items/${id}`),
  createItem: (dto: CreateMenuItemDto) =>
    apiClient.post<MenuItem>('/api/menu-items', dto),
  updateItem: (id: string, dto: Partial<CreateMenuItemDto>) =>
    apiClient.patch<MenuItem>(`/api/menu-items/${id}`, dto),
  toggleSoldOut: (id: string) =>
    apiClient.patch<MenuItem>(`/api/menu-items/${id}/sold-out`),
  deleteItem: (id: string) =>
    apiClient.delete(`/api/menu-items/${id}`),
};
```

### 3-C: Query Hooks

**File:** `features/menu/hooks/useMenuItems.ts`

```ts
export const menuKeys = {
  items: (restaurantId: string) => ['menu-items', restaurantId] as const,
  item: (id: string) => ['menu-items', 'detail', id] as const,
  categories: (restaurantId: string) => ['menu-categories', restaurantId] as const,
};

export function useMenuItems(restaurantId: string) {
  return useQuery({
    queryKey: menuKeys.items(restaurantId),
    queryFn: () => menuApi.getItems(restaurantId).then((r) => r.data),
    enabled: !!restaurantId,
  });
}
```

**File:** `features/menu/hooks/useMenuMutations.ts`

```ts
export function useCreateMenuItem(restaurantId: string) {
  return useMutation({
    mutationFn: menuApi.createItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: menuKeys.items(restaurantId) }),
  });
}
// + useUpdateMenuItem, useDeleteMenuItem, useToggleSoldOut
```

### 3-D: MenuManagementPage Wiring

Replace `mockMenuItems` / `mockMenuOverview` imports with:

```ts
const { restaurant } = useRestaurantStore();
const { data: items = [], isLoading } = useMenuItems(restaurant?.id ?? '');
const { data: categories = [] } = useMenuCategories(restaurant?.id ?? '');
```

Build `MenuOverview` stats derived from `items` array (count by status).

### 3-E: CreateMenuItemPage

The `MediaUploadCard` needs the Cloudinary image upload flow (Phase 6). For now, accept a URL string manually. The full upload flow is handled in Phase 6.

### 3-F: Category Management

`MenuManagementPage` filter tabs currently use hardcoded strings (`'Farm Fresh'`, etc.). Replace with `categories` from `useMenuCategories`. A "create category" modal should call `useCreateCategory`.

### Deliverables
| File | Action |
|---|---|
| `features/menu/types/index.ts` | Replace with API-accurate types |
| `features/menu/api/menu.api.ts` | Create (replaces `menu.ts`) |
| `features/menu/hooks/useMenuItems.ts` | Create |
| `features/menu/hooks/useMenuMutations.ts` | Create |
| `features/menu/hooks/useMenuCategories.ts` | Create |
| `features/menu/components/MenuManagementPage` (via page) | Replace mocks |
| `features/menu/components/create/*` | Wire form submit to `useCreateMenuItem` |

---

## Phase 4 — Orders Integration

Replaces the 240-line mock `initialOrders` array.

### 4-A: Types

The current `OrderStatus` (`requesting | todo | in_progress | done`) is UI-invented and does not match the API. Replace entirely:

```ts
// features/orders/types/order.types.ts — new API-accurate version

export type ApiOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'delivering'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

// Mapping to kanban column IDs
export const STATUS_TO_COLUMN: Record<ApiOrderStatus, KanbanColumnId> = {
  pending:           'requesting',
  confirmed:         'todo',
  preparing:         'in_progress',
  ready_for_pickup:  'done',
  picked_up:         'done',
  delivering:        'done',
  delivered:         'done',
  cancelled:         'done',
  refunded:          'done',
};

export type KanbanColumnId = 'requesting' | 'todo' | 'in_progress' | 'done';

export interface OrderListItem {
  orderId: string;
  status: ApiOrderStatus;
  restaurantId: string;
  restaurantName: string;
  paymentMethod: 'cod' | 'vnpay';
  totalAmount: number;
  shippingFee: number;
  itemCount: number;
  firstItemName: string;
  estimatedDeliveryMinutes: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDetail {
  orderId: string;
  status: ApiOrderStatus;
  // ... full shape from API audit
}
```

### 4-B: API Functions

**File:** `features/orders/api/orders.api.ts`

```ts
export const ordersApi = {
  // Restaurant view
  getRestaurantOrders: (params?: OrderQueryParams) =>
    apiClient.get<OrderListItem[]>('/api/restaurant/orders', { params }),
  getActiveOrders: () =>
    apiClient.get<OrderListItem[]>('/api/restaurant/orders/active'),
  getOrderDetail: (id: string) =>
    apiClient.get<OrderDetail>(`/api/orders/${id}`),
  // Lifecycle transitions
  confirmOrder: (id: string) =>
    apiClient.patch(`/api/orders/${id}/confirm`),
  startPreparing: (id: string) =>
    apiClient.patch(`/api/orders/${id}/start-preparing`),
  markReady: (id: string) =>
    apiClient.patch(`/api/orders/${id}/ready`),
  cancelOrder: (id: string, reason: string) =>
    apiClient.patch(`/api/orders/${id}/cancel`, { reason }),
};
```

### 4-C: Query Hooks

**File:** `features/orders/hooks/useOrders.ts`

```ts
export const orderKeys = {
  restaurant: (params?: OrderQueryParams) => ['orders', 'restaurant', params] as const,
  active: () => ['orders', 'restaurant', 'active'] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
};

export function useRestaurantOrders(params?: OrderQueryParams) {
  return useQuery({
    queryKey: orderKeys.restaurant(params),
    queryFn: () => ordersApi.getRestaurantOrders(params).then((r) => r.data),
    refetchInterval: 30_000, // poll every 30 s for live kitchen view
  });
}

export function useActiveOrders() {
  return useQuery({
    queryKey: orderKeys.active(),
    queryFn: () => ordersApi.getActiveOrders().then((r) => r.data),
    refetchInterval: 15_000, // faster poll for kitchen screen
  });
}
```

**File:** `features/orders/hooks/useOrderMutations.ts`

```ts
export function useConfirmOrder() {
  return useMutation({
    mutationFn: (id: string) => ordersApi.confirmOrder(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.active() });
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) });
    },
  });
}
// + useStartPreparing, useMarkReady, useCancelOrder
```

### 4-D: Replace Zustand orderStore

The current store bootstraps from `initialOrders`. After this phase:
- Remove all mock data.
- Keep `reorderOrder` for drag-and-drop **optimistic updates** only: call `useMutation` first, then update local store on success (rollback on error).
- `searchQuery` and `getOrdersByStatus` remain as UI-only filters applied to data from TanStack Query.

### 4-E: OrdersPage Wiring

```ts
const { data: orders = [] } = useActiveOrders();
// Map to kanban columns using STATUS_TO_COLUMN
```

### 4-F: OrderDetailPage Wiring

```ts
const { orderId } = useParams();
const { data: order } = useOrderDetail(orderId!);
```

The existing `OrderDetailHeader`, `OrderDetailItems`, `OrderDetailHistory` components already have the right structure — they just need the types updated and props fed from the query.

### Deliverables
| File | Action |
|---|---|
| `features/orders/types/order.types.ts` | Replace with API types |
| `features/orders/api/orders.api.ts` | Create |
| `features/orders/hooks/useOrders.ts` | Create |
| `features/orders/hooks/useOrderMutations.ts` | Create |
| `features/orders/stores/orderStore.ts` | Remove mock data, keep UI state |
| `pages/orders/OrdersPage.tsx` | Replace mock source |
| `pages/orders/OrderDetailPage.tsx` | Replace mock source |

---

## Phase 5 — Dashboard Live Stats

The `DashboardPage` currently shows hardcoded numbers (12 in progress, 08 ready). Wire to real data.

### 5-A: Derive from Active Orders Query

```ts
// In DashboardPage.tsx
const { data: active = [] } = useActiveOrders();

const preparingCount = active.filter((o) => o.status === 'preparing').length;
const readyCount     = active.filter((o) => o.status === 'ready_for_pickup').length;
const urgentCount    = readyCount; // or derive from age — see INTEGRATION_ISSUES.md #4
```

No new API calls needed — reuse `useActiveOrders` from Phase 4.

### 5-B: Store Open/Closed Toggle

Wire the Open/Closed toggle in `DashboardPage` to:

```ts
const { restaurant } = useRestaurantStore();
const { mutate: toggleOpen } = useToggleRestaurantOpen(restaurant?.id);

// In component:
const isOpen = restaurant?.isOpen ?? false;
<button onClick={() => toggleOpen(!isOpen)}>...</button>
```

`useToggleRestaurantOpen` calls `PATCH /api/restaurants/:id` with `{ isOpen: boolean }`.

### Deliverables
| File | Action |
|---|---|
| `pages/dashboard/DashboardPage.tsx` | Replace hardcoded counts |
| `features/restaurant/hooks/useRestaurantMutations.ts` | Add `useToggleRestaurantOpen` |

---

## Phase 6 — Image Upload (Cloudinary)

Needed by `CreateMenuItemPage` → `MediaUploadCard` and restaurant logo/cover image.

### 6-A: API Functions

**File:** `features/image/api/image.api.ts`

```ts
export const imageApi = {
  getSignature: (folder?: string) =>
    apiClient.get<CloudinarySignature>('/api/cloudinary/signature', { params: { folder } }),
  saveMetadata: (dto: CreateImageDto) =>
    apiClient.post<ImageResponse>('/api/images', dto),
};
```

### 6-B: Upload Hook

**File:** `features/image/hooks/useCloudinaryUpload.ts`

```ts
export function useCloudinaryUpload() {
  return useMutation({
    mutationFn: async (file: File): Promise<ImageResponse> => {
      // 1. Get signed token
      const { data: sig } = await imageApi.getSignature('menu-items');
      // 2. Upload directly to Cloudinary
      const form = new FormData();
      form.append('file', file);
      form.append('api_key', sig.apiKey);
      form.append('timestamp', String(sig.timestamp));
      form.append('signature', sig.signature);
      form.append('folder', sig.folder);
      const upload = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        { method: 'POST', body: form },
      ).then((r) => r.json());
      // 3. Persist metadata in backend
      const { data } = await imageApi.saveMetadata({
        publicId: upload.public_id,
        secureUrl: upload.secure_url,
        width: upload.width,
        height: upload.height,
      });
      return data;
    },
  });
}
```

### 6-C: MediaUploadCard Wiring

Replace the static placeholder in `MediaUploadCard.tsx` with a file input that calls `useCloudinaryUpload`. On success, pass `secureUrl` to the parent form via `react-hook-form`'s `setValue`.

### Deliverables
| File | Action |
|---|---|
| `features/image/api/image.api.ts` | Create |
| `features/image/hooks/useCloudinaryUpload.ts` | Create |
| `features/menu/components/create/MediaUploadCard.tsx` | Wire upload hook |

---

## Phase 7 — Real-time Notifications (WebSocket)

### 7-A: Socket Connection

**File:** `features/notification/lib/notification-socket.ts`

```ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectNotificationSocket(token: string): Socket {
  socket = io(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'}/notifications`, {
    auth: { token },        // NOT Authorization header — per API spec
    transports: ['websocket'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30_000,
  });
  return socket;
}

export function disconnectNotificationSocket() {
  socket?.disconnect();
  socket = null;
}
```

Note: requires `socket.io-client` package — `pnpm --filter web add socket.io-client`.

### 7-B: Notification Hook

**File:** `features/notification/hooks/useNotifications.ts`

```ts
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      apiClient.get('/api/notifications/my').then((r) => r.data),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () =>
      apiClient.get('/api/notifications/my/unread-count').then((r) => r.data),
    refetchInterval: 60_000,
  });
}
```

### 7-C: WebSocket Provider

**File:** `features/notification/components/NotificationProvider.tsx`

Wraps the app (inside `RequireAuth`). On mount, connects socket. On `notification.sent` event, calls `queryClient.invalidateQueries({ queryKey: ['notifications'] })` to refresh the inbox.

### 7-D: Dashboard Alert Integration

The "New Order Received!" alert in `DashboardPage` should listen to the `notification.sent` socket event filtered to `type === 'new_order_received'`. Show dismissable banner per new order.

### Deliverables
| File | Action |
|---|---|
| `features/notification/lib/notification-socket.ts` | Create |
| `features/notification/hooks/useNotifications.ts` | Create |
| `features/notification/components/NotificationProvider.tsx` | Create |
| `apps/web/package.json` | Add `socket.io-client` |
| `pages/dashboard/DashboardPage.tsx` | Wire new order alert to socket |

---

## Phase 8 — VNPay Return Handling

The backend's `GET /api/payments/vnpay/return` is a browser redirect that returns a JSON payload. The web app needs a dedicated `/payment/return` page that:

1. Reads `orderId` and `status` from the response.
2. Shows "Payment successful" or "Payment failed" with a link back to the order.

This only matters if the restaurant ever uses VNPay. Add the route + simple page.

---

## Execution Order Summary

```
Phase 0 — Foundation       (no user-visible change; enabler for all)
Phase 1 — Auth             (login + register work end-to-end)
Phase 2 — Restaurant       (user's restaurant context available)
Phase 3 — Menu             (menu management live)
Phase 4 — Orders           (kanban board live)
Phase 5 — Dashboard stats  (live order counts + store toggle)
Phase 6 — Image Upload     (menu item photos from Cloudinary)
Phase 7 — Notifications    (real-time alerts + inbox)
Phase 8 — VNPay return     (payment UX)
```

Each phase except 0 builds on the previous. Phases 6–8 are independent of each other.

---

## Environment Variables

Add to `apps/web/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:3000
```

Production:
```env
VITE_API_BASE_URL=https://api.yourdomain.com
```

---

## Testing Strategy

- **Phase 0–2**: Run `pnpm --filter web typecheck` after each phase. Auth can be tested manually against the live API.
- **Phase 3–5**: Use `React Query Devtools` (add to `AppProvider`) for inspecting query state during development.
- **Phase 6**: Cloudinary signature expiry is 1 hour — test upload flow with a fresh signature each time.
- **Phase 7**: Use `test.html` at `http://localhost:3000/public/test-ws.html` (already in the API's `/public` folder) to verify the WebSocket endpoint before building the frontend integration.
