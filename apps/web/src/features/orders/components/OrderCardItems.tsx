import type { OrderItem } from '@/features/orders/types';
import { formatVND } from '@/features/orders/utils/timeFormat';

interface OrderCardItemsProps {
  items: OrderItem[];
  maxVisible?: number;
}

export function OrderCardItems({ items, maxVisible = 3 }: OrderCardItemsProps) {
  if (!items || items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No items</p>
    );
  }

  const visibleItems = items.slice(0, maxVisible);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <div className="space-y-1.5">
      {visibleItems.map((item) => (
        <div key={item.orderItemId} className="text-xs">
          {/* Item name + quantity */}
          <div className="flex justify-between items-start gap-2">
            <span className="font-medium text-on-surface leading-tight">
              {item.itemName}
            </span>
            <span className="font-bold text-on-surface-variant flex-shrink-0">
              ×{item.quantity}
            </span>
          </div>

          {/* Modifiers */}
          {item.modifiers && item.modifiers.length > 0 && (
            <ul className="ml-2 mt-0.5 space-y-0.5">
              {item.modifiers.map((mod) => (
                <li
                  key={`${mod.groupId}-${mod.optionId}`}
                  className="text-[10px] text-muted-foreground flex justify-between gap-2"
                >
                  <span className="truncate">
                    <span className="opacity-70">{mod.groupName}:</span>{' '}
                    {mod.optionName}
                  </span>
                  {mod.price > 0 && (
                    <span className="flex-shrink-0 text-primary font-medium">
                      +{formatVND(mod.price)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {hiddenCount > 0 && (
        <p className="text-[10px] text-muted-foreground italic font-medium pt-0.5">
          + {hiddenCount} more item{hiddenCount > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
