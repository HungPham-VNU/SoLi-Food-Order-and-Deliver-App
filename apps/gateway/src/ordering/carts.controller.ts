import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
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

/**
 * Public cart + checkout endpoints. Mirrors the public CartController surface,
 * translating HTTP into Ordering TCP RPC. All routes require an authenticated
 * session; the customer id is taken from the minted `aud=ordering` token.
 */
@ApiTags('Ordering: Cart')
@ApiBearerAuth()
@Controller('api/carts')
@UseGuards(OrderingSessionGuard)
export class CartsController {
  constructor(
    @Inject(ORDERING_RPC_GATEWAY) private readonly ordering: OrderingRpcGateway,
    private readonly internalJwt: InternalJwtService,
  ) {}

  private token(req: GatewayRequestWithSession): string {
    return this.internalJwt.issueForRequest(req, 'ordering');
  }

  @Get('my')
  getCart(@Req() req: GatewayRequestWithSession) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.getCart, {
      internalAuth: this.token(req),
    });
  }

  @Post('my/items')
  addItem(@Req() req: GatewayRequestWithSession, @Body() dto: unknown) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.addCartItem, {
      internalAuth: this.token(req),
      dto,
    });
  }

  @Patch('my/items/:cartItemId')
  updateItem(
    @Req() req: GatewayRequestWithSession,
    @Param('cartItemId') cartItemId: string,
    @Body() dto: unknown,
  ) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.updateCartItem, {
      internalAuth: this.token(req),
      cartItemId,
      dto,
    });
  }

  @Patch('my/items/:cartItemId/modifiers')
  updateItemModifiers(
    @Req() req: GatewayRequestWithSession,
    @Param('cartItemId') cartItemId: string,
    @Body() dto: unknown,
  ) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.updateCartItemModifiers, {
      internalAuth: this.token(req),
      cartItemId,
      dto,
    });
  }

  @Delete('my/items/:cartItemId')
  removeItem(
    @Req() req: GatewayRequestWithSession,
    @Param('cartItemId') cartItemId: string,
  ) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.removeCartItem, {
      internalAuth: this.token(req),
      cartItemId,
    });
  }

  @Delete('my')
  @HttpCode(HttpStatus.NO_CONTENT)
  clearCart(@Req() req: GatewayRequestWithSession) {
    return this.ordering.send(ORDERING_RPC_PATTERNS.clearCart, {
      internalAuth: this.token(req),
    });
  }

  @Post('my/checkout')
  @HttpCode(HttpStatus.CREATED)
  checkout(
    @Req() req: GatewayRequestWithSession,
    @Body() dto: unknown,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddr =
      (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : '') ||
      req.socket?.remoteAddress ||
      '127.0.0.1';
    return this.ordering.send(ORDERING_RPC_PATTERNS.checkout, {
      internalAuth: this.token(req),
      dto,
      idempotencyKey: idempotencyKey?.trim() || undefined,
      ipAddr,
    });
  }
}
