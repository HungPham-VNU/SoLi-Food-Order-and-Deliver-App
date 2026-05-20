# Tổng Kết Tích Hợp API — Web App (SoLi Food)

**Ngày thực hiện:** 12/05/2026  
**Nhánh làm việc:** `integrate-api`  

---

## Tổng Quan

Tài liệu này mô tả các công việc đã hoàn thành trong phiên tích hợp API giữa web frontend (React 19 + Vite) và backend (NestJS 11) của ứng dụng SoLi Food — một nền tảng quản lý nhà hàng dành cho chủ nhà hàng/quản lý.

---

## Phase 0 — Nền Tảng (Foundation)

### Mục tiêu
Thiết lập cơ sở hạ tầng kết nối API: auth client, HTTP client, query client, và route guard.

### Các việc đã làm

#### 1. Cài đặt `better-auth` cho web
```bash
pnpm --filter web add better-auth
```
**Lý do:** `better-auth` đã được dùng ở backend và mobile. Web cần dùng `better-auth/react` để quản lý session, đăng nhập, đăng xuất mà không cần tự quản lý token thủ công.

---

#### 2. Tạo `src/lib/auth-client.ts`
**Nội dung:** Khởi tạo `authClient` từ `better-auth/react`, export các hàm `signIn`, `signUp`, `signOut`, `useSession`.

```ts
import { createAuthClient } from 'better-auth/react';
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
});
export const { signIn, signUp, signOut, useSession } = authClient;
```

**Lý do:** Tập trung logic auth vào một file duy nhất. Tất cả hook và component đều import từ đây thay vì khởi tạo client mới.

---

#### 3. Nâng cấp `src/lib/api-client.ts`
**Trước đây:** Chỉ đọc `auth_token` từ `localStorage` và gắn vào header `Authorization`.

**Sau khi sửa:**
- Thêm class `ApiError` để chuẩn hóa lỗi từ API (có `status`, `code`, `message`).
- Thêm `withCredentials: true` để gửi cookie session tự động.
- Thêm **response interceptor** tự động redirect về `/auth/login` khi nhận HTTP 401.

**Lý do:** `better-auth` dùng cookie session, không phải localStorage token. Nếu không có `withCredentials: true`, browser sẽ không gửi cookie qua CORS.

---

#### 4. Tạo `src/lib/query-client.ts`
**Nội dung:** Khởi tạo `QueryClient` chia sẻ toàn app với cấu hình:
- `staleTime: 30_000` — data được coi là "tươi" trong 30 giây, tránh fetch lại không cần thiết.
- Retry thông minh: không retry nếu lỗi là 401, 403, 404 (đây là lỗi logic, không phải lỗi mạng).

**Lý do:** Trước đây `provider.tsx` dùng `new QueryClient()` không có cấu hình, dẫn đến retry vô hạn ngay cả khi lỗi là "không tìm thấy".

---

#### 5. Tạo `src/components/auth/RequireAuth.tsx`
**Nội dung:** Route guard dùng `useSession()` từ `auth-client`. Nếu chưa đăng nhập thì redirect về `/auth/login`. Trong khi đang kiểm tra session thì hiện spinner.

**Lý do:** Bảo vệ tất cả route trong `MainLayout` (Dashboard, Orders, Menu). Không để người dùng chưa đăng nhập truy cập vào trang quản lý.

---

#### 6. Cập nhật `src/app/provider.tsx`
**Thay đổi:** Dùng `queryClient` đã tạo ở bước 4 thay vì tạo `new QueryClient()` bên trong component.

**Lý do:** Đảm bảo toàn bộ app dùng cùng một instance QueryClient — quan trọng vì cache TanStack Query là singleton.

---

#### 7. Cập nhật `src/app/router.tsx`
**Thay đổi:**
- Bọc tất cả route nằm trong `MainLayout` bằng `<RequireAuth />`.
- Thêm redirect từ `/` về `/dashboard`.
- Xóa block route `orders` bị trùng lặp (lỗi copy-paste trong file gốc).

---

## Phase 1 — Xác Thực Người Dùng (Authentication)

### Mục tiêu
Kết nối form đăng nhập và đăng ký với API thực tế, thay thế các form tĩnh không có xử lý.

### Các việc đã làm

#### 1. Tạo `src/features/auth/hooks/useSignIn.ts`
**Nội dung:** TanStack Query mutation gọi `signIn.email()` từ `better-auth`. Sau khi thành công tự động navigate về `/dashboard`.

