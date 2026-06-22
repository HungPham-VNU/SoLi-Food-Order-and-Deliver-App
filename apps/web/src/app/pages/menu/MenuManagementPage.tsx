import { useState, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MenuItemCard } from '@/features/menu/components/MenuItemCard';
import { MenuSidebar } from '@/features/menu/components/MenuSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  useMenuItems,
  useMenuCategories,
  useMenuCategoryItemCount,
} from '@/features/menu/hooks/useMenu';
import {
  useDeleteMenuItem,
  useUpdateMenuItem,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '@/features/menu/hooks/useMenuMutations';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const [categoryToDeleteId, setCategoryToDeleteId] = useState<string | null>(
    null,
  );
  const [categoryToRenameId, setCategoryToRenameId] = useState<string | null>(
    null,
  );
  const [categoryNameDraft, setCategoryNameDraft] = useState('');
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
  const deleteCategory = useDeleteCategory(restaurantId ?? '');
  const updateCategory = useUpdateCategory(restaurantId ?? '');
  const updateRestaurant = useUpdateRestaurant();

  const allItems = itemsResponse?.data ?? [];
  const categoryToDelete = categories.find(
    (category) => category.id === categoryToDeleteId,
  );
  const categoryToRename = categories.find(
    (category) => category.id === categoryToRenameId,
  );
  const {
    data: categoryItemCount,
    isLoading: categoryItemCountLoading,
    isError: categoryItemCountError,
  } = useMenuCategoryItemCount(restaurantId, categoryToDelete?.id);
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

  const handleOpenDeleteCategory = (categoryId: string) => {
    deleteCategory.reset();
    setCategoryToDeleteId(categoryId);
  };

  const handleOpenRenameCategory = (categoryId: string, name: string) => {
    updateCategory.reset();
    setCategoryNameDraft(name);
    setCategoryToRenameId(categoryId);
  };

  const handleRenameCategoryDialogChange = (open: boolean) => {
    if (open || updateCategory.isPending) return;
    setCategoryToRenameId(null);
    setCategoryNameDraft('');
    updateCategory.reset();
  };

  const handleSubmitRenameCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!categoryToRename) return;
    const name = categoryNameDraft.trim();
    if (!name || name === categoryToRename.name) return;

    updateCategory.mutate(
      { id: categoryToRename.id, dto: { name } },
      {
        onSuccess: () => {
          setCategoryToRenameId(null);
          setCategoryNameDraft('');
        },
      },
    );
  };

  const handleDeleteCategoryDialogChange = (open: boolean) => {
    if (open || deleteCategory.isPending) return;
    setCategoryToDeleteId(null);
    deleteCategory.reset();
  };

  const handleConfirmDeleteCategory = () => {
    if (!categoryToDelete) return;

    const deletedCategory = categoryToDelete;
    deleteCategory.mutate(deletedCategory.id, {
      onSuccess: () => {
        if (activeCategoryId === deletedCategory.id) {
          setActiveCategoryId(null);
        }
        setCategoryToDeleteId(null);
      },
    });
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

              {categories.map((cat) => {
                const isActive = activeCategoryId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className={`flex flex-shrink-0 items-stretch overflow-hidden rounded-full transition-colors ${
                      isActive
                        ? 'bg-primary-fixed text-on-primary-fixed'
                        : 'bg-surface-container-lowest text-on-surface-variant'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveCategoryId(cat.id)}
                      className={`px-6 py-3 pr-3 font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${
                        isActive
                          ? 'hover:bg-primary-fixed'
                          : 'hover:bg-surface-container'
                      }`}
                    >
                      {cat.name}
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={`flex min-w-11 items-center justify-center px-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${
                            isActive
                              ? 'hover:bg-on-primary-fixed/10'
                              : 'hover:bg-surface-container'
                          }`}
                          aria-label={`${cat.name} actions`}
                        >
                          <span
                            className="material-symbols-outlined text-lg"
                            aria-hidden="true"
                          >
                            more_horiz
                          </span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onClick={() =>
                              handleOpenRenameCategory(cat.id, cat.name)
                            }
                          >
                            <span
                              className="material-symbols-outlined"
                              aria-hidden="true"
                            >
                              edit
                            </span>
                            Rename category
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleOpenDeleteCategory(cat.id)}
                          >
                            <span
                              className="material-symbols-outlined"
                              aria-hidden="true"
                            >
                              delete
                            </span>
                            Delete category
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}

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

      <Dialog
        open={!!categoryToRename}
        onOpenChange={handleRenameCategoryDialogChange}
      >
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSubmitRenameCategory} className="contents">
            <DialogHeader>
              <DialogTitle>Rename category</DialogTitle>
              <DialogDescription>
                Update how this category appears on your menu.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2 py-2">
              <label
                htmlFor="category-name"
                className="text-sm font-medium text-on-surface"
              >
                Category name
              </label>
              <Input
                id="category-name"
                value={categoryNameDraft}
                onChange={(event) => setCategoryNameDraft(event.target.value)}
                autoFocus
                disabled={updateCategory.isPending}
                aria-invalid={updateCategory.isError}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleRenameCategoryDialogChange(false)}
                disabled={updateCategory.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  updateCategory.isPending ||
                  !categoryNameDraft.trim() ||
                  categoryNameDraft.trim() === categoryToRename?.name
                }
              >
                {updateCategory.isPending ? 'Saving…' : 'Save name'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!categoryToDelete}
        onOpenChange={handleDeleteCategoryDialogChange}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Delete “{categoryToDelete?.name}”?
            </DialogTitle>
            <DialogDescription>
              {categoryItemCountLoading
                ? 'Checking the category contents…'
                : categoryItemCountError
                  ? 'Any menu items in this category will become uncategorized. The items themselves will not be deleted.'
                  : categoryItemCount === 0
                    ? 'This category is empty. Deleting it cannot be undone.'
                    : `${categoryItemCount} menu ${categoryItemCount === 1 ? 'item' : 'items'} will become uncategorized. The ${categoryItemCount === 1 ? 'item' : 'items'} will not be deleted.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDeleteCategoryDialogChange(false)}
              disabled={deleteCategory.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDeleteCategory}
              disabled={
                deleteCategory.isPending || categoryItemCountLoading
              }
            >
              {deleteCategory.isPending ? 'Deleting…' : 'Delete category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
