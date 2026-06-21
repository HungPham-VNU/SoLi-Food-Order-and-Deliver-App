import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, ne, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import {
  dietaryTags,
  type DietaryTag,
  type DietaryTagCategory,
  type NewDietaryTag,
} from './domain/dietary-tag.schema';

@Injectable()
export class DietaryTagsRepository {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase,
  ) {}

  async findAll(): Promise<DietaryTag[]> {
    return this.db
      .select()
      .from(dietaryTags)
      .orderBy(asc(dietaryTags.category), asc(dietaryTags.name));
  }

  async findActive(category?: DietaryTagCategory): Promise<DietaryTag[]> {
    return this.db
      .select()
      .from(dietaryTags)
      .where(
        category
          ? and(
              eq(dietaryTags.isActive, true),
              eq(dietaryTags.category, category),
            )
          : eq(dietaryTags.isActive, true),
      )
      .orderBy(asc(dietaryTags.category), asc(dietaryTags.name));
  }

  async findById(id: string): Promise<DietaryTag | null> {
    const [row] = await this.db
      .select()
      .from(dietaryTags)
      .where(eq(dietaryTags.id, id))
      .limit(1);
    return row ?? null;
  }

  async findConflict(
    name: string,
    slug: string,
    excludeId?: string,
  ): Promise<DietaryTag | null> {
    const duplicate = or(
      sql`lower(${dietaryTags.name}) = lower(${name})`,
      eq(dietaryTags.slug, slug),
    );
    const [row] = await this.db
      .select()
      .from(dietaryTags)
      .where(
        excludeId ? and(duplicate, ne(dietaryTags.id, excludeId)) : duplicate,
      )
      .limit(1);
    return row ?? null;
  }

  async create(data: NewDietaryTag): Promise<DietaryTag> {
    const [row] = await this.db.insert(dietaryTags).values(data).returning();
    return row;
  }

  async update(
    id: string,
    data: Partial<Omit<NewDietaryTag, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<DietaryTag | null> {
    const [row] = await this.db
      .update(dietaryTags)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(dietaryTags.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string): Promise<DietaryTag | null> {
    const [row] = await this.db
      .delete(dietaryTags)
      .where(eq(dietaryTags.id, id))
      .returning();
    return row ?? null;
  }
}
