import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from '@/config/env.schema';
import { DatabaseModule } from '@/drizzle/database.module';
import { cloudinaryProvider } from '@/cloudinary/cloudinary.provider';
import { InternalAuthService } from '@/auth/internal-auth.service';
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { ImageRepository } from '@/image/image.repository';
import { ImageService } from '@/image/image.service';
import { ManagementController } from '@/management/management.controller';
import { MediaRpcController } from '@/rpc/media-rpc.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate }), DatabaseModule],
  controllers: [ManagementController, MediaRpcController],
  providers: [
    cloudinaryProvider,
    InternalAuthService,
    CloudinaryService,
    ImageRepository,
    ImageService,
  ],
})
export class AppModule {}
