import type { MenuItem } from '@/features/menu/types';
import { Edit2, Loader2, PackageCheck, PackageX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface MenuItemCardProps {
  item: MenuItem;
  onEdit?: (item: MenuItem) => void;
  onToggleAvailability?: (
    id: string,
    currentStatus: MenuItem['status'],
  ) => void;
  onToggleSoldOut?: (id: string) => void;
  isStatusUpdating?: boolean;
  isSoldOutUpdating?: boolean;
  statusError?: string;
}

export function MenuItemCard({
  item,
  onEdit,
  onToggleAvailability,
  onToggleSoldOut,
  isStatusUpdating = false,
  isSoldOutUpdating = false,
  statusError,
}: MenuItemCardProps) {
  const isAvailable = item.status === 'available';
  const isSoldOut = item.status === 'out_of_stock';
  const isVisible = item.status !== 'unavailable';

  const handleToggle = () => {
    onToggleAvailability?.(item.id, item.status);
  };

  const handleToggleSoldOut = () => {
    onToggleSoldOut?.(item.id);
  };

  return (
    <Card
      className={`bg-surface-container-lowest rounded-3xl py-0 gap-0 ring-0 group transition-all duration-300 ${
        isSoldOut ? 'bg-opacity-60' : 'hover:shadow-xl hover:shadow-primary/5'
      }`}
    >
      <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-6">
        {/* Image Block */}
        <div
          className={`relative h-24 w-24 md:h-32 md:w-32 rounded-2xl overflow-hidden flex-shrink-0 ${
            isSoldOut ? 'grayscale' : ''
          }`}
        >
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-surface-container flex items-center justify-center text-on-surface-variant font-medium text-xs">
              No Image
            </div>
          )}
        </div>

        {/* Content Block */}
        <div className={`flex-1 ${isSoldOut ? 'opacity-60' : ''}`}>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-headline text-xl font-bold text-on-surface">
                {item.name}
              </h3>
              <p className="text-sm text-on-surface-variant mt-1">
                {item.description}
              </p>
            </div>
            <div className="text-right">
              <p className="font-headline text-lg font-extrabold text-secondary">
                {item.price.toLocaleString('vi-VN')}₫
              </p>
              {item.sku && (
                <p className="text-[10px] text-outline font-bold uppercase tracking-tighter mt-1">
                  SKU: {item.sku}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-full">
              <span className="text-xs font-bold text-on-surface-variant">
                Live Status:
              </span>
              <div
                className={`h-2 w-2 rounded-full ${isSoldOut ? 'bg-error' : isAvailable ? 'bg-primary' : 'bg-outline'}`}
              />
              <span
                className={`text-xs font-bold uppercase ${isSoldOut ? 'text-error' : isAvailable ? 'text-primary' : 'text-outline'}`}
              >
                {isSoldOut
                  ? 'Sold Out'
                  : isAvailable
                    ? 'Available'
                    : 'Unavailable'}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onEdit?.(item)}
                className="p-2 bg-surface-container-high rounded-xl text-on-surface hover:bg-primary-fixed transition-colors"
                aria-label={`Edit ${item.name}`}
              >
                <Edit2 className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleToggleSoldOut}
                disabled={!isVisible || isStatusUpdating}
                className={`rounded-xl p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  isSoldOut
                    ? 'bg-primary-fixed text-primary hover:bg-primary-200'
                    : 'bg-surface-container-high text-error hover:bg-error-container'
                }`}
                aria-label={
                  isSoldOut
                    ? `Mark ${item.name} as back in stock`
                    : `Mark ${item.name} as sold out`
                }
                title={
                  !isVisible
                    ? 'Show this item before changing its stock status'
                    : isSoldOut
                      ? 'Mark back in stock'
                      : 'Mark as sold out'
                }
              >
                {isSoldOutUpdating ? (
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    aria-hidden="true"
                  />
                ) : isSoldOut ? (
                  <PackageCheck className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <PackageX className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Customer-facing status controls */}
        <div className="md:min-w-56 md:border-l md:border-outline-variant/20 md:pl-6 flex flex-col justify-center gap-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-bold text-on-surface uppercase tracking-wider">
              Customer visibility
            </p>
            <label
              className={`inline-flex items-center ${isStatusUpdating ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
            >
              <span className="sr-only">
                {isVisible ? `Hide ${item.name}` : `Show ${item.name}`}
              </span>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isVisible}
                  onChange={handleToggle}
                  disabled={isStatusUpdating}
                />
                <div className="w-11 h-6 bg-surface-container-highest rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </div>
            </label>
          </div>

          {statusError ? (
            <p className="text-xs font-medium text-error" role="alert">
              {statusError}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
