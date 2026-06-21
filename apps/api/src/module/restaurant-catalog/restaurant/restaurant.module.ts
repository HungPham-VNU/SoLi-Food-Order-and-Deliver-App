import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';
import { RestaurantRepository } from './restaurant.repository';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { ImageModule } from '@/module/image/image.module';
import { AiSearchIndexModule } from '@/module/restaurant-catalog/search/indexing/ai-search-index.module';
import { IdentityModule } from '@/module/auth/identity.module';
import { RESTAURANT_ACCESS_PORT } from '@/shared/ports/restaurant-access.port';

@Module({
  imports: [
    DatabaseModule,
    CqrsModule,
    ImageModule,
    AiSearchIndexModule,
    IdentityModule,
  ],
  controllers: [RestaurantController],
  providers: [
    RestaurantService,
    RestaurantRepository,
    { provide: RESTAURANT_ACCESS_PORT, useExisting: RestaurantService },
  ],
  exports: [RestaurantService, RESTAURANT_ACCESS_PORT],
})
export class RestaurantModule {}
