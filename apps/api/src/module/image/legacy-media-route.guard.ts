import {
  CanActivate,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config/env.schema';

@Injectable()
export class LegacyMediaRouteGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(): boolean {
    if (this.config.get('LEGACY_MEDIA_ROUTES_ENABLED', { infer: true })) {
      return true;
    }
    throw new ServiceUnavailableException(
      'Legacy Media routes are disabled after cutover.',
    );
  }
}
