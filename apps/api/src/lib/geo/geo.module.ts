import { Module } from '@nestjs/common';
import { GeoService } from './geo.service';

/** Geographic calculations shared through an explicitly imported module. */
@Module({
  providers: [GeoService],
  exports: [GeoService],
})
export class GeoModule {}
