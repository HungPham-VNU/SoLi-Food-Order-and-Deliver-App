import { Redirect, useLocalSearchParams } from "expo-router";

export default function ProductDetailPage() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const normalizedId = Array.isArray(id) ? id[0] : id;

  if (!normalizedId) {
    return <Redirect href="/(customer)/(tabs)" />;
  }

  return (
    <Redirect
      href={{
        pathname: "/restaurant/menu-item/[id]",
        params: { id: normalizedId },
      }}
    />
  );
}
