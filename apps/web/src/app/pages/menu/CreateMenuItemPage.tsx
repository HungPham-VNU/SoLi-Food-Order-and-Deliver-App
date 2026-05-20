import { useState } from 'react';
import { CreateMenuItemHeader } from '@/features/menu/components/create/CreateMenuItemHeader';
import { ProductEssenceCard } from '@/features/menu/components/create/ProductEssenceCard';
import { DietaryTagsCard } from '@/features/menu/components/create/DietaryTagsCard';
import { MediaUploadCard } from '@/features/menu/components/create/MediaUploadCard';
import { MarketVisibilityCard } from '@/features/menu/components/create/MarketVisibilityCard';
import { CreateMenuItemFooter } from '@/features/menu/components/create/CreateMenuItemFooter';
import type { CloudinaryImageMetadata } from '@/features/image/api/cloudinary-upload';

export default function CreateMenuItemPage() {
  const [uploadedImage, setUploadedImage] =
    useState<CloudinaryImageMetadata | null>(null);

  const handleCancel = () => {
    window.history.back();
  };

  const handleSave = () => {
    console.log('Saving menu item...', {
      imageUrl: uploadedImage?.secureUrl,
    });
  };

  const handleDiscard = () => {
    window.history.back();
  };

  const handlePublish = () => {
    console.log('Publishing menu item...', {
      imageUrl: uploadedImage?.secureUrl,
    });
  };

  return (
    <div className="w-full py-2 px-1">
      <CreateMenuItemHeader onCancel={handleCancel} onSave={handleSave} />

      <div className="grid grid-cols-12 gap-8">
        {/* Left Column: Details */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          <ProductEssenceCard />
          <DietaryTagsCard />
        </div>

        {/* Right Column: Media & Status */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          <MediaUploadCard onImageUploaded={setUploadedImage} />
          <MarketVisibilityCard />
        </div>
      </div>

      <CreateMenuItemFooter
        onDiscard={handleDiscard}
        onPublish={handlePublish}
      />
    </div>
  );
}
