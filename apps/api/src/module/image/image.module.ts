import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { cloudinaryProvider } from './cloudinary.provider';
import { CloudinaryController } from './cloudinary.controller';
import { CloudinaryService } from './cloudinary.service';
import { ImageController } from './image.controller';
import { ImageRepository } from './image.repository';
import { ImageService } from './image.service';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [CloudinaryController, ImageController],
  providers: [
    cloudinaryProvider,
    CloudinaryService,
    ImageService,
    ImageRepository,
  ],
  exports: [ImageService],
})
export class ImageModule {}
