import { useLocalSearchParams, useRouter } from "expo-router";
import { RestaurantMenuScreen } from "@/src/features/restaurants";
import { Text, View, TouchableOpacity } from "react-native";

export default function RestaurantMenuPage() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();

  const normalizedId = Array.isArray(id) ? id[0] : id;

  if (!normalizedId) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-6">
        <Text className="text-on-surface text-lg font-bold mb-2">Invalid Restaurant</Text>
        <Text className="text-on-surface-variant text-center mb-6">We couldn't find the restaurant you were looking for.</Text>
        <TouchableOpacity 
          onPress={() => router.back()}
          className="bg-primary px-6 py-2 rounded-full"
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBack = () => {
    router.back();
  };

  const handleFavoriteToggle = (restaurantId: string) => {
    // TODO: Integrate with backend favorite API or local storage
    console.log("Toggle favorite for restaurant:", restaurantId);
  };

  const handleItemPress = (itemId: string) => {
    router.push({ pathname: '/restaurant/menu-item/[id]', params: { id: itemId } });
  };

  const handleAddItem = (itemId: string) => {
    // TODO: Integrate with cart store
    console.log("Add item to cart:", itemId);
  };

  return (
    <RestaurantMenuScreen
      restaurantId={normalizedId}
      onBack={handleBack}
      onFavoriteToggle={handleFavoriteToggle}
      onItemPress={handleItemPress}
      onAddItem={handleAddItem}
    />
  );
}
