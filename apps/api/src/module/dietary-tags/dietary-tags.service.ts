import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateDietaryTagDto,
  UpdateDietaryTagDto,
} from './dto/dietary-tag.dto';
import type {
  DietaryTag,
  DietaryTagCategory,
} from './domain/dietary-tag.schema';
import { DietaryTagsRepository } from './dietary-tags.repository';

@Injectable()
export class DietaryTagsService {
  private readonly logger = new Logger(DietaryTagsService.name);

  constructor(private readonly repository: DietaryTagsRepository) {}

  listAll(): Promise<DietaryTag[]> {
    return this.repository.findAll();
  }

  listActive(category?: DietaryTagCategory): Promise<DietaryTag[]> {
    return this.repository.findActive(category);
  }

  async create(dto: CreateDietaryTagDto): Promise<DietaryTag> {
    await this.assertUnique(dto.name, dto.slug);
    try {
      const created = await this.repository.create({
        name: dto.name,
        slug: dto.slug,
        description: dto.description || null,
        category: dto.category,
        isActive: dto.isActive ?? true,
      });
      this.logger.log(
        `Created dietary tag id=${created.id} slug=${created.slug}`,
      );
      return created;
    } catch (error: unknown) {
      this.rethrowWriteError(error);
    }
  }

  async update(id: string, dto: UpdateDietaryTagDto): Promise<DietaryTag> {
    const existing = await this.getById(id);
    const nextName = dto.name ?? existing.name;
    const nextSlug = dto.slug ?? existing.slug;
    await this.assertUnique(nextName, nextSlug, id);

    let updated: DietaryTag | null;
    try {
      updated = await this.repository.update(id, {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && {
          description: dto.description || null,
        }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      });
    } catch (error: unknown) {
      this.rethrowWriteError(error);
    }
    if (!updated) throw new NotFoundException(`Dietary tag ${id} not found`);
    this.logger.log(`Updated dietary tag id=${id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) throw new NotFoundException(`Dietary tag ${id} not found`);
    this.logger.log(`Deleted dietary tag id=${id} slug=${deleted.slug}`);
  }

  private async getById(id: string): Promise<DietaryTag> {
    const row = await this.repository.findById(id);
    if (!row) throw new NotFoundException(`Dietary tag ${id} not found`);
    return row;
  }

  private async assertUnique(
    name: string,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const conflict = await this.repository.findConflict(name, slug, excludeId);
    if (!conflict) return;
    if (conflict.slug === slug) {
      throw new ConflictException(`A tag with slug ${slug} already exists`);
    }
    throw new ConflictException(`A tag named ${name} already exists`);
  }

  private rethrowWriteError(error: unknown): never {
    const message =
      error instanceof Error
        ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ''}`
        : '';
    if (
      message.includes('dietary_tags_slug_unique') ||
      message.includes('dietary_tags_name_lower_unique') ||
      message.includes('duplicate key')
    ) {
      throw new ConflictException(
        'A tag with this name or slug already exists',
      );
    }
    throw error;
  }
}
