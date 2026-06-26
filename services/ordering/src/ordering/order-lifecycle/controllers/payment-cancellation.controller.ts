import {
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import {
  PAYMENT_INITIATION_PORT,
  type IPaymentInitiationPort,
} from '@/shared/ports/payment-initiation.port';
import { TransitionOrderCommand } from '../commands/transition-order.command';

interface CancelPaymentResponse {
  id: string;
  orderId: string;
  status: string;
  updatedAt: Date;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentCancellationController {
  constructor(
    private readonly commandBus: CommandBus,
    @Inject(PAYMENT_INITIATION_PORT)
    private readonly payments: IPaymentInitiationPort,
  ) {}

  @Patch('vnpay/orders/:orderId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel an unpaid VNPay payment for the current customer',
    description:
      'Marks the pending/awaiting VNPay payment transaction for this order as failed, ' +
      'then cancels the pending order. The caller must own the payment transaction. ' +
      'Completed payments cannot be cancelled here.',
  })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  @ApiOkResponse({
    description: 'VNPay payment transaction and pending order cancelled',
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Payment does not belong to caller' })
  @ApiNotFoundResponse({ description: 'VNPay payment transaction not found' })
  @ApiConflictResponse({
    description: 'Payment status changed during cancellation',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Payment already completed or cannot be cancelled',
  })
  async cancelPendingPayment(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Session() session: UserSession,
  ): Promise<CancelPaymentResponse> {
    const transaction = await this.payments.cancelPendingPaymentForOrder(
      orderId,
      session.user.id,
      'Customer cancelled VNPay payment from mobile checkout',
    );

    await this.commandBus.execute(
      new TransitionOrderCommand(
        orderId,
        'cancelled',
        session.user.id,
        'customer',
        'Customer cancelled VNPay payment before completion.',
        'customer_request',
      ),
    );

    return transaction;
  }
}
