import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { Env } from '@/config/env.schema';
import { IdentitySessionAuthenticator } from '@/identity/identity-session.authenticator';
import type { ReportingRouteOverrides } from './reporting.interfaces';
import { NestReportingRpcClient } from './nest-reporting-rpc.client';
import { ReportingSessionGuard } from './reporting-session.guard';
import {
  REPORTING_RPC_GATEWAY,
  REPORTING_SESSION_AUTHENTICATOR,
  REPORTING_TCP_CLIENT,
} from './reporting.tokens';
import { ReportsController } from './reports.controller';

/**
 * Reporting public-route ownership. Registered behind REPORTING_ROUTES_ENABLED.
 */
@Module({})
export class ReportingRoutesModule {
  static register(overrides: ReportingRouteOverrides = {}): DynamicModule {
    return {
      module: ReportingRoutesModule,
      imports: [ConfigModule],
      controllers: [ReportsController],
      providers: [
        {
          provide: REPORTING_TCP_CLIENT,
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) =>
            ClientProxyFactory.create({
              transport: Transport.TCP,
              options: {
                host: config.get('REPORTING_TCP_HOST', { infer: true }),
                port: config.get('REPORTING_TCP_PORT', { infer: true }),
              },
            }),
        },
        NestReportingRpcClient,
        ReportingSessionGuard,
        overrides.reportingClient
          ? {
              provide: REPORTING_RPC_GATEWAY,
              useValue: overrides.reportingClient,
            }
          : {
              provide: REPORTING_RPC_GATEWAY,
              useExisting: NestReportingRpcClient,
            },
        overrides.reportingSessionAuthenticator
          ? {
              provide: REPORTING_SESSION_AUTHENTICATOR,
              useValue: overrides.reportingSessionAuthenticator,
            }
          : {
              provide: REPORTING_SESSION_AUTHENTICATOR,
              useExisting: IdentitySessionAuthenticator,
            },
      ],
    };
  }
}
