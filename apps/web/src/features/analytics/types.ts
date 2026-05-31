/**
 * Response shape returned by GET /restaurant/analytics/operational.
 * Mirrors apps/api/src/module/ordering/analytics/dto/operational-analytics.dto.ts.
 */

export type AnalyticsRange = 'today' | 'yesterday' | '7d';

export type CancellationReasonCode =
  | 'kitchen_cancel'
  | 'driver_no_show'
  | 'out_of_stock'
  | 'customer_request'
  | 'payment_failed'
  | 'timeout'
  | 'other';

export interface OperationalState {
  status: 'healthy' | 'attention' | 'critical';
  deltaSeconds: number;
  stuckOrderCount: number;
  sparkline: number[];
}

export interface KpiDelta {
  label: string;
  value: string;
  delta: number;
  direction: 'up' | 'down' | 'flat';
}

export interface KitchenKpi {
  hero: KpiDelta;
  supporting: KpiDelta[];
}

export interface FailureSegmentApi {
  reasonCode: CancellationReasonCode;
  count: number;
}

export interface HourlyDensityPoint {
  hour: string;
  count: number;
}

export interface RefundRatePoint {
  hour: string;
  rate: number;
}

export interface SlowItem {
  menuItemId: string;
  name: string;
  avgPrepSeconds: number;
}

export interface Incident {
  id: string;
  orderId: string;
  timestamp: string;
  title: string;
  detail: string;
  state: 'pending' | 'resolved';
}

export interface AnalyticsBundle {
  operationalState: OperationalState;
  kitchenKpi: KitchenKpi;
  timeToAcceptBuckets: number[];
  failureSegments: FailureSegmentApi[];
  hourlyDensity: HourlyDensityPoint[];
  refundRateSeries: RefundRatePoint[];
  slowItems: SlowItem[];
  incidents: Incident[];
  /** Sum of totalAmount for all orders in the window (integer VND) */
  totalRevenue: number;
  /** Average order value in the window (integer VND) */
  avgOrderValue: number;
  /** Total orders created in the window */
  orderCount: number;
}

export interface OperationalAnalyticsResponse {
  range: AnalyticsRange;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  current: AnalyticsBundle;
  baseline: AnalyticsBundle;
}

// ---------------------------------------------------------------------------
// Presentation helpers — the API returns codes; the UI maps to labels/colors.
// ---------------------------------------------------------------------------

export interface FailureSegment {
  reasonCode: CancellationReasonCode;
  label: string;
  count: number;
  color: string;
}

const REASON_DISPLAY: Record<
  CancellationReasonCode,
  { label: string; color: string }
> = {
  kitchen_cancel: { label: 'Kitchen Cancel', color: '#0d631b' },
  driver_no_show: { label: 'Driver No-show', color: '#3FB37F' },
  out_of_stock: { label: 'Out of Stock', color: '#D69E2E' },
  customer_request: { label: 'Customer Request', color: '#3A5AC6' },
  payment_failed: { label: 'Payment Failed', color: '#C44545' },
  timeout: { label: 'Timeout', color: '#bfcaba' },
  other: { label: 'Other', color: '#bfcaba' },
};

export function decorateFailureSegment(seg: FailureSegmentApi): FailureSegment {
  const display = REASON_DISPLAY[seg.reasonCode];
  return {
    reasonCode: seg.reasonCode,
    label: display.label,
    color: display.color,
    count: seg.count,
  };
}
