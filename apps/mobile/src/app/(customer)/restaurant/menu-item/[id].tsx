import { useLocalSearchParams, useRouter } from "expo-router";
import { MenuItemDetailScreen } from "@/src/features/restaurants";
import { useMenuItem, useRestaurant } from "@/src/features/restaurants/api";
import { useGuardedAddToCart } from "@/src/features/cart";
import type { SelectedModifierResponse } from "@/src/features/cart";
import { Text, View, TouchableOpacity, Alert } from "react-native";

export default function MenuItemDetailPage() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();

  const normalizedId = Array.isArray(id) ? id[0] : id;

  const { data: menuItem, isLoading: isLoadingItem, isError: isErrorItem } = useMenuItem(normalizedId || "");
  const { data: restaurant, isLoading: isLoadingRestaurant, isError: isErrorRestaurant } = useRestaurant(menuItem?.restaurantId || "");
  const { addItem, isPending: isAddingToCart } = useGuardedAddToCart();

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

  if (isLoadingItem || isLoadingRestaurant) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <Text className="text-on-surface">Loading item details...</Text>
      </View>
    );
  }

  if (isErrorItem || isErrorRestaurant) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-6">
        <Text className="text-on-surface text-lg font-bold mb-2">Error</Text>
        <Text className="text-on-surface-variant text-center mb-6">Failed to load item details. Please try again.</Text>
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

  const handleFavoriteToggle = (itemId: string) => {
    console.log("Toggle favorite for menu item:", itemId);
  };

  const handleAddToCart = (
    itemId: string,
    quantity: number,
    modifierSelections: Record<string, string[]>,
    isUpdate?: boolean,
    optimisticSelectedModifiers?: SelectedModifierResponse[]
  ) => {
    if (!menuItem || !restaurant || isAddingToCart) {
      if (!isAddingToCart) {
        Alert.alert("Error", "Missing item or restaurant information");
      }
      return;
    }

    // Convert modifierSelections Record<groupId, optionIds[]> to SelectedOption[]
    const selectedModifiers = Object.entries(modifierSelections ?? {}).flatMap(
      ([groupId, optionIds]) => optionIds.map(optionId => ({ groupId, optionId }))
    );

    addItem(
      {
        menuItemId: menuItem.id,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        itemName: menuItem.name,
        unitPrice: menuItem.price,
        imageUrl: menuItem.imageUrl ?? null,
        quantity,
        selectedModifiers,
        optimisticSelectedModifiers,
      },
      {
        successMessage: `${menuItem.name} ${isUpdate ? 'updated in' : 'added to'} cart`,
        onOptimisticUpdate: () => {
          router.back();
        },
      }
    );
  };

  return (
    <MenuItemDetailScreen
      itemId={normalizedId}
      onBack={handleBack}
      onFavoriteToggle={handleFavoriteToggle}
      onAddToCart={handleAddToCart}
      isAddingToCart={isAddingToCart}
    />
  );
}
