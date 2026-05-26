import { useState } from 'react';
import {
  uploadImageToCloudinary,
  storeImageMetadata,
  type CloudinaryImageMetadata,
} from '@/features/image/api/cloudinary-upload';

/**
 * Upload an image to Cloudinary and persist its metadata to the `images` table.
 *
 * Two phases:
 *   1. Direct upload — file goes browser → Cloudinary (signed). Required.
 *   2. Metadata persistence — POST /api/images so the `public_id` is tracked
 *      server-side. Best-effort: if the metadata call fails, the upload still
 *      succeeds (Cloudinary has the asset) but a warning is logged so we know
 *      orphan tracking failed for this asset.
 *
 * Why persist? The `images` table is the only place the `public_id` lives
 * canonically. Without it we can't programmatically delete unused assets later
 * (see CONTEXT.md rule 2 — Smart Image Cleanup).
 */
export function useImageUpload(folder = 'menu-items') {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const upload = async (
    file: File,
  ): Promise<CloudinaryImageMetadata | null> => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const result = await uploadImageToCloudinary(file, folder);

      // Best-effort persistence — don't block the upload if this fails.
      try {
        await storeImageMetadata(result);
      } catch (metaErr) {
        // eslint-disable-next-line no-console
        console.warn(
          '[useImageUpload] Cloudinary asset uploaded but metadata persistence failed:',
          metaErr,
          '\nasset:',
          result.publicId,
        );
      }

      return result;
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { upload, isUploading, uploadError };
}
