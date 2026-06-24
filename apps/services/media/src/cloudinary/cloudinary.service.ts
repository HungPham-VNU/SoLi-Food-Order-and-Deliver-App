import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadSignatureResponse } from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';
import { CLOUDINARY_CLIENT } from './cloudinary.constants';

const DEFAULT_FOLDER = 'app-images';
const FOLDER_PATTERN = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/;

@Injectable()
export class CloudinaryService {
  constructor(
    @Inject(CLOUDINARY_CLIENT)
    private readonly client: typeof cloudinary,
    private readonly config: ConfigService<Env, true>,
  ) {}

  getUploadSignature(folder?: string): UploadSignatureResponse {
    const safeFolder = this.resolveSafeFolder(folder);
    const timestamp = Math.round(Date.now() / 1000);
    const apiSecret = this.config.get('CLOUDINARY_API_SECRET', { infer: true });

    return {
      cloudName: this.config.get('CLOUDINARY_CLOUD_NAME', { infer: true }),
      apiKey: this.config.get('CLOUDINARY_API_KEY', { infer: true }),
      timestamp,
      signature: this.client.utils.api_sign_request(
        { timestamp, folder: safeFolder },
        apiSecret,
      ),
      folder: safeFolder,
    };
  }

  private resolveSafeFolder(folder?: string): string {
    const trimmed = folder?.trim();
    if (!trimmed) return DEFAULT_FOLDER;
    if (
      trimmed.startsWith('/') ||
      trimmed.startsWith('\\') ||
      trimmed.includes('../') ||
      trimmed.includes('..\\') ||
      !FOLDER_PATTERN.test(trimmed)
    ) {
      throw new BadRequestException('Invalid Cloudinary folder path.');
    }
    return trimmed;
  }
}
