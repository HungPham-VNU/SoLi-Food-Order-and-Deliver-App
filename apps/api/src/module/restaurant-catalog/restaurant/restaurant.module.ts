import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';
import { RestaurantRepository } from './restaurant.repository';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { ImageModule } from '@/module/image/image.module';

@Module({
  imports: [DatabaseModule, CqrsModule, ImageModule],
  controllers: [RestaurantController],
  providers: [RestaurantService, RestaurantRepository],
  exports: [RestaurantService],
})
export class RestaurantModule {}
