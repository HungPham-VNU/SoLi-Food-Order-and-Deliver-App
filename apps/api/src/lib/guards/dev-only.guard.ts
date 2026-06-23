import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config/env.schema';
import { isDevOrTestEnv } from '../environment';

/**
 * DevOnlyGuard
 *
 * Blocks any route it protects unless NODE_ENV is in the dev/test allowlist
 * (see {@link isDevOrTestEnv}). Used to fence off integration-test endpoints
 * (e.g. POST /notifications/test/push, /notifications/test/email) so they
 * cannot be invoked in production.
 *
 * Behaviour in production: throws NotFoundException rather than
 * ForbiddenException. A 404 does not reveal that the endpoint exists, so an
 * attacker probing the surface cannot distinguish a disabled test endpoint
 * from a path that was never defined.
 *
 * This is the runtime (defense-in-depth) layer. Where possible, prefer ALSO
 * not registering dev-only controllers in production at the module level so
 * the routes never enter the router or the OpenAPI document.
 */
@Injectable()
export class DevOnlyGuard implements CanActivate {
  private readonly logger = new Logger(DevOnlyGuard.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const nodeEnv = this.config.get('NODE_ENV', { infer: true });
    if (isDevOrTestEnv(nodeEnv)) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ method?: string; url?: string }>();
    this.logger.warn(
      `Blocked dev-only endpoint in NODE_ENV=${nodeEnv ?? '(unset)'}: ` +
        `${req?.method ?? '?'} ${req?.url ?? '?'}`,
    );
    throw new NotFoundException();
  }
}
