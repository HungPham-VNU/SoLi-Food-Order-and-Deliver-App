import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/drizzle/database.module';
import { AuthModule } from '@/auth/auth.module';
import { DietaryTagsRepository } from './dietary-tags.repository';
import { DietaryTagsService } from './dietary-tags.service';
import { DietaryTagsRpcController } from '@/rpc/dietary-tags-rpc.controller';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [DietaryTagsRpcController],
  providers: [DietaryTagsRepository, DietaryTagsService],
})
export class DietaryTagsModule {}
