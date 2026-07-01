import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { MapPin, LocateFixed, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RestaurantFormValues } from '@/features/restaurant/schemas/restaurant.schema';

// Fix for default Leaflet icon missing in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const DEFAULT_CENTER = { lat: 10.762622, lng: 106.660172 }; // Ho Chi Minh City

const reverseGeocode = async (lat: number, lng: number, setValue: any) => {
  try {
    const response = await fetch(`https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}`);
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const props = data.features[0].properties;
      const addressParts = [
        props.housenumber,
        props.street || props.name,
        props.district,
        props.city,
        props.state,
        props.country
      ].filter(Boolean);
      if (addressParts.length > 0) {
        setValue('address', addressParts.join(', '), { shouldValidate: true, shouldDirty: true });
      }
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error);
  }
};

function LocationMarker() {
  const { setValue } = useFormContext<RestaurantFormValues>();
  const map = useMap();
  const markerRef = useRef<L.Marker>(null);

  const lat = useWatch<RestaurantFormValues, 'latitude'>({ name: 'latitude' });
  const lng = useWatch<RestaurantFormValues, 'longitude'>({ name: 'longitude' });

  const hasValidCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const position = hasValidCoords
    ? new L.LatLng(lat!, lng!)
    : new L.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);

  const handleLocationUpdate = useCallback((newLat: number, newLng: number) => {
    setValue('latitude', newLat, { shouldValidate: true, shouldDirty: true });
    setValue('longitude', newLng, { shouldValidate: true, shouldDirty: true });
    reverseGeocode(newLat, newLng, setValue);
  }, [setValue]);

  useMapEvents({
    click(e) {
      handleLocationUpdate(e.latlng.lat, e.latlng.lng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const newPos = marker.getLatLng();
          handleLocationUpdate(newPos.lat, newPos.lng);
        }
      },
    }),
    [handleLocationUpdate]
  );

  useEffect(() => {
    if (hasValidCoords) {
      const newPos = new L.LatLng(lat!, lng!);
      if (map.getCenter().distanceTo(newPos) > 500) {
        map.flyTo(newPos, 15);
      }
    }
  }, [lat, lng, map, hasValidCoords]);

  return (
    <Marker 
      draggable={true} 
      eventHandlers={eventHandlers} 
      position={position} 
      ref={markerRef} 
    />
  );
}

function LocateControl() {
  const map = useMap();
  const { setValue } = useFormContext<RestaurantFormValues>();
  
  const handleLocate = () => {
    map.locate().on('locationfound', function (e: L.LocationEvent) {
      map.flyTo(e.latlng, map.getZoom());
      setValue('latitude', e.latlng.lat, { shouldValidate: true, shouldDirty: true });
      setValue('longitude', e.latlng.lng, { shouldValidate: true, shouldDirty: true });
      reverseGeocode(e.latlng.lat, e.latlng.lng, setValue);
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleLocate}
      className="p-2 bg-surface-container text-on-surface-variant rounded-lg hover:bg-surface-container-high transition-colors"
      title="Find my location"
    >
      <LocateFixed className="w-4 h-4" />
    </Button>
  );
}

export function RegisterBusinessMap() {
  return (
    <div className="xl:col-span-5 xl:sticky xl:top-12">
      <div className="bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/20 shadow-md">
        <div className="p-5 border-b border-outline-variant/10 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <span className="font-bold text-on-surface">Pinpoint Accuracy</span>
          </div>
          {/* We will render the locate button via a child component so it has access to useMap */}
        </div>

        <div className="relative aspect-[4/5] bg-surface-container z-0">
          <MapContainer 
            center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]} 
            zoom={13} 
            scrollWheelZoom={true}
            className="w-full h-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker />
            
            <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-md">
               <LocateControl />
            </div>
          </MapContainer>
        </div>

        <div className="p-6 bg-primary/5 border-t border-outline-variant/10">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Lightbulb className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              <span className="font-bold">Pro Tip:</span> Drag the pin or click on the map to set your
              restaurant's exact location. This helps couriers find you
              faster and reduces delivery times.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
