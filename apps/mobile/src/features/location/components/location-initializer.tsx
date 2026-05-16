import { useEffect, useRef } from 'react';
import { useSession } from '@/src/lib/auth-client';
import { useCurrentLocation } from '../hooks/use-current-location';
import { useAddressStore } from '../store/address-store';

export function LocationInitializer() {
  const { data: session } = useSession();
  const { locate } = useCurrentLocation();
  const { setSelectedAddress, latitude } = useAddressStore();
  const isFetchingRef = useRef(false);

  useEffect(() => {
    // Only trigger if we have a session, haven't set a location yet,
    // and aren't already fetching one.
    if (session && latitude === null && !isFetchingRef.current) {
      isFetchingRef.current = true;
      
      locate().then((result) => {
        if (result) {
          setSelectedAddress(result.label, result.coords);
        }
        isFetchingRef.current = false;
      }).catch(() => {
        isFetchingRef.current = false;
      });
    }
  }, [session, latitude, locate, setSelectedAddress]);

  return null;
}
