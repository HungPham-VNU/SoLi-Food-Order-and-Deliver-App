import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CATALOG_RPC_PATTERNS } from '@uitfood/contracts';
import { ModifiersService } from '@/menu/modifiers/modifiers.service';
import { InternalAuthService } from '@/auth/internal-auth.service';
import type {
  CreateModifierGroupDto,
  UpdateModifierGroupDto,
  CreateModifierOptionDto,
  UpdateModifierOptionDto,
} from '@/menu/modifiers/modifiers.dto';
import { asCatalogRpcException } from './catalog-rpc.errors';

interface Mutation {
  internalAuth: string;
}

@Controller()
export class ModifiersRpcController {
  constructor(
    private readonly service: ModifiersService,
    private readonly auth: InternalAuthService,
  ) {}

  @MessagePattern(CATALOG_RPC_PATTERNS.listModifierGroups)
  async listGroups(@Payload() p: { menuItemId: string }) {
    try {
      return await this.service.findGroupsByMenuItem(p.menuItemId);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.createModifierGroup)
  async createGroup(
    @Payload()
    p: Mutation & { menuItemId: string; dto: CreateModifierGroupDto },
  ) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.createGroup(
        p.menuItemId,
        c.userId,
        c.isAdmin,
        p.dto,
      );
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.updateModifierGroup)
  async updateGroup(
    @Payload()
    p: Mutation & {
      groupId: string;
      menuItemId: string;
      dto: UpdateModifierGroupDto;
    },
  ) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.updateGroup(
        p.groupId,
        p.menuItemId,
        c.userId,
        c.isAdmin,
        p.dto,
      );
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.removeModifierGroup)
  async removeGroup(
    @Payload() p: Mutation & { groupId: string; menuItemId: string },
  ) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      await this.service.removeGroup(
        p.groupId,
        p.menuItemId,
        c.userId,
        c.isAdmin,
      );
      return { id: p.groupId, removed: true };
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.createModifierOption)
  async createOption(
    @Payload()
    p: Mutation & {
      groupId: string;
      menuItemId: string;
      dto: CreateModifierOptionDto;
    },
  ) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.createOption(
        p.groupId,
        p.menuItemId,
        c.userId,
        c.isAdmin,
        p.dto,
      );
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.updateModifierOption)
  async updateOption(
    @Payload()
    p: Mutation & {
      optionId: string;
      groupId: string;
      menuItemId: string;
      dto: UpdateModifierOptionDto;
    },
  ) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.updateOption(
        p.optionId,
        p.groupId,
        p.menuItemId,
        c.userId,
        c.isAdmin,
        p.dto,
      );
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.removeModifierOption)
  async removeOption(
    @Payload()
    p: Mutation & { optionId: string; groupId: string; menuItemId: string },
  ) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      await this.service.removeOption(
        p.optionId,
        p.groupId,
        p.menuItemId,
        c.userId,
        c.isAdmin,
      );
      return { id: p.optionId, removed: true };
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }
}
