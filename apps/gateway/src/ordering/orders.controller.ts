import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
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

interface CancelBody {
  reason?: string;
  reasonCode?: string;
}

/**
 * Public order endpoints: the customer's own history, single-order reads, and
 * the lifecycle transitions (each REST action maps to a state-machine target
 * status). Translates HTTP into Ordering TCP RPC.
 */
@ApiTags('Ordering: Orders')
@ApiBearerAuth()
@Controller('api/orders')
@UseGuards(OrderingSessionGuard)
export class OrdersController {
  constructor(
    @Inject(ORDERING_RPC_GATEWAY) private readonly ordering: OrderingRpcGateway,
    private readonly internalJwt: InternalJwtService,
  ) {}

  private token(req: GatewayRequestWithSession): string {
    return this.internalJwt.issueForRequest(req, 'ordering');
  }

  private transition(
    req: GatewayRequestWithSession,
    orderId: string,
    toStatus: string,
    note?: string,
    cancellationReason?: string,
  ) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.transitionOrder, {
      internalAuth: this.token(req),
      orderId,
      toStatus,
      note,
      cancellationReason,
    });
  }

  // --- Customer history (declared before :id so /my is not swallowed) ---
  @Get('my')
  myOrders(
    @Req() req: GatewayRequestWithSession,
    @Query() filters: Record<string, string>,
  ) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.customerOrders, {
      internalAuth: this.token(req),
      filters,
    });
  }

  @Get('my/:id')
  myOrderDetail(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
  ) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.customerOrderDetail, {
      internalAuth: this.token(req),
      orderId: id,
    });
  }

  @Get('my/:id/reorder')
  reorder(@Req() req: GatewayRequestWithSession, @Param('id') id: string) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.customerReorder, {
      internalAuth: this.token(req),
      orderId: id,
    });
  }

  // --- Single order reads ---
  @Get(':id')
  getOrder(@Req() req: GatewayRequestWithSession, @Param('id') id: string) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.getOrder, {
      internalAuth: this.token(req),
      orderId: id,
    });
  }

  @Get(':id/timeline')
  getTimeline(@Req() req: GatewayRequestWithSession, @Param('id') id: string) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.getOrderTimeline, {
      internalAuth: this.token(req),
      orderId: id,
    });
  }

  // --- Lifecycle transitions ---
  @Patch(':id/confirm')
  confirm(@Req() req: GatewayRequestWithSession, @Param('id') id: string) {
    return this.transition(req, id, 'confirmed');
  }

  @Patch(':id/start-preparing')
  startPreparing(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
  ) {
    return this.transition(req, id, 'preparing');
  }

  @Patch(':id/ready')
  markReady(@Req() req: GatewayRequestWithSession, @Param('id') id: string) {
    return this.transition(req, id, 'ready_for_pickup');
  }

  @Patch(':id/pickup')
  pickup(@Req() req: GatewayRequestWithSession, @Param('id') id: string) {
    return this.transition(req, id, 'picked_up');
  }

  @Patch(':id/en-route')
  enRoute(@Req() req: GatewayRequestWithSession, @Param('id') id: string) {
    return this.transition(req, id, 'delivering');
  }

  @Patch(':id/deliver')
  deliver(@Req() req: GatewayRequestWithSession, @Param('id') id: string) {
    return this.transition(req, id, 'delivered');
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
    @Body() body: CancelBody,
  ) {
    return this.transition(req, id, 'cancelled', body?.reason, body?.reasonCode);
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  refund(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
    @Body() body: CancelBody,
  ) {
    return this.transition(req, id, 'refunded', body?.reason, body?.reasonCode);
  }
}
