import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm, useFormContext, FormProvider, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin, Store, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMyRestaurant, useUpdateRestaurant } from '@/features/restaurant/hooks/useRestaurants';
import {
  updateRestaurantFormSchema,
  type UpdateRestaurantFormValues,
} from '@/features/restaurant/schemas/restaurant.schema';

const DEFAULT_CENTER = { lat: 10.762622, lng: 106.660172 };

function LocationMarker() {
  const { setValue } = useFormContext<UpdateRestaurantFormValues>();
  const [position, setPosition] = useState<L.LatLng | null>(null);
  const map = useMap();

  const lat = useWatch<UpdateRestaurantFormValues, 'latitude'>({ name: 'latitude' });
  const lng = useWatch<UpdateRestaurantFormValues, 'longitude'>({ name: 'longitude' });

  // Sync position state with form values
  useEffect(() => {
    if (lat !== undefined && lng !== undefined) {
      const newPos = new L.LatLng(lat, lng);
      setPosition(newPos);
      
      // If the map center is too far from the new position (e.g. from geocoding), fly to it
      if (map.getCenter().distanceTo(newPos) > 500) {
        map.flyTo(newPos, 15);
      }
    } else {
      setPosition(new L.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng));
      setValue('latitude', DEFAULT_CENTER.lat);
      setValue('longitude', DEFAULT_CENTER.lng);
    }
  }, [lat, lng, map, setValue]);

  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      setValue('latitude', e.latlng.lat, { shouldValidate: true, shouldDirty: true });
      setValue('longitude', e.latlng.lng, { shouldValidate: true, shouldDirty: true });
    },
  });

  const markerRef = useRef<L.Marker>(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latlng = marker.getLatLng();
          setPosition(latlng);
          setValue('latitude', latlng.lat, { shouldValidate: true, shouldDirty: true });
          setValue('longitude', latlng.lng, { shouldValidate: true, shouldDirty: true });
        }
      },
    }),
    [setValue]
  );

  return position === null ? null : (
    <Marker draggable={true} eventHandlers={eventHandlers} position={position} ref={markerRef} />
  );
}

