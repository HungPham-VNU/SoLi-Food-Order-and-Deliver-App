import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ZonesController } from './zones.controller';
import { ZonesService } from './zones.service';
import { ZonesRepository } from './zones.repository';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { GeoModule } from '@/lib/geo/geo.module';
import { RestaurantModule } from '../restaurant.module';

@Module({
  imports: [CqrsModule, DatabaseModule, RestaurantModule, GeoModule],
  controllers: [ZonesController],
  providers: [ZonesService, ZonesRepository],
})
export class ZonesModule {}
