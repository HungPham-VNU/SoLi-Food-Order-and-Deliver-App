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
  MEDIA_RPC_PATTERNS,
  imageRecordSchema,
  mediaRpcErrorSchema,
  type CreateImageRequest,
} from '@uitfood/contracts';
import { createHash } from 'node:crypto';
import type { Env } from '@/config/env.schema';
import type { CreateImageDto } from '@/shared/contracts/image.dto';
import type { IImageManagementPort } from '@/shared/ports/image-management.port';
import { MEDIA_TCP_CLIENT } from './media-client.constants';

@Injectable()
export class MediaImageManagementAdapter
  implements IImageManagementPort, OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(MediaImageManagementAdapter.name);

  constructor(
    @Inject(MEDIA_TCP_CLIENT) private readonly client: ClientProxy,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get('MEDIA_RPC_REQUIRED', { infer: true })) {
      await this.client.connect();
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }

  async create(input: CreateImageDto): Promise<unknown> {
    const request: CreateImageRequest = {
      idempotencyKey: `image:${createHash('sha256')
        .update(input.publicId)
        .digest('hex')}`,
      image: input,
    };
    const attempts = this.config.get('MEDIA_RPC_MAX_ATTEMPTS', { infer: true });
    const timeoutMs = this.config.get('MEDIA_RPC_TIMEOUT_MS', { infer: true });
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await firstValueFrom(
          this.client
            .send(MEDIA_RPC_PATTERNS.createImage, request)
            .pipe(timeout(timeoutMs)),
        );
        return imageRecordSchema.parse(response);
      } catch (error) {
        const rpcError = mediaRpcErrorSchema.safeParse(error);
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
          `Media create attempt ${attempt}/${attempts} failed for ${input.publicId}`,
        );
      }
    }

    throw new ServiceUnavailableException('Media service is unavailable.', {
      cause: lastError,
    });
  }
}
