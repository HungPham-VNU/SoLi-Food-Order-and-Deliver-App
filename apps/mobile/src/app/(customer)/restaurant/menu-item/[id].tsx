import { useLocalSearchParams, useRouter } from "expo-router";
import { MenuItemDetailScreen } from "@/src/features/restaurants";
import { Text, View, TouchableOpacity } from "react-native";

export default function MenuItemDetailPage() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();

  const normalizedId = Array.isArray(id) ? id[0] : id;

  if (!normalizedId) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-6">
        <Text className="text-on-surface text-lg font-bold mb-2">Item Not Found</Text>
        <Text className="text-on-surface-variant text-center mb-6">The menu item could not be found.</Text>
        <TouchableOpacity 
          onPress={() => router.back()}
          className="bg-primary px-6 py-2 rounded-full"
          accessibilityRole="button"
          accessibilityLabel="Go back to restaurant menu"
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBack = () => {
    router.back();
  };

  const handleFavoriteToggle = (itemId: string) => {
    console.log("Toggle favorite for menu item:", itemId);
  };

  const handleAddToCart = (itemId: string, quantity: number, modifierSelections: Record<string, string[]>) => {
    // TODO: Integrate with cart store
    console.log("Add menu item to cart:", itemId, "qty:", quantity, "modifiers:", modifierSelections);
  };

  return (
    <MenuItemDetailScreen
      itemId={normalizedId}
      onBack={handleBack}
      onFavoriteToggle={handleFavoriteToggle}
      onAddToCart={handleAddToCart}
    />
  );
}
