import { apiClient } from './api-client';

interface CloudinarySignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
}

export interface CloudinaryImageMetadata {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
}

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
}

async function getSignature(folder: string): Promise<CloudinarySignature> {
  const res = await apiClient.get<CloudinarySignature>('/api/cloudinary/signature', {
    params: { folder },
  });
  return res.data;
}

export async function uploadImageToCloudinary(
  file: File,
  folder = 'menu-items',
): Promise<CloudinaryImageMetadata> {
  const sig = await getSignature(folder);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', sig.apiKey);
  formData.append('timestamp', String(sig.timestamp));
  formData.append('signature', sig.signature);
  formData.append('folder', sig.folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
    { method: 'POST', body: formData },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? 'Image upload failed');
  }

  const data = await res.json() as CloudinaryUploadResponse;
  return {
    publicId: data.public_id,
    secureUrl: data.secure_url,
    width: data.width,
    height: data.height,
  };
}

export async function uploadToCloudinary(
  file: File,
  folder = 'menu-items',
): Promise<string> {
  const image = await uploadImageToCloudinary(file, folder);
  return image.secureUrl;
}
