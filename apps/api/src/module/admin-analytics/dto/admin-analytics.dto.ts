import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
} from '@/shared/analytics-windows';

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export class PlatformAnalyticsQueryDto {
  @ApiPropertyOptional({ enum: ANALYTICS_RANGES, default: 'today' })
  @IsOptional()
  @IsEnum(ANALYTICS_RANGES)
  range?: AnalyticsRange = 'today';
}

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

export class PlatformKpisDto {
  @ApiProperty({ description: 'Sum of all order totalAmount in window (VND).' })
  gmv!: number;

  @ApiProperty({ description: 'Platform commission — gmv × 0.15 (VND).' })
  revenue!: number;

  @ApiPropertyOptional({
    description:
      '% change in GMV vs the prior equivalent window. null when no prior data.',
  })
  gmvDelta!: number | null;

  @ApiProperty({ description: 'Total orders created in window.' })
  orderCount!: number;

  @ApiProperty({ description: 'Orders with status "delivered".' })
  deliveredCount!: number;

  @ApiProperty({ description: 'Orders cancelled or refunded.' })
  failedCount!: number;

  @ApiProperty({
    description:
      'deliveredCount / (deliveredCount + failedCount). 1 when no failures.',
  })
  successRate!: number;

  @ApiProperty({
    description: 'Restaurants with is_approved=true and is_open=true.',
  })
  restaurantsOnline!: number;

  @ApiProperty({
    description: 'Restaurants with is_approved=true and is_open=false.',
  })
  restaurantsOffline!: number;

  @ApiProperty({ description: 'Restaurants with is_approved=false.' })
  restaurantsPending!: number;
}

export class HourlyLoadPointDto {
  @ApiProperty({ description: 'ISO8601 hour bucket (UTC, start of hour).' })
  hour!: string;

  @ApiProperty({ description: 'Total orders created in this hour.' })
  orders!: number;

  @ApiProperty({ description: 'Sum of totalAmount in this hour (VND).' })
  revenue!: number;
}

export class TopEarnerDto {
  @ApiProperty({ format: 'uuid' })
  restaurantId!: string;

  @ApiProperty()
  restaurantName!: string;

  @ApiProperty({
    description: 'GMV excluding cancelled/refunded orders (VND).',
  })
  gmv!: number;

  @ApiProperty()
  orderCount!: number;
}

export class BottleneckDto {
  @ApiProperty({ format: 'uuid' })
  restaurantId!: string;

  @ApiProperty()
  restaurantName!: string;

  @ApiProperty({ description: 'cancelled+refunded / total. 0..1.' })
  cancelRate!: number;

  @ApiPropertyOptional({
    description:
      'Average minutes from confirmed to ready_for_pickup. null when no confirmed orders.',
  })
  avgPrepMinutes!: number | null;

  @ApiProperty({ description: 'Total orders in window for this restaurant.' })
  orderCount!: number;

  @ApiProperty({ enum: ['high-cancel', 'slow-prep'] })
  primaryIssue!: 'high-cancel' | 'slow-prep';
}

export class OrderDistrictDto {
  @ApiProperty({ description: 'District name from deliveryAddress JSONB.' })
  district!: string;

  @ApiProperty()
  orderCount!: number;
}

export class PlatformAnalyticsResponseDto {
  @ApiProperty({ enum: ANALYTICS_RANGES })
  range!: AnalyticsRange;

  @ApiProperty({
    description: 'ISO8601 timestamp when the bundle was computed.',
  })
  generatedAt!: string;

  @ApiProperty({ description: 'ISO8601 start of the window (inclusive).' })
  windowStart!: string;

  @ApiProperty({ description: 'ISO8601 end of the window (exclusive).' })
  windowEnd!: string;

  @ApiProperty({ type: PlatformKpisDto })
  kpis!: PlatformKpisDto;

  @ApiProperty({ type: [HourlyLoadPointDto] })
  hourlyLoad!: HourlyLoadPointDto[];

  @ApiProperty({ type: [TopEarnerDto] })
  topEarners!: TopEarnerDto[];

  @ApiProperty({ type: [BottleneckDto] })
  bottlenecks!: BottleneckDto[];

  @ApiProperty({ type: [OrderDistrictDto] })
  ordersByDistrict!: OrderDistrictDto[];
}
