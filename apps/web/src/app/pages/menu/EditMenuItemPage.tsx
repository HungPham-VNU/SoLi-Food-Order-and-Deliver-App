import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreateMenuItemHeader } from '@/features/menu/components/create/CreateMenuItemHeader';
import { ProductEssenceCard } from '@/features/menu/components/create/ProductEssenceCard';
import { DietaryTagsCard } from '@/features/menu/components/create/DietaryTagsCard';
import { MediaUploadCard } from '@/features/menu/components/create/MediaUploadCard';
import { MarketVisibilityCard } from '@/features/menu/components/create/MarketVisibilityCard';
import { ModifiersCard } from '@/features/menu/components/create/ModifiersCard';
import { NutritionAssistantCard } from '@/features/menu/components/create/NutritionAssistantCard';
import {
  createMenuItemSchema,
  type CreateMenuItemFormValues,
} from '@/features/menu/schemas/menu.schema';
import {
  useDeleteMenuItem,
  useUpdateMenuItem,
} from '@/features/menu/hooks/useMenuMutations';
import { useMenuCategories, useMenuItem } from '@/features/menu/hooks/useMenu';
import { useMyRestaurant } from '@/features/restaurant/hooks/useRestaurants';

export default function EditMenuItemPage() {
  const navigate = useNavigate();
  const { itemId } = useParams<{ itemId: string }>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: restaurant, isLoading: restaurantLoading } = useMyRestaurant();
  const restaurantId = restaurant?.id;

  const { data: categories = [] } = useMenuCategories(restaurantId);
  const { data: editItem, isLoading: editItemLoading } = useMenuItem(itemId);

  const {
    mutate: updateItem,
    isPending: updatePending,
    error: updateError,
  } = useUpdateMenuItem(restaurantId ?? '');
  const {
    mutate: deleteItem,
    isPending: deletePending,
    error: deleteError,
  } = useDeleteMenuItem(restaurantId ?? '');

  const methods = useForm<CreateMenuItemFormValues>({
    resolver: zodResolver(createMenuItemSchema),
    defaultValues: { name: '', description: '', sku: '' },
  });

  useEffect(() => {
    if (editItem) {
      methods.reset({
        name: editItem.name,
        itemKind: editItem.itemKind,
        description: editItem.description || '',
        price: editItem.price,
        categoryId: editItem.categoryId || '',
        sku: editItem.sku || '',
        imageUrl: editItem.imageUrl || '',
        tags: editItem.tags || [],
      });
    }
  }, [editItem, methods]);

  const onSubmit = (values: CreateMenuItemFormValues) => {
    updateItem(
      {
        id: itemId!,
        dto: {
          name: values.name,
          price: values.price,
          itemKind: values.itemKind,
          categoryId: values.categoryId,
          description: values.description || undefined,
          sku: values.sku || undefined,
          imageUrl: values.imageUrl || undefined,
          tags: values.tags,
        },
      },
      { onSuccess: () => navigate('/menu') },
    );
  };

  const handleDeleteDialogChange = (open: boolean) => {
    if (deletePending) return;
    setDeleteDialogOpen(open);
  };

  const handleDelete = () => {
    if (!itemId) return;
    deleteItem(itemId, { onSuccess: () => navigate('/menu') });
  };

  if (restaurantLoading || editItemLoading) {
    return (
      <div className="w-full py-2 px-1">
        <p className="text-muted-foreground text-sm">Loading item…</p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="w-full py-2 px-1">
        <h1 className="text-4xl font-extrabold text-foreground tracking-tight mb-4">
          Edit Item
        </h1>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
          <p className="font-bold mb-1">Restaurant not found</p>
          <p className="text-sm">
            Your restaurant account must be <strong>approved</strong> before you
            can manage menu items. Check your restaurant status in the database
            or contact an admin.
          </p>
          <button
            onClick={() => navigate('/menu')}
            className="mt-4 text-sm font-bold underline"
          >
            ← Back to menu
          </button>
        </div>
      </div>
    );
  }

  if (!editItem) {
    return (
      <div className="w-full py-2 px-1">
        <h1 className="text-4xl font-extrabold text-foreground tracking-tight mb-4">
          Edit Item
        </h1>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
          <p className="font-bold mb-1">Menu item not found</p>
          <p className="text-sm">
            The menu item you're trying to edit doesn't exist or has been
            deleted.
          </p>
          <button
            onClick={() => navigate('/menu')}
            className="mt-4 text-sm font-bold underline"
          >
            ← Back to menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <div className="w-full py-2 px-1">
        <CreateMenuItemHeader
          onCancel={() => navigate('/menu')}
          onSave={methods.handleSubmit(onSubmit)}
          isEditMode={true}
          isPending={updatePending}
        />

        {updateError && (
          <p className="text-sm text-destructive mb-4 px-1">
            {updateError.message}
          </p>
        )}

        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8 space-y-8">
            <ProductEssenceCard
              categories={categories}
              restaurantId={restaurantId!}
            />
            <NutritionAssistantCard
              menuItemId={itemId!}
              currentNutrition={editItem.nutrition}
            />
            <DietaryTagsCard />
            <ModifiersCard menuItemId={itemId!} />
          </div>
          <div className="col-span-12 lg:col-span-4 space-y-8">
            <MediaUploadCard />
            <MarketVisibilityCard />
            <Card className="gap-0 rounded-3xl border border-error/20 bg-error-container/20 py-0 ring-0">
              <CardContent className="p-6">
                <h2 className="font-headline text-lg font-bold text-on-surface">
                  Delete item
                </h2>
                <p className="mt-2 text-sm leading-5 text-on-surface-variant">
                  Permanently remove this item from your menu. This action
                  cannot be undone.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  className="mt-4"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={updatePending || deletePending}
                >
                  <Trash2 aria-hidden="true" />
                  Delete item
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete “{editItem.name}”?</DialogTitle>
              <DialogDescription>
                This permanently removes the item from your menu and cannot be
                undone.
              </DialogDescription>
            </DialogHeader>

            {deleteError ? (
              <p className="text-sm font-medium text-error" role="alert">
                {deleteError.message ||
                  'Could not delete this item. Try again.'}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDeleteDialogChange(false)}
                disabled={deletePending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deletePending}
              >
                {deletePending ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 aria-hidden="true" />
                )}
                {deletePending ? 'Deleting…' : 'Delete permanently'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </FormProvider>
  );
}
