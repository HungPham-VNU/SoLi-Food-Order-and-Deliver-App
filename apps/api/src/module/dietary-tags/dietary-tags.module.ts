import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import {
  DietaryTagsAdminController,
  DietaryTagsPublicController,
} from './dietary-tags.controller';
import { DietaryTagsRepository } from './dietary-tags.repository';
import { DietaryTagsService } from './dietary-tags.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DietaryTagsPublicController, DietaryTagsAdminController],
  providers: [DietaryTagsRepository, DietaryTagsService],
})
export class DietaryTagsModule {}
