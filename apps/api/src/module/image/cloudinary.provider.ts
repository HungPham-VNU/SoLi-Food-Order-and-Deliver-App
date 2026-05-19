import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Logger } from '@nestjs/common';
import { CLOUDINARY_CLIENT } from './cloudinary.constants';

export const cloudinaryProvider = {
  provide: CLOUDINARY_CLIENT,
  useFactory: (configService: ConfigService) => {
    const cloudName = configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = configService.get<string>('CLOUDINARY_API_SECRET');
    const nodeEnv = configService.get<string>('NODE_ENV');

    if (cloudName === 'STUB_CLOUD' || !cloudName || !apiKey || !apiSecret) {
      const logger = new Logger('CloudinaryProvider');
      if (nodeEnv === 'test') {
        logger.warn(
          'Cloudinary credentials are missing or using STUB values. Image uploads will fail.',
        );
      } else {
        // Still throw in production if for some reason schema defaults were bypassed
        throw new Error(
          'Cloudinary credentials are missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
        );
      }
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    return cloudinary;
  },
  inject: [ConfigService],
};
