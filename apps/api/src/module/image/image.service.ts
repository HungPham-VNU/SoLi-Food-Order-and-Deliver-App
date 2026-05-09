import { Injectable } from '@nestjs/common';
import { ImageRepository, type PaginatedImages } from './image.repository';
import { CreateImageDto } from './dto/image.dto';
import type { Image } from './image.schema';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class ImageService {
  constructor(private readonly repo: ImageRepository) {}

  async findAll(offset?: number, limit?: number): Promise<PaginatedImages> {
    const safeLimit = Math.min(
      Math.max(limit ?? DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE,
    );
    const safeOffset = Math.max(0, offset ?? 0);
    return this.repo.findAll(safeOffset, safeLimit);
  }

  async create(dto: CreateImageDto): Promise<Image> {
    return this.repo.create({
      publicId: dto.publicId,
      secureUrl: dto.secureUrl,
      width: dto.width,
      height: dto.height,
    });
  }
}
