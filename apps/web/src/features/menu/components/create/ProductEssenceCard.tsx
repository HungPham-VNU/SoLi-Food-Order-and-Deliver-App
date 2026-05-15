import { Info } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MenuCategory } from '@/features/menu/types';
import type { CreateMenuItemFormValues } from '@/features/menu/schemas/menu.schema';

interface ProductEssenceCardProps {
  categories?: MenuCategory[];
}

export function ProductEssenceCard({ categories = [] }: ProductEssenceCardProps) {
  const { register, setValue, watch, formState: { errors } } = useFormContext<CreateMenuItemFormValues>();

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
            <Select
              value={watch('categoryId') ?? ''}
              onValueChange={(v) => setValue('categoryId', v || undefined)}
            >
              <SelectTrigger
                id="category"
                className="w-full h-12 bg-surface-container border-none rounded-xl px-4 focus:ring-2 focus:ring-primary/30 focus:bg-card transition-all outline-none"
              >
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price" className="text-sm font-bold text-muted-foreground">
              Price (VND)
            </Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₫</span>
              <Input
                id="price"
                type="number"
                placeholder="35000"
                className="w-full h-12 bg-surface-container border-none rounded-xl pl-8 pr-4 focus:ring-2 focus:ring-primary/30 focus:bg-card transition-all outline-none"
                {...register('price', { valueAsNumber: true })}
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
