import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';

/**
 * Gateway management endpoints. These are the only routes the gateway serves
 * itself; everything else is proxied (see api-proxy.factory.ts pathFilter).
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
   * Readiness: the gateway can reach the upstream monolith. Returns 503 when the
   * upstream is unreachable so traffic is not routed to a gateway that cannot
   * serve it. A non-2xx HTTP response from the monolith still counts as
   * "reachable" — only a transport failure/timeout fails readiness.
   */
  @Get('ready')
  async ready(): Promise<{ status: 'ok'; upstream: 'reachable' }> {
    const target = this.config.get('MONOLITH_UPSTREAM_URL', { infer: true });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_000);
    try {
      await fetch(target, { method: 'HEAD', signal: controller.signal });
      return { status: 'ok', upstream: 'reachable' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'degraded',
        upstream: 'unreachable',
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
