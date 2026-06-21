import { Module } from '@nestjs/common';
import { MenuModule } from './menu/menu.module';
import { CatalogContractsModule } from './catalog-contracts.module';
import { ZonesModule } from './restaurant/zones/zones.module';
import { SearchModule } from './search/search.module';
import { ModifiersModule } from './menu/modifiers/modifiers.module';
import { NutritionModule } from './nutrition/nutrition.module';
import { DietaryTagsModule } from './dietary-tags/dietary-tags.module';

@Module({
  imports: [
    MenuModule,
    CatalogContractsModule,
    ZonesModule,
    SearchModule,
    ModifiersModule,
    NutritionModule,
    DietaryTagsModule,
  ],
  exports: [CatalogContractsModule],
})
export class RestaurantCatalogModule {}
