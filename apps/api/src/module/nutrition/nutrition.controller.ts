import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { hasRole } from '@/module/auth/role.util';
import { NutritionService } from './nutrition.service';
import { AnalyzeRecipeDto } from './dto/analyze-recipe.dto';
import { CalculateNutritionDto } from './dto/calculate-nutrition.dto';
import { SaveMenuItemNutritionDto } from './dto/save-menu-item-nutrition.dto';

@ApiTags('Nutrition')
@ApiBearerAuth()
@Controller('restaurant/menu-items/:menuItemId/nutrition')
@Roles(['admin', 'restaurant'])
export class NutritionController {
  constructor(private readonly service: NutritionService) {}

  @Post('analyze-recipe')
  @ApiOperation({ summary: 'Analyze a recipe text for menu item nutrition' })
  @ApiParam({ name: 'menuItemId', format: 'uuid' })
  @ApiBody({ type: AnalyzeRecipeDto })
  @ApiOkResponse({ description: 'Recipe analysis returned for review' })
  analyzeRecipe(
    @Param('menuItemId', ParseUUIDPipe) menuItemId: string,
    @Session() session: UserSession,
    @Body() dto: AnalyzeRecipeDto,
  ) {
    return this.service.analyzeRecipe(
      menuItemId,
      session.user.id,
      hasRole(session.user.role, 'admin'),
      dto,
    );
  }

  @Post('calculate')
  @ApiOperation({
    summary: 'Calculate nutrition from restaurant-confirmed ingredients',
  })
  @ApiParam({ name: 'menuItemId', format: 'uuid' })
  @ApiBody({ type: CalculateNutritionDto })
  @ApiOkResponse({ description: 'Nutrition calculated for final review' })
  calculate(
    @Param('menuItemId', ParseUUIDPipe) menuItemId: string,
    @Session() session: UserSession,
    @Body() dto: CalculateNutritionDto,
  ) {
    return this.service.calculateNutrition(
      menuItemId,
      session.user.id,
      hasRole(session.user.role, 'admin'),
      dto,
    );
  }

  @Put()
  @ApiOperation({ summary: 'Save restaurant-verified menu item nutrition' })
  @ApiParam({ name: 'menuItemId', format: 'uuid' })
  @ApiBody({ type: SaveMenuItemNutritionDto })
  @ApiOkResponse({ description: 'Nutrition saved' })
  save(
    @Param('menuItemId', ParseUUIDPipe) menuItemId: string,
    @Session() session: UserSession,
    @Body() dto: SaveMenuItemNutritionDto,
  ) {
    return this.service.saveMenuItemNutrition(
      menuItemId,
      session.user.id,
      hasRole(session.user.role, 'admin'),
      dto,
    );
  }
}