function LocateControl() {
  const map = useMap();
  const { setValue } = useFormContext<UpdateRestaurantFormValues>();
  
  const handleLocate = () => {
    map.locate().on('locationfound', function (e) {
      map.flyTo(e.latlng, map.getZoom());
      setValue('latitude', e.latlng.lat, { shouldValidate: true, shouldDirty: true });
      setValue('longitude', e.latlng.lng, { shouldValidate: true, shouldDirty: true });
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

export function StoreTab() {
  const { data: restaurant, isLoading } = useMyRestaurant();
  const { mutateAsync: updateRestaurant } = useUpdateRestaurant();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const methods = useForm<UpdateRestaurantFormValues>({
    resolver: zodResolver(updateRestaurantFormSchema),
    defaultValues: {
      name: '',
      address: '',
      phone: '',
      cuisineType: '',
    },
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = methods;

  useEffect(() => {
    if (restaurant) {
      reset({
        name: restaurant.name,
        address: restaurant.address,
        phone: restaurant.phone,
        cuisineType: restaurant.cuisineType ?? undefined,
        latitude: restaurant.latitude ?? undefined,
        longitude: restaurant.longitude ?? undefined,
      });
    }
  }, [restaurant, reset]);

  const onSubmit = async (data: UpdateRestaurantFormValues) => {
    if (!restaurant) return;
    try {
      await updateRestaurant({ id: restaurant.id, data });
      reset(data); // Reset form to new values
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } catch (error) {
      console.error('Failed to update restaurant', error);
    }
  };

  const handleGeocodeAddress = async () => {
    const address = methods.getValues('address');
    if (!address || address.length < 3) return;

    setIsGeocoding(true);
    try {
      const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`);
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].geometry.coordinates;
        methods.setValue('latitude', lat, { shouldValidate: true, shouldDirty: true });
        methods.setValue('longitude', lng, { shouldValidate: true, shouldDirty: true });
      } else {
        alert('Could not locate this address. Please refine your search or drag the pin manually.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('Error fetching location data.');
    } finally {
      setIsGeocoding(false);
    }
  };

  if (isLoading) {
    return <div className="text-on-surface-variant animate-pulse p-6">Loading store data...</div>;
  }

  if (!restaurant) {
    return (
      <div className="bg-surface-container-low rounded-3xl p-8 text-center border border-dashed border-outline-variant">
        <Store className="w-12 h-12 text-on-surface-variant/50 mx-auto mb-4" />
        <h3 className="font-headline font-bold text-xl text-on-surface mb-2">No Restaurant Linked</h3>
        <p className="text-on-surface-variant max-w-md mx-auto">
          You don't have a registered restaurant yet. Please register your business first.
        </p>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <div className="space-y-6">
        {/* Store Information */}
        <section className="bg-surface-container-lowest rounded-3xl p-6 md:p-8">
          <div className="mb-6 flex justify-between items-center border-b border-outline-variant/15 pb-4">
            <h3 className="font-headline text-lg font-bold text-on-surface">Store Profile</h3>
            {savedAt && (
              <span className="text-xs text-primary font-medium flex items-center gap-1 animate-in fade-in">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Saved
              </span>
            )}
          </div>

          <form id="store-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block font-headline text-sm font-semibold text-on-surface">Restaurant Name</label>
                <input
                  type="text"
                  {...register('name')}
                  className="w-full rounded-md border-0 bg-surface-container-high px-4 py-3 text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/30 transition-all outline-none"
                />
                {errors.name && <p className="text-xs text-error">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="block font-headline text-sm font-semibold text-on-surface">Phone Number</label>
                <input
                  type="tel"
                  {...register('phone')}
                  className="w-full rounded-md border-0 bg-surface-container-high px-4 py-3 text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/30 transition-all outline-none"
                />
                {errors.phone && <p className="text-xs text-error">{errors.phone.message}</p>}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="block font-headline text-sm font-semibold text-on-surface">Street Address</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    {...register('address')}
                    className="w-full rounded-md border-0 bg-surface-container-high px-4 py-3 text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/30 transition-all outline-none"
                  />
                  <Button 
                    type="button" 
                    variant="secondary"
                    onClick={handleGeocodeAddress}
                    disabled={isGeocoding}
                    className="h-auto px-6 whitespace-nowrap bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest border border-outline-variant/20 shadow-sm"
                  >
                    {isGeocoding ? 'Locating...' : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Locate on Map
                      </>
                    )}
                  </Button>
                </div>
                {errors.address && <p className="text-xs text-error">{errors.address.message}</p>}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="block font-headline text-sm font-semibold text-on-surface">Cuisine Type</label>
                <input
                  type="text"
                  {...register('cuisineType')}
                  placeholder="e.g. Italian, Vietnamese, Fast Food"
                  className="w-full rounded-md border-0 bg-surface-container-high px-4 py-3 text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/30 transition-all outline-none"
                />
              </div>
              
              {/* Hidden inputs for location tracking */}
              <input type="hidden" step="any" {...register('latitude', { valueAsNumber: true })} />
              <input type="hidden" step="any" {...register('longitude', { valueAsNumber: true })} />
            </div>
          </form>
        </section>

        {/* Location Picker */}
        <section className="bg-surface-container-lowest rounded-3xl p-6 md:p-8">
          <div className="mb-6 flex justify-between items-center border-b border-outline-variant/15 pb-4">
            <h3 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Pinpoint Location
            </h3>
          </div>
          
          <p className="text-sm text-on-surface-variant mb-6">
            Drag the pin or click on the map to set your exact restaurant location. This is used for delivery estimates and coverage zones.
          </p>

          <div className="relative aspect-video lg:aspect-[21/9] bg-surface-container rounded-2xl overflow-hidden shadow-sm border border-outline-variant/10 z-0">
            <MapContainer 
              center={[restaurant.latitude || DEFAULT_CENTER.lat, restaurant.longitude || DEFAULT_CENTER.lng]} 
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
        </section>

        <div className="flex justify-end pt-2">
          <button
            form="store-form"
            type="submit"
            disabled={!isDirty || isSubmitting}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold shadow-lg shadow-primary/20 hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </FormProvider>
  );
}
