import { PaymentScreen } from '@/src/features/cart';
import { router } from 'expo-router';

export default function PaymentRoute() {
  const handleContinue = () => {
    // In a real app, this would save the selected payment method to the cart state
    router.back();
  };

  return <PaymentScreen onContinue={handleContinue} />;
}
