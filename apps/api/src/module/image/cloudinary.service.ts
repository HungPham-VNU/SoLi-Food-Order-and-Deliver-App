import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { CLOUDINARY_CLIENT } from './cloudinary.constants';
import type { CloudinarySignatureResponseDto } from './dto/cloudinary.dto';

const DEFAULT_FOLDER = 'app-images';
const FOLDER_PATTERN = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/;

@Injectable()
export class CloudinaryService {
  constructor(
    @Inject(CLOUDINARY_CLIENT)
    private readonly cloudinaryClient: typeof cloudinary,
    private readonly configService: ConfigService,
  ) {}

  private resolveSafeFolder(folder?: string): string {
    const trimmed = folder?.trim();
    if (!trimmed) return DEFAULT_FOLDER;

    if (trimmed.startsWith('/') || trimmed.startsWith('\\')) {
      throw new BadRequestException('Invalid Cloudinary folder path.');
    }

    if (trimmed.includes('../') || trimmed.includes('..\\')) {
      throw new BadRequestException('Invalid Cloudinary folder path.');
    }

    if (!FOLDER_PATTERN.test(trimmed)) {
      throw new BadRequestException('Invalid Cloudinary folder path.');
    }

    return trimmed;
  }

  getUploadSignature(folder?: string): CloudinarySignatureResponseDto {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (
      !cloudName ||
      !apiKey ||
      !apiSecret ||
      cloudName === 'STUB_CLOUD' ||
      apiKey === 'STUB_KEY' ||
      apiSecret === 'STUB_SECRET'
    ) {
      throw new InternalServerErrorException(
        'Cloudinary configuration is missing.',
      );
    }

    const safeFolder = this.resolveSafeFolder(folder);
    const timestamp = Math.round(Date.now() / 1000);
    const signature = this.cloudinaryClient.utils.api_sign_request(
      { timestamp, folder: safeFolder },
      apiSecret,
    );

    return {
      cloudName,
      apiKey,
      timestamp,
      signature,
      folder: safeFolder,
    };
  }
}
