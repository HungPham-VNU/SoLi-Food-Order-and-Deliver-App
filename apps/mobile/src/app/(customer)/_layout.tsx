import { Stack } from 'expo-router';

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="cart" />
      <Stack.Screen name="checkout/delivery-address" />
      <Stack.Screen name="checkout/payment" />
      <Stack.Screen name="checkout/order-review" />
      <Stack.Screen name="product/[id]" />
      <Stack.Screen name="address-selection" />
    </Stack>
  );
}
