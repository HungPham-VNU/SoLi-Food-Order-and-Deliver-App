import { useState } from 'react';
import {
  useRestaurantMenuCategories,
  useRestaurantMenuItems,
} from '../hooks/useRestaurantMenu';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PaginationControls } from './PaginationControls';
import { MenuItemDetailSheet } from './MenuItemDetailSheet';
import type { MenuItemStatusFilter } from '../api/menu.api';

const PAGE_SIZE = 24;

export function MenuTab({ restaurantId }: { restaurantId: string }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MenuItemStatusFilter>('all');
  const [page, setPage] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const { data: categories, isLoading: isLoadingCats } =
    useRestaurantMenuCategories(restaurantId);
  const { data: itemsData, isLoading: isLoadingItems } = useRestaurantMenuItems(
    restaurantId,
    {
      status: statusFilter,
      offset: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    },
  );

  if (isLoadingCats || isLoadingItems) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const items = itemsData?.data || [];
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );

  // Group items by category
  const itemsByCategory =
    categories?.reduce(
      (acc, cat) => {
        acc[cat.id] = filteredItems.filter(
          (item) => item.categoryId === cat.id,
        );
        return acc;
      },
      {} as Record<string, typeof items>,
    ) || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-surface-container p-4 rounded-lg">
        <div className="flex gap-4">
          <Input
            placeholder="Search this page..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64"
          />
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as MenuItemStatusFilter);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="unavailable">Unavailable</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <div>
            Total Items:{' '}
            <span className="font-semibold text-foreground">
              {itemsData?.total ?? 0}
            </span>
          </div>
          <div>
            Out of stock on page:{' '}
            <span className="font-semibold text-destructive">
              {items.filter((i) => i.status === 'out_of_stock').length}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {categories?.map((category) => {
          const categoryItems = itemsByCategory[category.id] || [];
          if (categoryItems.length === 0) return null;

          return (
            <div key={category.id} className="space-y-4">
              <h3 className="text-xl font-semibold border-b pb-2">
                {category.name}
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categoryItems.map((item) => (
                  <Card
                    key={item.id}
                    className="overflow-hidden cursor-pointer hover:border-primary transition-colors"
                    onClick={() => setSelectedItemId(item.id)}
                  >
                    <div className="flex h-full flex-col">
                      {item.imageUrl ? (
                        <div
                          className="h-32 w-full bg-muted bg-cover bg-center"
                          style={{ backgroundImage: `url(${item.imageUrl})` }}
                        />
                      ) : (
                        <div className="h-32 w-full bg-muted flex items-center justify-center text-muted-foreground">
                          No image
                        </div>
                      )}
                      <CardContent className="flex-1 p-4 flex flex-col gap-2">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-semibold line-clamp-2">
                            {item.name}
                          </h4>
                          <span className="font-bold whitespace-nowrap">
                            {new Intl.NumberFormat('vi-VN', {
                              style: 'currency',
                              currency: 'VND',
                            }).format(item.price)}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        <div className="mt-auto pt-4 flex gap-2 flex-wrap">
                          <Badge variant="outline">{item.itemKind}</Badge>
                          <Badge
                            variant={
                              item.status === 'available'
                                ? 'default'
                                : 'destructive'
                            }
                          >
                            {item.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No items found.
          </div>
        )}
      </div>

      <PaginationControls
        page={page}
        pageSize={PAGE_SIZE}
        total={itemsData?.total ?? 0}
        onPageChange={setPage}
      />

      <MenuItemDetailSheet
        itemId={selectedItemId}
        onClose={() => setSelectedItemId(null)}
      />
    </div>
  );
}
