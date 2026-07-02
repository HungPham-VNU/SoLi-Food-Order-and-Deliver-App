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
import { firstValueFrom, timeout, Observable } from 'rxjs';
import {
  catalogRpcErrorSchema,
  type CatalogRpcPattern,
} from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';
import type { CatalogRpcGateway } from './catalog.interfaces';
import { CATALOG_TCP_CLIENT } from './catalog.tokens';

@Injectable()
export class NestCatalogRpcClient
  implements CatalogRpcGateway, OnApplicationShutdown
{
  constructor(
    @Inject(CATALOG_TCP_CLIENT) private readonly client: ClientProxy,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }

  async send<T = unknown>(
    pattern: CatalogRpcPattern,
    payload: unknown,
  ): Promise<T> {
    const timeoutMs = this.config.get('CATALOG_RPC_TIMEOUT_MS', {
      infer: true,
    });
    try {
      return await firstValueFrom(
        this.client.send<T>(pattern, payload).pipe(timeout(timeoutMs)),
      );
    } catch (error) {
      const rpcError = catalogRpcErrorSchema.safeParse(error);
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
        throw new GatewayTimeoutException('Catalog service request timed out.');
      }
      throw new ServiceUnavailableException('Catalog service is unavailable.', {
        cause: error,
      });
    }
  }

  stream<T = unknown>(
    pattern: CatalogRpcPattern,
    payload: unknown,
  ): Observable<T> {
    return this.client.send<T>(pattern, payload);
  }
}
