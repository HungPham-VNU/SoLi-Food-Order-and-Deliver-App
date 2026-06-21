import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { MenuRepository } from './menu.repository';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { RestaurantModule } from '@/module/restaurant-catalog/restaurant/restaurant.module';
import { ImageModule } from '@/module/image/image.module';
import { AiSearchIndexModule } from '@/module/restaurant-catalog/search/indexing/ai-search-index.module';

/**
 * MenuModule — owns menu_items, menu_categories.
 * ModifiersModule is imported at RestaurantCatalogModule level to avoid
 * the circular dependency (ModifiersModule imports MenuModule for MenuRepository).
 */
@Module({
  imports: [
    DatabaseModule,
    RestaurantModule,
    ImageModule,
    CqrsModule,
    AiSearchIndexModule,
  ],
  controllers: [MenuController],
  providers: [MenuService, MenuRepository],
  exports: [MenuService, MenuRepository],
})
export class MenuModule {}
