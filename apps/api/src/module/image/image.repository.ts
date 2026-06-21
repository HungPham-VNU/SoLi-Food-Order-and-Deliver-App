import { Inject, Injectable } from '@nestjs/common';
import { count, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import { images, type Image, type NewImage } from './image.schema';

export interface PaginatedImages {
  data: Image[];
  total: number;
}

@Injectable()
export class ImageRepository {
  constructor(@Inject(DB_CONNECTION) private readonly db: NodePgDatabase) {}

  async findAll(offset: number, limit: number): Promise<PaginatedImages> {
    const [countResult, rows] = await Promise.all([
      this.db.select({ total: count() }).from(images),
      this.db
        .select()
        .from(images)
        .orderBy(desc(images.createdAt))
        .offset(offset)
        .limit(limit),
    ]);

    return {
      data: rows,
      total: countResult[0]?.total ?? 0,
    };
  }

  async create(data: NewImage): Promise<Image> {
    const [row] = await this.db.insert(images).values(data).returning();
    return row;
  }
}