**Xử lý lỗi:** Nếu `better-auth` trả về `result.error`, ném `ApiError` có `status`, `code`, `message` — để form hiển thị thông báo lỗi đúng chỗ.

---

#### 2. Tạo `src/features/auth/hooks/useSignUp.ts`
**Nội dung:** Tương tự `useSignIn` nhưng gọi `signUp.email()`. Sau thành công navigate về `/auth/register/business`.

---

#### 3. Nâng cấp `LoginForm.tsx`
**Trước đây:** Form tĩnh, nút `type="button"` không có xử lý.

**Sau khi sửa:**
- Dùng `react-hook-form` + `zodResolver` để validate.
- Schema Zod: `z.email()` (Zod v4) cho email, `z.string().min(1)` cho password.
- Hiển thị lỗi inline dưới mỗi field.
- Nút submit hiển thị "Authenticating…" khi đang chờ.
- Hiển thị lỗi từ server bên dưới form.

---

#### 4. Nâng cấp `RegisterForm.tsx`
**Trước đây:** Có `handleSubmit` nhưng chỉ navigate không gọi API. Dùng `React.SubmitEvent` (type không tồn tại trong React).

**Sau khi sửa:**
- Thêm field `name` (tên đầy đủ) — API yêu cầu trường này.
- Dùng `react-hook-form` + Zod.
- Gọi `useSignUp` mutation thực sự.
- Sửa link "Sign In" từ `href="#"` thành `href="/auth/login"`.

---

## Phase 2 — Ngữ Cảnh Nhà Hàng (Restaurant Context)

### Mục tiêu
Tạo đầy đủ layer tích hợp cho tính năng nhà hàng: types, schemas, API client, hooks, store, và form đăng ký.

### Vấn đề phát hiện
File `src/features/restaurant/index.ts` export các symbol không tồn tại (`RestaurantStatusToggle`, `useRestaurants`, `useRestaurantMutations`, `restaurantKeys`, `schemas/restaurant.schema`, `api/restaurant.types`) — gây lỗi TypeScript trên toàn bộ nơi import.

### Các việc đã làm

#### 1. Tạo `src/features/restaurant/api/restaurant.types.ts`
**Nội dung:** Interface `Restaurant` và `RestaurantListResponse` phản ánh đúng `RestaurantResponseDto` từ backend.

**Thay đổi quan trọng:**
- Bỏ field `isAvailable` (không có trong API).
- Thêm `isOpen`, `isApproved`, `ownerId`, `cuisineType`, `logoUrl`, `coverImageUrl`.
- `createdAt`/`updatedAt` là `string` (JSON serialize từ `Date`).

---

#### 2. Tạo `src/features/restaurant/schemas/restaurant.schema.ts`
**Nội dung:** Zod schema cho form tạo và cập nhật nhà hàng. Export type `RestaurantFormValues` và `UpdateRestaurantFormValues`.

---

#### 3. Sửa `src/features/restaurant/api/restaurant.api.ts`
**Lỗi cũ:** Tất cả đường dẫn thiếu prefix `/api` (ví dụ `/restaurants` thay vì `/api/restaurants`). NestJS backend dùng global prefix `/api`.

**Sau khi sửa:** Tất cả endpoint có prefix đúng.

---

#### 4. Tạo `src/features/restaurant/hooks/useRestaurants.ts`
**Nội dung:**
- `useMyRestaurant()`: Fetch danh sách nhà hàng, lọc theo `ownerId === session.user.id`.
  - **Workaround Issue #1:** Backend chưa có endpoint `GET /api/restaurants/mine`. Tạm thời fetch trang đầu (50 records) và filter phía client.
- `useRestaurant(id)`: Fetch một nhà hàng theo ID.

---

#### 5. Tạo `src/features/restaurant/hooks/useRestaurantMutations.ts`
**Nội dung:**
- `useCreateRestaurant()`: Mutation gọi `POST /api/restaurants`, invalidate cache sau khi tạo.
- `useUpdateRestaurant(id)`: Mutation gọi `PATCH /api/restaurants/:id`, cập nhật cache ngay lập tức (optimistic-style).

---

#### 6. Tạo `src/features/restaurant/stores/restaurantStore.ts`
**Nội dung:** Zustand store lưu `restaurant` hiện tại của user đang đăng nhập. Các trang trong MainLayout sẽ đọc từ đây thay vì fetch lại nhiều lần.

