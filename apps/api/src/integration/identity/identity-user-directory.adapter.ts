import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import {
  IDENTITY_RPC_PATTERNS,
  identityPromoteToRestaurantResponseSchema,
  identityRpcErrorSchema,
  identityUserContactResponseSchema,
} from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';
import type { IUserDirectoryPort } from '@/shared/ports/user-directory.port';
import { IDENTITY_TCP_CLIENT } from './identity-client.constants';

@Injectable()
export class IdentityUserDirectoryRpcAdapter
  implements IUserDirectoryPort, OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(IdentityUserDirectoryRpcAdapter.name);

  constructor(
    @Inject(IDENTITY_TCP_CLIENT) private readonly client: ClientProxy,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get('IDENTITY_RPC_REQUIRED', { infer: true })) {
      await this.client.connect();
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }

  async findEmail(userId: string): Promise<string | null> {
    const response = await this.send(IDENTITY_RPC_PATTERNS.getUserContact, {
      userId,
    });
    return identityUserContactResponseSchema.parse(response).email;
  }

  async promoteToRestaurant(userId: string): Promise<void> {
    const response = await this.send(
      IDENTITY_RPC_PATTERNS.promoteUserToRestaurant,
      { userId },
    );
    identityPromoteToRestaurantResponseSchema.parse(response);
  }

  private async send(pattern: string, payload: unknown): Promise<unknown> {
    const attempts = this.config.get('IDENTITY_RPC_MAX_ATTEMPTS', {
      infer: true,
    });
    const timeoutMs = this.config.get('IDENTITY_RPC_TIMEOUT_MS', {
      infer: true,
    });
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await firstValueFrom(
          this.client.send(pattern, payload).pipe(timeout(timeoutMs)),
        );
      } catch (error) {
        const rpcError = identityRpcErrorSchema.safeParse(error);
        if (rpcError.success && rpcError.data.statusCode < 500) {
          throw new HttpException(
            {
              statusCode: rpcError.data.statusCode,
              error: HttpStatus[rpcError.data.statusCode],
              message: rpcError.data.message,
            },
            rpcError.data.statusCode,
          );
        }
        lastError = error;
        this.logger.warn(
          `Identity RPC attempt ${attempt}/${attempts} failed for ${pattern}`,
        );
      }
    }

    throw new ServiceUnavailableException('Identity service is unavailable.', {
      cause: lastError,
    });
  }
}
