import { Module } from '@nestjs/common';
import { RestaurantModule } from './restaurant/restaurant.module';

@Module({
  imports: [RestaurantModule],
  exports: [RestaurantModule],
})
export class CatalogContractsModule {}
