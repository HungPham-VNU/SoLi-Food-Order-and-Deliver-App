import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSession, authClient } from '@/lib/auth-client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useImageUpload } from '@/features/menu/hooks/useImageUpload';

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(80),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function getInitials(name?: string | null) {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function roleLabel(role?: string | null) {
  if (!role) return 'Member';
  const map: Record<string, string> = {
    admin: 'Administrator',
    restaurant: 'Restaurant Owner',
    shipper: 'Delivery Shipper',
    user: 'Customer',
  };
  return map[role] ?? role;
}

export function ProfileTab() {
  const { data: session, refetch } = useSession();
  const user = session?.user;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, isUploading, uploadError } = useImageUpload('user-avatars');
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '' },
  });

  useEffect(() => {
    if (user?.name) reset({ name: user.name });
  }, [user?.name, reset]);

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input so the same file can be reselected later.
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      window.alert('Please choose an image file (PNG, JPG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      window.alert('Image must be 5 MB or smaller.');
      return;
    }

    setSavingPhoto(true);
    try {
      const result = await upload(file);
      if (!result) return;
      await authClient.updateUser({ image: result.secureUrl });
      await refetch();
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!user?.image) return;
    setSavingPhoto(true);
    try {
      await authClient.updateUser({ image: '' });
      await refetch();
    } finally {
      setSavingPhoto(false);
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    handleSubmit(async ({ name }) => {
      await authClient.updateUser({ name });
      await refetch();
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    })(e);
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Avatar block */}
      <section className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary-fixed/20 rounded-full blur-3xl opacity-50 pointer-events-none" />

        <div className="shrink-0 relative">
          <div className="w-24 h-24 rounded-full p-[3px] bg-gradient-to-tr from-primary via-primary-fixed to-secondary-container">
            <Avatar className="w-full h-full border-4 border-surface-container-lowest">
              {user.image && <AvatarImage src={user.image} alt={user.name ?? ''} />}
              <AvatarFallback className="bg-surface-container text-on-surface text-2xl font-bold">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        <div className="flex-1 text-center md:text-left z-10">
          <h3 className="font-headline text-lg font-bold text-on-surface">
            Profile Photo
          </h3>
          <p className="font-body text-sm text-on-surface-variant mt-1 mb-6">
            This image will be shown publicly as your avatar. PNG, JPG or WebP, up to 5 MB.
          </p>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
            <button
              type="button"
              onClick={handleSelectFile}
              disabled={savingPhoto || isUploading}
              className="px-5 py-2.5 rounded-full border border-primary text-primary font-semibold text-sm hover:bg-primary-fixed/10 transition-colors disabled:opacity-50"
            >
              {isUploading
                ? 'Uploading…'
                : savingPhoto
                ? 'Saving…'
                : 'Upload Photo'}
            </button>
            {user.image && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={savingPhoto || isUploading}
                className="px-5 py-2.5 rounded-full text-error font-medium text-sm hover:bg-error/10 transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
          {uploadError && (
            <p className="mt-3 text-xs text-error">{uploadError}</p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </section>

      {/* Personal Information */}
      <section className="bg-surface-container-lowest rounded-3xl p-6 md:p-8">
        <div className="mb-6 flex justify-between items-center border-b border-outline-variant/15 pb-4">
          <h3 className="font-headline text-lg font-bold text-on-surface">
            Personal Information
          </h3>
          {savedAt && (
            <span className="text-xs text-primary font-medium flex items-center gap-1 animate-in fade-in">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Saved
            </span>
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label
                htmlFor="fullName"
                className="block font-headline text-sm font-semibold text-on-surface"
              >
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                {...register('name')}
                className="w-full rounded-md border-0 bg-surface-container-high px-4 py-3 text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/30 transition-all outline-none"
              />
              {errors.name && (
                <p className="text-xs text-error">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block font-headline text-sm font-semibold text-on-surface">
                Primary Role
              </label>
              <div className="w-full rounded-md bg-surface-container-high px-4 py-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed-variant text-xs font-bold">
                  <span className="material-symbols-outlined text-xs">restaurant</span>
                  {roleLabel((user as any).role)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block font-headline text-sm font-semibold text-on-surface">
                Email Address
              </label>
              <div className="w-full rounded-md bg-surface-container-high px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-on-surface truncate">{user.email}</span>
                {user.emailVerified ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant text-[10px] font-bold uppercase">
                    <span className="material-symbols-outlined text-xs">verified</span>
                    Verified
                  </span>
                ) : (
                  <button
                    type="button"
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Verify
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block font-headline text-sm font-semibold text-on-surface flex items-center justify-between">
                Phone Number
                {!(user as any).phoneNumberVerified && (user as any).phoneNumber && (
                  <span className="text-xs font-bold text-primary hover:underline cursor-pointer">
                    Verify now
                  </span>
                )}
              </label>
              <div className="w-full rounded-md bg-surface-container-high px-4 py-3 text-on-surface">
                {(user as any).phoneNumber || (
                  <span className="text-on-surface-variant italic">
                    +84 (0) 000 000 000
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!isDirty || isSubmitting}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-bold shadow-lg shadow-primary/20 hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
