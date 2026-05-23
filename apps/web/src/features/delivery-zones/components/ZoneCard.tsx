import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatVND } from '@/features/orders/utils/timeFormat';
import type { DeliveryZone } from '../types';
import { useUpdateDeliveryZone, useDeleteDeliveryZone } from '../hooks/useDeliveryZones';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ZoneCardProps {
  zone: DeliveryZone;
  restaurantId: string;
  onEdit: (zone: DeliveryZone) => void;
}

function zoneIconFor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('express') || lower.includes('fast')) return 'speed';
  if (lower.includes('suburb') || lower.includes('home')) return 'home';
  return 'location_on';
}

export function ZoneCard({ zone, restaurantId, onEdit }: ZoneCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { mutate: updateZone } = useUpdateDeliveryZone(restaurantId);
  const { mutate: deleteZone, isPending: isDeleting } =
    useDeleteDeliveryZone(restaurantId);

  const handleToggleActive = (checked: boolean) => {
    updateZone({ id: zone.id, data: { isActive: checked } });
  };

  const handleDelete = () => {
    if (
      window.confirm(`Delete "${zone.name}"? Customers in this zone will no longer be able to order.`)
    ) {
      deleteZone(zone.id);
    }
  };

  return (
    <div
      className={cn(
        'group bg-surface-container-lowest rounded-xl p-6 flex items-center justify-between transition-all hover:shadow-md border-l-4 relative overflow-hidden',
        zone.isActive ? 'border-primary' : 'border-outline-variant opacity-60 bg-surface-container-low',
      )}
    >
      {/* Left: icon + name + stats */}
      <div className="flex items-center gap-5 min-w-0">
        <div
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
            zone.isActive
              ? 'bg-primary-fixed text-primary'
              : 'bg-surface-container-highest text-on-surface-variant',
          )}
        >
          <span className="material-symbols-outlined">{zoneIconFor(zone.name)}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-headline font-bold text-lg text-on-surface truncate">
              {zone.name}
            </h4>
            {!zone.isActive && (
              <span className="bg-surface-container-highest text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded text-on-surface-variant">
                Inactive
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-medium text-on-surface-variant">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">straighten</span>
              {zone.radiusKm} km
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">payments</span>
              {formatVND(zone.baseFee)} base
            </span>
          </div>
        </div>
      </div>

      {/* Right: rate + actions */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-right">
          <span
            className={cn(
              'block font-bold text-sm mb-1',
              zone.isActive ? 'text-primary' : 'text-on-surface-variant',
            )}
          >
            +{formatVND(zone.perKmRate)}/km
          </span>
          <Switch
            checked={zone.isActive}
            onCheckedChange={handleToggleActive}
            aria-label={zone.isActive ? 'Deactivate zone' : 'Activate zone'}
          />
        </div>

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
              aria-label="Zone actions"
            >
              <span className="material-symbols-outlined text-lg">more_vert</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => onEdit(zone)}>
                <span className="material-symbols-outlined text-sm mr-2">edit</span>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isDeleting}
                onClick={handleDelete}
                className="text-error focus:bg-error/10 focus:text-error"
              >
                <span className="material-symbols-outlined text-sm mr-2">delete</span>
                {isDeleting ? 'Deleting…' : 'Delete'}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
