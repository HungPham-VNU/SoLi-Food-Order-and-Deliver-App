import { Loader2 } from 'lucide-react';
import {
  useMenuItem,
  useMenuItemModifiers,
} from '../hooks/useRestaurantMenu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export function MenuItemDetailSheet({
  itemId,
  onClose,
}: {
  itemId: string | null;
  onClose: () => void;
}) {
  const { data: item, isLoading: isLoadingItem } = useMenuItem(itemId);
  const { data: modifiers, isLoading: isLoadingModifiers } =
    useMenuItemModifiers(itemId);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);

  return (
    <Sheet open={!!itemId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-md w-full p-0">
        {isLoadingItem || isLoadingModifiers ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !item ? (
          <div className="p-6 text-center text-muted-foreground">
            Menu item not found.
          </div>
        ) : (
          <div className="flex flex-col pb-6">
            {item.imageUrl ? (
              <div
                className="h-64 w-full bg-muted bg-cover bg-center shrink-0"
                style={{ backgroundImage: `url(${item.imageUrl})` }}
              />
            ) : (
              <div className="h-64 w-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                No image
              </div>
            )}

            <SheetHeader className="px-6 py-4">
              <div className="flex justify-between items-start gap-4">
                <SheetTitle className="text-2xl">{item.name}</SheetTitle>
                <span className="text-lg font-bold whitespace-nowrap">
                  {formatPrice(item.price)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline">{item.itemKind}</Badge>
                <Badge
                  variant={
                    item.status === 'available' ? 'default' : 'destructive'
                  }
                >
                  {item.status.replace('_', ' ')}
                </Badge>
                {item.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
              {item.description && (
                <SheetDescription className="text-base mt-4 text-foreground/80">
                  {item.description}
                </SheetDescription>
              )}
            </SheetHeader>

            {item.nutrition && (
              <>
                <Separator />
                <div className="px-6 py-4 space-y-3">
                  <h4 className="font-semibold text-lg">Nutrition Facts</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Calories: </span>
                      <span className="font-medium">{item.nutrition.calories} kcal</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Protein: </span>
                      <span className="font-medium">{item.nutrition.protein}g</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Carbs: </span>
                      <span className="font-medium">{item.nutrition.carbs}g</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fat: </span>
                      <span className="font-medium">{item.nutrition.fat}g</span>
                    </div>
                    {item.nutrition.fiber !== null && (
                      <div>
                        <span className="text-muted-foreground">Fiber: </span>
                        <span className="font-medium">{item.nutrition.fiber}g</span>
                      </div>
                    )}
                    {item.nutrition.sugar !== null && (
                      <div>
                        <span className="text-muted-foreground">Sugar: </span>
                        <span className="font-medium">{item.nutrition.sugar}g</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    {item.nutrition.disclaimer}
                  </p>
                </div>
              </>
            )}

            {modifiers && modifiers.length > 0 && (
              <>
                <Separator />
                <div className="px-6 py-4 space-y-6">
                  <h4 className="font-semibold text-lg">Modifier Groups</h4>
                  {modifiers.map((group) => (
                    <div key={group.id} className="space-y-3">
                      <div className="flex justify-between items-baseline">
                        <h5 className="font-medium">{group.name}</h5>
                        <span className="text-xs text-muted-foreground">
                          {group.minSelections > 0
                            ? `Required (select ${group.minSelections}-${group.maxSelections})`
                            : `Optional (up to ${group.maxSelections})`}
                        </span>
                      </div>
                      <div className="space-y-2 border rounded-md divide-y">
                        {group.options?.map((option) => (
                          <div
                            key={option.id}
                            className="flex justify-between items-center p-3 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span>{option.name}</span>
                              {option.isDefault && (
                                <Badge variant="secondary" className="text-[10px] px-1 h-4">
                                  Default
                                </Badge>
                              )}
                              {!option.isAvailable && (
                                <Badge variant="destructive" className="text-[10px] px-1 h-4">
                                  Unavailable
                                </Badge>
                              )}
                            </div>
                            <span className="text-muted-foreground">
                              {option.price > 0
                                ? `+${formatPrice(option.price)}`
                                : 'Free'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
