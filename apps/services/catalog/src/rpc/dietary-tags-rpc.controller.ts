import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CATALOG_RPC_PATTERNS } from '@uitfood/contracts';
import { DietaryTagsService } from '@/dietary-tags/dietary-tags.service';
import { InternalAuthService } from '@/auth/internal-auth.service';
import type {
  CreateDietaryTagDto,
  UpdateDietaryTagDto,
} from '@/dietary-tags/dto/dietary-tag.dto';
import type { DietaryTagCategory } from '@/dietary-tags/domain/dietary-tag.schema';
import { asCatalogRpcException } from './catalog-rpc.errors';

interface Mutation {
  internalAuth: string;
}

@Controller()
export class DietaryTagsRpcController {
  constructor(
    private readonly service: DietaryTagsService,
    private readonly auth: InternalAuthService,
  ) {}

  @MessagePattern(CATALOG_RPC_PATTERNS.listDietaryTags)
  async listActive(@Payload() p: { category?: DietaryTagCategory }) {
    try {
      return await this.service.listActive(p.category);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.listAllDietaryTags)
  async listAll(@Payload() p: Mutation) {
    try {
      this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.listAll();
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.createDietaryTag)
  async create(@Payload() p: Mutation & { dto: CreateDietaryTagDto }) {
    try {
      this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.create(p.dto);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.updateDietaryTag)
  async update(
    @Payload() p: Mutation & { id: string; dto: UpdateDietaryTagDto },
  ) {
    try {
      this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.update(p.id, p.dto);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.removeDietaryTag)
  async remove(@Payload() p: Mutation & { id: string }) {
    try {
      this.auth.verifyCatalogToken(p.internalAuth);
      await this.service.delete(p.id);
      return { id: p.id, removed: true };
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }
}
