import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { Env } from '@/config/env.schema';
import { IdentitySessionAuthenticator } from '@/identity/identity-session.authenticator';
import type { PaymentRouteOverrides } from './payment.interfaces';
import { NestPaymentRpcClient } from './nest-payment-rpc.client';
import { PaymentSessionGuard } from './payment-session.guard';
import {
  PAYMENT_RPC_GATEWAY,
  PAYMENT_SESSION_AUTHENTICATOR,
  PAYMENT_TCP_CLIENT,
} from './payment.tokens';
import { PaymentsController } from './payments.controller';

@Module({})
export class PaymentRoutesModule {
  static register(overrides: PaymentRouteOverrides = {}): DynamicModule {
    return {
      module: PaymentRoutesModule,
      imports: [ConfigModule],
      controllers: [PaymentsController],
      providers: [
        {
          provide: PAYMENT_TCP_CLIENT,
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) =>
            ClientProxyFactory.create({
              transport: Transport.TCP,
              options: {
                host: config.get('PAYMENT_TCP_HOST', { infer: true }),
                port: config.get('PAYMENT_TCP_PORT', { infer: true }),
              },
            }),
        },
        NestPaymentRpcClient,
        PaymentSessionGuard,
        overrides.paymentClient
          ? { provide: PAYMENT_RPC_GATEWAY, useValue: overrides.paymentClient }
          : { provide: PAYMENT_RPC_GATEWAY, useExisting: NestPaymentRpcClient },
        overrides.paymentSessionAuthenticator
          ? {
              provide: PAYMENT_SESSION_AUTHENTICATOR,
              useValue: overrides.paymentSessionAuthenticator,
            }
          : {
              provide: PAYMENT_SESSION_AUTHENTICATOR,
              useExisting: IdentitySessionAuthenticator,
            },
      ],
    };
  }
}
