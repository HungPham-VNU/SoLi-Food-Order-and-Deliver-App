import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CATALOG_RPC_PATTERNS } from '@uitfood/contracts';
import { NutritionService } from '@/nutrition/nutrition.service';
import { InternalAuthService } from '@/auth/internal-auth.service';
import type { AnalyzeRecipeDto } from '@/nutrition/dto/analyze-recipe.dto';
import type { CalculateNutritionDto } from '@/nutrition/dto/calculate-nutrition.dto';
import type { SaveMenuItemNutritionDto } from '@/nutrition/dto/save-menu-item-nutrition.dto';
import { asCatalogRpcException } from './catalog-rpc.errors';

interface Mutation {
  internalAuth: string;
  menuItemId: string;
}

@Controller()
export class NutritionRpcController {
  constructor(
    private readonly service: NutritionService,
    private readonly auth: InternalAuthService,
  ) {}

  @MessagePattern(CATALOG_RPC_PATTERNS.getNutrition)
  async getLatest(@Payload() p: Mutation) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.getLatestMenuItemNutritionAnalysis(
        p.menuItemId,
        c.userId,
        c.isAdmin,
      );
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.analyzeNutrition)
  analyze(@Payload() p: Mutation & { dto: AnalyzeRecipeDto }) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      return this.service.analyzeRecipe(
        p.menuItemId,
        c.userId,
        c.isAdmin,
        p.dto,
      );
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  // @MessagePattern(CATALOG_RPC_PATTERNS.startManualNutrition)
  async startManual(@Payload() p: Mutation) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.startManualIngredientSession(
        p.menuItemId,
        c.userId,
        c.isAdmin,
      );
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.calculateNutrition)
  async calculate(@Payload() p: Mutation & { dto: CalculateNutritionDto }) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.calculateNutrition(
        p.menuItemId,
        c.userId,
        c.isAdmin,
        p.dto,
      );
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.upsertNutrition)
  async save(@Payload() p: Mutation & { dto: SaveMenuItemNutritionDto }) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.saveMenuItemNutrition(
        p.menuItemId,
        c.userId,
        c.isAdmin,
        p.dto,
      );
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }
}
