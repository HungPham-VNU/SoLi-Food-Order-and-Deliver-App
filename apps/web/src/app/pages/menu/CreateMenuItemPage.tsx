import { useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateMenuItemHeader } from '@/features/menu/components/create/CreateMenuItemHeader';
import { ProductEssenceCard } from '@/features/menu/components/create/ProductEssenceCard';
import { DietaryTagsCard } from '@/features/menu/components/create/DietaryTagsCard';
import { MediaUploadCard } from '@/features/menu/components/create/MediaUploadCard';
import { MarketVisibilityCard } from '@/features/menu/components/create/MarketVisibilityCard';
import { CreateMenuItemFooter } from '@/features/menu/components/create/CreateMenuItemFooter';
import { createMenuItemSchema, type CreateMenuItemFormValues } from '@/features/menu/schemas/menu.schema';
import { useCreateMenuItem } from '@/features/menu/hooks/useMenuMutations';
import { useMenuCategories } from '@/features/menu/hooks/useMenu';
import { useMyRestaurant } from '@/features/restaurant/hooks/useRestaurants';

export default function CreateMenuItemPage() {
  const navigate = useNavigate();
  const { data: restaurant } = useMyRestaurant();
  const restaurantId = restaurant?.id ?? '';

  const { data: categories = [] } = useMenuCategories(restaurantId || undefined);
  const { mutate: createItem, isPending, error } = useCreateMenuItem(restaurantId);

  const methods = useForm<CreateMenuItemFormValues>({
    resolver: zodResolver(createMenuItemSchema),
    defaultValues: { name: '', price: undefined, description: '', sku: '' },
  });

  const onSubmit = (values: CreateMenuItemFormValues) => {
    if (!restaurantId) return;
    createItem(
      {
        restaurantId,
        name: values.name,
        price: values.price,
        categoryId: values.categoryId,
        description: values.description || undefined,
        sku: values.sku || undefined,
        imageUrl: values.imageUrl || undefined,
        tags: values.tags,
      },
      { onSuccess: () => navigate('/menu') },
    );
  };

  return (
    <FormProvider {...methods}>
      <div className="w-full py-2 px-1">
        <CreateMenuItemHeader
          onCancel={() => navigate('/menu')}
          onSave={methods.handleSubmit(onSubmit)}
        />

        {error && (
          <p className="text-sm text-destructive mb-4 px-1">{error.message}</p>
        )}

        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8 space-y-8">
            <ProductEssenceCard categories={categories} />
            <DietaryTagsCard />
          </div>
          <div className="col-span-12 lg:col-span-4 space-y-8">
            <MediaUploadCard />
            <MarketVisibilityCard />
          </div>
        </div>

        <CreateMenuItemFooter
          onDiscard={() => navigate('/menu')}
          onPublish={methods.handleSubmit(onSubmit)}
          isPending={isPending}
        />
      </div>
    </FormProvider>
  );
}
