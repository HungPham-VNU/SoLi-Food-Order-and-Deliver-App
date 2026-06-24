import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { MenuRepository } from './menu.repository';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { OutboxModule } from '@/messaging/outbox/outbox.module';
import { RestaurantModule } from '@/module/restaurant-catalog/restaurant/restaurant.module';
import { MediaClientModule } from '@/integration/media/media-client.module';
import { AiSearchIndexModule } from '@/module/restaurant-catalog/search/indexing/ai-search-index.module';

/**
 * MenuModule — owns menu_items, menu_categories.
 * ModifiersModule is imported at RestaurantCatalogModule level to avoid
 * the circular dependency (ModifiersModule imports MenuModule for MenuRepository).
 */
@Module({
  imports: [
    DatabaseModule,
    OutboxModule,
    RestaurantModule,
    MediaClientModule,
    CqrsModule,
    AiSearchIndexModule,
  ],
  controllers: [MenuController],
  providers: [MenuService, MenuRepository],
  exports: [MenuService, MenuRepository],
})
export class MenuModule {}
