import 'dotenv/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export type SeedImage = {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
};

export type SeedImageDef = {
  publicId: string;
  sourceUrl: string;
  width: number;
  height: number;
};

/**
 * Uploads an array of image definitions to Cloudinary and returns a map of resolved SeedImages.
 * It uses the sourceUrl (Unsplash, placehold.co, etc.) and uploads it to the user's configured Cloudinary.
 */
export async function uploadSeedImages(
  imageDefs: SeedImageDef[],
): Promise<Map<string, SeedImage>> {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    console.warn(
      'Cloudinary config missing, using source URLs directly for seed images.',
    );
    return new Map(
      imageDefs.map((def) => [
        def.publicId,
        {
          publicId: def.publicId,
          secureUrl: def.sourceUrl,
          width: def.width,
          height: def.height,
        },
      ]),
    );
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const resultMap = new Map<string, SeedImage>();

  for (const def of imageDefs) {
    try {
      const primaryUrl = def.sourceUrl;
      const foodName =
        def.publicId.split('/').pop()?.replace(/-/g, ' ') || 'food';
      console.log(`Uploading ${def.publicId} from ${primaryUrl}...`);

      let uploadResult: UploadApiResponse;
      try {
        uploadResult = await cloudinary.uploader.upload(primaryUrl, {
          public_id: def.publicId,
          overwrite: true,
        });
      } catch (err) {
        console.warn(
          `Failed to upload: ${err instanceof Error ? err.message : String(err)}. Using fallback placeholder.`,
        );
        const fallbackUrl = `https://placehold.co/${def.width}x${def.height}/EEE/31343C?text=${encodeURIComponent(foodName)}`;
        uploadResult = await cloudinary.uploader.upload(fallbackUrl, {
          public_id: def.publicId,
          overwrite: true,
        });
      }

      resultMap.set(def.publicId, {
        publicId: uploadResult.public_id,
        secureUrl: uploadResult.secure_url,
        width: uploadResult.width,
        height: uploadResult.height,
      });
    } catch (error) {
      console.error(`Error uploading image ${def.publicId}:`, error);
      throw error;
    }
  }

  return resultMap;
}
