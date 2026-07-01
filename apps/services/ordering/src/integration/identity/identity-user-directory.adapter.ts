import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import {
  IDENTITY_RPC_PATTERNS,
  identityRpcErrorSchema,
  identityUserContactResponseSchema,
} from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';
import type {
  IUserDirectoryPort,
  UserContact,
} from '@/shared/ports/user-directory.port';
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

  async findContact(userId: string): Promise<UserContact | null> {
    try {
      const response = await this.send(IDENTITY_RPC_PATTERNS.getUserContact, {
        userId,
      });
      const contact = identityUserContactResponseSchema.parse(response);
      if (!contact.name && !contact.phoneNumber) return null;
      return {
        id: contact.userId,
        name: contact.name ?? '',
        phoneNumber: contact.phoneNumber,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to look up identity contact for userId=${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async send(pattern: string, payload: unknown): Promise<unknown> {
    const timeoutMs = this.config.get('IDENTITY_RPC_TIMEOUT_MS', {
      infer: true,
    });
    try {
      return await firstValueFrom(
        this.client.send(pattern, payload).pipe(timeout(timeoutMs)),
      );
    } catch (error) {
      const rpcError = identityRpcErrorSchema.safeParse(error);
      if (rpcError.success) {
        throw new Error(rpcError.data.message);
      }
      throw error;
    }
  }
}
