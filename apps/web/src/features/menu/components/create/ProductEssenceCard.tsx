import { useState } from 'react';
import { Info, Plus, Check, X } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import type { MenuCategory } from '@/features/menu/types';
import type { CreateMenuItemFormValues } from '@/features/menu/schemas/menu.schema';
import { useCreateCategory } from '@/features/menu/hooks/useMenuMutations';
import { Controller } from 'react-hook-form';
import { PriceInput } from '@/components/ui/price-input';

interface ProductEssenceCardProps {
  categories?: MenuCategory[];
  restaurantId: string;
}

export function ProductEssenceCard({ categories = [], restaurantId }: ProductEssenceCardProps) {
  const { register, control, setValue, watch, formState: { errors } } = useFormContext<CreateMenuItemFormValues>();
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const { mutate: createCategory, isPending: creatingCategory } = useCreateCategory(restaurantId);

  const handleCreateCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    createCategory(
      { restaurantId, name, displayOrder: categories.length },
      {
        onSuccess: (created) => {
          setValue('categoryId', created.id);
          setNewCategoryName('');
          setShowNewCategory(false);
        },
      },
    );
  };

  return (
    <div className="bg-card rounded-3xl p-8 shadow-sm border border-border/50">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <Info className="h-5 w-5 text-primary" />
        Product Essence
      </h3>
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="item-name" className="text-sm font-bold text-muted-foreground">
            Item Name
          </Label>
          <Input
            id="item-name"
            placeholder="e.g. Heirloom Tomato Tart"
            className="w-full bg-surface-container border-none rounded-xl px-4 py-6 focus:ring-2 focus:ring-primary/30 focus:bg-card transition-all outline-none"
            {...register('name')}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm font-bold text-muted-foreground">
              Category
            </Label>
            <div className="flex gap-2">
              <Select
                value={watch('categoryId') ?? ''}
                onValueChange={(v) => setValue('categoryId', v || undefined)}
              >
                <SelectTrigger
                  id="category"
                  className="flex-1 h-12 bg-surface-container border-none rounded-xl px-4 focus:ring-2 focus:ring-primary/30 focus:bg-card transition-all outline-none"
                >
                  <span className={!watch('categoryId') ? 'text-muted-foreground' : ''}>
                    {watch('categoryId')
                      ? (categories.find((c) => c.id === watch('categoryId'))?.name ?? 'Select Category')
                      : 'Select Category'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {categories.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No categories yet — add one with +
                    </div>
                  )}
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowNewCategory((v) => !v)}
                className="h-12 w-12 shrink-0 rounded-xl bg-surface-container hover:bg-primary/10 hover:text-primary transition-colors"
                title="Add new category"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {showNewCategory && (
              <div className="flex gap-2 mt-2">
                <Input
                  autoFocus
                  placeholder="New category name…"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory(); }
                    if (e.key === 'Escape') { setShowNewCategory(false); setNewCategoryName(''); }
                  }}
                  className="flex-1 h-10 bg-surface-container border-none rounded-xl px-4 focus:ring-2 focus:ring-primary/30 focus:bg-card transition-all outline-none text-sm"
                />
                <Button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={creatingCategory || !newCategoryName.trim()}
                  className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground hover:opacity-90"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }}
                  className="h-10 w-10 shrink-0 rounded-xl hover:bg-muted/50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="price" className="text-sm font-bold text-muted-foreground">
              Price (VND)
            </Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₫</span>
              <Controller
                control={control}
                name="price"
                render={({ field: { value, onChange, ref, ...field } }) => (
                  <PriceInput
                    id="price"
                    placeholder="35,000"
                    className="w-full h-12 bg-surface-container border-none rounded-xl pl-8 pr-4 focus:ring-2 focus:ring-primary/30 focus:bg-card transition-all outline-none"
                    value={value}
                    onChange={onChange}
                    {...field}
                  />
                )}
              />
            </div>
            {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-bold text-muted-foreground">
            Description
          </Label>
          <Textarea
            id="description"
            placeholder="Describe the flavors, origin, and craftsmanship..."
            className="w-full min-h-[120px] bg-surface-container border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/30 focus:bg-card transition-all outline-none resize-none"
            {...register('description')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sku" className="text-sm font-bold text-muted-foreground">
            SKU <span className="font-normal text-outline">(optional)</span>
          </Label>
          <Input
            id="sku"
            placeholder="e.g. PIZZA-MARG-01"
            className="w-full bg-surface-container border-none rounded-xl px-4 py-6 focus:ring-2 focus:ring-primary/30 focus:bg-card transition-all outline-none"
            {...register('sku')}
          />
        </div>
      </div>
    </div>
  );
}
