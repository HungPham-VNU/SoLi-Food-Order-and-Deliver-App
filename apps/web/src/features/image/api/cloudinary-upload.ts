import axios from 'axios';
import { apiClient } from '@/lib/api-client';

export interface CloudinaryImageMetadata {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
}

interface CloudinarySignatureResponse {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
}

interface CloudinaryUploadResponse {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
}

export async function uploadImageToCloudinary(
  file: File,
  folder: string,
): Promise<CloudinaryImageMetadata> {
  const { data: signature } = await apiClient.get<CloudinarySignatureResponse>(
    '/api/cloudinary/signature',
    { params: { folder } },
  );

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signature.apiKey);
  formData.append('timestamp', String(signature.timestamp));
  formData.append('signature', signature.signature);
  formData.append('folder', signature.folder);

  const { data } = await axios.post<CloudinaryUploadResponse>(
    `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
    formData,
  );

  return {
    publicId: data.public_id,
    secureUrl: data.secure_url,
    width: data.width,
    height: data.height,
  };
}

export async function storeImageMetadata(
  image: CloudinaryImageMetadata,
): Promise<CloudinaryImageMetadata & { id: string; createdAt: string }> {
  const { data } = await apiClient.post<
    CloudinaryImageMetadata & { id: string; createdAt: string }
  >('/api/images', image);
  return data;
}
