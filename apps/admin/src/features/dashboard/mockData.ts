// ---------------------------------------------------------------------------
// Admin Dashboard — Mock data for the Mission Control page.
// Replace individual sections with real API calls as endpoints land.
// ---------------------------------------------------------------------------

export const PLATFORM_KPIS = {
  gmv: 4_280_000_000,           // ₫4.28B total GMV today
  revenue: 641_400_000,          // 15% commission
  restaurantsOnline: 47,
  restaurantsOffline: 13,
  orderSuccessRate: 91.4,        // %
  orderSuccessDelta: +2.1,       // pp vs yesterday
  gmvDelta: +18.3,               // % vs last week
  revenueDelta: +18.3,
};

export const HOURLY_LOAD = [
  { hour: '07:00', orders: 38,  revenue: 7.1  },
  { hour: '08:00', orders: 62,  revenue: 11.6 },
  { hour: '09:00', orders: 54,  revenue: 10.1 },
  { hour: '10:00', orders: 71,  revenue: 13.3 },
  { hour: '11:00', orders: 124, revenue: 23.2 },
  { hour: '12:00', orders: 198, revenue: 37.0 },
  { hour: '13:00', orders: 176, revenue: 33.0 },
  { hour: '14:00', orders: 109, revenue: 20.4 },
  { hour: '15:00', orders: 88,  revenue: 16.5 },
  { hour: '16:00', orders: 93,  revenue: 17.4 },
  { hour: '17:00', orders: 142, revenue: 26.6 },
  { hour: '18:00', orders: 212, revenue: 39.7 },
  { hour: '19:00', orders: 231, revenue: 43.2 },
  { hour: '20:00', orders: 194, revenue: 36.3 },
  { hour: '21:00', orders: 148, revenue: 27.7 },
  { hour: '22:00', orders: 87,  revenue: 16.3 },
];

// Ho Chi Minh City order density clusters (SVG map, normalized 0-1 coords)
export const ORDER_CLUSTERS = [
  { id: 'q1',      x: 0.56, y: 0.44, density: 0.92, label: 'Q.1',       orders: 231 },
  { id: 'q3',      x: 0.48, y: 0.55, density: 0.75, label: 'Q.3',       orders: 188 },
  { id: 'binhth',  x: 0.62, y: 0.38, density: 0.60, label: 'Bình Thạnh', orders: 152 },
  { id: 'govap',   x: 0.50, y: 0.30, density: 0.48, label: 'Gò Vấp',    orders: 121 },
  { id: 'tanbinh', x: 0.43, y: 0.36, density: 0.55, label: 'Tân Bình',  orders: 139 },
  { id: 'q7',      x: 0.52, y: 0.65, density: 0.70, label: 'Q.7',       orders: 176 },
  { id: 'q10',     x: 0.46, y: 0.42, density: 0.40, label: 'Q.10',      orders: 101 },
  { id: 'q12',     x: 0.45, y: 0.22, density: 0.30, label: 'Q.12',      orders: 76  },
  { id: 'thuduc',  x: 0.70, y: 0.28, density: 0.58, label: 'Thủ Đức',   orders: 147 },
  { id: 'binhtan', x: 0.30, y: 0.48, density: 0.35, label: 'Bình Tân',  orders: 89  },
  { id: 'canh',    x: 0.38, y: 0.42, density: 0.22, label: 'Cần Giờ',   orders: 44  },
  { id: 'nhabe',   x: 0.58, y: 0.78, density: 0.18, label: 'Nhà Bè',    orders: 36  },
];

export const TOP_EARNERS = [
  { id: '1', rank: 1, name: 'Phở Thìn Lò Đúc',        category: 'Vietnamese',   gmv: 48_200_000, orders: 203, logo: '🍜', trend: +12 },
  { id: '2', rank: 2, name: 'Bánh Mì Huỳnh Hoa',       category: 'Street Food',  gmv: 39_700_000, orders: 317, logo: '🥖', trend: +8  },
  { id: '3', rank: 3, name: 'Bún Bò Bà Tư',            category: 'Vietnamese',   gmv: 34_100_000, orders: 178, logo: '🍲', trend: -3  },
  { id: '4', rank: 4, name: 'Cơm Tấm Thuận Kiều',      category: 'Vietnamese',   gmv: 31_400_000, orders: 241, logo: '🍚', trend: +5  },
  { id: '5', rank: 5, name: 'Hải Sản Hoàng Hạnh',      category: 'Seafood',      gmv: 28_900_000, orders: 94,  logo: '🦐', trend: +21 },
];

export const BOTTLENECKS = [
  {
    id: 'b1',
    name: 'Lẩu Thái Nhà Hàng Đỏ',
    issue: 'high-cancel',
    cancelRate: 18.4,
    avgPrepMin: 22,
    severity: 'critical' as const,
    ordersToday: 47,
  },
  {
    id: 'b2',
    name: 'Cháo Sườn Bà Năm',
    issue: 'slow-prep',
    cancelRate: 5.2,
    avgPrepMin: 41,
    severity: 'warning' as const,
    ordersToday: 33,
  },
  {
    id: 'b3',
    name: 'Pizza Napoli Sài Gòn',
    issue: 'high-cancel',
    cancelRate: 12.7,
    avgPrepMin: 34,
    severity: 'warning' as const,
    ordersToday: 71,
  },
  {
    id: 'b4',
    name: 'Gà Rán Phong Thúy',
    issue: 'slow-prep',
    cancelRate: 3.1,
    avgPrepMin: 38,
    severity: 'info' as const,
    ordersToday: 119,
  },
];

export const PENDING_APPROVALS = [
  {
    id: 'pa1',
    name: 'Mì Quảng Bà Hoa',
    category: 'Vietnamese',
    submittedAt: '2026-05-28T09:14:00Z',
    district: 'Q.3',
    status: 'pending-review' as const,
  },
  {
    id: 'pa2',
    name: 'Dimsum Cung Đình',
    category: 'Chinese',
    submittedAt: '2026-05-28T14:31:00Z',
    district: 'Bình Thạnh',
    status: 'docs-missing' as const,
  },
  {
    id: 'pa3',
    name: 'Sushi Hanabi',
    category: 'Japanese',
    submittedAt: '2026-05-29T08:05:00Z',
    district: 'Q.7',
    status: 'pending-review' as const,
  },
];

export const PENDING_PAYOUTS = [
  { id: 'py1', name: 'Phở Thìn Lò Đúc',   amount: 40_970_000, period: 'Week 21', status: 'ready' as const },
  { id: 'py2', name: 'Bánh Mì Huỳnh Hoa',  amount: 33_745_000, period: 'Week 21', status: 'processing' as const },
  { id: 'py3', name: 'Bún Bò Bà Tư',       amount: 28_985_000, period: 'Week 21', status: 'ready' as const },
];

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatVND(vnd: number): string {
  if (vnd >= 1_000_000_000) return `₫${(vnd / 1_000_000_000).toFixed(2)}B`;
  if (vnd >= 1_000_000)     return `₫${(vnd / 1_000_000).toFixed(1)}M`;
  return `₫${Math.round(vnd / 1_000)}k`;
}
