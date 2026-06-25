import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  MEDIA_RPC_PATTERNS,
  createImageRequestSchema,
  createUploadSignatureRequestSchema,
  listImagesRequestSchema,
  type CreateImageRequest,
  type CreateUploadSignatureRequest,
  type ListImagesRequest,
} from '@uitfood/contracts';
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { InternalAuthService } from '@/auth/internal-auth.service';
import { ImageService } from '@/image/image.service';
import { asMediaRpcException } from './media-rpc.errors';

@Controller()
export class MediaRpcController {
  constructor(
    private readonly images: ImageService,
    private readonly cloudinary: CloudinaryService,
    private readonly internalAuth: InternalAuthService,
  ) {}

  @MessagePattern(MEDIA_RPC_PATTERNS.listImages)
  async listImages(@Payload() payload: ListImagesRequest) {
    try {
      return await this.images.findAll(listImagesRequestSchema.parse(payload));
    } catch (error) {
      throw asMediaRpcException(error);
    }
  }

  @MessagePattern(MEDIA_RPC_PATTERNS.createImage)
  async createImage(@Payload() payload: CreateImageRequest) {
    try {
      const input = createImageRequestSchema.parse(payload);
      this.internalAuth.verifyMediaToken(input.internalAuth);
      return await this.images.create(input);
    } catch (error) {
      throw asMediaRpcException(error);
    }
  }

  @MessagePattern(MEDIA_RPC_PATTERNS.createUploadSignature)
  createUploadSignature(@Payload() payload: CreateUploadSignatureRequest) {
    try {
      const input = createUploadSignatureRequestSchema.parse(payload);
      this.internalAuth.verifyMediaToken(input.internalAuth);
      return this.cloudinary.getUploadSignature(input.folder);
    } catch (error) {
      throw asMediaRpcException(error);
    }
  }
}
