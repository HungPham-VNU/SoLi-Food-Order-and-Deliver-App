import { useState } from 'react';
import { useMyRestaurant } from '@/features/restaurant/hooks/useRestaurants';
import { useDeliveryZones } from '@/features/delivery-zones/hooks/useDeliveryZones';
import { ZoneCard } from '@/features/delivery-zones/components/ZoneCard';
import { ZoneFormDialog } from '@/features/delivery-zones/components/ZoneFormDialog';
import { DeliveryEstimator } from '@/features/delivery-zones/components/DeliveryEstimator';
import { CoverageMap } from '@/features/delivery-zones/components/CoverageMap';
import type { DeliveryZone } from '@/features/delivery-zones/types';

export function DeliveryZonesPage() {
  const { data: restaurant, isLoading: loadingRestaurant } = useMyRestaurant();
  const restaurantId = restaurant?.id;

  const { data: zones = [], isLoading: loadingZones } = useDeliveryZones(restaurantId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);

  const openNew = () => {
    setEditingZone(null);
    setDialogOpen(true);
  };

  const openEdit = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setDialogOpen(true);
  };

  if (loadingRestaurant) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading restaurant…
      </div>
    );
  }

  if (!restaurantId) {
    return (
      <div className="rounded-2xl border border-outline-variant/30 p-8 text-center">
        <p className="font-bold text-on-surface mb-1">No restaurant found</p>
        <p className="text-sm text-on-surface-variant">
          You need a registered restaurant to manage delivery zones.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex justify-between items-end">
        <div>
          <h2 className="font-headline font-extrabold text-3xl text-on-surface tracking-tight mb-2">
            Delivery Zones
          </h2>
          <p className="text-on-surface-variant font-medium text-lg">
            Define where you deliver and how much to charge customers
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-white px-6 py-3 rounded-full font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined">add</span>
          <span>New Zone</span>
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-10">
        {/* LEFT: Zones */}
        <section className="lg:col-span-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-headline font-bold text-xl text-on-surface">
              Active Zones{' '}
              <span className="text-on-surface-variant text-sm font-normal ml-2">
                ({zones.filter((z) => z.isActive).length} of {zones.length})
              </span>
            </h3>
          </div>

          <div className="space-y-4">
            {loadingZones && (
              <div className="bg-surface-container-low rounded-xl p-6 animate-pulse">
                <div className="h-5 bg-surface-container-highest rounded w-1/3 mb-3" />
                <div className="h-3 bg-surface-container-highest rounded w-1/2" />
              </div>
            )}

            {!loadingZones && zones.length === 0 && (
              <div className="text-center bg-surface-container-low rounded-xl p-10 border border-dashed border-outline-variant">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/50 mb-2">
                  map
                </span>
                <p className="font-bold text-on-surface mb-1">No zones yet</p>
                <p className="text-sm text-on-surface-variant mb-4">
                  Customers won't be able to check out without a delivery zone.
                </p>
                <button
                  type="button"
                  onClick={openNew}
                  className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-full font-bold text-sm active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">
                    add_location
                  </span>
                  Create your first zone
                </button>
              </div>
            )}

            {zones.map((zone) => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                restaurantId={restaurantId}
                onEdit={openEdit}
              />
            ))}

            {zones.length > 0 && (
              <button
                type="button"
                onClick={openNew}
                className="w-full border-2 border-dashed border-outline-variant rounded-xl p-6 flex items-center justify-center gap-2 text-on-surface-variant hover:bg-surface-container-low hover:border-primary transition-all group font-bold"
              >
                <span className="material-symbols-outlined group-hover:scale-110 transition-transform">
                  add_circle
                </span>
                <span>Add Zone</span>
              </button>
            )}
          </div>
        </section>

        {/* RIGHT: Tools */}
        <aside className="lg:col-span-4 space-y-6">
          <DeliveryEstimator restaurantId={restaurantId} />
          <CoverageMap zones={zones} />
        </aside>
      </div>

      <ZoneFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        restaurantId={restaurantId}
        zone={editingZone}
      />
    </div>
  );
}
