import { ShippingAddressScreen } from '@/src/features/cart';
import { router } from 'expo-router';

export default function ShippingAddressRoute() {
  const handleContinue = () => {
    // In a real app, this would save the selected address to the cart state
    router.back();
  };

  return <ShippingAddressScreen onContinue={handleContinue} />;
}
