import { useLocalSearchParams, useRouter } from "expo-router";
import { ProductDetailScreen } from "@/src/features/restaurants";

export default function ProductDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  const handleAddToCart = (productId: string, quantity: number) => {
    // TODO: Integrate with Zustand cart store
    console.log("Add to cart:", productId, "qty:", quantity);
  };

  const handleFavoriteToggle = (productId: string) => {
    // TODO: Integrate with favorites store or API
    console.log("Toggle favorite:", productId);
  };

  const handleViewAllRelated = () => {
    // TODO: Navigate to related/category browse
    console.log("View all related products");
  };

  const handleRelatedProductAdd = (productId: string) => {
    // TODO: Integrate with Zustand cart store
    console.log("Add related product to cart:", productId);
  };

  const handleTabPress = (tabId: string) => {
    if (tabId === "home") {
      router.navigate("/(customer)/(tabs)/" as any);
    } else {
      router.navigate(`/(customer)/(tabs)/${tabId}` as any);
    }
  };

  return (
    <ProductDetailScreen
      productId={id ?? ""}
      onBack={handleBack}
      onAddToCart={handleAddToCart}
      onFavoriteToggle={handleFavoriteToggle}
      onViewAllRelated={handleViewAllRelated}
      onRelatedProductAdd={handleRelatedProductAdd}
      onTabPress={handleTabPress}
    />
  );
}
