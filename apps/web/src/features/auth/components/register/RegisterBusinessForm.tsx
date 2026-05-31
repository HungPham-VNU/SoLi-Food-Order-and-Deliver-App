import {
  Store,
  UtensilsCrossed,
  Contact,
  Phone,
  AtSign,
  MapPin,
  Search,
} from 'lucide-react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RestaurantFormValues } from '@/features/restaurant/schemas/restaurant.schema';

export function RegisterBusinessForm() {
  const {
    register,
    formState: { errors },
    getValues,
    setValue,
  } = useFormContext<RestaurantFormValues>();
  
  const [isGeocoding, setIsGeocoding] = useState(false);

  const handleGeocodeAddress = async () => {
    const address = getValues('address');
    if (!address || address.length < 3) return;

    setIsGeocoding(true);
    try {
      const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`);
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].geometry.coordinates;
        setValue('latitude', lat, { shouldValidate: true, shouldDirty: true });
        setValue('longitude', lng, { shouldValidate: true, shouldDirty: true });
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

  return (
    <div className="xl:col-span-7 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight mb-3 font-headline">
          Describe your restaurant
        </h1>
        <p className="text-on-surface-variant">
          Fill in the form below to describe your restaurant. The information
          will be used to verify your restaurant.
        </p>
      </div>

      <div className="space-y-6">
        {/* Restaurant Identification */}
        <Card className="bg-surface-container-lowest border border-outline-variant/20 shadow-sm rounded-2xl ring-0">
          <CardHeader className="border-b border-outline-variant/10">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-surface-container rounded-lg">
                <Store className="w-6 h-6 text-on-surface-variant" />
              </div>
              <span className="font-bold text-on-surface font-headline text-base">
                Restaurant Identification
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="restaurantName"
                className="text-sm font-semibold text-on-surface-variant font-headline"
              >
                Restaurant Name
              </Label>
              <div className="relative">
                <UtensilsCrossed className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 w-5 h-5 pointer-events-none z-10" />
                <Input
                  id="restaurantName"
                  className="w-full pl-11 pr-4 py-3 h-auto bg-surface-container border border-outline-variant/20 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus-visible:bg-surface-container-lowest transition-all font-headline"
                  placeholder="e.g. The Green Bistro"
                  type="text"
                  {...register('name')}
                />
              </div>
              {errors.name && (
                <p className="text-xs text-destructive ml-1">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="cuisineType"
                className="text-sm font-semibold text-on-surface-variant font-headline"
              >
                Cuisine Type (Optional)
              </Label>
              <div className="relative">
                <UtensilsCrossed className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 w-5 h-5 pointer-events-none z-10" />
                <Input
                  id="cuisineType"
                  className="w-full pl-11 pr-4 py-3 h-auto bg-surface-container border border-outline-variant/20 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus-visible:bg-surface-container-lowest transition-all font-headline"
                  placeholder="e.g. Vietnamese, Italian"
                  type="text"
                  {...register('cuisineType')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Contact */}
        <Card className="bg-surface-container-lowest border border-outline-variant/20 shadow-sm rounded-2xl ring-0">
          <CardHeader className="border-b border-outline-variant/10 pb-4">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-surface-container rounded-lg">
                <Contact className="w-6 h-6 text-on-surface-variant" />
              </div>
              <span className="font-bold text-on-surface font-headline text-base">
                Business Contact
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label
                  htmlFor="storePhone"
                  className="text-sm font-semibold text-on-surface-variant"
                >
                  Store Phone Number
                </Label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 w-5 h-5 pointer-events-none z-10" />
                  <Input
                    id="storePhone"
                    className="w-full pl-11 pr-4 py-3 h-auto bg-surface-container border border-outline-variant/20 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus-visible:bg-surface-container-lowest transition-all"
                    placeholder="+84 (0) 000-0000"
                    type="tel"
                    {...register('phone')}
                  />
                </div>
                {errors.phone && (
                  <p className="text-xs text-destructive ml-1">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="businessEmail"
                  className="text-sm font-semibold text-on-surface-variant"
                >
                  Public Business Email (Optional)
                </Label>
                <div className="relative">
                  <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 w-5 h-5 pointer-events-none z-10" />
                  <Input
                    id="businessEmail"
                    className="w-full pl-11 pr-4 py-3 h-auto bg-surface-container border border-outline-variant/20 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus-visible:bg-surface-container-lowest transition-all"
                    placeholder="contact@restaurant.com"
                    type="email"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address Section */}
        <Card className="bg-surface-container-lowest border border-outline-variant/20 shadow-sm rounded-2xl ring-0">
          <CardHeader className="border-b border-outline-variant/10 pb-4">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-surface-container rounded-lg">
                <MapPin className="w-6 h-6 text-on-surface-variant" />
              </div>
              <span className="font-bold text-on-surface font-headline text-base">
                Store Address
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <Label
                htmlFor="streetAddress"
                className="text-sm font-semibold text-on-surface-variant"
              >
                Full Address
              </Label>
              <div className="flex gap-2">
                <Input
                  id="streetAddress"
                  className="w-full px-4 py-3 h-auto bg-surface-container border border-outline-variant/20 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus-visible:bg-surface-container-lowest transition-all"
                  placeholder="123 Nguyen Hue, District 1, Ho Chi Minh City"
                  type="text"
                  {...register('address')}
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
                      Locate
                    </>
                  )}
                </Button>
              </div>
              {errors.address && (
                <p className="text-xs text-destructive ml-1">{errors.address.message}</p>
              )}
            </div>
            
            {/* Hidden inputs for location tracking from Map */}
            <input type="hidden" step="any" {...register('latitude', { valueAsNumber: true })} />
            <input type="hidden" step="any" {...register('longitude', { valueAsNumber: true })} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
