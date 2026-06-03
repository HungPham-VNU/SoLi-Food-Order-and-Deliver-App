import { useLocalSearchParams, useRouter } from "expo-router";
import { RestaurantMenuScreen } from "@/src/features/restaurants";
import { useRestaurant, useRestaurantMenu } from "@/src/features/restaurants/api";
import { useGuardedAddToCart } from "@/src/features/cart";
import { Text, View, TouchableOpacity } from "react-native";

export default function RestaurantMenuPage() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();

  const normalizedId = Array.isArray(id) ? id[0] : id;

  const { data: restaurant, isLoading: isLoadingRestaurant, isError: isErrorRestaurant } = useRestaurant(normalizedId || "");
  const { data: menuData, isLoading: isLoadingMenu, isError: isErrorMenu } = useRestaurantMenu(normalizedId || "");
  const { addItem, isPending: isAddingToCart } = useGuardedAddToCart();

  if (!normalizedId) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-6">
        <Text className="text-on-surface text-lg font-bold mb-2">Invalid Restaurant</Text>
        <Text className="text-on-surface-variant text-center mb-6">We couldn&apos;t find the restaurant you were looking for.</Text>
        <TouchableOpacity 
          onPress={() => router.back()}
          className="bg-primary px-6 py-2 rounded-full"
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoadingRestaurant || isLoadingMenu) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <Text className="text-on-surface">Loading restaurant menu...</Text>
      </View>
    );
  }

  if (isErrorRestaurant || isErrorMenu) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-6">
        <Text className="text-on-surface text-lg font-bold mb-2">Error</Text>
        <Text className="text-on-surface-variant text-center mb-6">Failed to load restaurant details. Please try again.</Text>
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
    router.navigate({ pathname: '/restaurant/menu-item/[id]', params: { id: itemId } });
  };

  const handleAddItem = (itemId: string) => {
    if (!restaurant || !menuData || !Array.isArray(menuData?.data) || isAddingToCart) return;

    const menuItem = menuData.data.find((item) => item.id === itemId);
    if (!menuItem) return;

    addItem(
      {
        menuItemId: menuItem.id,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        itemName: menuItem.name,
        unitPrice: menuItem.price,
        imageUrl: menuItem.imageUrl ?? null,
        quantity: 1,
      },
      {
        successMessage: `${menuItem.name} added to cart`,
      }
    );
  };

  return (
    <RestaurantMenuScreen
      restaurantId={normalizedId}
      onBack={handleBack}
      onFavoriteToggle={handleFavoriteToggle}
      onItemPress={handleItemPress}
      onAddItem={handleAddItem}
      isAddingToCart={isAddingToCart}
    />
  );
}
