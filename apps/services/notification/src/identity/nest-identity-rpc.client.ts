import {
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import {
  IDENTITY_RPC_PATTERNS,
  identityRpcErrorSchema,
  identitySessionIntrospectResponseSchema,
  identityUserContactResponseSchema,
  type IdentitySessionIntrospectRequest,
  type IdentityUserContactRequest,
} from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';
import type { IdentityRpcGateway } from './identity.interfaces';
import { IDENTITY_TCP_CLIENT } from './identity.tokens';

@Injectable()
export class NestIdentityRpcClient
  implements IdentityRpcGateway, OnApplicationShutdown
{
  constructor(
    @Inject(IDENTITY_TCP_CLIENT) private readonly client: ClientProxy,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }

  async introspectSession(input: IdentitySessionIntrospectRequest) {
    const response = await this.send(
      IDENTITY_RPC_PATTERNS.introspectSession,
      input,
    );
    return identitySessionIntrospectResponseSchema.parse(response);
  }

  async getUserContact(input: IdentityUserContactRequest) {
    const response = await this.send(
      IDENTITY_RPC_PATTERNS.getUserContact,
      input,
    );
    return identityUserContactResponseSchema.parse(response);
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
        throw new HttpException(
          {
            statusCode: rpcError.data.statusCode,
            error: HttpStatus[rpcError.data.statusCode],
            message: rpcError.data.message,
          },
          rpcError.data.statusCode,
        );
      }
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GatewayTimeoutException(
          'Identity service request timed out.',
        );
      }
      throw new ServiceUnavailableException(
        'Identity service is unavailable.',
        {
          cause: error,
        },
      );
    }
  }
}
