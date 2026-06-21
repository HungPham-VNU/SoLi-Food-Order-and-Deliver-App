import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { cloudinaryProvider } from './cloudinary.provider';
import { CloudinaryController } from './cloudinary.controller';
import { CloudinaryService } from './cloudinary.service';
import { ImageController } from './image.controller';
import { ImageRepository } from './image.repository';
import { ImageService } from './image.service';
import { IMAGE_MANAGEMENT_PORT } from '@/shared/ports/image-management.port';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [CloudinaryController, ImageController],
  providers: [
    cloudinaryProvider,
    CloudinaryService,
    ImageService,
    ImageRepository,
    {
      provide: IMAGE_MANAGEMENT_PORT,
      useExisting: ImageService,
    },
  ],
  exports: [IMAGE_MANAGEMENT_PORT],
})
export class ImageModule {}
