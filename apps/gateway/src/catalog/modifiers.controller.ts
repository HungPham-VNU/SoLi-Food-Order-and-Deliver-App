import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CATALOG_RPC_PATTERNS } from '@uitfood/contracts';
import type { CatalogRpcGateway } from './catalog.interfaces';
import { CATALOG_RPC_GATEWAY } from './catalog.tokens';
import { CatalogSessionGuard } from './catalog-session.guard';
import { InternalJwtService } from '@/identity/internal-jwt.service';
import type { GatewayRequestWithSession } from '@/identity/identity.interfaces';

@ApiTags('Catalog: Modifiers')
@ApiBearerAuth()
@Controller('api/menu-items/:menuItemId/modifier-groups')
export class ModifiersController {
  constructor(
    @Inject(CATALOG_RPC_GATEWAY) private readonly catalog: CatalogRpcGateway,
    private readonly internalJwt: InternalJwtService,
  ) {}

  private token(req: GatewayRequestWithSession): string {
    return this.internalJwt.issueForRequest(req, 'catalog');
  }

  @Get()
  listGroups(@Param('menuItemId') menuItemId: string) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.listModifierGroups, {
      menuItemId,
    });
  }

  @Post()
  @UseGuards(CatalogSessionGuard)
  createGroup(
    @Req() req: GatewayRequestWithSession,
    @Param('menuItemId') menuItemId: string,
    @Body() dto: unknown,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.createModifierGroup, {
      internalAuth: this.token(req),
      menuItemId,
      dto,
    });
  }

  @Patch(':groupId')
  @UseGuards(CatalogSessionGuard)
  updateGroup(
    @Req() req: GatewayRequestWithSession,
    @Param('menuItemId') menuItemId: string,
    @Param('groupId') groupId: string,
    @Body() dto: unknown,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.updateModifierGroup, {
      internalAuth: this.token(req),
      groupId,
      menuItemId,
      dto,
    });
  }

  @Delete(':groupId')
  @UseGuards(CatalogSessionGuard)
  removeGroup(
    @Req() req: GatewayRequestWithSession,
    @Param('menuItemId') menuItemId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.removeModifierGroup, {
      internalAuth: this.token(req),
      groupId,
      menuItemId,
    });
  }

  @Post(':groupId/options')
  @UseGuards(CatalogSessionGuard)
  createOption(
    @Req() req: GatewayRequestWithSession,
    @Param('menuItemId') menuItemId: string,
    @Param('groupId') groupId: string,
    @Body() dto: unknown,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.createModifierOption, {
      internalAuth: this.token(req),
      groupId,
      menuItemId,
      dto,
    });
  }

  @Patch(':groupId/options/:optionId')
  @UseGuards(CatalogSessionGuard)
  updateOption(
    @Req() req: GatewayRequestWithSession,
    @Param('menuItemId') menuItemId: string,
    @Param('groupId') groupId: string,
    @Param('optionId') optionId: string,
    @Body() dto: unknown,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.updateModifierOption, {
      internalAuth: this.token(req),
      optionId,
      groupId,
      menuItemId,
      dto,
    });
  }

  @Delete(':groupId/options/:optionId')
  @UseGuards(CatalogSessionGuard)
  removeOption(
    @Req() req: GatewayRequestWithSession,
    @Param('menuItemId') menuItemId: string,
    @Param('groupId') groupId: string,
    @Param('optionId') optionId: string,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.removeModifierOption, {
      internalAuth: this.token(req),
      optionId,
      groupId,
      menuItemId,
    });
  }
}
