/**
 * Seed for Ẩm thực Á Đông
 *
 * Run:  pnpm db:seed:adong
 *
 * Self-contained — creates the restaurant (isApproved=true, isOpen=true) and
 * its owner user on every run. All inserts use onConflictDoNothing so it is
 * safe to re-run. Snapshot upserts overwrite stale data.
 *
 * Shipper is resolved at runtime from the first user with role='shipper'.
 *
 * Fixed IDs (ad-namespace — no collision with main seed):
 * ─────────────────────────────────────────────────────────────────────────────
 *  OWNER USER
 *    Á Đông Owner : ad000020-0000-4000-8000-000000000001
 *
 *  RESTAURANT
 *    Ẩm thực Á Đông : ad000000-0000-4000-8000-000000000001
 *
 *  DELIVERY ZONES
 *    Nội thành (3 km) : ad000010-0000-4000-8000-000000000001
 *    Mở rộng (7 km)   : ad000010-0000-4000-8000-000000000002
 *
 *  CATEGORIES
 *    Món Chính  : ad000001-0000-4000-8000-000000000001
 *    Dim Sum    : ad000002-0000-4000-8000-000000000002
 *    Mì & Bún   : ad000003-0000-4000-8000-000000000003
 *    Đồ Uống    : ad000004-0000-4000-8000-000000000004
 *
 *  MENU ITEMS (15)
 *    Cơm Gà Hải Nam       : ad001001-0000-4000-8000-000000000001
 *    Vịt Quay Bắc Kinh    : ad001002-0000-4000-8000-000000000002
 *    Gà Kung Pao          : ad001003-0000-4000-8000-000000000003
 *    Cá Hồi Teriyaki      : ad001004-0000-4000-8000-000000000004
 *    Cơm Chiên Dương Châu : ad001005-0000-4000-8000-000000000005
 *    Lẩu Thái Chua Cay    : ad001006-0000-4000-8000-000000000006
 *    Há Cảo Tôm           : ad001007-0000-4000-8000-000000000007
 *    Sủi Cảo Hấp          : ad001008-0000-4000-8000-000000000008
 *    Bánh Bao Xá Xíu      : ad001009-0000-4000-8000-000000000009
 *    Mì Vịt Tiềm          : ad001010-0000-4000-8000-000000000010
 *    Bún Bò Nam Bộ        : ad001011-0000-4000-8000-000000000011
 *    Mì Xào Hải Sản       : ad001012-0000-4000-8000-000000000012
 *    Phở Cuốn Bò          : ad001013-0000-4000-8000-000000000013
 *    Trà Ô Long Sữa       : ad001014-0000-4000-8000-000000000014
 *    Nước Chanh Muối      : ad001015-0000-4000-8000-000000000015
 * ─────────────────────────────────────────────────────────────────────────────
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, inArray } from 'drizzle-orm';
import { Pool } from 'pg';

import { hashPassword } from 'better-auth/crypto';
import { user, account } from '../../module/auth/auth.schema';
import {
  deliveryZones,
  restaurants,
} from '../../module/restaurant-catalog/restaurant/restaurant.schema';
import {
  menuCategories,
  menuItems,
  modifierGroups,
  modifierOptions,
} from '../../module/restaurant-catalog/menu/menu.schema';
import {
  orders,
  orderItems,
  orderStatusLogs,
} from '../../module/ordering/order/order.schema';
import type {
  CancellationReason,
  OrderModifier,
} from '../../module/ordering/order/order.schema';
import { orderingRestaurantSnapshots } from '../../module/ordering/acl/schemas/restaurant-snapshot.schema';
import { orderingMenuItemSnapshots } from '../../module/ordering/acl/schemas/menu-item-snapshot.schema';
import { orderingDeliveryZoneSnapshots } from '../../module/ordering/acl/schemas/delivery-zone-snapshot.schema';
import { reviews } from '../../module/review/domain/review.schema';
import { paymentTransactions } from '../../module/payment/domain/payment-transaction.schema';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not defined');
}

const localDatabaseHosts = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'host.docker.internal',
  'postgres',
]);

function getSslConfig(url: string): false | { rejectUnauthorized: boolean } {
  try {
    if (localDatabaseHosts.has(new URL(url).hostname)) return false;
  } catch {
    // If the URL is malformed, let pg surface the connection error.
  }

  return { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: getSslConfig(databaseUrl),
  max: 1,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 5_000,
});

const db = drizzle(pool);

// ─── Constants ────────────────────────────────────────────────────────────────

const OWNER_USER_ID = 'ad000020-0000-4000-8000-000000000001';
const OWNER_ACCOUNT_ID = 'ad000021-0000-4000-8000-000000000001';
const OWNER_PASSWORD = 'password1234';
const RESTAURANT_ID = 'ad000000-0000-4000-8000-000000000001';
const RESTAURANT_NAME = 'Ẩm thực Á Đông';

const RESTAURANT_DATA = {
  id: RESTAURANT_ID,
  ownerId: OWNER_USER_ID,
  name: RESTAURANT_NAME,
  description:
    'Nhà hàng chuyên các món Á Đông — Trung, Nhật, Việt, Thái giao thoa tinh tế.',
  address: '15 Đinh Tiên Hoàng, Quận 1, TP.HCM',
  phone: '+84-28-3822-1234',
  cuisineType: 'Á Đông',
  latitude: 10.7769,
  longitude: 106.7009,
  isOpen: true,
  isApproved: true,
};
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';

// ─── Fixed IDs ────────────────────────────────────────────────────────────────

const IDS = {
  // ── Delivery Zones ─────────────────────────────────────────────────────────
  zoneInner: 'ad000010-0000-4000-8000-000000000001',
  zoneWide: 'ad000010-0000-4000-8000-000000000002',

  // ── Categories ─────────────────────────────────────────────────────────────
  catMains: 'ad000001-0000-4000-8000-000000000001',
  catDimSum: 'ad000002-0000-4000-8000-000000000002',
  catNoodles: 'ad000003-0000-4000-8000-000000000003',
  catDrinks: 'ad000004-0000-4000-8000-000000000004',

  // ── Menu Items ─────────────────────────────────────────────────────────────
  iComGa: 'ad001001-0000-4000-8000-000000000001', // Cơm Gà Hải Nam
  iVitQuay: 'ad001002-0000-4000-8000-000000000002', // Vịt Quay Bắc Kinh
  iGaKung: 'ad001003-0000-4000-8000-000000000003', // Gà Kung Pao
  iCaHoi: 'ad001004-0000-4000-8000-000000000004', // Cá Hồi Teriyaki
  iComChien: 'ad001005-0000-4000-8000-000000000005', // Cơm Chiên Dương Châu
  iLauThai: 'ad001006-0000-4000-8000-000000000006', // Lẩu Thái Chua Cay
  iHaCao: 'ad001007-0000-4000-8000-000000000007', // Há Cảo Tôm
  iSuiCao: 'ad001008-0000-4000-8000-000000000008', // Sủi Cảo Hấp
  iBanhBao: 'ad001009-0000-4000-8000-000000000009', // Bánh Bao Xá Xíu
  iMiVit: 'ad001010-0000-4000-8000-000000000010', // Mì Vịt Tiềm
  iBunBo: 'ad001011-0000-4000-8000-000000000011', // Bún Bò Nam Bộ
  iMiXao: 'ad001012-0000-4000-8000-000000000012', // Mì Xào Hải Sản
  iPhoQuon: 'ad001013-0000-4000-8000-000000000013', // Phở Cuốn Bò
  iTraOLong: 'ad001014-0000-4000-8000-000000000014', // Trà Ô Long Sữa
  iNuocChanh: 'ad001015-0000-4000-8000-000000000015', // Nước Chanh Muối

  // ── Modifier Groups ────────────────────────────────────────────────────────
  grpComGaSize: 'ad002001-0000-4000-8000-000000000001', // Cơm Gà — Cỡ phần
  grpComChienSize: 'ad002002-0000-4000-8000-000000000002', // Cơm Chiên — Cỡ phần
  grpGaSpicy: 'ad002003-0000-4000-8000-000000000003', // Gà Kung Pao — Độ cay
  grpLauSpicy: 'ad002004-0000-4000-8000-000000000004', // Lẩu Thái — Độ cay
  grpHaCaoFill: 'ad002005-0000-4000-8000-000000000005', // Há Cảo — Nhân
  grpSuiCaoFill: 'ad002006-0000-4000-8000-000000000006', // Sủi Cảo — Nhân
  grpMiVitSize: 'ad002007-0000-4000-8000-000000000007', // Mì Vịt — Cỡ tô
  grpMiXaoType: 'ad002008-0000-4000-8000-000000000008', // Mì Xào — Loại mì
  grpTraSugar: 'ad002009-0000-4000-8000-000000000009', // Trà Ô Long — Mức đường
  grpTraIce: 'ad002010-0000-4000-8000-000000000010', // Trà Ô Long — Lượng đá

  // ── Modifier Options ───────────────────────────────────────────────────────
  // grpComGaSize
  optComGaS: 'ad003001-0000-4000-8000-000000000001',
  optComGaM: 'ad003002-0000-4000-8000-000000000002',
  optComGaL: 'ad003003-0000-4000-8000-000000000003',
  // grpComChienSize
  optComChienS: 'ad003004-0000-4000-8000-000000000004',
  optComChienM: 'ad003005-0000-4000-8000-000000000005',
  optComChienL: 'ad003006-0000-4000-8000-000000000006',
  // grpGaSpicy
  optGaSpicy0: 'ad003007-0000-4000-8000-000000000007',
  optGaSpicyM: 'ad003008-0000-4000-8000-000000000008',
  optGaSpicyH: 'ad003009-0000-4000-8000-000000000009',
  // grpLauSpicy
  optLauSpicy0: 'ad003010-0000-4000-8000-000000000010',
  optLauSpicyM: 'ad003011-0000-4000-8000-000000000011',
  optLauSpicyH: 'ad003012-0000-4000-8000-000000000012',
  // grpHaCaoFill
  optHaCaoTom: 'ad003013-0000-4000-8000-000000000013',
  optHaCaoTomThit: 'ad003014-0000-4000-8000-000000000014',
  optHaCaoChay: 'ad003015-0000-4000-8000-000000000015',
  // grpSuiCaoFill
  optSuiCaoThit: 'ad003016-0000-4000-8000-000000000016',
  optSuiCaoTomThit: 'ad003017-0000-4000-8000-000000000017',
  optSuiCaoChay: 'ad003018-0000-4000-8000-000000000018',
  // grpMiVitSize
  optMiVitS: 'ad003019-0000-4000-8000-000000000019',
  optMiVitM: 'ad003020-0000-4000-8000-000000000020',
  optMiVitL: 'ad003021-0000-4000-8000-000000000021',
  // grpMiXaoType
  optMiXaoTrung: 'ad003022-0000-4000-8000-000000000022',
  optMiXaoTuoi: 'ad003023-0000-4000-8000-000000000023',
  optMiXaoPhoKho: 'ad003024-0000-4000-8000-000000000024',
  // grpTraSugar
  optTraSugar0: 'ad003025-0000-4000-8000-000000000025',
  optTraSugar30: 'ad003026-0000-4000-8000-000000000026',
  optTraSugar50: 'ad003027-0000-4000-8000-000000000027',
  optTraSugar100: 'ad003028-0000-4000-8000-000000000028',
  // grpTraIce
  optTraIce0: 'ad003029-0000-4000-8000-000000000029',
  optTraIceLow: 'ad003030-0000-4000-8000-000000000030',
  optTraIceNorm: 'ad003031-0000-4000-8000-000000000031',
} as const;

// ─── Price constants (integer VND) ────────────────────────────────────────────
const FREE = 0;
const SIZE_UP = 10_000;
const SIZE_UP2 = 20_000;
const FILLING_UP = 5_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ri(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function minsAgo(n: number): Date {
  return new Date(Date.now() - n * 60_000);
}
function daysAgo(d: number, offsetMs = 0): Date {
  return new Date(Date.now() - d * 86_400_000 + offsetMs);
}

// ─── 1. Delivery zones ────────────────────────────────────────────────────────

async function seedDeliveryZones() {
  await db
    .insert(deliveryZones)
    .values([
      {
        id: IDS.zoneInner,
        restaurantId: RESTAURANT_ID,
        name: 'Nội thành (3 km)',
        radiusKm: 3,
        baseFee: 15_000,
        perKmRate: 5_000,
        avgSpeedKmh: 25,
        prepTimeMinutes: 15,
        bufferMinutes: 5,
        isActive: true,
      },
      {
        id: IDS.zoneWide,
        restaurantId: RESTAURANT_ID,
        name: 'Mở rộng (7 km)',
        radiusKm: 7,
        baseFee: 20_000,
        perKmRate: 7_000,
        avgSpeedKmh: 30,
        prepTimeMinutes: 20,
        bufferMinutes: 5,
        isActive: true,
      },
    ])
    .onConflictDoNothing();
  console.log('✅ delivery_zones (2)');
}

// ─── 2. Menu categories ───────────────────────────────────────────────────────

async function seedCategories() {
  await db
    .insert(menuCategories)
    .values([
      {
        id: IDS.catMains,
        restaurantId: RESTAURANT_ID,
        name: 'Món Chính',
        displayOrder: 1,
      },
      {
        id: IDS.catDimSum,
        restaurantId: RESTAURANT_ID,
        name: 'Dim Sum',
        displayOrder: 2,
      },
      {
        id: IDS.catNoodles,
        restaurantId: RESTAURANT_ID,
        name: 'Mì & Bún',
        displayOrder: 3,
      },
      {
        id: IDS.catDrinks,
        restaurantId: RESTAURANT_ID,
        name: 'Đồ Uống',
        displayOrder: 4,
      },
    ])
    .onConflictDoNothing();
  console.log('✅ menu_categories (4)');
}

// ─── 3. Menu items ────────────────────────────────────────────────────────────

async function seedMenuItems() {
  await db
    .insert(menuItems)
    .values([
      // ── Món Chính ─────────────────────────────────────────────────────────────
      {
        id: IDS.iComGa,
        restaurantId: RESTAURANT_ID,
        categoryId: IDS.catMains,
        name: 'Cơm Gà Hải Nam',
        description:
          'Cơm gà Hải Nam chuẩn vị — gà luộc nước gừng, cơm nấu nước hầm xương, sốt gừng và tương đen.',
        price: 95_000,
        tags: ['chicken', 'rice', 'chinese'],
        status: 'available' as const,
      },
      {
        id: IDS.iVitQuay,
        restaurantId: RESTAURANT_ID,
        categoryId: IDS.catMains,
        name: 'Vịt Quay Bắc Kinh',
        description:
          'Vịt quay Bắc Kinh da giòn — ăn kèm bánh tráng mỏng, dưa leo, hành lá và sốt hoisin.',
        price: 165_000,
        tags: ['duck', 'chinese', 'grilled'],
        status: 'available' as const,
      },
      {
        id: IDS.iGaKung,
        restaurantId: RESTAURANT_ID,
        categoryId: IDS.catMains,
        name: 'Gà Kung Pao',
        description:
          'Gà xào Tứ Xuyên — đậu phộng rang, ớt khô, hành, sốt cay ngọt đậm đà.',
        price: 125_000,
        tags: ['chicken', 'spicy', 'chinese', 'stir-fried'],
        status: 'available' as const,
      },
      {
        id: IDS.iCaHoi,
        restaurantId: RESTAURANT_ID,
        categoryId: IDS.catMains,
        name: 'Cá Hồi Teriyaki',
        description:
          'Phi lê cá hồi Na Uy áp chảo sốt teriyaki — ăn kèm cơm trắng và rau củ xào bơ.',
        price: 155_000,
        tags: ['seafood', 'japanese', 'grilled'],
        status: 'available' as const,
      },
      {
        id: IDS.iComChien,
        restaurantId: RESTAURANT_ID,
        categoryId: IDS.catMains,
        name: 'Cơm Chiên Dương Châu',
        description:
          'Cơm chiên Dương Châu — tôm, thịt xá xíu, trứng, đậu Hà Lan, cà rốt.',
        price: 80_000,
        tags: ['rice', 'chinese', 'fried'],
        status: 'available' as const,
      },
      {
        id: IDS.iLauThai,
        restaurantId: RESTAURANT_ID,
        categoryId: IDS.catMains,
        name: 'Lẩu Thái Chua Cay',
        description:
          'Lẩu Thái hải sản — tôm, mực, nghêu, nước dùng sả ớt chua cay đặc trưng.',
        price: 195_000,
        tags: ['seafood', 'spicy', 'hotpot', 'thai'],
        status: 'available' as const,
      },
      // ── Dim Sum ───────────────────────────────────────────────────────────────
      {
        id: IDS.iHaCao,
        restaurantId: RESTAURANT_ID,
        categoryId: IDS.catDimSum,
        name: 'Há Cảo Tôm',
        description:
          'Há cảo tôm tươi hấp — vỏ mỏng trong suốt, nhân tôm nguyên con giòn ngọt. 4 miếng/phần.',
        price: 65_000,
        tags: ['shrimp', 'dim-sum', 'chinese', 'steamed'],
        status: 'available' as const,
      },
      {
        id: IDS.iSuiCao,
        restaurantId: RESTAURANT_ID,
        categoryId: IDS.catDimSum,
        name: 'Sủi Cảo Hấp',
        description:
          'Sủi cảo nhân thịt heo và nấm mộc nhĩ hấp — ăn kèm nước chấm gừng chua ngọt. 5 viên/phần.',
        price: 60_000,
        tags: ['pork', 'dim-sum', 'chinese', 'steamed'],
        status: 'available' as const,
      },
      {
        id: IDS.iBanhBao,
        restaurantId: RESTAURANT_ID,
        categoryId: IDS.catDimSum,
        name: 'Bánh Bao Xá Xíu',
        description:
          'Bánh bao hấp nhân xá xíu thịt heo xào sốt oyster — vỏ mềm xốp, nhân ngọt đậm.',
        price: 45_000,
        tags: ['pork', 'dim-sum', 'steamed'],
        status: 'available' as const,
      },
      // ── Mì & Bún ──────────────────────────────────────────────────────────────
      {
        id: IDS.iMiVit,
        restaurantId: RESTAURANT_ID,
        categoryId: IDS.catNoodles,
        name: 'Mì Vịt Tiềm',
        description:
          'Mì vịt tiềm thuốc bắc — vịt hầm kỹ với kỷ tử, táo đỏ, hồi, quế; nước dùng ngọt thơm.',
        price: 110_000,
        tags: ['duck', 'noodle', 'soup', 'chinese'],
        status: 'available' as const,
      },
      {
        id: IDS.iBunBo,
        restaurantId: RESTAURANT_ID,
        categoryId: IDS.catNoodles,
        name: 'Bún Bò Nam Bộ',
        description:
          'Bún bò nam bộ — bún tươi, thịt bò xào sả ớt, đậu phộng, rau thơm và nước mắm pha chua ngọt.',
        price: 85_000,
        tags: ['beef', 'noodle', 'vietnamese'],
        status: 'available' as const,
      },
      {
        id: IDS.iMiXao,
        restaurantId: RESTAURANT_ID,
        categoryId: IDS.catNoodles,
        name: 'Mì Xào Hải Sản',
        description:
          'Mì xào hải sản — tôm, mực, cá viên, rau cải, sốt oyster đặc sánh.',
        price: 120_000,
        tags: ['seafood', 'noodle', 'stir-fried', 'chinese'],
        status: 'available' as const,
      },
      {
        id: IDS.iPhoQuon,
        restaurantId: RESTAURANT_ID,
        categoryId: IDS.catNoodles,
        name: 'Phở Cuốn Bò',
        description:
          'Phở cuốn bò tái — bánh phở mềm cuốn thịt bò, rau thơm, giá đỗ; chấm nước mắm tỏi ớt.',
        price: 75_000,
        tags: ['beef', 'vietnamese', 'fresh', 'noodle'],
        status: 'available' as const,
      },
      // ── Đồ Uống ───────────────────────────────────────────────────────────────
      {
        id: IDS.iTraOLong,
        restaurantId: RESTAURANT_ID,
        categoryId: IDS.catDrinks,
        name: 'Trà Ô Long Sữa',
        description:
          'Trà ô long Đài Loan pha sữa tươi — chọn mức đường và đá theo ý thích.',
        price: 45_000,
        tags: ['tea', 'cold', 'milk-tea'],
        status: 'available' as const,
      },
      {
        id: IDS.iNuocChanh,
        restaurantId: RESTAURANT_ID,
        categoryId: IDS.catDrinks,
        name: 'Nước Chanh Muối',
        description:
          'Nước chanh muối đá — thanh mát, cân bằng vị mặn chua ngọt.',
        price: 25_000,
        tags: ['cold', 'fresh', 'lemonade'],
        status: 'available' as const,
      },
    ])
    .onConflictDoNothing();
  console.log('✅ menu_items (15)');
}

// ─── 4. Modifier groups ───────────────────────────────────────────────────────

async function seedModifierGroups() {
  await db
    .insert(modifierGroups)
    .values([
      {
        id: IDS.grpComGaSize,
        menuItemId: IDS.iComGa,
        name: 'Cỡ phần',
        minSelections: 1,
        maxSelections: 1,
        displayOrder: 1,
      },
      {
        id: IDS.grpComChienSize,
        menuItemId: IDS.iComChien,
        name: 'Cỡ phần',
        minSelections: 1,
        maxSelections: 1,
        displayOrder: 1,
      },
      {
        id: IDS.grpGaSpicy,
        menuItemId: IDS.iGaKung,
        name: 'Độ cay',
        minSelections: 1,
        maxSelections: 1,
        displayOrder: 1,
      },
      {
        id: IDS.grpLauSpicy,
        menuItemId: IDS.iLauThai,
        name: 'Độ cay',
        minSelections: 1,
        maxSelections: 1,
        displayOrder: 1,
      },
      {
        id: IDS.grpHaCaoFill,
        menuItemId: IDS.iHaCao,
        name: 'Nhân',
        minSelections: 1,
        maxSelections: 1,
        displayOrder: 1,
      },
      {
        id: IDS.grpSuiCaoFill,
        menuItemId: IDS.iSuiCao,
        name: 'Nhân',
        minSelections: 1,
        maxSelections: 1,
        displayOrder: 1,
      },
      {
        id: IDS.grpMiVitSize,
        menuItemId: IDS.iMiVit,
        name: 'Cỡ tô',
        minSelections: 1,
        maxSelections: 1,
        displayOrder: 1,
      },
      {
        id: IDS.grpMiXaoType,
        menuItemId: IDS.iMiXao,
        name: 'Loại mì',
        minSelections: 1,
        maxSelections: 1,
        displayOrder: 1,
      },
      {
        id: IDS.grpTraSugar,
        menuItemId: IDS.iTraOLong,
        name: 'Mức đường',
        minSelections: 1,
        maxSelections: 1,
        displayOrder: 1,
      },
      {
        id: IDS.grpTraIce,
        menuItemId: IDS.iTraOLong,
        name: 'Lượng đá',
        minSelections: 1,
        maxSelections: 1,
        displayOrder: 2,
      },
    ])
    .onConflictDoNothing();
  console.log('✅ modifier_groups (10)');
}

// ─── 5. Modifier options ──────────────────────────────────────────────────────

async function seedModifierOptions() {
  await db
    .insert(modifierOptions)
    .values([
      // grpComGaSize — Cỡ phần (Cơm Gà Hải Nam)
      {
        id: IDS.optComGaS,
        groupId: IDS.grpComGaSize,
        name: 'Nhỏ',
        price: FREE,
        isDefault: false,
        displayOrder: 1,
      },
      {
        id: IDS.optComGaM,
        groupId: IDS.grpComGaSize,
        name: 'Vừa',
        price: FREE,
        isDefault: true,
        displayOrder: 2,
      },
      {
        id: IDS.optComGaL,
        groupId: IDS.grpComGaSize,
        name: 'Lớn',
        price: SIZE_UP,
        isDefault: false,
        displayOrder: 3,
      },

      // grpComChienSize — Cỡ phần (Cơm Chiên Dương Châu)
      {
        id: IDS.optComChienS,
        groupId: IDS.grpComChienSize,
        name: 'Nhỏ',
        price: FREE,
        isDefault: false,
        displayOrder: 1,
      },
      {
        id: IDS.optComChienM,
        groupId: IDS.grpComChienSize,
        name: 'Vừa',
        price: FREE,
        isDefault: true,
        displayOrder: 2,
      },
      {
        id: IDS.optComChienL,
        groupId: IDS.grpComChienSize,
        name: 'Lớn',
        price: SIZE_UP,
        isDefault: false,
        displayOrder: 3,
      },

      // grpGaSpicy — Độ cay (Gà Kung Pao)
      {
        id: IDS.optGaSpicy0,
        groupId: IDS.grpGaSpicy,
        name: 'Không cay',
        price: FREE,
        isDefault: false,
        displayOrder: 1,
      },
      {
        id: IDS.optGaSpicyM,
        groupId: IDS.grpGaSpicy,
        name: 'Cay vừa',
        price: FREE,
        isDefault: true,
        displayOrder: 2,
      },
      {
        id: IDS.optGaSpicyH,
        groupId: IDS.grpGaSpicy,
        name: 'Cay nhiều',
        price: FREE,
        isDefault: false,
        displayOrder: 3,
      },

      // grpLauSpicy — Độ cay (Lẩu Thái)
      {
        id: IDS.optLauSpicy0,
        groupId: IDS.grpLauSpicy,
        name: 'Không cay',
        price: FREE,
        isDefault: false,
        displayOrder: 1,
      },
      {
        id: IDS.optLauSpicyM,
        groupId: IDS.grpLauSpicy,
        name: 'Cay vừa',
        price: FREE,
        isDefault: true,
        displayOrder: 2,
      },
      {
        id: IDS.optLauSpicyH,
        groupId: IDS.grpLauSpicy,
        name: 'Cay nhiều',
        price: FREE,
        isDefault: false,
        displayOrder: 3,
      },

      // grpHaCaoFill — Nhân (Há Cảo)
      {
        id: IDS.optHaCaoTom,
        groupId: IDS.grpHaCaoFill,
        name: 'Tôm',
        price: FREE,
        isDefault: true,
        displayOrder: 1,
      },
      {
        id: IDS.optHaCaoTomThit,
        groupId: IDS.grpHaCaoFill,
        name: 'Tôm + Thịt',
        price: FILLING_UP,
        isDefault: false,
        displayOrder: 2,
      },
      {
        id: IDS.optHaCaoChay,
        groupId: IDS.grpHaCaoFill,
        name: 'Chay',
        price: FREE,
        isDefault: false,
        displayOrder: 3,
      },

      // grpSuiCaoFill — Nhân (Sủi Cảo)
      {
        id: IDS.optSuiCaoThit,
        groupId: IDS.grpSuiCaoFill,
        name: 'Thịt heo',
        price: FREE,
        isDefault: true,
        displayOrder: 1,
      },
      {
        id: IDS.optSuiCaoTomThit,
        groupId: IDS.grpSuiCaoFill,
        name: 'Tôm + Thịt',
        price: FILLING_UP,
        isDefault: false,
        displayOrder: 2,
      },
      {
        id: IDS.optSuiCaoChay,
        groupId: IDS.grpSuiCaoFill,
        name: 'Chay',
        price: FREE,
        isDefault: false,
        displayOrder: 3,
      },

      // grpMiVitSize — Cỡ tô (Mì Vịt Tiềm)
      {
        id: IDS.optMiVitS,
        groupId: IDS.grpMiVitSize,
        name: 'Nhỏ',
        price: FREE,
        isDefault: false,
        displayOrder: 1,
      },
      {
        id: IDS.optMiVitM,
        groupId: IDS.grpMiVitSize,
        name: 'Vừa',
        price: FREE,
        isDefault: true,
        displayOrder: 2,
      },
      {
        id: IDS.optMiVitL,
        groupId: IDS.grpMiVitSize,
        name: 'Lớn',
        price: SIZE_UP,
        isDefault: false,
        displayOrder: 3,
      },

      // grpMiXaoType — Loại mì (Mì Xào Hải Sản)
      {
        id: IDS.optMiXaoTrung,
        groupId: IDS.grpMiXaoType,
        name: 'Mì trứng',
        price: FREE,
        isDefault: true,
        displayOrder: 1,
      },
      {
        id: IDS.optMiXaoTuoi,
        groupId: IDS.grpMiXaoType,
        name: 'Mì tươi',
        price: FREE,
        isDefault: false,
        displayOrder: 2,
      },
      {
        id: IDS.optMiXaoPhoKho,
        groupId: IDS.grpMiXaoType,
        name: 'Phở khô',
        price: FREE,
        isDefault: false,
        displayOrder: 3,
      },

      // grpTraSugar — Mức đường (Trà Ô Long)
      {
        id: IDS.optTraSugar0,
        groupId: IDS.grpTraSugar,
        name: '0% đường',
        price: FREE,
        isDefault: false,
        displayOrder: 1,
      },
      {
        id: IDS.optTraSugar30,
        groupId: IDS.grpTraSugar,
        name: '30% đường',
        price: FREE,
        isDefault: false,
        displayOrder: 2,
      },
      {
        id: IDS.optTraSugar50,
        groupId: IDS.grpTraSugar,
        name: '50% đường',
        price: FREE,
        isDefault: true,
        displayOrder: 3,
      },
      {
        id: IDS.optTraSugar100,
        groupId: IDS.grpTraSugar,
        name: '100% đường',
        price: FREE,
        isDefault: false,
        displayOrder: 4,
      },

      // grpTraIce — Lượng đá (Trà Ô Long)
      {
        id: IDS.optTraIce0,
        groupId: IDS.grpTraIce,
        name: 'Không đá',
        price: FREE,
        isDefault: false,
        displayOrder: 1,
      },
      {
        id: IDS.optTraIceLow,
        groupId: IDS.grpTraIce,
        name: 'Ít đá',
        price: FREE,
        isDefault: false,
        displayOrder: 2,
      },
      {
        id: IDS.optTraIceNorm,
        groupId: IDS.grpTraIce,
        name: 'Bình thường',
        price: FREE,
        isDefault: true,
        displayOrder: 3,
      },
    ])
    .onConflictDoNothing();
  console.log('✅ modifier_options (31)');
}

// ─── 6. Ordering snapshots ────────────────────────────────────────────────────

async function seedSnapshots(restaurantRow: {
  name: string;
  address: string;
  cuisineType: string | null;
  latitude: number | null;
  longitude: number | null;
  isOpen: boolean;
  isApproved: boolean;
  ownerId: string;
}) {
  // Restaurant snapshot
  await db
    .insert(orderingRestaurantSnapshots)
    .values({
      restaurantId: RESTAURANT_ID,
      name: restaurantRow.name,
      isOpen: restaurantRow.isOpen,
      isApproved: restaurantRow.isApproved,
      address: restaurantRow.address,
      cuisineType: restaurantRow.cuisineType,
      latitude: restaurantRow.latitude,
      longitude: restaurantRow.longitude,
      ownerId: restaurantRow.ownerId,
    })
    .onConflictDoUpdate({
      target: orderingRestaurantSnapshots.restaurantId,
      set: {
        name: restaurantRow.name,
        isOpen: restaurantRow.isOpen,
        address: restaurantRow.address,
        cuisineType: restaurantRow.cuisineType,
        latitude: restaurantRow.latitude,
        longitude: restaurantRow.longitude,
      },
    });

  // Menu item snapshots
  const items = [
    {
      id: IDS.iComGa,
      name: 'Cơm Gà Hải Nam',
      price: 95_000,
      grps: [
        {
          gid: IDS.grpComGaSize,
          gname: 'Cỡ phần',
          min: 1,
          max: 1,
          opts: [
            { oid: IDS.optComGaS, name: 'Nhỏ', price: FREE, isDefault: false },
            { oid: IDS.optComGaM, name: 'Vừa', price: FREE, isDefault: true },
            {
              oid: IDS.optComGaL,
              name: 'Lớn',
              price: SIZE_UP,
              isDefault: false,
            },
          ],
        },
      ],
    },
    { id: IDS.iVitQuay, name: 'Vịt Quay Bắc Kinh', price: 165_000, grps: [] },
    {
      id: IDS.iGaKung,
      name: 'Gà Kung Pao',
      price: 125_000,
      grps: [
        {
          gid: IDS.grpGaSpicy,
          gname: 'Độ cay',
          min: 1,
          max: 1,
          opts: [
            {
              oid: IDS.optGaSpicy0,
              name: 'Không cay',
              price: FREE,
              isDefault: false,
            },
            {
              oid: IDS.optGaSpicyM,
              name: 'Cay vừa',
              price: FREE,
              isDefault: true,
            },
            {
              oid: IDS.optGaSpicyH,
              name: 'Cay nhiều',
              price: FREE,
              isDefault: false,
            },
          ],
        },
      ],
    },
    { id: IDS.iCaHoi, name: 'Cá Hồi Teriyaki', price: 155_000, grps: [] },
    {
      id: IDS.iComChien,
      name: 'Cơm Chiên Dương Châu',
      price: 80_000,
      grps: [
        {
          gid: IDS.grpComChienSize,
          gname: 'Cỡ phần',
          min: 1,
          max: 1,
          opts: [
            {
              oid: IDS.optComChienS,
              name: 'Nhỏ',
              price: FREE,
              isDefault: false,
            },
            {
              oid: IDS.optComChienM,
              name: 'Vừa',
              price: FREE,
              isDefault: true,
            },
            {
              oid: IDS.optComChienL,
              name: 'Lớn',
              price: SIZE_UP,
              isDefault: false,
            },
          ],
        },
      ],
    },
    {
      id: IDS.iLauThai,
      name: 'Lẩu Thái Chua Cay',
      price: 195_000,
      grps: [
        {
          gid: IDS.grpLauSpicy,
          gname: 'Độ cay',
          min: 1,
          max: 1,
          opts: [
            {
              oid: IDS.optLauSpicy0,
              name: 'Không cay',
              price: FREE,
              isDefault: false,
            },
            {
              oid: IDS.optLauSpicyM,
              name: 'Cay vừa',
              price: FREE,
              isDefault: true,
            },
            {
              oid: IDS.optLauSpicyH,
              name: 'Cay nhiều',
              price: FREE,
              isDefault: false,
            },
          ],
        },
      ],
    },
    {
      id: IDS.iHaCao,
      name: 'Há Cảo Tôm',
      price: 65_000,
      grps: [
        {
          gid: IDS.grpHaCaoFill,
          gname: 'Nhân',
          min: 1,
          max: 1,
          opts: [
            { oid: IDS.optHaCaoTom, name: 'Tôm', price: FREE, isDefault: true },
            {
              oid: IDS.optHaCaoTomThit,
              name: 'Tôm + Thịt',
              price: FILLING_UP,
              isDefault: false,
            },
            {
              oid: IDS.optHaCaoChay,
              name: 'Chay',
              price: FREE,
              isDefault: false,
            },
          ],
        },
      ],
    },
    {
      id: IDS.iSuiCao,
      name: 'Sủi Cảo Hấp',
      price: 60_000,
      grps: [
        {
          gid: IDS.grpSuiCaoFill,
          gname: 'Nhân',
          min: 1,
          max: 1,
          opts: [
            {
              oid: IDS.optSuiCaoThit,
              name: 'Thịt heo',
              price: FREE,
              isDefault: true,
            },
            {
              oid: IDS.optSuiCaoTomThit,
              name: 'Tôm + Thịt',
              price: FILLING_UP,
              isDefault: false,
            },
            {
              oid: IDS.optSuiCaoChay,
              name: 'Chay',
              price: FREE,
              isDefault: false,
            },
          ],
        },
      ],
    },
    { id: IDS.iBanhBao, name: 'Bánh Bao Xá Xíu', price: 45_000, grps: [] },
    {
      id: IDS.iMiVit,
      name: 'Mì Vịt Tiềm',
      price: 110_000,
      grps: [
        {
          gid: IDS.grpMiVitSize,
          gname: 'Cỡ tô',
          min: 1,
          max: 1,
          opts: [
            { oid: IDS.optMiVitS, name: 'Nhỏ', price: FREE, isDefault: false },
            { oid: IDS.optMiVitM, name: 'Vừa', price: FREE, isDefault: true },
            {
              oid: IDS.optMiVitL,
              name: 'Lớn',
              price: SIZE_UP,
              isDefault: false,
            },
          ],
        },
      ],
    },
    { id: IDS.iBunBo, name: 'Bún Bò Nam Bộ', price: 85_000, grps: [] },
    {
      id: IDS.iMiXao,
      name: 'Mì Xào Hải Sản',
      price: 120_000,
      grps: [
        {
          gid: IDS.grpMiXaoType,
          gname: 'Loại mì',
          min: 1,
          max: 1,
          opts: [
            {
              oid: IDS.optMiXaoTrung,
              name: 'Mì trứng',
              price: FREE,
              isDefault: true,
            },
            {
              oid: IDS.optMiXaoTuoi,
              name: 'Mì tươi',
              price: FREE,
              isDefault: false,
            },
            {
              oid: IDS.optMiXaoPhoKho,
              name: 'Phở khô',
              price: FREE,
              isDefault: false,
            },
          ],
        },
      ],
    },
    { id: IDS.iPhoQuon, name: 'Phở Cuốn Bò', price: 75_000, grps: [] },
    {
      id: IDS.iTraOLong,
      name: 'Trà Ô Long Sữa',
      price: 45_000,
      grps: [
        {
          gid: IDS.grpTraSugar,
          gname: 'Mức đường',
          min: 1,
          max: 1,
          opts: [
            {
              oid: IDS.optTraSugar0,
              name: '0% đường',
              price: FREE,
              isDefault: false,
            },
            {
              oid: IDS.optTraSugar30,
              name: '30% đường',
              price: FREE,
              isDefault: false,
            },
            {
              oid: IDS.optTraSugar50,
              name: '50% đường',
              price: FREE,
              isDefault: true,
            },
            {
              oid: IDS.optTraSugar100,
              name: '100% đường',
              price: FREE,
              isDefault: false,
            },
          ],
        },
        {
          gid: IDS.grpTraIce,
          gname: 'Lượng đá',
          min: 1,
          max: 1,
          opts: [
            {
              oid: IDS.optTraIce0,
              name: 'Không đá',
              price: FREE,
              isDefault: false,
            },
            {
              oid: IDS.optTraIceLow,
              name: 'Ít đá',
              price: FREE,
              isDefault: false,
            },
            {
              oid: IDS.optTraIceNorm,
              name: 'Bình thường',
              price: FREE,
              isDefault: true,
            },
          ],
        },
      ],
    },
    { id: IDS.iNuocChanh, name: 'Nước Chanh Muối', price: 25_000, grps: [] },
  ];

  for (const item of items) {
    const modifiers = item.grps.map((g) => ({
      groupId: g.gid,
      groupName: g.gname,
      minSelections: g.min,
      maxSelections: g.max,
      options: g.opts.map((o) => ({
        optionId: o.oid,
        name: o.name,
        price: o.price,
        isDefault: o.isDefault,
        isAvailable: true,
      })),
    }));

    await db
      .insert(orderingMenuItemSnapshots)
      .values({
        menuItemId: item.id,
        restaurantId: RESTAURANT_ID,
        name: item.name,
        price: item.price,
        status: 'available' as const,
        modifiers,
      })
      .onConflictDoUpdate({
        target: orderingMenuItemSnapshots.menuItemId,
        set: { name: item.name, price: item.price, modifiers },
      });
  }

  // Delivery zone snapshots
  const zones = [
    {
      id: IDS.zoneInner,
      name: 'Nội thành (3 km)',
      radiusKm: 3,
      baseFee: 15_000,
      perKmRate: 5_000,
      avgSpeedKmh: 25,
      prepTimeMinutes: 15,
      bufferMinutes: 5,
    },
    {
      id: IDS.zoneWide,
      name: 'Mở rộng (7 km)',
      radiusKm: 7,
      baseFee: 20_000,
      perKmRate: 7_000,
      avgSpeedKmh: 30,
      prepTimeMinutes: 20,
      bufferMinutes: 5,
    },
  ];
  for (const z of zones) {
    await db
      .insert(orderingDeliveryZoneSnapshots)
      .values({
        zoneId: z.id,
        restaurantId: RESTAURANT_ID,
        name: z.name,
        radiusKm: z.radiusKm,
        baseFee: z.baseFee,
        perKmRate: z.perKmRate,
        avgSpeedKmh: z.avgSpeedKmh,
        prepTimeMinutes: z.prepTimeMinutes,
        bufferMinutes: z.bufferMinutes,
        isActive: true,
        isDeleted: false,
      })
      .onConflictDoUpdate({
        target: orderingDeliveryZoneSnapshots.zoneId,
        set: { isActive: true, isDeleted: false },
      });
  }

  console.log('✅ ordering_snapshots (restaurant + 15 items + 2 zones)');
}

// ─── 7. Lifecycle orders (15) ─────────────────────────────────────────────────

const DELIVERY_ADDRESSES = [
  {
    street: '23 Lý Tự Trọng',
    district: 'Quận 1',
    city: 'TP.HCM',
    latitude: 10.7745,
    longitude: 106.7012,
  },
  {
    street: '88 Nguyễn Thị Minh Khai',
    district: 'Quận 3',
    city: 'TP.HCM',
    latitude: 10.7798,
    longitude: 106.6901,
  },
  {
    street: '12 Võ Văn Kiệt',
    district: 'Quận 1',
    city: 'TP.HCM',
    latitude: 10.7655,
    longitude: 106.6987,
  },
  {
    street: '56 Đinh Tiên Hoàng',
    district: 'Quận Bình Thạnh',
    city: 'TP.HCM',
    latitude: 10.8015,
    longitude: 106.7143,
  },
  {
    street: '77 Cách Mạng Tháng 8',
    district: 'Quận 10',
    city: 'TP.HCM',
    latitude: 10.773,
    longitude: 106.6692,
  },
];

function makeModifier(
  groupId: string,
  groupName: string,
  optionId: string,
  optionName: string,
  price: number,
): OrderModifier {
  return { groupId, groupName, optionId, optionName, price };
}

async function seedLifecycleOrders(shipperId: string | null) {
  type LifecycleDef = {
    label: string;
    status:
      | 'pending'
      | 'confirmed'
      | 'preparing'
      | 'ready_for_pickup'
      | 'delivering'
      | 'delivered'
      | 'cancelled';
    paymentMethod: 'cod' | 'vnpay';
    cancellationReason?: CancellationReason;
    items: Array<{
      menuItemId: string;
      itemName: string;
      unitPrice: number;
      modifiersPrice: number;
      quantity: number;
      modifiers: OrderModifier[];
    }>;
  };

  const defs: LifecycleDef[] = [
    // ── pending (2) ────────────────────────────────────────────────────────────
    {
      label: 'Pending #1',
      status: 'pending',
      paymentMethod: 'cod',
      items: [
        {
          menuItemId: IDS.iComGa,
          itemName: 'Cơm Gà Hải Nam',
          unitPrice: 95_000,
          modifiersPrice: 0,
          quantity: 2,
          modifiers: [
            makeModifier(
              IDS.grpComGaSize,
              'Cỡ phần',
              IDS.optComGaM,
              'Vừa',
              FREE,
            ),
          ],
        },
        {
          menuItemId: IDS.iHaCao,
          itemName: 'Há Cảo Tôm',
          unitPrice: 65_000,
          modifiersPrice: 0,
          quantity: 1,
          modifiers: [
            makeModifier(
              IDS.grpHaCaoFill,
              'Nhân',
              IDS.optHaCaoTom,
              'Tôm',
              FREE,
            ),
          ],
        },
      ],
    },
    {
      label: 'Pending #2',
      status: 'pending',
      paymentMethod: 'vnpay',
      items: [
        {
          menuItemId: IDS.iGaKung,
          itemName: 'Gà Kung Pao',
          unitPrice: 125_000,
          modifiersPrice: 0,
          quantity: 1,
          modifiers: [
            makeModifier(
              IDS.grpGaSpicy,
              'Độ cay',
              IDS.optGaSpicyH,
              'Cay nhiều',
              FREE,
            ),
          ],
        },
        {
          menuItemId: IDS.iMiXao,
          itemName: 'Mì Xào Hải Sản',
          unitPrice: 120_000,
          modifiersPrice: 0,
          quantity: 1,
          modifiers: [
            makeModifier(
              IDS.grpMiXaoType,
              'Loại mì',
              IDS.optMiXaoTuoi,
              'Mì tươi',
              FREE,
            ),
          ],
        },
        {
          menuItemId: IDS.iTraOLong,
          itemName: 'Trà Ô Long Sữa',
          unitPrice: 45_000,
          modifiersPrice: 0,
          quantity: 2,
          modifiers: [
            makeModifier(
              IDS.grpTraSugar,
              'Mức đường',
              IDS.optTraSugar50,
              '50% đường',
              FREE,
            ),
            makeModifier(
              IDS.grpTraIce,
              'Lượng đá',
              IDS.optTraIceNorm,
              'Bình thường',
              FREE,
            ),
          ],
        },
      ],
    },
    // ── confirmed (2) ──────────────────────────────────────────────────────────
    {
      label: 'Confirmed #1',
      status: 'confirmed',
      paymentMethod: 'cod',
      items: [
        {
          menuItemId: IDS.iVitQuay,
          itemName: 'Vịt Quay Bắc Kinh',
          unitPrice: 165_000,
          modifiersPrice: 0,
          quantity: 1,
          modifiers: [],
        },
        {
          menuItemId: IDS.iSuiCao,
          itemName: 'Sủi Cảo Hấp',
          unitPrice: 60_000,
          modifiersPrice: FILLING_UP,
          quantity: 2,
          modifiers: [
            makeModifier(
              IDS.grpSuiCaoFill,
              'Nhân',
              IDS.optSuiCaoTomThit,
              'Tôm + Thịt',
              FILLING_UP,
            ),
          ],
        },
      ],
    },
    {
      label: 'Confirmed #2',
      status: 'confirmed',
      paymentMethod: 'vnpay',
      items: [
        {
          menuItemId: IDS.iLauThai,
          itemName: 'Lẩu Thái Chua Cay',
          unitPrice: 195_000,
          modifiersPrice: 0,
          quantity: 1,
          modifiers: [
            makeModifier(
              IDS.grpLauSpicy,
              'Độ cay',
              IDS.optLauSpicyM,
              'Cay vừa',
              FREE,
            ),
          ],
        },
        {
          menuItemId: IDS.iNuocChanh,
          itemName: 'Nước Chanh Muối',
          unitPrice: 25_000,
          modifiersPrice: 0,
          quantity: 2,
          modifiers: [],
        },
      ],
    },
    // ── preparing (2) ──────────────────────────────────────────────────────────
    {
      label: 'Preparing #1',
      status: 'preparing',
      paymentMethod: 'cod',
      items: [
        {
          menuItemId: IDS.iMiVit,
          itemName: 'Mì Vịt Tiềm',
          unitPrice: 110_000,
          modifiersPrice: 0,
          quantity: 2,
          modifiers: [
            makeModifier(IDS.grpMiVitSize, 'Cỡ tô', IDS.optMiVitM, 'Vừa', FREE),
          ],
        },
        {
          menuItemId: IDS.iBanhBao,
          itemName: 'Bánh Bao Xá Xíu',
          unitPrice: 45_000,
          modifiersPrice: 0,
          quantity: 2,
          modifiers: [],
        },
      ],
    },
    {
      label: 'Preparing #2',
      status: 'preparing',
      paymentMethod: 'vnpay',
      items: [
        {
          menuItemId: IDS.iCaHoi,
          itemName: 'Cá Hồi Teriyaki',
          unitPrice: 155_000,
          modifiersPrice: 0,
          quantity: 1,
          modifiers: [],
        },
        {
          menuItemId: IDS.iComChien,
          itemName: 'Cơm Chiên Dương Châu',
          unitPrice: 80_000,
          modifiersPrice: 0,
          quantity: 1,
          modifiers: [
            makeModifier(
              IDS.grpComChienSize,
              'Cỡ phần',
              IDS.optComChienL,
              'Lớn',
              FREE,
            ),
          ],
        },
      ],
    },
    // ── ready_for_pickup (2) ───────────────────────────────────────────────────
    {
      label: 'Ready #1',
      status: 'ready_for_pickup',
      paymentMethod: 'cod',
      items: [
        {
          menuItemId: IDS.iPhoQuon,
          itemName: 'Phở Cuốn Bò',
          unitPrice: 75_000,
          modifiersPrice: 0,
          quantity: 3,
          modifiers: [],
        },
        {
          menuItemId: IDS.iNuocChanh,
          itemName: 'Nước Chanh Muối',
          unitPrice: 25_000,
          modifiersPrice: 0,
          quantity: 3,
          modifiers: [],
        },
      ],
    },
    {
      label: 'Ready #2',
      status: 'ready_for_pickup',
      paymentMethod: 'vnpay',
      items: [
        {
          menuItemId: IDS.iBunBo,
          itemName: 'Bún Bò Nam Bộ',
          unitPrice: 85_000,
          modifiersPrice: 0,
          quantity: 2,
          modifiers: [],
        },
        {
          menuItemId: IDS.iHaCao,
          itemName: 'Há Cảo Tôm',
          unitPrice: 65_000,
          modifiersPrice: FILLING_UP,
          quantity: 2,
          modifiers: [
            makeModifier(
              IDS.grpHaCaoFill,
              'Nhân',
              IDS.optHaCaoTomThit,
              'Tôm + Thịt',
              FILLING_UP,
            ),
          ],
        },
      ],
    },
    // ── delivering (2) ─────────────────────────────────────────────────────────
    {
      label: 'Delivering #1',
      status: 'delivering',
      paymentMethod: 'cod',
      items: [
        {
          menuItemId: IDS.iComGa,
          itemName: 'Cơm Gà Hải Nam',
          unitPrice: 95_000,
          modifiersPrice: SIZE_UP,
          quantity: 1,
          modifiers: [
            makeModifier(
              IDS.grpComGaSize,
              'Cỡ phần',
              IDS.optComGaL,
              'Lớn',
              SIZE_UP,
            ),
          ],
        },
        {
          menuItemId: IDS.iSuiCao,
          itemName: 'Sủi Cảo Hấp',
          unitPrice: 60_000,
          modifiersPrice: 0,
          quantity: 1,
          modifiers: [
            makeModifier(
              IDS.grpSuiCaoFill,
              'Nhân',
              IDS.optSuiCaoThit,
              'Thịt heo',
              FREE,
            ),
          ],
        },
      ],
    },
    {
      label: 'Delivering #2',
      status: 'delivering',
      paymentMethod: 'vnpay',
      items: [
        {
          menuItemId: IDS.iGaKung,
          itemName: 'Gà Kung Pao',
          unitPrice: 125_000,
          modifiersPrice: 0,
          quantity: 2,
          modifiers: [
            makeModifier(
              IDS.grpGaSpicy,
              'Độ cay',
              IDS.optGaSpicy0,
              'Không cay',
              FREE,
            ),
          ],
        },
        {
          menuItemId: IDS.iTraOLong,
          itemName: 'Trà Ô Long Sữa',
          unitPrice: 45_000,
          modifiersPrice: 0,
          quantity: 2,
          modifiers: [
            makeModifier(
              IDS.grpTraSugar,
              'Mức đường',
              IDS.optTraSugar30,
              '30% đường',
              FREE,
            ),
            makeModifier(
              IDS.grpTraIce,
              'Lượng đá',
              IDS.optTraIceLow,
              'Ít đá',
              FREE,
            ),
          ],
        },
      ],
    },
    // ── delivered (3) — these get reviews ─────────────────────────────────────
    {
      label: 'Delivered #1',
      status: 'delivered',
      paymentMethod: 'cod',
      items: [
        {
          menuItemId: IDS.iVitQuay,
          itemName: 'Vịt Quay Bắc Kinh',
          unitPrice: 165_000,
          modifiersPrice: 0,
          quantity: 1,
          modifiers: [],
        },
        {
          menuItemId: IDS.iBanhBao,
          itemName: 'Bánh Bao Xá Xíu',
          unitPrice: 45_000,
          modifiersPrice: 0,
          quantity: 3,
          modifiers: [],
        },
      ],
    },
    {
      label: 'Delivered #2',
      status: 'delivered',
      paymentMethod: 'vnpay',
      items: [
        {
          menuItemId: IDS.iCaHoi,
          itemName: 'Cá Hồi Teriyaki',
          unitPrice: 155_000,
          modifiersPrice: 0,
          quantity: 2,
          modifiers: [],
        },
        {
          menuItemId: IDS.iMiVit,
          itemName: 'Mì Vịt Tiềm',
          unitPrice: 110_000,
          modifiersPrice: SIZE_UP,
          quantity: 1,
          modifiers: [
            makeModifier(
              IDS.grpMiVitSize,
              'Cỡ tô',
              IDS.optMiVitL,
              'Lớn',
              SIZE_UP,
            ),
          ],
        },
      ],
    },
    {
      label: 'Delivered #3',
      status: 'delivered',
      paymentMethod: 'cod',
      items: [
        {
          menuItemId: IDS.iLauThai,
          itemName: 'Lẩu Thái Chua Cay',
          unitPrice: 195_000,
          modifiersPrice: 0,
          quantity: 1,
          modifiers: [
            makeModifier(
              IDS.grpLauSpicy,
              'Độ cay',
              IDS.optLauSpicyH,
              'Cay nhiều',
              FREE,
            ),
          ],
        },
        {
          menuItemId: IDS.iHaCao,
          itemName: 'Há Cảo Tôm',
          unitPrice: 65_000,
          modifiersPrice: 0,
          quantity: 2,
          modifiers: [
            makeModifier(
              IDS.grpHaCaoFill,
              'Nhân',
              IDS.optHaCaoTom,
              'Tôm',
              FREE,
            ),
          ],
        },
        {
          menuItemId: IDS.iTraOLong,
          itemName: 'Trà Ô Long Sữa',
          unitPrice: 45_000,
          modifiersPrice: 0,
          quantity: 2,
          modifiers: [
            makeModifier(
              IDS.grpTraSugar,
              'Mức đường',
              IDS.optTraSugar0,
              '0% đường',
              FREE,
            ),
            makeModifier(
              IDS.grpTraIce,
              'Lượng đá',
              IDS.optTraIceNorm,
              'Bình thường',
              FREE,
            ),
          ],
        },
      ],
    },
    // ── cancelled (2) ──────────────────────────────────────────────────────────
    {
      label: 'Cancelled (customer_request)',
      status: 'cancelled',
      paymentMethod: 'cod',
      cancellationReason: 'customer_request',
      items: [
        {
          menuItemId: IDS.iComChien,
          itemName: 'Cơm Chiên Dương Châu',
          unitPrice: 80_000,
          modifiersPrice: 0,
          quantity: 2,
          modifiers: [
            makeModifier(
              IDS.grpComChienSize,
              'Cỡ phần',
              IDS.optComChienM,
              'Vừa',
              FREE,
            ),
          ],
        },
      ],
    },
    {
      label: 'Cancelled (out_of_stock)',
      status: 'cancelled',
      paymentMethod: 'vnpay',
      cancellationReason: 'out_of_stock',
      items: [
        {
          menuItemId: IDS.iMiXao,
          itemName: 'Mì Xào Hải Sản',
          unitPrice: 120_000,
          modifiersPrice: 0,
          quantity: 1,
          modifiers: [
            makeModifier(
              IDS.grpMiXaoType,
              'Loại mì',
              IDS.optMiXaoTrung,
              'Mì trứng',
              FREE,
            ),
          ],
        },
        {
          menuItemId: IDS.iNuocChanh,
          itemName: 'Nước Chanh Muối',
          unitPrice: 25_000,
          modifiersPrice: 0,
          quantity: 1,
          modifiers: [],
        },
      ],
    },
  ];

  const lifecycleOrderIds: {
    orderId: string;
    status: string;
    paymentMethod: string;
    totalAmount: number;
  }[] = [];

  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    const orderId = crypto.randomUUID();
    const cartId = crypto.randomUUID();
    const createdAt = minsAgo(120 - i * 5);

    const itemsTotal = def.items.reduce(
      (s, it) => s + (it.unitPrice + it.modifiersPrice) * it.quantity,
      0,
    );
    const shippingFee = 18_000;
    const totalAmount = itemsTotal + shippingFee;

    await db.insert(orders).values({
      id: orderId,
      customerId: CUSTOMER_ID,
      restaurantId: RESTAURANT_ID,
      restaurantName: RESTAURANT_NAME,
      cartId,
      status: def.status,
      totalAmount,
      shippingFee,
      discountAmount: 0,
      paymentMethod: def.paymentMethod,
      deliveryAddress: DELIVERY_ADDRESSES[i % DELIVERY_ADDRESSES.length],
      estimatedDeliveryMinutes: 30,
      shipperId: ['delivering', 'delivered'].includes(def.status)
        ? shipperId
        : null,
      createdAt,
    });

    for (const it of def.items) {
      await db.insert(orderItems).values({
        id: crypto.randomUUID(),
        orderId,
        menuItemId: it.menuItemId,
        itemName: it.itemName,
        unitPrice: it.unitPrice,
        modifiersPrice: it.modifiersPrice,
        quantity: it.quantity,
        subtotal: (it.unitPrice + it.modifiersPrice) * it.quantity,
        modifiers: it.modifiers,
      });
    }

    // Build status log chain
    const statusChain: Array<{
      from: string | null;
      to: string;
      role: string;
      at: Date;
      reason?: CancellationReason;
    }> = [{ from: null, to: 'pending', role: 'system', at: createdAt }];
    const step = 8; // minutes per transition
    if (
      [
        'confirmed',
        'preparing',
        'ready_for_pickup',
        'delivering',
        'delivered',
        'cancelled',
      ].includes(def.status)
    ) {
      statusChain.push({
        from: 'pending',
        to: 'confirmed',
        role: 'restaurant',
        at: new Date(createdAt.getTime() + step * 60_000),
      });
    }
    if (
      ['preparing', 'ready_for_pickup', 'delivering', 'delivered'].includes(
        def.status,
      )
    ) {
      statusChain.push({
        from: 'confirmed',
        to: 'preparing',
        role: 'restaurant',
        at: new Date(createdAt.getTime() + step * 2 * 60_000),
      });
    }
    if (['ready_for_pickup', 'delivering', 'delivered'].includes(def.status)) {
      statusChain.push({
        from: 'preparing',
        to: 'ready_for_pickup',
        role: 'restaurant',
        at: new Date(createdAt.getTime() + step * 3 * 60_000),
      });
    }
    if (['delivering', 'delivered'].includes(def.status)) {
      statusChain.push({
        from: 'ready_for_pickup',
        to: 'delivering',
        role: 'shipper',
        at: new Date(createdAt.getTime() + step * 4 * 60_000),
      });
    }
    if (def.status === 'delivered') {
      statusChain.push({
        from: 'delivering',
        to: 'delivered',
        role: 'shipper',
        at: new Date(createdAt.getTime() + step * 5 * 60_000),
      });
    }
    if (def.status === 'cancelled') {
      const lastFrom = statusChain[statusChain.length - 1].to;
      statusChain.push({
        from: lastFrom,
        to: 'cancelled',
        role: 'customer',
        at: new Date(createdAt.getTime() + step * 2 * 60_000),
        reason: def.cancellationReason,
      });
    }

    for (const step of statusChain) {
      await db.insert(orderStatusLogs).values({
        id: crypto.randomUUID(),
        orderId,
        fromStatus: step.from as any,
        toStatus: step.to as any,
        triggeredByRole: step.role as any,
        cancellationReason: step.reason ?? null,
        createdAt: step.at,
      });
    }

    lifecycleOrderIds.push({
      orderId,
      status: def.status,
      paymentMethod: def.paymentMethod,
      totalAmount,
    });
    console.log(`   ✅ ${def.label} (${def.status})`);
  }

  console.log(`✅ lifecycle_orders (${defs.length})`);
  return lifecycleOrderIds;
}

// ─── 8. Analytics orders (60) ─────────────────────────────────────────────────

const ANALYTICS_ITEMS = [
  { id: IDS.iComGa, name: 'Cơm Gà Hải Nam', price: 95_000 },
  { id: IDS.iGaKung, name: 'Gà Kung Pao', price: 125_000 },
  { id: IDS.iMiVit, name: 'Mì Vịt Tiềm', price: 110_000 },
  { id: IDS.iHaCao, name: 'Há Cảo Tôm', price: 65_000 },
  { id: IDS.iSuiCao, name: 'Sủi Cảo Hấp', price: 60_000 },
  { id: IDS.iComChien, name: 'Cơm Chiên Dương Châu', price: 80_000 },
  { id: IDS.iMiXao, name: 'Mì Xào Hải Sản', price: 120_000 },
  { id: IDS.iBunBo, name: 'Bún Bò Nam Bộ', price: 85_000 },
  { id: IDS.iCaHoi, name: 'Cá Hồi Teriyaki', price: 155_000 },
  { id: IDS.iTraOLong, name: 'Trà Ô Long Sữa', price: 45_000 },
];

const CANCELLATION_REASONS: CancellationReason[] = [
  'kitchen_cancel',
  'out_of_stock',
  'customer_request',
  'driver_no_show',
  'timeout',
];

async function seedAnalyticsOrders() {
  const analyticsOrderIds: {
    orderId: string;
    paymentMethod: string;
    totalAmount: number;
    status: string;
  }[] = [];

  for (let i = 0; i < 60; i++) {
    const orderId = crypto.randomUUID();
    const cartId = crypto.randomUUID();

    // Spread over 30 days, weighted toward recent (0-7 days = ~50% of orders)
    const daysBack = i < 30 ? Math.random() * 7 : 7 + Math.random() * 23;
    const createdAt = daysAgo(daysBack);

    const rand = Math.random();
    const isCancelled = rand < 0.12;
    const isRefunded = rand >= 0.12 && rand < 0.2;
    const finalStatus = isCancelled
      ? 'cancelled'
      : isRefunded
        ? 'refunded'
        : 'delivered';
    const cancellationReason =
      isCancelled || isRefunded ? pick(CANCELLATION_REASONS) : null;
    const paymentMethod = Math.random() < 0.55 ? 'cod' : 'vnpay';

    const itemCount = ri(1, 3);
    const pickedItems = Array.from({ length: itemCount }, () =>
      pick(ANALYTICS_ITEMS),
    );
    const itemsTotal = pickedItems.reduce((s, it) => s + it.price, 0);
    const shippingFee = ri(15, 25) * 1_000;
    const totalAmount = itemsTotal + shippingFee;

    await db.insert(orders).values({
      id: orderId,
      customerId: CUSTOMER_ID,
      restaurantId: RESTAURANT_ID,
      restaurantName: RESTAURANT_NAME,
      cartId,
      status: finalStatus as any,
      totalAmount,
      shippingFee,
      discountAmount: 0,
      paymentMethod: paymentMethod as any,
      deliveryAddress: pick(DELIVERY_ADDRESSES),
      estimatedDeliveryMinutes: 35,
      createdAt,
    });

    for (const it of pickedItems) {
      await db.insert(orderItems).values({
        id: crypto.randomUUID(),
        orderId,
        menuItemId: it.id,
        itemName: it.name,
        unitPrice: it.price,
        modifiersPrice: 0,
        quantity: 1,
        subtotal: it.price,
        modifiers: [],
      });
    }

    // Status logs
    const acceptSec = ri(15, 180);
    const acceptedAt = new Date(createdAt.getTime() + acceptSec * 1_000);

    await db.insert(orderStatusLogs).values({
      id: crypto.randomUUID(),
      orderId,
      fromStatus: null,
      toStatus: 'pending',
      triggeredByRole: 'system',
      createdAt,
    });
    await db.insert(orderStatusLogs).values({
      id: crypto.randomUUID(),
      orderId,
      fromStatus: 'pending',
      toStatus: 'confirmed',
      triggeredByRole: 'restaurant',
      createdAt: acceptedAt,
    });

    if (isCancelled || isRefunded) {
      const failedAt = new Date(acceptedAt.getTime() + ri(60, 480) * 1_000);
      await db.insert(orderStatusLogs).values({
        id: crypto.randomUUID(),
        orderId,
        fromStatus: 'confirmed',
        toStatus: finalStatus as any,
        triggeredByRole: 'system',
        cancellationReason,
        note: 'Seed generated failure',
        createdAt: failedAt,
      });
    } else {
      const readyAt = new Date(acceptedAt.getTime() + ri(600, 1_200) * 1_000);
      const deliveredAt = new Date(readyAt.getTime() + ri(600, 1_800) * 1_000);
      await db.insert(orderStatusLogs).values({
        id: crypto.randomUUID(),
        orderId,
        fromStatus: 'confirmed',
        toStatus: 'preparing',
        triggeredByRole: 'restaurant',
        createdAt: new Date(acceptedAt.getTime() + ri(60, 300) * 1_000),
      });
      await db.insert(orderStatusLogs).values({
        id: crypto.randomUUID(),
        orderId,
        fromStatus: 'preparing',
        toStatus: 'ready_for_pickup',
        triggeredByRole: 'restaurant',
        createdAt: readyAt,
      });
      await db.insert(orderStatusLogs).values({
        id: crypto.randomUUID(),
        orderId,
        fromStatus: 'ready_for_pickup',
        toStatus: 'delivering',
        triggeredByRole: 'shipper',
        createdAt: new Date(readyAt.getTime() + ri(60, 300) * 1_000),
      });
      await db.insert(orderStatusLogs).values({
        id: crypto.randomUUID(),
        orderId,
        fromStatus: 'delivering',
        toStatus: 'delivered',
        triggeredByRole: 'shipper',
        createdAt: deliveredAt,
      });
    }

    analyticsOrderIds.push({
      orderId,
      paymentMethod,
      totalAmount,
      status: finalStatus,
    });
  }

  console.log('✅ analytics_orders (60)');
  return analyticsOrderIds;
}

// ─── 9. Reviews ───────────────────────────────────────────────────────────────

const REVIEW_TEMPLATES = [
  {
    stars: 5,
    comment:
      'Cơm gà Hải Nam ngon tuyệt, gà mềm thơm, cơm béo ngậy. Giao hàng nhanh!',
    tags: ['ngon', 'giao-nhanh', 'đóng-gói-đẹp'],
  },
  {
    stars: 5,
    comment: 'Vịt quay Bắc Kinh da giòn tan, nhân viên đóng gói rất cẩn thận.',
    tags: ['ngon', 'đóng-gói-đẹp'],
  },
  {
    stars: 4,
    comment: 'Mì vịt tiềm đậm đà, nước dùng ngon. Hơi chờ lâu hơn dự kiến.',
    tags: ['ngon', 'hơi-chậm'],
  },
  {
    stars: 5,
    comment: 'Há cảo tôm tươi, vỏ mỏng, nhân ngọt. Sẽ order lại!',
    tags: ['ngon', 'tươi'],
  },
  {
    stars: 4,
    comment: 'Gà Kung Pao cay vừa, ăn với cơm rất hợp. Khẩu phần ổn.',
    tags: ['ngon', 'khẩu-phần-ổn'],
  },
  {
    stars: 3,
    comment: 'Đồ ăn bình thường, không có gì đặc biệt lắm. Giao đúng giờ.',
    tags: ['bình-thường'],
  },
  {
    stars: 5,
    comment: 'Cá hồi teriyaki cực ngon, cá tươi, sốt đậm đà. Sẽ quay lại!',
    tags: ['ngon', 'tươi', 'giao-nhanh'],
  },
  {
    stars: 4,
    comment: 'Mì xào hải sản nhiều hải sản, không có mùi tanh. Khá hài lòng.',
    tags: ['ngon', 'nhiều-hải-sản'],
  },
  {
    stars: 5,
    comment:
      'Lẩu Thái chua cay chuẩn vị, nước dùng thơm sả ớt. Giao hàng nhanh chóng.',
    tags: ['ngon', 'cay', 'giao-nhanh'],
  },
  {
    stars: 2,
    comment:
      'Đồ ăn nguội khi nhận, sủi cảo dính vào nhau. Cần cải thiện đóng gói.',
    tags: ['nguội', 'đóng-gói-kém'],
  },
];

async function seedReviews(deliveredOrderIds: string[]) {
  let count = 0;
  for (let i = 0; i < deliveredOrderIds.length; i++) {
    const template = REVIEW_TEMPLATES[i % REVIEW_TEMPLATES.length];
    await db
      .insert(reviews)
      .values({
        id: crypto.randomUUID(),
        orderId: deliveredOrderIds[i],
        customerId: CUSTOMER_ID,
        restaurantId: RESTAURANT_ID,
        stars: template.stars,
        comment: template.comment,
        tags: template.tags,
        moderationStatus: 'visible',
      })
      .onConflictDoNothing();
    count++;
  }
  console.log(`✅ reviews (${count})`);
}

// ─── 10. Payment transactions ─────────────────────────────────────────────────

async function seedPaymentTransactions(
  vnpayOrders: Array<{ orderId: string; totalAmount: number; status: string }>,
) {
  let count = 0;
  const now = new Date();

  for (const o of vnpayOrders) {
    let txStatus: 'pending' | 'completed' | 'refunded' | 'refund_pending';
    let paidAt: Date | null = null;
    let refundedAt: Date | null = null;

    if (o.status === 'delivered') {
      txStatus = 'completed';
      paidAt = new Date(now.getTime() - ri(1, 72) * 3_600_000);
    } else if (o.status === 'refunded') {
      txStatus = 'refunded';
      refundedAt = new Date(now.getTime() - ri(1, 48) * 3_600_000);
    } else if (o.status === 'cancelled') {
      txStatus = 'refund_pending';
    } else {
      txStatus = 'pending';
    }

    await db.insert(paymentTransactions).values({
      id: crypto.randomUUID(),
      orderId: o.orderId,
      customerId: CUSTOMER_ID,
      amount: o.totalAmount,
      status: txStatus,
      providerTxnId:
        txStatus === 'completed'
          ? `VNP${crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`
          : null,
      vnpResponseCode: txStatus === 'completed' ? '00' : null,
      paidAt,
      refundedAt,
      expiresAt: new Date(now.getTime() + 15 * 60_000),
    });
    count++;
  }
  console.log(`✅ payment_transactions (${count})`);
}

async function cleanGeneratedOrderData() {
  const existingOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.restaurantId, RESTAURANT_ID));

  await db.delete(reviews).where(eq(reviews.restaurantId, RESTAURANT_ID));

  if (existingOrders.length > 0) {
    const orderIds = existingOrders.map((order) => order.id);

    await db
      .delete(paymentTransactions)
      .where(inArray(paymentTransactions.orderId, orderIds));
    await db
      .delete(orderStatusLogs)
      .where(inArray(orderStatusLogs.orderId, orderIds));
    await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
    await db.delete(orders).where(inArray(orders.id, orderIds));
  }

  console.log(`✅ cleaned generated order data (${existingOrders.length} orders)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🍜 Seeding Ẩm thực Á Đông (${RESTAURANT_ID})\n`);

  // Create owner user + credential account
  const now = new Date();
  await db
    .insert(user)
    .values({
      id: OWNER_USER_ID,
      name: 'Á Đông Owner',
      email: 'owner.adong@soli.dev',
      emailVerified: true,
      role: 'restaurant',
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
  const passwordHash = await hashPassword(OWNER_PASSWORD);
  await db
    .insert(account)
    .values({
      id: OWNER_ACCOUNT_ID,
      accountId: OWNER_USER_ID,
      providerId: 'credential',
      userId: OWNER_USER_ID,
      password: passwordHash,
      createdAt: now,
    })
    .onConflictDoNothing();
  console.log(`   Owner user: owner.adong@soli.dev / ${OWNER_PASSWORD}`);

  // Create restaurant (approved + open)
  await db.insert(restaurants).values(RESTAURANT_DATA).onConflictDoNothing();
  console.log(
    `   Restaurant: ${RESTAURANT_NAME} (isApproved=true, isOpen=true)`,
  );

  const restaurantRow = RESTAURANT_DATA;

  // Resolve shipper
  const shipperRows = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.role, 'shipper'))
    .limit(1);

  const shipperId = shipperRows[0]?.id ?? null;
  if (shipperId) {
    console.log(`   Shipper: ${shipperRows[0].name} (${shipperId})`);
  } else {
    console.warn(
      '   ⚠️  No shipper found — delivering/delivered orders will have null shipperId',
    );
  }

  console.log('');

  await seedDeliveryZones();
  await seedCategories();
  await seedMenuItems();
  await seedModifierGroups();
  await seedModifierOptions();
  await seedSnapshots(restaurantRow);
  await cleanGeneratedOrderData();

  console.log('\n📦 Lifecycle orders:');
  const lifecycleOrders = await seedLifecycleOrders(shipperId);

  console.log('\n📊 Analytics orders:');
  const analyticsOrders = await seedAnalyticsOrders();

  // Collect delivered order IDs for reviews (lifecycle delivered + analytics delivered)
  const deliveredFromLifecycle = lifecycleOrders
    .filter((o) => o.status === 'delivered')
    .map((o) => o.orderId);

  const deliveredFromAnalytics = analyticsOrders
    .filter((o) => o.status === 'delivered')
    .slice(0, 15) // cap at 15 to keep review count reasonable
    .map((o) => o.orderId);

  const allDeliveredIds = [
    ...deliveredFromLifecycle,
    ...deliveredFromAnalytics,
  ];

  // Collect vnpay orders for payment transactions
  const vnpayOrders = [
    ...lifecycleOrders.filter((o) => o.paymentMethod === 'vnpay'),
    ...analyticsOrders.filter((o) => o.paymentMethod === 'vnpay').slice(0, 20),
  ];

  console.log('');
  await seedReviews(allDeliveredIds);
  await seedPaymentTransactions(vnpayOrders);

  console.log(`
✅ Seed complete for Ẩm thực Á Đông
   • 2  delivery zones
   • 4  menu categories
   • 15 menu items
   • 10 modifier groups  /  31 modifier options
   • 3  ordering snapshots (restaurant + items + zones)
   • 15 lifecycle orders  (2 pending, 2 confirmed, 2 preparing, 2 ready, 2 delivering, 3 delivered, 2 cancelled)
   • 60 analytics orders  (spread over 30 days)
   • ${allDeliveredIds.length}  reviews
   • ${vnpayOrders.length}  payment transactions
`);
}

void main()
  .catch((err) => {
    console.error('❌', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch (err) {
      console.error('❌ Failed to close database pool', err);
      process.exitCode = 1;
    }
  });
