import React, { useState } from 'react';
import { View, ScrollView, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BottomNav,
  ProductDetailTopBar,
  ProductHeroSection,
  ProductInfoCard,
  RelatedProductsSection,
} from '@/src/features/restaurants/components';
import type {
  ProductDetailScreenProps,
  Product,
} from '@/src/features/restaurants/types';

// ─── Mock Data ────────────────────────────────────────────────────────────────
// In a real app this would come from a TanStack Query hook

const MOCK_PRODUCT: Product = {
  id: 'avocado-hass-organic',
  name: 'Organic Hass Avocado',
  subtitle: 'Direct from California Farms',
  price: 1.5,
  priceUnit: 'per each',
  badge: 'Organic',
  description:
    'Experience the buttery texture and rich, nutty flavor of our premium Organic Hass Avocados. Hand-picked at peak ripeness, they are naturally high in healthy fats, vitamin E, and potassium.',
  imageUrl:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAD60Djs0joxwm6m06qctKUMto6D3MPY3a6sL3dKJjxMTRv8ME4Oaw56e9853YxwuJx097N2l00DNKLpcOjOxottoBuot0itHce-_dRMp-bN-c9uG4rrft91x9XR7nITFbJmYssKLhqYtNIPN6cKxzDqX2CU-4IRdQMa3EBS4IIj6WJGQDfCLOnD18NsrLY_pBictJPOoq4AeIT_OBVRErFzH0u-UOJzECB66r25h2HOm1Rhwl_JtihuJTrsASuyGGcUIM_nFVphs7H',
  nutrition: {
    calories: 160,
    fat: '15g',
    carbs: '9g',
    protein: '2g',
  },
  relatedProducts: [
    {
      id: 'roma-tomatoes',
      name: 'Roma Tomatoes',
      price: 0.89,
      imageUrl:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuALxWFO5TVzXhpno4wo_4PEueJ_VgpdKte2ULkFMWKbr0k8_ywivoLjJ2yYPzCFj8nmN7G1vzdFr0GOcvoeu0uXg0J7HUIDcUlScKajtfJ0djVk5Uk1-57WfGRLBHqpMB2ZBn1Cn_R7xFKMaC6PL1aB8t2aEuH2Q3T4JNy5HzemZ6tTaO-3nj3RAmWXAM0Z3L9tEPtfX5G9FDNT3jDV9hSIzsaOV0o6V5XFl-13hl_ViA4VxhhQBr4srdPX6p9SNuYdik6fvwYXfPrP',
    },
    {
      id: 'red-onion',
      name: 'Red Onion',
      price: 1.2,
      imageUrl:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuCQjXJURjhH4Vh5zZ-VIS-Cq5M-7sVH4ZgmWALKzjyJqyAeN6tcUR7yUmh7VN4zsvG01n_ug8YQxr_zuHzhBUO9Mwtpn0vzZpEnFMrvhnRo1a8H1hFgusXoqcVNYVIJUMn8iywjk0pnnOKt-MXAYuWicjMCLbsK5jMoY89x3TtwUhMSSgMcBovoAZwXdyLzUwZJljjiXj8MBS4ZAwhy0haSimyENSHWE8Tie7FtsORaPjFPqXq5XdgDFVsnOSOQHjVi3MzXf0rDurj3',
    },
    {
      id: 'seedless-limes',
      name: 'Seedless Limes',
      price: 0.5,
      imageUrl:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDRaNjuvd-sueFMtnvaneC3VpzEneWnWwW870uothO2aftRPeHnKfQBcZD5lYnMEYs2eqsNiN4i1za4QTrRpuCGGJSGfty-wnpHTi9xx0ttFJHIlGRCKS-BaTC2kj8YkgJnJGNUunSPBDfNN_puRXDQsNtXXsmBcaJe84XSHGRkVh_-zS6zJcNnHi8P7lQ8yD65nZrAcPELf2zeoS5diyA9J1BZjLqqB4vGagxPxoAwz2btZbG6jO6EdsLZ5xXV1klSjUOfYWITUSFu',
    },
  ],
  isFavorited: true,
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export function ProductDetailScreen({
  productId,
  onBack,
  onFavoriteToggle,
  onAddToCart,
  onViewAllRelated,
  onRelatedProductAdd,
}: ProductDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const [quantity, setQuantity] = useState(1);
  const [isFavorited, setIsFavorited] = useState(
    MOCK_PRODUCT.isFavorited ?? false,
  );

  const product = MOCK_PRODUCT; // Replace with useQuery in real implementation

  const handleDecrement = () => setQuantity((q) => Math.max(1, q - 1));
  const handleIncrement = () => setQuantity((q) => q + 1);

  const handleFavorite = () => {
    setIsFavorited((prev) => !prev);
    onFavoriteToggle?.(product.id);
  };

  const handleAddToCart = () => {
    onAddToCart?.(product.id, quantity);
  };

  const BOTTOM_NAV_HEIGHT = 72 + insets.bottom;

  return (
    <View className="flex-1 bg-surface">
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />

      <ProductDetailTopBar
        insetsTop={insets.top}
        onBack={onBack}
        onFavoriteToggle={handleFavorite}
        isFavorited={isFavorited}
      />

      {/* ── Scrollable Content ────────────────────────────────────────────── */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 64,
          paddingBottom: BOTTOM_NAV_HEIGHT + 24,
        }}
      >
        <ProductHeroSection imageUrl={product.imageUrl} badge={product.badge} />

        <ProductInfoCard
          product={product}
          quantity={quantity}
          onDecrement={handleDecrement}
          onIncrement={handleIncrement}
          onAddToCart={handleAddToCart}
        />

        <RelatedProductsSection
          relatedProducts={product.relatedProducts}
          onViewAllRelated={onViewAllRelated}
          onRelatedProductAdd={onRelatedProductAdd}
        />
      </ScrollView>

      {/* ── Bottom Navigation ──────────────────────────────────────────────── */}
      <BottomNav insetBottom={insets.bottom} activeTab="home" />
    </View>
  );
}
