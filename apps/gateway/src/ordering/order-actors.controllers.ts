import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ORDERING_RPC_PATTERNS } from '@uitfood/contracts';
import type { OrderingRpcGateway } from './ordering.interfaces';
import { ORDERING_RPC_GATEWAY } from './ordering.tokens';
import { OrderingSessionGuard } from './ordering-session.guard';
import { InternalJwtService } from '@/identity/internal-jwt.service';
import type { GatewayRequestWithSession } from '@/identity/identity.interfaces';

abstract class BaseOrderingController {
  constructor(
    @Inject(ORDERING_RPC_GATEWAY) protected readonly ordering: OrderingRpcGateway,
    protected readonly internalJwt: InternalJwtService,
  ) {}
  protected token(req: GatewayRequestWithSession): string {
    return this.internalJwt.issueForRequest(req, 'ordering');
  }
}

@ApiTags('Ordering: Restaurant')
@ApiBearerAuth()
@Controller('api/restaurant/orders')
@UseGuards(OrderingSessionGuard)
export class RestaurantOrdersController extends BaseOrderingController {
  @Get()
  list(
    @Req() req: GatewayRequestWithSession,
    @Query() filters: Record<string, string>,
  ) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.restaurantOrders, {
      internalAuth: this.token(req),
      filters,
    });
  }

  @Get('active')
  active(@Req() req: GatewayRequestWithSession) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.restaurantActiveOrders, {
      internalAuth: this.token(req),
    });
  }
}

@ApiTags('Ordering: Restaurant Analytics')
@ApiBearerAuth()
@Controller('api/restaurant/analytics')
@UseGuards(OrderingSessionGuard)
export class RestaurantAnalyticsController extends BaseOrderingController {
  @Get('operational')
  operational(
    @Req() req: GatewayRequestWithSession,
    @Query('range') range?: string,
  ) {
    return this.ordering.send(
      ORDERING_RPC_PATTERNS.restaurantOperationalAnalytics,
      { internalAuth: this.token(req), range },
    );
  }
}

@ApiTags('Ordering: Shipper')
@ApiBearerAuth()
@Controller('api/shipper/orders')
@UseGuards(OrderingSessionGuard)
export class ShipperOrdersController extends BaseOrderingController {
  @Get('available')
  available(@Req() req: GatewayRequestWithSession) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.shipperAvailableOrders, {
      internalAuth: this.token(req),
    });
  }

  @Get('active')
  active(@Req() req: GatewayRequestWithSession) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.shipperActiveOrder, {
      internalAuth: this.token(req),
    });
  }

  @Get('history')
  history(
    @Req() req: GatewayRequestWithSession,
    @Query() filters: Record<string, string>,
  ) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.shipperHistory, {
      internalAuth: this.token(req),
      filters,
    });
  }
}

@ApiTags('Ordering: Admin')
@ApiBearerAuth()
@Controller('api/admin/orders')
@UseGuards(OrderingSessionGuard)
export class AdminOrdersController extends BaseOrderingController {
  @Get()
  list(
    @Req() req: GatewayRequestWithSession,
    @Query() filters: Record<string, string>,
  ) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.adminOrders, {
      internalAuth: this.token(req),
      filters,
    });
  }

  @Get(':id')
  detail(@Req() req: GatewayRequestWithSession, @Param('id') id: string) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.adminOrderDetail, {
      internalAuth: this.token(req),
      orderId: id,
    });
  }
}

@ApiTags('Ordering: Payments')
@ApiBearerAuth()
@Controller('api/payments/vnpay/orders')
@UseGuards(OrderingSessionGuard)
export class OrderingPaymentsController extends BaseOrderingController {
  @Patch(':orderId/cancel')
  @HttpCode(HttpStatus.OK)
  cancelPending(
    @Req() req: GatewayRequestWithSession,
    @Param('orderId') orderId: string,
  ) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.cancelPendingPayment, {
      internalAuth: this.token(req),
      orderId,
    });
  }
}
