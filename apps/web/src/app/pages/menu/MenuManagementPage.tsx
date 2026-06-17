import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MenuItemCard } from '@/features/menu/components/MenuItemCard';
import { MenuSidebar } from '@/features/menu/components/MenuSidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useMenuItems, useMenuCategories } from '@/features/menu/hooks/useMenu';
import {
  useDeleteMenuItem,
  useUpdateMenuItem,
  useCreateCategory,
} from '@/features/menu/hooks/useMenuMutations';
import {
  useMyRestaurant,
  useUpdateRestaurant,
} from '@/features/restaurant/hooks/useRestaurants';
import type { MenuItem } from '@/features/menu/types';

export function MenuManagementPage() {
  const navigate = useNavigate();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const categoryInputRef = useRef<HTMLInputElement>(null);

  const { data: restaurant } = useMyRestaurant();
  const restaurantId = restaurant?.id;
  const isOpen = restaurant?.isOpen ?? false;

  const { data: itemsResponse, isLoading: itemsLoading } =
    useMenuItems(restaurantId);
  const { data: categories = [] } = useMenuCategories(restaurantId);

  const deleteItem = useDeleteMenuItem(restaurantId ?? '');
  const updateItem = useUpdateMenuItem(restaurantId ?? '');
  const createCategory = useCreateCategory(restaurantId ?? '');
  const updateRestaurant = useUpdateRestaurant();

  const allItems = itemsResponse?.data ?? [];
  const filteredItems = activeCategoryId
    ? allItems.filter((i) => i.categoryId === activeCategoryId)
    : allItems;

  const availableItems = allItems.filter(
    (i) => i.status === 'available',
  ).length;
  const unavailableItems = allItems.filter(
    (i) => i.status === 'unavailable',
  ).length;
  const outOfStockItems = allItems.filter(
    (i) => i.status === 'out_of_stock',
  ).length;

  const overview = {
    totalItems: allItems.length,
    availableItems,
    unavailableItems,
    outOfStockItems,
    categories,
  };

  const handleAddItem = () => navigate('/menu/create');

  const handleOpenAddCategory = () => {
    setNewCategoryName('');
    setAddingCategory(true);
    setTimeout(() => categoryInputRef.current?.focus(), 0);
  };

  const handleSubmitCategory = () => {
    const name = newCategoryName.trim();
    if (!name || !restaurantId) {
      setAddingCategory(false);
      return;
    }
    createCategory.mutate(
      { restaurantId, name, displayOrder: categories.length },
      {
        onSuccess: () => {
          setAddingCategory(false);
          setNewCategoryName('');
        },
      },
    );
  };

  const handleCancelCategory = () => {
    setAddingCategory(false);
    setNewCategoryName('');
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this menu item?')) {
      deleteItem.mutate(id);
    }
  };

  const handleToggleAvailability = (
    id: string,
    currentStatus: MenuItem['status'],
  ) => {
    if (currentStatus === 'out_of_stock') return;
    const nextStatus =
      currentStatus === 'available' ? 'unavailable' : 'available';
    updateItem.mutate({ id, dto: { status: nextStatus } });
  };

  const handleEdit = (item: MenuItem) => {
    navigate(`/menu/edit/${item.id}`);
  };

  const handleStoreToggle = () => {
    if (!restaurant) return;
    updateRestaurant.mutate({
      id: restaurant.id,
      data: { isOpen: !restaurant.isOpen },
    });
  };

  return (
    <>
      <main className="flex-1 p-6 md:p-10 bg-surface min-h-screen">
        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight">
              Menu Management
            </h1>
            <p className="text-on-surface-variant mt-2 text-lg">
              {restaurant ? restaurant.name : 'Loading restaurant...'}
            </p>
          </div>

          {/* Store Status Card */}
          <Card className="bg-surface-container-lowest rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-outline-variant/10 ring-0 py-0 gap-0">
            <CardContent className="p-4 flex items-center gap-4">
              <div
                className={`h-12 w-12 rounded-2xl flex items-center justify-center ${isOpen ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}
              >
                <span
                  className="material-symbols-outlined text-3xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  storefront
                </span>
              </div>
              <div className="pr-4 flex-1">
                <p className="text-xs font-bold uppercase tracking-widest text-outline">
                  Store Visibility
                </p>
                <p
                  className={`text-sm font-bold ${isOpen ? 'text-green-700' : 'text-muted-foreground'}`}
                >
                  {isOpen ? 'Currently Accepting Orders' : 'Store Offline'}
                </p>
                {updateRestaurant.isError && (
                  <p className="text-xs text-destructive mt-0.5">
                    Update failed — try again
                  </p>
                )}
              </div>
              <Button
                onClick={handleStoreToggle}
                disabled={updateRestaurant.isPending || !restaurant}
                className={`px-6 py-2.5 rounded-full font-bold text-sm shadow-md transition-opacity hover:opacity-90 ${
                  isOpen
                    ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                    : 'bg-primary text-white'
                }`}
              >
                {updateRestaurant.isPending
                  ? 'Saving…'
                  : isOpen
                    ? 'Go Offline'
                    : 'Go Online'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12">
          <div className="lg:col-span-8 space-y-6">
            {/* Category Filter Tabs */}
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setActiveCategoryId(null)}
                className={`h-auto flex-shrink-0 px-6 py-3 rounded-full font-bold flex items-center gap-2 ${
                  activeCategoryId === null
                    ? 'bg-primary-fixed text-on-primary-fixed hover:bg-primary-fixed'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-sm">
                  grid_view
                </span>
                All Items
              </Button>

              {categories.map((cat) => (
                <Button
                  type="button"
                  key={cat.id}
                  variant="ghost"
                  onClick={() => setActiveCategoryId(cat.id)}
                  className={`h-auto flex-shrink-0 px-6 py-3 rounded-full font-semibold transition-colors ${
                    activeCategoryId === cat.id
                      ? 'bg-primary-fixed text-on-primary-fixed hover:bg-primary-fixed'
                      : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {cat.name}
                </Button>
              ))}

              {addingCategory ? (
                <div className="flex items-center gap-2 flex-shrink-0 bg-surface-container-lowest border border-primary/30 rounded-full px-4 py-2">
                  <input
                    ref={categoryInputRef}
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSubmitCategory();
                      if (e.key === 'Escape') handleCancelCategory();
                    }}
                    placeholder="Category name…"
                    className="bg-transparent text-sm font-semibold text-on-surface placeholder:text-on-surface-variant/50 outline-none w-36"
                    disabled={createCategory.isPending}
                  />
                  <button
                    onClick={handleSubmitCategory}
                    disabled={
                      !newCategoryName.trim() || createCategory.isPending
                    }
                    className="text-primary disabled:opacity-40 hover:opacity-70 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      check
                    </span>
                  </button>
                  <button
                    onClick={handleCancelCategory}
                    className="text-on-surface-variant hover:opacity-70 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      close
                    </span>
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={handleOpenAddCategory}
                  variant="ghost"
                  className="h-auto flex-shrink-0 p-3 bg-surface-container-lowest text-primary rounded-full hover:bg-surface-container transition-colors"
                  title="Add category"
                >
                  <span className="material-symbols-outlined">add</span>
                </Button>
              )}
            </div>

            {/* Items List */}
            <div className="space-y-4">
              {itemsLoading && (
                <p className="text-on-surface-variant text-sm py-8 text-center">
                  Loading menu items…
                </p>
              )}
              {!itemsLoading && filteredItems.length === 0 && (
                <p className="text-on-surface-variant text-sm py-8 text-center">
                  No items yet.{' '}
                  <button
                    onClick={handleAddItem}
                    className="text-primary font-bold hover:underline"
                  >
                    Add your first item
                  </button>
                </p>
              )}
              {filteredItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleAvailability={handleToggleAvailability}
                />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <MenuSidebar overview={overview} onAddItem={handleAddItem} />
          </div>
        </div>
      </main>
    </>
  );
}
