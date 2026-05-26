import { useMemo } from 'react';
import type { DeliveryZone } from '../types';

interface CoverageMapProps {
  zones: DeliveryZone[];
}

/**
 * Stylized "map" that renders zones as concentric circles, scaled relative to
 * the largest active radius. Pure CSS — no map library, no API key.
 * Replace with Leaflet/Mapbox later if real maps are needed.
 */
export function CoverageMap({ zones }: CoverageMapProps) {
  const activeZones = useMemo(
    () => zones.filter((z) => z.isActive).sort((a, b) => b.radiusKm - a.radiusKm),
    [zones],
  );

  const maxRadius = activeZones[0]?.radiusKm ?? 0;

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/10">
      <h3 className="font-headline font-bold text-lg mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">map</span>
        Coverage Map
      </h3>

      <div className="relative aspect-square rounded-xl overflow-hidden mb-4 bg-gradient-to-br from-surface-container to-surface-container-low">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(rgba(112,122,108,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(112,122,108,0.15) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Concentric zone circles (largest first so smaller overlap on top) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {activeZones.length === 0 && (
            <div className="text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl opacity-40">
                map
              </span>
              <p className="text-xs italic mt-2">No active zones yet</p>
            </div>
          )}
          {activeZones.map((zone, idx) => {
            const sizePct = maxRadius > 0 ? (zone.radiusKm / maxRadius) * 90 : 0;
            // Stagger opacity so layered rings stay visible.
            const opacity = 0.15 + (1 - idx / Math.max(activeZones.length, 1)) * 0.4;
            return (
              <div
                key={zone.id}
                className="absolute rounded-full border-2 border-primary"
                style={{
                  width: `${sizePct}%`,
                  height: `${sizePct}%`,
                  backgroundColor: `rgba(0, 73, 14, ${opacity * 0.15})`,
                  opacity,
                }}
              />
            );
          })}

          {/* Center pin */}
          {activeZones.length > 0 && (
            <div className="relative z-10 w-5 h-5 rounded-full bg-primary border-2 border-white shadow-lg" />
          )}
        </div>

        <div className="absolute bottom-3 right-3 bg-white/85 backdrop-blur px-3 py-1.5 rounded-lg border border-white/50 text-[10px] font-bold shadow-sm">
          Your restaurant
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-3">
        {activeZones.length === 0 ? (
          <p className="text-xs text-on-surface-variant italic">
            Activate at least one zone to see coverage.
          </p>
        ) : (
          activeZones.map((zone, idx) => {
            const opacity =
              0.4 + (1 - idx / Math.max(activeZones.length, 1)) * 0.6;
            return (
              <div key={zone.id} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full bg-primary"
                  style={{ opacity }}
                />
                <span className="text-xs font-bold text-on-surface">
                  {zone.name}{' '}
                  <span className="font-normal text-on-surface-variant">
                    ({zone.radiusKm} km)
                  </span>
                </span>
              </div>
            );
          })
        )}
        <div className="flex items-center gap-3 pt-1 border-t border-outline-variant/20">
          <div className="w-3 h-3 rounded-full bg-outline-variant" />
          <span className="text-xs font-bold text-on-surface">Out of Range</span>
        </div>
      </div>
    </div>
  );
}
