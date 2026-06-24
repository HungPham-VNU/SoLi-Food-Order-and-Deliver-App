import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { count, desc, eq } from 'drizzle-orm';
import { MEDIA_DATABASE } from '@/drizzle/database.constants';
import type { MediaDatabase } from '@/drizzle/database.module';
import { images, type Image, type NewImage } from './image.schema';

export interface PaginatedImages {
  data: Image[];
  total: number;
}

@Injectable()
export class ImageRepository {
  constructor(
    @Inject(MEDIA_DATABASE) private readonly database: MediaDatabase,
  ) {}

  async findAll(offset: number, limit: number): Promise<PaginatedImages> {
    const [countResult, rows] = await Promise.all([
      this.database.select({ total: count() }).from(images),
      this.database
        .select()
        .from(images)
        .orderBy(desc(images.createdAt))
        .offset(offset)
        .limit(limit),
    ]);

    return { data: rows, total: countResult[0]?.total ?? 0 };
  }

  async createIdempotent(data: NewImage): Promise<Image> {
    const [created] = await this.database
      .insert(images)
      .values(data)
      .onConflictDoNothing({ target: images.idempotencyKey })
      .returning();

    if (created) return created;

    const [existing] = await this.database
      .select()
      .from(images)
      .where(eq(images.idempotencyKey, data.idempotencyKey))
      .limit(1);

    if (!existing) {
      throw new Error('Idempotent image insert lost its committed row');
    }

    const samePayload =
      existing.publicId === data.publicId &&
      existing.secureUrl === data.secureUrl &&
      existing.width === data.width &&
      existing.height === data.height;
    if (!samePayload) {
      throw new ConflictException(
        'Idempotency key was already used for different image metadata.',
      );
    }

    return existing;
  }
}
