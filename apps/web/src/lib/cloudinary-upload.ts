/**
 * Re-export of the feature module so legacy imports keep working.
 * Prefer the feature path `@/features/image/api/cloudinary-upload` in new code.
 *
 * Single source of truth: `apps/web/src/features/image/api/cloudinary-upload.ts`
 */
export {
  uploadImageToCloudinary,
  storeImageMetadata,
  type CloudinaryImageMetadata,
} from '@/features/image/api/cloudinary-upload';

import {
  uploadImageToCloudinary,
  type CloudinaryImageMetadata,
} from '@/features/image/api/cloudinary-upload';

/**
 * Legacy helper kept for any callers that only need the URL.
 * NOTE: this DOES NOT persist metadata. Prefer `useImageUpload` for that.
 */
export async function uploadToCloudinary(
  file: File,
  folder = 'menu-items',
): Promise<string> {
  const image: CloudinaryImageMetadata = await uploadImageToCloudinary(
    file,
    folder,
  );
  return image.secureUrl;
}
