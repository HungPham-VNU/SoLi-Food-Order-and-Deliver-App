import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { cancellationReasonEnum } from '../../order/order.schema';

// ---------------------------------------------------------------------------
// Query DTO
// ---------------------------------------------------------------------------

export const ANALYTICS_RANGES = ['today', 'yesterday', '7d'] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    enum: ANALYTICS_RANGES,
    default: 'today',
    description:
      'Window the analytics bundle is computed over. Defaults to today.',
  })
  @IsOptional()
  @IsEnum(ANALYTICS_RANGES)
  range?: AnalyticsRange = 'today';
}

// ---------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------

export class OperationalStateDto {
  @ApiProperty({ enum: ['healthy', 'attention', 'critical'] })
  status!: 'healthy' | 'attention' | 'critical';

  @ApiProperty({
    description:
      'Signed delta in seconds between current avg-time-to-accept and the baseline. ' +
      'Negative = faster than baseline.',
  })
  deltaSeconds!: number;

  @ApiProperty({
    description:
      'Number of currently stuck orders (active orders past their SLA).',
  })
  stuckOrderCount!: number;

  @ApiProperty({
    type: [Number],
    description: 'Last-10-window avg-accept seconds, sparkline-ready.',
  })
  sparkline!: number[];
}

export class KpiDeltaDto {
  @ApiProperty()
  label!: string;

  @ApiProperty({ description: 'Display string, e.g. "2m 47s" or "1.4%".' })
  value!: string;

  @ApiProperty({
    description: 'Signed delta vs baseline in metric-native units.',
  })
  delta!: number;

  @ApiProperty({ enum: ['up', 'down', 'flat'] })
  direction!: 'up' | 'down' | 'flat';
}

export class KitchenKpiDto {
  @ApiProperty({ type: KpiDeltaDto })
  hero!: KpiDeltaDto;

  @ApiProperty({ type: [KpiDeltaDto] })
  supporting!: KpiDeltaDto[];
}

export class FailureSegmentDto {
  @ApiProperty({ enum: cancellationReasonEnum.enumValues })
  reasonCode!: (typeof cancellationReasonEnum.enumValues)[number];

  @ApiProperty()
  count!: number;
}

export class HourlyDensityPointDto {
  @ApiProperty({ description: 'ISO8601 hour bucket (start).' })
  hour!: string;

  @ApiProperty()
  count!: number;
}

export class RefundRatePointDto {
  @ApiProperty({ description: 'ISO8601 hour bucket.' })
  hour!: string;

  @ApiProperty({ description: 'Refund rate (0..1) for the hour.' })
  rate!: number;
}

export class SlowItemDto {
  @ApiProperty({ format: 'uuid' })
  menuItemId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'Average prep latency, whole seconds.' })
  avgPrepSeconds!: number;
}

export class IncidentDto {
  @ApiProperty({ description: 'Status log ID' })
  id!: string;

  @ApiProperty({ description: 'Order ID' })
  orderId!: string;

  @ApiProperty({ description: 'ISO8601 timestamp of the transition log row.' })
  timestamp!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  detail!: string;

  @ApiProperty({ enum: ['pending', 'resolved'] })
  state!: 'pending' | 'resolved';
}

export class AnalyticsBundleDto {
  @ApiProperty({ type: OperationalStateDto })
  operationalState!: OperationalStateDto;

  @ApiProperty({ type: KitchenKpiDto })
  kitchenKpi!: KitchenKpiDto;

  @ApiProperty({ type: [Number] })
  timeToAcceptBuckets!: number[];

  @ApiProperty({ type: [FailureSegmentDto] })
  failureSegments!: FailureSegmentDto[];

  @ApiProperty({ type: [HourlyDensityPointDto] })
  hourlyDensity!: HourlyDensityPointDto[];

  @ApiProperty({ type: [RefundRatePointDto] })
  refundRateSeries!: RefundRatePointDto[];

  @ApiProperty({ type: [SlowItemDto] })
  slowItems!: SlowItemDto[];

  @ApiProperty({ type: [IncidentDto] })
  incidents!: IncidentDto[];

  @ApiProperty({
    description:
      'Sum of totalAmount for all orders in the window (integer VND).',
  })
  totalRevenue!: number;

  @ApiProperty({
    description:
      'Average order value for the window (integer VND, 0 when no orders).',
  })
  avgOrderValue!: number;

  @ApiProperty({ description: 'Total number of orders created in the window.' })
  orderCount!: number;
}

export class AnalyticsResponseDto {
  @ApiProperty({ enum: ANALYTICS_RANGES })
  range!: AnalyticsRange;

  @ApiProperty({
    description: 'ISO8601 timestamp when the bundle was computed.',
  })
  generatedAt!: string;

  @ApiProperty({
    description: 'ISO8601 start of the current window (inclusive).',
  })
  windowStart!: string;

  @ApiProperty({
    description: 'ISO8601 end of the current window (exclusive).',
  })
  windowEnd!: string;

  @ApiProperty({ type: AnalyticsBundleDto })
  current!: AnalyticsBundleDto;

  @ApiProperty({ type: AnalyticsBundleDto })
  baseline!: AnalyticsBundleDto;
}
