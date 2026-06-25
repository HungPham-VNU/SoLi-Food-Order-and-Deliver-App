import { z } from 'zod';

export const MEDIA_RPC_PATTERNS = {
  listImages: 'media.image.list.v1',
  createImage: 'media.image.create.v1',
  createUploadSignature: 'media.cloudinary.signature.get.v1',
} as const;

export const imageMetadataSchema = z.object({
  publicId: z.string().min(1),
  secureUrl: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const imageRecordSchema = imageMetadataSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export const listImagesRequestSchema = z.object({
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(100).default(20),
});

export const listImagesResponseSchema = z.object({
  data: z.array(imageRecordSchema),
  total: z.number().int().nonnegative(),
});

export const createImageRequestSchema = z.object({
  internalAuth: z.string().min(1),
  idempotencyKey: z.string().trim().min(1).max(200),
  image: imageMetadataSchema,
});

export const createUploadSignatureRequestSchema = z.object({
  internalAuth: z.string().min(1),
  folder: z.string().max(120).optional(),
});

export const uploadSignatureResponseSchema = z.object({
  cloudName: z.string().min(1),
  apiKey: z.string().min(1),
  timestamp: z.number().int().positive(),
  signature: z.string().min(1),
  folder: z.string().min(1),
});

export const mediaRpcErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  code: z.string().min(1),
  message: z.string().min(1),
});

export type ImageMetadata = z.infer<typeof imageMetadataSchema>;
export type ImageRecord = z.infer<typeof imageRecordSchema>;
export type ListImagesRequest = z.infer<typeof listImagesRequestSchema>;
export type ListImagesResponse = z.infer<typeof listImagesResponseSchema>;
export type CreateImageRequest = z.infer<typeof createImageRequestSchema>;
export type CreateUploadSignatureRequest = z.infer<
  typeof createUploadSignatureRequestSchema
>;
export type UploadSignatureResponse = z.infer<
  typeof uploadSignatureResponseSchema
>;
export type MediaRpcError = z.infer<typeof mediaRpcErrorSchema>;
