import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';

type ServiceName =
  | 'media'
  | 'identity'
  | 'notification'
  | 'catalog'
  | 'promotion'
  | 'payment'
  | 'review'
  | 'ordering'
  | 'reporting';

type ServiceStatus = 'reachable' | 'disabled' | 'unreachable';

interface ServiceCheck {
  name: ServiceName;
  enabledKey: keyof Env;
  hostKey: keyof Env;
  portKey: keyof Env;
}

const SERVICE_CHECKS: readonly ServiceCheck[] = [
  {
    name: 'media',
    enabledKey: 'MEDIA_ROUTES_ENABLED',
    hostKey: 'MEDIA_TCP_HOST',
    portKey: 'MEDIA_MANAGEMENT_PORT',
  },
  {
    name: 'identity',
    enabledKey: 'IDENTITY_ROUTES_ENABLED',
    hostKey: 'IDENTITY_TCP_HOST',
    portKey: 'IDENTITY_MANAGEMENT_PORT',
  },
  {
    name: 'notification',
    enabledKey: 'NOTIFICATION_ROUTES_ENABLED',
    hostKey: 'NOTIFICATION_TCP_HOST',
    portKey: 'NOTIFICATION_MANAGEMENT_PORT',
  },
  {
    name: 'catalog',
    enabledKey: 'CATALOG_ROUTES_ENABLED',
    hostKey: 'CATALOG_TCP_HOST',
    portKey: 'CATALOG_MANAGEMENT_PORT',
  },
  {
    name: 'promotion',
    enabledKey: 'PROMOTION_ROUTES_ENABLED',
    hostKey: 'PROMOTION_TCP_HOST',
    portKey: 'PROMOTION_MANAGEMENT_PORT',
  },
  {
    name: 'payment',
    enabledKey: 'PAYMENT_ROUTES_ENABLED',
    hostKey: 'PAYMENT_TCP_HOST',
    portKey: 'PAYMENT_MANAGEMENT_PORT',
  },
  {
    name: 'review',
    enabledKey: 'REVIEW_ROUTES_ENABLED',
    hostKey: 'REVIEW_TCP_HOST',
    portKey: 'REVIEW_MANAGEMENT_PORT',
  },
  {
    name: 'ordering',
    enabledKey: 'ORDERING_ROUTES_ENABLED',
    hostKey: 'ORDERING_TCP_HOST',
    portKey: 'ORDERING_MANAGEMENT_PORT',
  },
  {
    name: 'reporting',
    enabledKey: 'REPORTING_ROUTES_ENABLED',
    hostKey: 'REPORTING_TCP_HOST',
    portKey: 'REPORTING_MANAGEMENT_PORT',
  },
];

/**
 * Gateway management endpoints. These are the only routes the gateway serves
 * itself; public API routes are translated to private services.
 */
@Controller()
export class HealthController {
  constructor(private readonly config: ConfigService<Env, true>) {}

  /** Liveness: the process is up. Used by the orchestrator to restart on hang. */
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /**
   * Readiness follows active route ownership. Enabled services must expose a
   * healthy management endpoint; disabled services are ignored for isolated
   * component tests.
   */
  @Get('ready')
  async ready(): Promise<{
    status: 'ok';
    services: Record<ServiceName, Exclude<ServiceStatus, 'unreachable'>>;
  }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_000);
    try {
      const checks = await Promise.all(
        SERVICE_CHECKS.map((service) =>
          this.checkServiceReadiness(service, controller.signal),
        ),
      );
      const services = Object.fromEntries(checks) as Record<
        ServiceName,
        ServiceStatus
      >;
      if (Object.values(services).some((status) => status === 'unreachable')) {
        throw new ServiceUnavailableException({
          status: 'degraded',
          services,
        });
      }
      return {
        status: 'ok',
        services: services as Record<
          ServiceName,
          Exclude<ServiceStatus, 'unreachable'>
        >,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException({ status: 'degraded' });
    } finally {
      clearTimeout(timer);
    }
  }

  private async checkServiceReadiness(
    service: ServiceCheck,
    signal: AbortSignal,
  ): Promise<[ServiceName, ServiceStatus]> {
    if (!this.config.get(service.enabledKey, { infer: true })) {
      return [service.name, 'disabled'];
    }

    const host = this.config.get(service.hostKey, { infer: true });
    const port = this.config.get(service.portKey, { infer: true });
    try {
      const response = await fetch(`http://${host}:${port}/ready`, {
        method: 'GET',
        signal,
      });
      return [service.name, response.ok ? 'reachable' : 'unreachable'];
    } catch {
      return [service.name, 'unreachable'];
    }
  }
}
