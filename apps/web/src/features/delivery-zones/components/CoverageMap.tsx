import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { DeliveryZone } from '../types';

// Fix for default Leaflet icon missing in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface CoverageMapProps {
  zones: DeliveryZone[];
  restaurantLocation?: { lat: number; lng: number } | null;
}

/**
 * Interactive map rendering zones as concentric circles using Leaflet.
 */
export function CoverageMap({ zones, restaurantLocation }: CoverageMapProps) {
  const activeZones = useMemo(
    () => zones.filter((z) => z.isActive).sort((a, b) => b.radiusKm - a.radiusKm),
    [zones],
  );

  const defaultLocation = { lat: 40.7128, lng: -74.0060 }; // NYC fallback
  const center = restaurantLocation || defaultLocation;

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/10">
      <h3 className="font-headline font-bold text-lg mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">map</span>
        Coverage Map
      </h3>

      <div className="relative aspect-square rounded-xl overflow-hidden mb-4 bg-surface-container">
        {restaurantLocation ? (
          <MapContainer 
            center={[center.lat, center.lng]} 
            zoom={11} 
            scrollWheelZoom={false}
            className="w-full h-full z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[center.lat, center.lng]} />
            
            {activeZones.map((zone, idx) => {
              const opacity = 0.15 + (1 - idx / Math.max(activeZones.length, 1)) * 0.4;
              return (
                <Circle
                  key={zone.id}
                  center={[center.lat, center.lng]}
                  radius={zone.radiusKm * 1000} // Leaflet circle radius is in meters
                  pathOptions={{
                    color: 'var(--primary)',
                    fillColor: 'var(--primary)',
                    fillOpacity: opacity * 0.3,
                    weight: 2,
                  }}
                />
              );
            })}
          </MapContainer>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <div>
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-2">location_off</span>
              <p className="text-sm text-on-surface-variant italic">
                Set your restaurant location in Settings to view the coverage map.
              </p>
            </div>
          </div>
        )}

        {/* Floating badge */}
        {restaurantLocation && (
          <div className="absolute bottom-3 right-3 z-[1000] bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg border border-white/50 text-[10px] font-bold shadow-sm">
            Your restaurant
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="space-y-3">
        {activeZones.length === 0 ? (
          <p className="text-xs text-on-surface-variant italic">
            Activate at least one zone to see coverage.
          </p>
        ) : (
          activeZones.map((zone, idx) => {
            const opacity = 0.4 + (1 - idx / Math.max(activeZones.length, 1)) * 0.6;
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
      </div>
    </div>
  );
}
