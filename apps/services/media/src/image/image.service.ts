import { Injectable } from '@nestjs/common';
import type {
  CreateImageRequest,
  ImageRecord,
  ListImagesRequest,
  ListImagesResponse,
} from '@uitfood/contracts';
import { ImageRepository } from './image.repository';
import type { Image } from './image.schema';

@Injectable()
export class ImageService {
  constructor(private readonly repository: ImageRepository) {}

  async findAll(input: ListImagesRequest): Promise<ListImagesResponse> {
    const result = await this.repository.findAll(input.offset, input.limit);
    return {
      data: result.data.map((image) => this.toRecord(image)),
      total: result.total,
    };
  }

  async create(input: CreateImageRequest): Promise<ImageRecord> {
    const image = await this.repository.createIdempotent({
      ...input.image,
      idempotencyKey: input.idempotencyKey,
    });
    return this.toRecord(image);
  }

  private toRecord(image: Image): ImageRecord {
    return {
      id: image.id,
      publicId: image.publicId,
      secureUrl: image.secureUrl,
      width: image.width,
      height: image.height,
      createdAt: image.createdAt.toISOString(),
    };
  }
}