---

#### 7. Sửa `src/features/restaurant/index.ts`
**Thay đổi:** Xóa tất cả export không tồn tại, thêm export đúng cho các file vừa tạo.

---

#### 8. Nâng cấp `RegisterBusinessPage.tsx`
**Trước đây:** Dùng `React.SubmitEvent` (type không tồn tại), chỉ navigate không gọi API.

**Sau khi sửa:**
- Dùng `FormProvider` từ `react-hook-form` để chia sẻ form state xuống các component con.
- Gọi `useCreateRestaurant()` mutation khi submit.
- Hiển thị lỗi từ server nếu có.

---

#### 9. Nâng cấp `RegisterBusinessForm.tsx`
**Thay đổi:** Dùng `useFormContext()` thay vì các Input rời rạc. Hiển thị lỗi validation inline.

---

#### 10. Nâng cấp `RegisterBusinessFooter.tsx`
**Thay đổi:** Thêm prop `isPending` — disable nút "Save & Continue" và hiển thị "Saving…" khi đang gọi API.

---

## Vấn Đề Chưa Giải Quyết (Ghi Nhận)

Các vấn đề này được ghi lại trong `docs/INTEGRATION_ISSUES.md` và cần backend hoặc design xử lý:

| # | Vấn đề | Mức độ | Chủ sở hữu |
|---|--------|--------|------------|
| 1 | Không có endpoint `GET /api/restaurants/mine` | Cao | Backend |
| 2 | OrderStatus mismatch (frontend 4 status vs API 9 status) | Cao | Frontend/Design |
| 3 | Role mặc định là `user`, không tạo được nhà hàng sau signup | Cao | Backend |
| 4 | Không có field "urgent" cho đơn hàng | Trung bình | Backend |
| 5 | Thiếu tax/service fee trong order totals | Trung bình | Backend |

---

## Các Phase Còn Lại (Chưa Làm)

| Phase | Tên | Mô tả |
|-------|-----|-------|
| 3 | Menu | Thay mock data bằng API thật, tạo hooks cho menu items và categories |
| 4 | Orders | Thay mock orderStore, tạo mapping API status → cột Kanban |
| 5 | Dashboard | Kết nối số liệu thực tế, toggle open/closed nhà hàng |
| 6 | Images | Tích hợp Cloudinary upload |
| 7 | Notifications | WebSocket socket.io-client |
| 8 | VNPay | Trang `/payment/return` |

---

## Hướng Dẫn Kiểm Tra

Xem phần tiếp theo trong tài liệu này.

---

## Cấu Trúc File Đã Tạo/Sửa

```
apps/web/src/
├── lib/
│   ├── auth-client.ts          ← MỚI: better-auth React client
│   ├── api-client.ts           ← SỬA: ApiError, 401 interceptor, withCredentials
│   └── query-client.ts         ← MỚI: QueryClient với cấu hình chuẩn
├── components/
│   └── auth/
│       └── RequireAuth.tsx     ← MỚI: Route guard
├── app/
│   ├── provider.tsx            ← SỬA: dùng shared queryClient
│   ├── router.tsx              ← SỬA: RequireAuth wrapper, bỏ duplicate route
│   └── pages/auth/register/
│       └── RegisterBusinessPage.tsx  ← SỬA: FormProvider + useCreateRestaurant
└── features/
    ├── auth/
    │   ├── hooks/
    │   │   ├── useSignIn.ts    ← MỚI
    │   │   └── useSignUp.ts    ← MỚI
    │   └── components/
    │       ├── login/LoginForm.tsx          ← SỬA: react-hook-form + zod
    │       └── register/
    │           ├── RegisterForm.tsx         ← SỬA: react-hook-form + zod
    │           ├── RegisterBusinessForm.tsx ← SỬA: useFormContext()
    │           └── RegisterBusinessFooter.tsx ← SỬA: isPending prop
    └── restaurant/
        ├── api/
        │   ├── restaurant.types.ts  ← MỚI
        │   └── restaurant.api.ts    ← SỬA: /api prefix
        ├── schemas/
        │   └── restaurant.schema.ts ← MỚI
        ├── hooks/
        │   ├── useRestaurants.ts    ← MỚI
        │   └── useRestaurantMutations.ts ← MỚI
        ├── stores/
        │   └── restaurantStore.ts   ← MỚI
        └── index.ts                 ← SỬA: fixed barrel exports
```
