import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  restaurantSchema,
  type RestaurantFormValues,
} from '../schemas/restaurant.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  storeImageMetadata,
  uploadImageToCloudinary,
} from '@/features/image/api/cloudinary-upload';

interface Props {
  defaultValues?: Partial<RestaurantFormValues>;
  onSubmit: (values: RestaurantFormValues) => void | Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export function RestaurantForm({
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel = 'Save',
}: Props) {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RestaurantFormValues>({
    resolver: zodResolver(restaurantSchema),
    defaultValues,
  });

  const submitWithUploads = handleSubmit(async (values) => {
    setUploadError(null);
    setIsUploading(true);

    try {
      const [logoImage, coverImage] = await Promise.all([
        logoFile
          ? uploadImageToCloudinary(logoFile, 'restaurants/logos').then(
              storeImageMetadata,
            )
          : Promise.resolve(null),
        coverFile
          ? uploadImageToCloudinary(coverFile, 'restaurants/covers').then(
              storeImageMetadata,
            )
          : Promise.resolve(null),
      ]);

      await onSubmit({
        ...values,
        logoUrl: logoImage?.secureUrl ?? values.logoUrl,
        coverImageUrl: coverImage?.secureUrl ?? values.coverImageUrl,
      });
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : 'Image upload failed',
      );
    } finally {
      setIsUploading(false);
    }
  });

  return (
    <form onSubmit={submitWithUploads} noValidate className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" placeholder="Restaurant name" {...register('name')} />
        {errors.name && (
          <span className="text-sm text-red-500">{errors.name.message}</span>
        )}
      </div>

      <div>
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          placeholder="Full address"
          {...register('address')}
        />
        {errors.address && (
          <span className="text-sm text-red-500">{errors.address.message}</span>
        )}
      </div>

      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" placeholder="Phone number" {...register('phone')} />
        {errors.phone && (
          <span className="text-sm text-red-500">{errors.phone.message}</span>
        )}
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Restaurant description"
          {...register('description')}
        />
        {errors.description && (
          <span className="text-sm text-red-500">
            {errors.description.message}
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="logoFile">Logo image</Label>
          <Input
            id="logoFile"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
          />
        </div>

        <div>
          <Label htmlFor="coverFile">Cover image</Label>
          <Input
            id="coverFile"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      {uploadError && (
        <span className="text-sm text-red-500">{uploadError}</span>
      )}

      <Button type="submit" disabled={isLoading || isUploading}>
        {isLoading || isUploading ? 'Saving...' : submitLabel}
      </Button>
    </form>
  );
}
